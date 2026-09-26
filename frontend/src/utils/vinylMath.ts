export const TIP_X = 0.15
export const TIP_Y = 0.98
export const PIVOT_X = 0.72
export const PIVOT_Y = 0.15
export const DISC_R = 0.705
export const LABEL_R = 0.17

export const CENTER_X = 0.6
export const CENTER_Y = 0.50

export const START_ANGLE = -53
export const SWING_RANGE = 36

export function calcNaturalTipAngle(w: number, h: number): number {
  if (!w || !h) return 0
  return Math.atan2((TIP_Y - PIVOT_Y) * h, (TIP_X - PIVOT_X) * w) * (180 / Math.PI)
}

export function calcNeedleTip(
  pivotPos: { x: number; y: number },
  angleDeg: number,
  needleSize: { w: number; h: number }
): { x: number; y: number } {
  const { w, h } = needleSize
  const θ = angleDeg * (Math.PI / 180)
  const dx0 = (TIP_X - PIVOT_X) * w
  const dy0 = (TIP_Y - PIVOT_Y) * h
  return {
    x: pivotPos.x + dx0 * Math.cos(θ) - dy0 * Math.sin(θ),
    y: pivotPos.y + dx0 * Math.sin(θ) + dy0 * Math.cos(θ)
  }
}

export function calcRestAngle(
  cw: number,
  ch: number,
  nw: number,
  nh: number
): { angle: number; pivot: { x: number; y: number } } {
  const pivot = { x: cw * 0.8, y: ch * 0 }
  if (!nw || !nh) return { angle: 0, pivot }
  const naturalTipAngle = calcNaturalTipAngle(nw, nh)
  const restX = cw * 1.25
  const restY = ch * 0.85
  const angle = Math.atan2(restY - pivot.y, restX - pivot.x) * (180 / Math.PI) - naturalTipAngle
  return { angle, pivot }
}

export function getAngleForProgress(progressMs: number, durationMs: number): number {
  if (durationMs <= 0) return START_ANGLE
  const percent = Math.min(1, Math.max(0, progressMs / durationMs))
  return START_ANGLE + SWING_RANGE * percent
}

export function calcTrackProgress(tipPos: { x: number; y: number }, cw: number, ch: number): number {
  const centerX = cw * CENTER_X
  const centerY = ch * CENTER_Y
  const dist = Math.hypot(tipPos.x - centerX, tipPos.y - centerY)

  const outerR = (cw / 2) * DISC_R
  const innerR = (cw / 2) * LABEL_R
  const p = (outerR - dist) / (outerR - innerR)

  return Math.min(100, Math.max(0, p * 100))
}

export function isNeedleOnDisc(tipPos: { x: number; y: number }, cw: number, ch: number): boolean {
  const centerX = cw * CENTER_X
  const centerY = ch * CENTER_Y
  const dist = Math.hypot(tipPos.x - centerX, tipPos.y - centerY)

  const outerR = (cw / 2) * DISC_R
  const innerR = (cw / 2) * LABEL_R

  return dist <= outerR && dist > innerR
}
