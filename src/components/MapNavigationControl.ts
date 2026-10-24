import { NavigationControl } from 'maplibre-gl'
import type { Map as LibreMap } from 'maplibre-gl'
import { nextMapView } from '../lib/mapRendering'

/** Keep native zoom/drag controls; make the third button a reversible view. */
export class MapNavigationControl extends NavigationControl {
  private removeToggle?: () => void

  override onAdd(map: LibreMap): HTMLElement {
    const group = super.onAdd(map)
    const button = group.querySelector<HTMLButtonElement>('.maplibregl-ctrl-compass')
    if (!button) return group
    button.classList.add('traffic-map-view-toggle')
    const label = document.createElement('span')
    label.className = 'traffic-map-view-label'
    label.setAttribute('aria-hidden', 'true')
    button.append(label)
    let saved = { pitch: map.getPitch() > 5 ? map.getPitch() : 55, bearing: map.getBearing() }
    let pendingFlat: boolean | null = null
    const showTarget = (flat: boolean) => {
      label.textContent = flat ? '3D' : '2D'
      button.title = `Switch to ${flat ? '3D' : '2D'} view`
      button.setAttribute('aria-label', button.title)
      button.dataset.view = flat ? '2d' : '3d'
    }
    const settled = () => { pendingFlat = null; showTarget(map.getPitch() <= 5) }
    const toggle = (event: MouseEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      const wasFlat = pendingFlat ?? map.getPitch() <= 5
      if (pendingFlat === null && !wasFlat) saved = { pitch: map.getPitch(), bearing: map.getBearing() }
      map.stop()
      pendingFlat = !wasFlat
      showTarget(pendingFlat)
      map.easeTo({ ...nextMapView(pendingFlat, saved), duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 })
    }
    button.addEventListener('click', toggle, true)
    map.on('moveend', settled)
    showTarget(map.getPitch() <= 5)
    this.removeToggle = () => { button.removeEventListener('click', toggle, true); map.off('moveend', settled) }
    return group
  }

  override onRemove() {
    this.removeToggle?.()
    super.onRemove()
  }
}
