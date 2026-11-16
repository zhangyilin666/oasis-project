import type { DivinationInput } from './index'
import type { DivinationReading, DivinationSubmission } from '@/api/divination'

export type ReadingPhase = 'idle' | 'submitting' | 'loading' | 'watching' | 'completed' | 'failed' | 'submit-error' | 'read-error' | 'paused'
export interface ReadingSessionState {
  phase: ReadingPhase
  reading: DivinationReading | null
  error: string
}
export interface ReadingSessionDependencies {
  create(payload: DivinationSubmission): Promise<DivinationReading>
  read(id: number): Promise<DivinationReading>
  newRequestId(): string
  onChange(state: ReadingSessionState): void
  schedule?: (callback: () => void, delay: number) => unknown
  unschedule?: (handle: unknown) => void
  pollDelayMs?: number
  maxPolls?: number
}

/** One fixed cast per session. Only explicit submit/retry may POST; polling is read-only. */
export function createReadingSession(dependencies: ReadingSessionDependencies) {
  let state: ReadingSessionState = { phase: 'idle', reading: null, error: '' }
  let submission: DivinationSubmission | null = null
  let generation = 0
  let timer: unknown
  let polls = 0
  let visible = true
  let disposed = false
  const schedule = dependencies.schedule || ((callback, delay) => setTimeout(callback, delay))
  const unschedule = dependencies.unschedule || (handle => clearTimeout(handle as ReturnType<typeof setTimeout>))
  const isCurrent = (token: number) => token === generation && !disposed
  const isBusy = () => state.phase === 'submitting' || state.phase === 'loading'
  const isPending = (reading: DivinationReading | null) => reading?.status === 'pending' || reading?.status === 'processing'
  const text = (error: unknown) => error instanceof Error ? error.message : '网络请求没有完成，请稍后重试。'
  function update(patch: Partial<ReadingSessionState>) {
    state = { ...state, ...patch }
    dependencies.onChange({ ...state })
  }
  function stopTimer() { if (timer !== undefined) unschedule(timer); timer = undefined }
  function queuePoll() {
    stopTimer()
    if (!visible || disposed || !isPending(state.reading)) return
    if (polls >= (dependencies.maxPolls ?? 72)) {
      update({ phase: 'paused', error: '解读仍在云端处理中。可以稍后刷新，或从云端记录回看。' })
      return
    }
    timer = schedule(() => { timer = undefined; polls++; void refresh(false) }, dependencies.pollDelayMs ?? 2500)
  }
  function accept(reading: DivinationReading) {
    if (reading.status === 'completed' && !reading.analysis) {
      update({ reading, phase: 'read-error', error: '解读内容不完整，请刷新这条云端记录。' })
      return
    }
    update({ reading, phase: isPending(reading) ? 'watching' : reading.status === 'completed' ? 'completed' : 'failed', error: reading.status === 'failed' ? reading.error_message || '这次 AI 解读没有完成，卦象已保留。' : '' })
    if (isPending(reading)) queuePoll()
  }
  async function send(): Promise<DivinationReading | null> {
    if (!submission || isBusy() || disposed) return null
    stopTimer()
    const token = ++generation
    const payload = JSON.parse(JSON.stringify(submission)) as DivinationSubmission
    update({ phase: 'submitting', error: '' })
    try {
      const reading = await dependencies.create(payload)
      if (!isCurrent(token)) return null
      polls = 0
      accept(reading)
      return reading
    } catch (error) {
      if (isCurrent(token)) update({ phase: 'submit-error', error: text(error) })
      return null
    }
  }
  async function submit(input: DivinationInput, ruleVersion: string): Promise<DivinationReading | null> {
    if (disposed || isBusy() || isPending(state.reading) || state.phase === 'completed') return null
    // A failed network response has an unknown outcome: reuse the previous idempotency key.
    if (submission && state.phase === 'submit-error') return send()
    if (state.reading?.status === 'failed') return null // Explicit retry() starts a new accepted task.
    try {
      submission = { request_id: dependencies.newRequestId(), input: JSON.parse(JSON.stringify(input)) as DivinationInput, rule_version: ruleVersion }
    } catch (error) { update({ phase: 'submit-error', error: text(error) }); return null }
    return send()
  }
  async function refresh(resetPolls = true): Promise<DivinationReading | null> {
    if (disposed || isBusy() || !state.reading) return null
    if (resetPolls) polls = 0
    stopTimer()
    const id = state.reading.reading_id
    const token = ++generation
    update({ phase: 'loading', error: '' })
    try {
      const reading = await dependencies.read(id)
      if (!isCurrent(token)) return null
      accept(reading)
      return reading
    } catch (error) {
      if (isCurrent(token)) update({ phase: 'read-error', error: text(error) })
      return null
    }
  }
  async function open(id: number): Promise<DivinationReading | null> {
    invalidate()
    const token = generation
    update({ phase: 'loading', error: '' })
    try {
      const reading = await dependencies.read(id)
      if (!isCurrent(token)) return null
      submission = { request_id: '', input: JSON.parse(JSON.stringify(reading.input)) as DivinationInput, rule_version: reading.rule_version }
      polls = 0
      accept(reading)
      return reading
    } catch (error) {
      if (isCurrent(token)) update({ phase: 'read-error', error: text(error) })
      return null
    }
  }
  async function retry(): Promise<DivinationReading | null> {
    if (disposed || isBusy()) return null
    if (state.phase === 'submit-error' && submission) return send()
    if (state.reading?.status !== 'failed') return refresh()
    try {
      submission = { request_id: dependencies.newRequestId(), input: JSON.parse(JSON.stringify(state.reading.input)) as DivinationInput, rule_version: state.reading.rule_version }
    } catch (error) { update({ phase: 'submit-error', error: text(error) }); return null }
    return send()
  }
  function invalidate() {
    generation++
    stopTimer()
    submission = null
    polls = 0
    update({ phase: 'idle', reading: null, error: '' })
  }
  function pause() {
    visible = false
    generation++
    stopTimer()
    if (state.phase === 'submitting') update({ phase: 'submit-error', error: '提交结果尚未确认。返回后可用同一次请求继续确认，或查看云端记录。' })
    else if (isPending(state.reading) || state.phase === 'loading') update({ phase: 'paused', error: '' })
  }
  function resume() {
    visible = true
    if (state.phase === 'paused' && state.reading) void refresh()
  }
  function dispose() { pause(); disposed = true }
  return { submit, retry, refresh, open, invalidate, pause, resume, dispose, getState: () => ({ ...state }) }
}

export function createDivinationRequestId(): string {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.getRandomValues) throw new Error('当前环境无法安全生成请求标识，请用系统浏览器通过 HTTPS 打开。')
  if (cryptoApi.randomUUID) return cryptoApi.randomUUID()
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
