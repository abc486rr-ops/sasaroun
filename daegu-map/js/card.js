/* 지도 위에 앉는 장소 카드. 덱 카드의 축약판이다.
 * 지도를 최대한 넓게 쓰되, 여기까지 내려온 이유(어디로 갈지)는 바로 보이게 한다. */

import { naverLink, externalLink } from './links.js'

const el = (tag, cls, text) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

const row = (label, value) => {
  const r = el('div', 'pcard__row')
  r.append(el('span', 'label', label), el('span', 'pcard__val', value))
  return r
}

/* 외부 지도로 보내는 링크. 자세한 선택 근거는 links.js 머리말에 있다. */
function routes(place) {
  const wrap = el('div', 'pcard__routes')
  wrap.append(externalLink('네이버지도에서 보기 →', naverLink(place)))
  return wrap
}

export function renderPlaceCard({ host, place, visited, onToggle, onClose }) {
  const head = el('div', 'pcard__head')
  head.append(el('span', 'label', place.sector || 'where to go'), el('span', 'value', place.name))

  const close = el('button', 'pcard__close')
  close.type = 'button'
  close.setAttribute('aria-label', '카드 닫기')
  close.textContent = '×'
  close.addEventListener('click', onClose)

  const body = el('div', 'pcard__body')
  if (place.note) body.append(el('p', 'pcard__one', place.note))
  else if (place.one_liner) body.append(el('p', 'pcard__one', place.one_liner))
  if (place.hours) body.append(row('hours', place.hours))
  if (place.walk) body.append(row('walk', place.walk))
  // 좌표를 못 구한 곳은 지도에 핀이 없다. 왜 없는지 말해준다.
  if (!place.located) body.append(row('map', '위치 확인 중 — 이름으로 찾아보세요'))

  const foot = el('footer', 'pcard__foot')

  const chk = el('button', 'chk')
  chk.type = 'button'
  const sync = () => {
    chk.setAttribute('aria-pressed', String(visited.has(place.id)))
    chk.replaceChildren(el('span', 'chk__box'), el('span', null, '다녀왔어요'))
  }
  sync()
  chk.addEventListener('click', () => {
    visited.toggle(place.id)
    sync()
    onToggle(place)
  })

  foot.append(chk, routes(place))

  const links = el('div', 'pcard__links')
  if (place.link) {
    const a = el('a', 'pcard__link', '인스타그램 →')
    a.href = place.link
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    links.append(a)
  }

  host.replaceChildren(head, close, body, foot, links)
  host.classList.add('pcard--on')
}

export function hidePlaceCard(host) {
  host.classList.remove('pcard--on')
}

/* 지도 타일이 죽었을 때 — 지도 대신 주소와 길찾기 링크만이라도 남긴다. */
export function renderFallback({ host, place }) {
  const box = el('div', 'fb__box')
  box.append(el('span', 'label', 'map unavailable'), el('span', 'value', '지도를 불러오지 못했습니다'))
  box.append(el('p', 'fb__coord', `${place.lat.toFixed(5)}N ${place.lng.toFixed(5)}E`))
  box.append(routes(place))
  host.replaceChildren(box)
}
