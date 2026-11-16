export const PRACTICE_RULE_VERSION = 'practice-timer-v1'
export const MAX_PRACTICE_NOTE_LENGTH = 2000
export type PracticeTopicId = 'quiet-seat' | 'notice-sounds' | 'gather-thoughts'
export type PracticeStatus = 'running' | 'paused' | 'completed'
export interface PracticeTopic { id: PracticeTopicId; title: string; introduction: string; guidance: string[] }
export interface PracticeDraft {
  schemaVersion: 1
  ruleVersion: typeof PRACTICE_RULE_VERSION
  id: string
  topic: PracticeTopic
  durationMinutes: number
  status: PracticeStatus
  startedAt: number
  elapsedMs: number
  anchorAt: number | null
  lastObservedAt: number
  completedAt: number | null
  completionReason: 'elapsed' | 'early' | null
  note: string
  clockRollbackCount: number
  lastClockRollbackAt: number | null
}

export const PRACTICE_TOPICS: readonly PracticeTopic[] = [
  {
    id: 'quiet-seat', title: '安静坐一会', introduction: '给自己留一小段不必赶路的时间。',
    guidance: ['找一个舒服的位置坐下，让双脚与手自然安放。', '把视线放在眼前一处，留意此刻身体与座椅接触的感觉。', '思绪走远时，知道自己刚才想到了什么，再把注意放回这里。'],
  },
  {
    id: 'notice-sounds', title: '留意周围声音', introduction: '听听日常环境里，那些平时略过的声音。',
    guidance: ['先留意一个离你较近的声音，不急着为它命名。', '再试着听一个较远的声音，观察它持续、停顿或变化的样子。', '没有明显声音时，也可以留意这段安静，不需要寻找特别的体验。'],
  },
  {
    id: 'gather-thoughts', title: '整理今日思绪', introduction: '为今天的想法留一张小纸条。',
    guidance: ['想一想今天最占据注意的一件事，先用一句话描述它。', '分开看看：发生了什么、自己怎么理解它、还想知道什么。', '在下方记下愿意留下的一点，或一个可以慢慢处理的小步骤。'],
  },
]

function clock(now: number): number {
  if (!Number.isSafeInteger(now) || now < 0 || now > 8640000000000000) throw new Error('无法读取有效的系统时间，请检查设备时间。')
  return now
}
export function practiceNote(note: unknown): string {
  if (typeof note !== 'string' || note.length > MAX_PRACTICE_NOTE_LENGTH) throw new Error(`练习笔记最多 ${MAX_PRACTICE_NOTE_LENGTH} 字。`)
  return note
}

export function createPracticeDraft(input: { topicId: PracticeTopicId; durationMinutes: number }, now = Date.now(), id = `practice-${now}-${Math.random().toString(36).slice(2, 10)}`): PracticeDraft {
  clock(now)
  const topic = PRACTICE_TOPICS.find(item => item.id === input?.topicId)
  if (!topic) throw new Error('请选择一个练习主题。')
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 60) throw new Error('练习时长支持 1–60 分钟的整数。')
  if (typeof id !== 'string' || !id || id.length > 100) throw new Error('练习标识无效。')
  return {
    schemaVersion: 1, ruleVersion: PRACTICE_RULE_VERSION, id,
    topic: { ...topic, guidance: [...topic.guidance] }, durationMinutes: input.durationMinutes,
    status: 'running', startedAt: now, elapsedMs: 0, anchorAt: now, lastObservedAt: now,
    completedAt: null, completionReason: null, note: '', clockRollbackCount: 0, lastClockRollbackAt: null,
  }
}

/** Date.now anchors include time spent in the background; interval ticks only refresh the view. */
export function projectPracticeDraft(draft: PracticeDraft, now = Date.now()): PracticeDraft {
  clock(now)
  if (draft.status !== 'running') return { ...draft }
  if (now < draft.lastObservedAt) {
    return { ...draft, status: 'paused', anchorAt: null, lastObservedAt: now, clockRollbackCount: draft.clockRollbackCount + 1, lastClockRollbackAt: now }
  }
  const target = draft.durationMinutes * 60000
  const anchor = draft.anchorAt as number
  const elapsedMs = Math.min(target, draft.elapsedMs + now - anchor)
  if (elapsedMs >= target) {
    return { ...draft, status: 'completed', elapsedMs: target, anchorAt: null, lastObservedAt: now, completedAt: anchor + target - draft.elapsedMs, completionReason: 'elapsed' }
  }
  return { ...draft, elapsedMs, anchorAt: now, lastObservedAt: now }
}

export function pausePracticeDraft(draft: PracticeDraft, now = Date.now()): PracticeDraft {
  const current = projectPracticeDraft(draft, now)
  return current.status === 'running' ? { ...current, status: 'paused', anchorAt: null } : current
}

export function resumePracticeDraft(draft: PracticeDraft, now = Date.now()): PracticeDraft {
  clock(now)
  if (draft.status === 'completed') throw new Error('这次练习已结束，请先保存记录，再开始新的练习。')
  if (draft.status === 'running') return projectPracticeDraft(draft, now)
  return { ...draft, status: 'running', anchorAt: now, lastObservedAt: now }
}

export function finishPracticeDraft(draft: PracticeDraft, now = Date.now()): PracticeDraft {
  const current = projectPracticeDraft(draft, now)
  if (current.status === 'completed') return current
  return { ...current, status: 'completed', anchorAt: null, lastObservedAt: now, completedAt: now, completionReason: 'early' }
}

export function updatePracticeNote(draft: PracticeDraft, note: string): PracticeDraft { return { ...draft, note: practiceNote(note) } }
export function practiceRemainingMs(draft: PracticeDraft): number { return Math.max(0, draft.durationMinutes * 60000 - draft.elapsedMs) }
export function formatPracticeTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
