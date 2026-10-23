export const number = (value: number, digits = 0) => Number.isFinite(value)
  ? value.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  : '—'

export function clockTime(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds))
  return `${Math.floor(rounded / 60).toString().padStart(2, '0')}:${(rounded % 60).toString().padStart(2, '0')}`
}
