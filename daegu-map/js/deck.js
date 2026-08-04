/* 여행갈피 카드 덱.
 * 스와이프 1회에 카드 1장. 관성으로 여러 장이 넘어가지 않는다 —
 * 20장 남짓을 훑는 게 아니라 한 장씩 읽게 하려는 것이다.
 *
 * 이 저장소 index.html 의 사진 카루셀과 같은 포인터 패턴을 쓴다. 라이브러리 없음. */

const THRESHOLD = 0.25 // 카드 폭 대비 이만큼 끌어야 넘어간다
const TAP_SLOP = 8 // 이보다 덜 움직였으면 탭으로 본다
const EDGE_DAMP = 0.35 // 양 끝에서 끌 때 저항
const NEW_DAYS = 30

const el = (tag, cls, text) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

const isNew = (added, today) => {
  if (!added) return false
  const diff = (today - Date.parse(added)) / 86400000
  return diff >= 0 && diff <= NEW_DAYS
}

function cardEl(place, i, total, { visited, onOpen, onToggle, today }) {
  const art = el('article', 'pc')

  const head = el('header', 'pc__head')
  const no = el('span', 'pc__no', `N°${String(i + 1).padStart(3, '0')} / ${total}`)
  if (isNew(place.added, today)) no.append(el('span', 'pc__new', 'new'))
  head.append(no, el('span', 'label', 'where to go'), el('span', 'value', place.name))
  if (place.sector) head.append(el('span', 'pc__sector', place.sector))

  const body = el('div', 'pc__body')
  body.append(el('p', 'pc__one', place.one_liner))
  body.append(el('hr', 'rule'))
  body.append(el('span', 'label', 'why we recommend'))
  body.append(el('p', 'pc__note', place.note || ''))

  const foot = el('footer', 'pc__foot')
  const chk = el('button', 'chk')
  chk.type = 'button'
  const sync = () => {
    const on = visited.has(place.id)
    chk.setAttribute('aria-pressed', String(on))
    chk.replaceChildren(el('span', 'chk__box'), el('span', null, '다녀왔어요'))
  }
  sync()
  chk.addEventListener('click', (e) => {
    e.stopPropagation() // 체크가 지도로 내려가는 동작을 겸하지 않게
    visited.toggle(place.id)
    sync()
    onToggle(place)
  })
  foot.append(chk, el('span', 'pc__open', '지도에서 보기 →'))

  art.append(head, body, foot)
  art.addEventListener('click', () => onOpen(place))
  return art
}

export function createDeck({ trackHost, dotsHost, visited, onOpen, onToggle, today = Date.now() }) {
  let places = []
  let index = 0
  let dragging = false
  let startX = 0
  let dx = 0
  let width = 1

  const track = el('div', 'deck__track')
  trackHost.replaceChildren(track)

  const paint = (animate = true) => {
    track.style.transition = animate ? 'transform var(--dur) var(--ease)' : 'none'
    track.style.transform = `translate3d(${-index * width + dx}px,0,0)`
    ;[...dotsHost.children].forEach((d, i) =>
      d.classList.toggle('dots__i--on', i === index)
    )
  }

  const goTo = (next, animate = true) => {
    index = Math.max(0, Math.min(places.length - 1, next))
    dx = 0
    paint(animate)
  }

  function onDown(e) {
    if (e.button != null && e.button !== 0) return
    dragging = true
    startX = e.clientX
    dx = 0
    width = trackHost.clientWidth || 1
    track.setPointerCapture?.(e.pointerId)
  }

  function onMove(e) {
    if (!dragging) return
    const raw = e.clientX - startX
    // 양 끝에서는 저항을 준다 — 순환하지 않으므로 끝이라는 걸 손끝으로 알려야 한다
    const atEdge = (raw > 0 && index === 0) || (raw < 0 && index === places.length - 1)
    dx = atEdge ? raw * EDGE_DAMP : raw
    paint(false)
  }

  function onUp() {
    if (!dragging) return
    dragging = false
    const moved = Math.abs(dx)
    if (moved > width * THRESHOLD) goTo(index + (dx < 0 ? 1 : -1))
    else goTo(index)
  }

  trackHost.addEventListener('pointerdown', onDown)
  trackHost.addEventListener('pointermove', onMove)
  trackHost.addEventListener('pointerup', onUp)
  trackHost.addEventListener('pointercancel', onUp)
  // 드래그 끝의 클릭이 카드 열기로 이어지지 않게 한다
  trackHost.addEventListener('click', (e) => {
    if (Math.abs(dx) > TAP_SLOP) e.stopPropagation()
  }, true)

  addEventListener('resize', () => {
    width = trackHost.clientWidth || 1
    paint(false)
  })

  return {
    get index() {
      return index
    },
    get current() {
      return places[index] ?? null
    },
    goTo,
    handleKey(key) {
      if (key === 'ArrowRight') goTo(index + 1)
      else if (key === 'ArrowLeft') goTo(index - 1)
      else if (key === 'Enter' && places[index]) onOpen(places[index])
      else return false
      return true
    },
    setPlaces(list) {
      places = list
      track.replaceChildren(
        ...list.map((p, i) =>
          cardEl(p, i, list.length, { visited, onOpen, onToggle, today })
        )
      )
      dotsHost.replaceChildren(...list.map(() => el('li', 'dots__i')))
      width = trackHost.clientWidth || 1
      goTo(0, false)
    },
    refresh() {
      const keep = index
      this.setPlaces(places)
      goTo(keep, false)
    }
  }
}
