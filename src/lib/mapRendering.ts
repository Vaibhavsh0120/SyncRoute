export type VehicleDetail = 'compact' | 'full'

export function vehicleDetail(zoom: number, moving: boolean): VehicleDetail {
  return moving || zoom < 16.5 ? 'compact' : 'full'
}

/** New snapshots respect the upload budget too; settled/paused frames flush. */
export function vehicleFrameDue({ changed, elapsed, moving, playing }: {
  changed: boolean; elapsed: number; moving: boolean; playing: boolean
}) {
  return changed && (!playing || elapsed >= (moving ? 100 : 50))
}

export function nextMapView(flat: boolean, saved: { pitch: number; bearing: number }) {
  return flat ? { pitch: 0, bearing: 0 } : { pitch: saved.pitch > 5 ? saved.pitch : 55, bearing: saved.bearing }
}
