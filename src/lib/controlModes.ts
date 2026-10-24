import type { Mode } from '../domain/types'

/** Product labels; engine/export mode keys remain stable for replay compatibility. */
export const CONTROL_LABELS: Record<Mode, string> = { fixed: 'Adaptive', optimized: 'Dynamic' }
export const DEFAULT_CONTROL_MODE: Mode = 'fixed'
