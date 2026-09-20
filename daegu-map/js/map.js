/* Leaflet 래퍼. 3D 변환 컨텍스트 바깥에서 전체 화면으로 뜬다.
 * 지도 라이브러리를 직접 쓰는 곳은 여기 하나뿐이다 — 나중에 갈아끼우기 쉽도록. */

const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const ZOOM = 16

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/* 기본 마커 이미지 대신 손그림 톤의 잉크 점. 이미지 파일이 필요 없다.
 * 이름표는 점 옆에 띄우되 아이콘 상자 밖으로 흘려보내, 점이 좌표에서 밀리지 않게 한다. */
const pin = (label, name, { visited, current }) => {
  const cls = ['pin', visited && 'pin--on', current && 'pin--cur'].filter(Boolean).join(' ')
  return L.divIcon({
    className: 'pin-wrap',
    html: `<span class="${cls}">${label}</span><span class="pin-name">${esc(name)}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  })
}

export function createMap({ el, fallbackEl, onPick, onTileFail }) {
  let map = null
  let markers = new Map()
  let list = []
  let visitedRef = null
  let currentId = null
  let failed = 0
  let loaded = 0
  let broken = false
  let tiles = null
  const fail = () => {
    broken = true
    fallbackEl.hidden = false
    onTileFail?.()
  }

  const iconFor = (place, i) =>
    pin(String(i + 1), place.name, {
      visited: visitedRef?.has(place.id),
      current: place.id === currentId
    })

  const repaint = () =>
    list.forEach((p, i) => markers.get(p.id)?.setIcon(iconFor(p, i)))

  function ensure() {
    if (map) return map
    if (typeof L === 'undefined') { fail(); return null }
    map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      // 카드가 화면 아래를 가리므로 탭 여유를 준다
      tap: true
    })
    map.attributionControl.setPosition('topright')
    tiles = L.tileLayer(TILE, { attribution: ATTR, maxZoom: 19 })
      .on('loading', () => { failed = 0; loaded = 0 })
      .on('tileerror', () => { failed += 1 })
      .on('tileload', () => {
        loaded += 1
        broken = false
        fallbackEl.hidden = true
      })
      .on('load', () => { if (failed > 0 && loaded === 0) fail() })
      .addTo(map)
    return map
  }

  return {
    /** 카드가 뒤집힌 뒤에 부른다. 숨겨진 상태에서 만든 지도는 크기를 잘못 잡는다. */
    refresh() {
      map?.invalidateSize()
    },

    /* 좌표를 아직 못 구한 곳은 핀을 찍지 않는다.
     * 다만 번호는 덱 순서를 그대로 쓴다 — 카드의 N°003 과 지도의 3 이 같아야 한다. */
    setPlaces(places, { visited } = {}) {
      list = places
      const m = ensure()
      visitedRef = visited ?? null
      if (!m) return
      markers.forEach((mk) => mk.remove())
      markers = new Map(
        places
          .map((p, i) => [p, i])
          .filter(([p]) => p.located)
          .map(([p, i]) => {
            const mk = L.marker([p.lat, p.lng], {
              icon: iconFor(p, i),
              title: p.name,
              keyboard: true,
              alt: p.name
            })
              .addTo(m)
              .on('click', () => onPick?.(p))
              .on('keydown', (event) => {
                if (!['Enter', ' '].includes(event.originalEvent.key)) return
                L.DomEvent.stop(event.originalEvent)
                onPick?.(p)
              })
            return [p.id, mk]
          })
      )
    },

    /** 지금 카드에 떠 있는 장소를 표시한다. 비슷한 자리에 번호가 몰리면 구분이 안 된다. */
    setCurrent(id) {
      markers.get(currentId)?.setZIndexOffset(0)
      currentId = id
      repaint()
      markers.get(id)?.setZIndexOffset(1000)
    },

    markVisited() {
      repaint()
    },

    /** 좌표가 없으면 대신 전체를 보여준다 — 엉뚱한 곳으로 튀는 것보다 낫다. */
    focus(place, { animate = true } = {}) {
      const m = ensure()
      if (!m) return
      if (!place.located) {
        this.fitAll(list)
        return
      }
      // 하단 카드가 가리는 만큼 위로 올려 앉힌다
      const cardHeight = document.getElementById('place-card')?.offsetHeight ?? 0
      const headerHeight = document.querySelector('.hd')?.offsetHeight ?? 0
      const offset = Math.max(0, Math.round((cardHeight - headerHeight) / 2))
      m.setView([place.lat, place.lng], ZOOM, { animate: false })
      m.panBy([0, offset], { animate })
    },

    /* 세이지 머리띠가 지도 위를 덮는다. 위쪽 여백을 그만큼 더 줘야
     * 북쪽 끝 핀이 헤더 밑으로 숨지 않는다. */
    fitAll(places, { top = 48 } = {}) {
      const pts = places.filter((p) => p.located).map((p) => [p.lat, p.lng])
      if (!pts.length) return
      ensure()?.fitBounds(pts, {
        paddingTopLeft: [24, top],
        paddingBottomRight: [24, 48],
        maxZoom: ZOOM
      })
    },

    retry() {
      if (typeof L === 'undefined') { location.reload(); return }
      broken = false
      failed = 0
      loaded = 0
      fallbackEl.hidden = true
      tiles?.redraw()
    },

    get broken() {
      return broken
    }
  }
}
