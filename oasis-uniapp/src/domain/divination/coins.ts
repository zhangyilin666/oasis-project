import { validateDivinationInput, type CoinDivinationInput, type CoinValue, type LineValue, type QuestionContext } from './index'

/** Injectable only for deterministic rule tests; production uses the platform CSPRNG. */
export type FillRandomBytes = (bytes: Uint8Array) => void

function platformRandom(bytes: Uint8Array): void {
  const provider = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (!provider || typeof provider.getRandomValues !== 'function') {
    throw new Error('当前运行环境不支持安全随机起卦，请在新版手机浏览器打开，或选择梅花时间法、手录方式。')
  }
  provider.getRandomValues(bytes)
}

/** A new draw occurs only when explicitly called, never during calculation/replay. */
export function generateCoinInput(context: QuestionContext, fillRandom: FillRandomBytes = platformRandom): CoinDivinationInput {
  // Validate the complete time boundary before consuming randomness.
  validateDivinationInput({ ...context, method: 'liuyao-coins', lines: [6, 6, 6, 6, 6, 6], coins: Array.from({ length: 6 }, () => [2, 2, 2]) })
  const bytes = new Uint8Array(18)
  try { fillRandom(bytes) } catch (error) {
    if (error instanceof Error && error.message.includes('不支持安全随机')) throw error
    throw new Error('这次未能取得安全随机数，尚未生成卦象。请重试或改用其他起卦方式。')
  }
  // Low bit is balanced for all 256 byte values: 128 map to each coin face.
  const coins: CoinValue[][] = Array.from({ length: 6 }, (_, line) =>
    Array.from({ length: 3 }, (_, coin) => 2 + (bytes[line * 3 + coin] & 1) as CoinValue),
  )
  const lines = coins.map(group => group.reduce<number>((sum, coin) => sum + coin, 0) as LineValue)
  return validateDivinationInput({ ...context, method: 'liuyao-coins', lines, coins }) as CoinDivinationInput
}
