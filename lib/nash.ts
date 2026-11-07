export const MICROSTX_PER_STX = 1_000_000

export type NashInput = {
  deltaR: number
  deltaRNS: number
  epsilon?: number
}

export function calculateNashRate({ deltaR, deltaRNS, epsilon = 1 }: NashInput) {
  const safeDeltaR = Math.abs(Number.isFinite(deltaR) ? deltaR : 0)
  const safeDeltaRNS = Math.abs(Number.isFinite(deltaRNS) ? deltaRNS : 0)
  const safeEpsilon = Math.max(1, Math.abs(Number.isFinite(epsilon) ? epsilon : 1))
  const rate = (safeDeltaR ** 2) / (Math.abs(safeDeltaR - safeDeltaRNS) + safeEpsilon) - safeDeltaR
  return Math.round(rate)
}

export function getEpoch(blockHeight: number) {
  return Math.floor(Math.max(0, blockHeight) / 144)
}

export function toStx(microStx: number) {
  return microStx / MICROSTX_PER_STX
}
