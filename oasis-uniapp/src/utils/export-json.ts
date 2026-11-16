// #ifdef H5
let activeExport: { panel: HTMLElement; url: string; trigger: HTMLElement | null } | null = null

function closeExport(restoreFocus: boolean) {
  if (!activeExport) return
  const { panel, url, trigger } = activeExport
  activeExport = null
  panel.remove()
  URL.revokeObjectURL(url)
  if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true })
}

function offerBrowserExport(json: string, filename: string) {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const trigger = focused && activeExport?.panel.contains(focused) ? activeExport.trigger : focused
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }))
  const panel = document.createElement('section')
  panel.className = 'oasis-json-export'
  panel.setAttribute('role', 'region')
  panel.setAttribute('aria-labelledby', 'json-export-title')
  panel.setAttribute('aria-describedby', 'json-export-description')
  panel.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:420px;max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);overflow:auto;margin-left:auto;box-sizing:border-box;z-index:2147483000;padding:18px;border:1px solid #d8cce4;border-radius:16px;background:#fff;color:#382f49;box-shadow:0 8px 32px #30223c33;font:14px/1.65 system-ui,sans-serif;overflow-wrap:anywhere;'
  const style = document.createElement('style')
  style.textContent = '.oasis-json-export a:focus,.oasis-json-export button:focus,.oasis-json-export textarea:focus{outline:3px solid #72548f;outline-offset:3px}'
  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;'
  const title = document.createElement('h2')
  title.id = 'json-export-title'
  title.textContent = 'JSON 导出'
  title.style.cssText = 'font-size:17px;line-height:1.5;margin:0;'
  const makeButton = (text: string) => {
    const button = document.createElement('button')
    button.type = 'button'; button.textContent = text
    button.style.cssText = 'min-height:44px;padding:9px 12px;border:1px solid #cfc0df;border-radius:9px;background:#f4eff9;color:#503c67;font:inherit;cursor:pointer;white-space:normal;'
    return button
  }
  const close = makeButton('关闭')
  close.setAttribute('aria-label', '关闭导出面板')
  const description = document.createElement('p')
  description.id = 'json-export-description'
  description.textContent = '已发起下载，请检查浏览器下载列表或文件保存位置；若未开始，可点击下方链接。此页面无法确认下载是否完成。'
  description.style.cssText = 'margin:12px 0;'
  const file = document.createElement('p')
  file.textContent = filename
  file.style.cssText = 'margin:8px 0;color:#695773;font-size:12px;overflow-wrap:anywhere;'
  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;'
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.target = '_blank'; link.rel = 'noopener noreferrer'
  link.textContent = '再次下载文件'
  link.style.cssText = 'display:inline-flex;align-items:center;box-sizing:border-box;min-height:44px;padding:9px 4px;color:#60417e;text-decoration:underline;'
  const copy = makeButton('复制 JSON')
  const status = document.createElement('p')
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
  status.style.cssText = 'margin:10px 0 0;'
  const manual = document.createElement('textarea')
  manual.readOnly = true; manual.hidden = true
  manual.setAttribute('aria-label', 'JSON 备用文本，可手动复制')
  manual.style.cssText = 'box-sizing:border-box;width:100%;min-height:120px;margin-top:12px;padding:10px;border:1px solid #cfc0df;border-radius:8px;font:12px/1.5 monospace;color:#382f49;background:#faf8fc;'
  const dismiss = () => { if (activeExport?.panel === panel) closeExport(true) }
  close.addEventListener('click', dismiss)
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); dismiss() } })
  copy.addEventListener('click', async () => {
    if (copy.disabled) return
    copy.disabled = true; status.textContent = '正在复制 JSON…'
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(json)
      if (activeExport?.panel === panel) status.textContent = 'JSON 已复制，请粘贴并保存为 UTF-8 文件。'
    } catch {
      if (activeExport?.panel === panel) {
        status.textContent = '复制未成功。可以重试、使用下载链接，或手动复制下方 JSON 文本。'
        manual.value = json; manual.hidden = false; manual.focus(); manual.select()
      }
    } finally { copy.disabled = false }
  })
  header.append(title, close); actions.append(link, copy)
  panel.append(style, header, description, file, actions, status, manual)
  closeExport(false)
  activeExport = { panel, url, trigger }
  try {
    document.body.appendChild(panel)
    link.focus({ preventScroll: true })
    link.click()
  } catch (error) { closeExport(true); throw error }
}
// #endif

/** User-initiated export only. No upload, storage read, or automatic H5 clipboard write. */
export async function exportJson(value: unknown, filename: string): Promise<'download' | 'clipboard'> {
  const json = JSON.stringify(value, null, 2)
  if (typeof json !== 'string') throw new Error('没有可导出的 JSON 内容。')
  // #ifdef H5
  offerBrowserExport(json, filename.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'oasis-export.json')
  return 'download'
  // #endif
  // #ifndef H5
  await new Promise<void>((resolve, reject) => uni.setClipboardData({ data: json, success: () => resolve(), fail: () => reject(new Error('复制失败，请重试')) }))
  return 'clipboard'
  // #endif
}
