export function advanceClock(elapsedMs: number, speed: number, remainder: number) {
  const elapsed = Math.max(0, elapsedMs) * speed / 1000 + remainder
  const ticks = Math.floor(elapsed + 1e-9)
  return { ticks, remainder: Math.max(0, elapsed - ticks) }
}

/** Pausing settles at the current tick even inside the normal 30 fps limit. */
export function interpolationFrameDue(interpolation: number, previousInterpolation: number | undefined, elapsedMs: number) {
  return interpolation !== previousInterpolation && (interpolation === 1 || elapsedMs >= 32)
}
