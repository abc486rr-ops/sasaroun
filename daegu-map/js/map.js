/* Leaflet 래퍼. 3D 변환 컨텍스트 바깥에서 전체 화면으로 뜬다.
 * 지도 라이브러리를 직접 쓰는 곳은 여기 하나뿐이다 — 나중에 갈아끼우기 쉽도록. */

const TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'
const ZOOM = 16
const TILE_FAIL_LIMIT = 6 // 이만큼 실패하면 지도를 포기하고 링크로 대체한다

/* 기본 마커 이미지 대신 손그림 톤의 잉크 점을 쓴다. 이미지 파일이 필요 없다. */
const pin = (label, on) =>
  L.divIcon({
    className: '',
    html: `<span class="pin${on ? ' pin--on' : ''}">${label}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  })

export function createMap({ el, fallbackEl, onPick, onTileFail }) {
  let map = null
  let markers = new Map()
  let failed = 0

  function ensure() {
    if (map) return map
    map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      // 카드가 화면 아래를 가리므로 탭 여유를 준다
      tap: true
    })
    L.tileLayer(TILE, { attribution: ATTR, maxZoom: 19 })
      .on('tileerror', () => {
        failed += 1
        if (failed === TILE_FAIL_LIMIT) {
          fallbackEl.hidden = false
          onTileFail?.()
        }
      })
      .addTo(map)
    return map
  }

  return {
    /** 카드가 뒤집힌 뒤에 부른다. 숨겨진 상태에서 만든 지도는 크기를 잘못 잡는다. */
    refresh() {
      map?.invalidateSize()
    },

    setPlaces(places, { visited } = {}) {
      const m = ensure()
      markers.forEach((mk) => mk.remove())
      markers = new Map(
        places.map((p, i) => {
          const mk = L.marker([p.lat, p.lng], {
            icon: pin(String(i + 1), visited?.has(p.id)),
            title: p.name,
            keyboard: true,
            alt: p.name
          })
            .addTo(m)
            .on('click', () => onPick?.(p))
          return [p.id, mk]
        })
      )
    },

    markVisited(id, on, index) {
      markers.get(id)?.setIcon(pin(String(index + 1), on))
    },

    focus(place, { animate = true } = {}) {
      const m = ensure()
      // 하단 카드가 가리는 만큼 위로 올려 앉힌다
      const offset = Math.round(Math.min(innerHeight * 0.22, 170))
      m.setView([place.lat, place.lng], ZOOM, { animate: false })
      m.panBy([0, offset], { animate })
    },

    fitAll(places) {
      if (!places.length) return
      const m = ensure()
      m.fitBounds(
        places.map((p) => [p.lat, p.lng]),
        { padding: [48, 48], maxZoom: ZOOM }
      )
    },

    get broken() {
      return failed >= TILE_FAIL_LIMIT
    }
  }
}

/* 지도가 못 뜨더라도 목적지에는 갈 수 있어야 한다. */
export const kakaoLink = (place) =>
  `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`
