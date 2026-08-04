/* 전체 목록 화면 — 모든 곳을 한 번에.
 *
 * 덱이 "한 사람의 카드 묶음"이라면 여기는 "모두의 목록"이다. 성격이 다를 뿐 층은 같다.
 * 카드로 넘기게 하지 않는다 — 스물다섯 장을 한 장씩 넘기는 건 훑는 게 아니라 노동이다.
 *
 * 여러 명이 고른 곳은 얼굴이 겹쳐 쌓인다. 숫자를 세지 않아도 눈에 띄라고 그렇게 뒀다. */

const ART_DIR = 'img/art/'
const FACE = 30 // 겹쳐 쌓는 얼굴 한 변
const FACE_MAX = 4 // 이보다 많으면 나머지는 +N 으로 접는다

const el = (tag, cls, text) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

/* 추천인 얼굴을 겹쳐 쌓는다.
 * 첫 화면 아바타와 같은 이유로 지연 로딩을 걸지 않는다 — 이 그림이 곧 정보다. */
function faces(who) {
  const wrap = el('span', 'al__faces')
  who.slice(0, FACE_MAX).forEach((c) => {
    if (!c.art) return
    const img = el('img', 'art al__face')
    img.src = ART_DIR + c.art
    img.alt = ''
    img.decoding = 'async'
    img.width = FACE
    img.height = FACE
    wrap.append(img)
  })
  if (who.length > FACE_MAX) wrap.append(el('span', 'al__more', `+${who.length - FACE_MAX}`))
  return wrap
}

function check(place, { visited, onToggle }) {
  const chk = el('button', 'chk chk--bare')
  chk.type = 'button'
  const sync = () => {
    const on = visited.has(place.id)
    chk.setAttribute('aria-pressed', String(on))
    chk.setAttribute('aria-label', `${place.name} 다녀왔어요`)
    chk.replaceChildren(el('span', 'chk__box'))
  }
  sync()
  chk.addEventListener('click', () => {
    visited.toggle(place.id)
    sync()
    onToggle(place)
  })
  return chk
}

function row(place, i, { credits, visited, onOpen, onToggle }) {
  const who = credits.get(place.id) ?? []
  const li = el('li', 'al__row')
  const syncRow = () => li.classList.toggle('al__row--on', visited.has(place.id))
  syncRow()

  const main = el('button', 'al__main')
  main.type = 'button'
  // 목록 순서가 곧 지도의 핀 번호다. 둘이 어긋나면 목록을 보고 핀을 찾을 수 없다.
  main.append(el('span', 'al__no', String(i + 1).padStart(2, '0')))

  const body = el('span', 'al__body')
  body.append(el('span', 'value', place.name))
  const sub = [place.sector, who.length > 1 ? `${who.length}명이 추천` : null]
    .filter(Boolean)
    .join(' · ')
  if (sub) body.append(el('span', 'al__sub', sub))
  main.append(body, faces(who))
  main.addEventListener('click', () => onOpen(place))

  li.append(
    main,
    check(place, {
      visited,
      onToggle: (p) => {
        syncRow()
        onToggle(p)
      }
    })
  )
  return li
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.host
 * @param {Map<string, object[]>} opts.credits  placeId → 추천인들
 */
export function createAll({ host, credits, visited, onOpen, onToggle }) {
  let places = []
  const list = el('ul', 'al')
  host.replaceChildren(list)

  const paint = () =>
    list.replaceChildren(
      ...places.map((p, i) => row(p, i, { credits, visited, onOpen, onToggle }))
    )

  return {
    setPlaces(next) {
      places = next
      paint()
    },
    refresh: paint
  }
}
