export function advanceClock(elapsedMs: number, speed: number, remainder: number) {
  const elapsed = Math.max(0, elapsedMs) * speed / 1000 + remainder
  const ticks = Math.floor(elapsed + 1e-9)
  return { ticks, remainder: Math.max(0, elapsed - ticks) }
}
