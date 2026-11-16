const DEVICE_CODE = /^(?:[a-f0-9]{32}|[a-f0-9-]{36})$/i

export function formatRecoveryCode(userId: number, deviceId: string | null): string {
  if (!Number.isSafeInteger(userId) || userId < 0 || !deviceId || !DEVICE_CODE.test(deviceId)) {
    throw new Error('账号信息暂不完整，请稍后重试')
  }
  return `mlyz${userId}-${deviceId}`
}

export function parseRecoveryCode(code: string): { deviceId: string; userId: number } {
  const trimmed = code.trim()
  const branded = /^mlyz(0|[1-9]\d*)-(.+)$/i.exec(trimmed)
  if (!branded) throw new Error('请使用 mlyz 和账号 ID 开头的新版恢复码')
  const deviceId = branded[2]
  const userId = Number(branded[1])
  if (!DEVICE_CODE.test(deviceId) || !Number.isSafeInteger(userId)) {
    throw new Error('恢复码格式不正确，请完整粘贴新版恢复码')
  }
  return { deviceId, userId }
}
