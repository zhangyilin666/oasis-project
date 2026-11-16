/** The API persists UTC timestamps without a timezone suffix on MySQL. */
export function formatReportDate(raw: string | null | undefined): string {
 if (!raw) return ''
 const date = new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : raw + 'Z')
 if (Number.isNaN(date.getTime())) return raw
 return date.toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
export function reportName(info: string): string {
 return info.split(/\s+\d{4}-\d{2}-\d{2}/)[0] || '我的报告'
}
export function reportBirth(info: string): string {
 const match = info.match(/\d{4}-\d{2}-\d{2}[\s\S]*/)
 return match ? match[0] : info
}

