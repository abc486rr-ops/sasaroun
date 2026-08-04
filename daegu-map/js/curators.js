/* 추천인 목록 화면.
 * 지도가 '장소 모음'이 아니라 '사람의 취향 모음'이 되는 지점이라, 첫 화면을 여기가 맡는다. */

const ART_DIR = 'img/art/'

export const isTeam = (c) => c.kind === 'team'
export const monthOf = (date) => `${date.slice(0, 7)}`

/** 이번 달 손님 / 지난 손님을 갈라낸다. 팀은 항상 상시 노출. */
export function split(curators, thisMonth) {
  return curators.reduce(
    (acc, c) => {
      if (isTeam(c)) return { ...acc, team: [...acc.team, c] }
      if (c.month === thisMonth) return { ...acc, now: [...acc.now, c] }
      return { ...acc, past: [...acc.past, c] }
    },
    { team: [], now: [], past: [] }
  )
}

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

function card(c, { visitedCount, onPick }) {
  const li = el('li')
  const btn = el('button', 'cur')
  btn.type = 'button'

  const art = el('div', 'cur__art')
  if (c.art) {
    const img = el('img', 'art')
    img.src = ART_DIR + c.art
    img.alt = ''
    img.loading = 'lazy'
    art.append(img)
  }

  const body = el('div', 'cur__body')
  body.append(el('span', 'label', c.kind === 'special' ? 'guest' : 'recommends'))
  body.append(el('span', 'value', c.name))
  if (c.tagline) body.append(el('span', 'label', c.tagline))

  if (c.traits?.length) {
    const traits = el('div', 'cur__traits')
    c.traits.forEach((t) => traits.append(el('span', 'cur__trait', t)))
    body.append(traits)
  }

  const meta = el('div', 'cur__meta')
  if (c.kind === 'special' && c.month) meta.append(el('span', 'cur__badge', c.month))
  meta.append(el('div', null, `${visitedCount} / ${c.places.length}`))

  btn.append(art, body, meta)
  btn.addEventListener('click', () => onPick(c))
  li.append(btn)
  return li
}

function group(title) {
  const li = el('li', 'curators__group')
  li.append(el('span', 'label', title))
  return li
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.listEl  상시 목록
 * @param {HTMLElement} opts.pastEl  지난 손님 목록
 * @param {HTMLElement} opts.pastWrap
 * @param {(c) => number} opts.countVisited
 */
export function render({ listEl, pastEl, pastWrap, curators, thisMonth, countVisited, onPick }) {
  const { team, now, past } = split(curators, thisMonth)
  listEl.replaceChildren()

  team.forEach((c) => listEl.append(card(c, { visitedCount: countVisited(c), onPick })))

  if (now.length) {
    listEl.append(group('이번 달의 손님'))
    now.forEach((c) => listEl.append(card(c, { visitedCount: countVisited(c), onPick })))
  }

  pastEl.replaceChildren()
  past.forEach((c) => pastEl.append(card(c, { visitedCount: countVisited(c), onPick })))
  pastWrap.hidden = past.length === 0
}
