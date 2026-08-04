/* 진입점. 모듈을 엮는 일만 한다 — 화면 로직은 각 모듈이 갖는다. */

import { load } from './data.js'
import { createMachine, CURATORS, DECK, MAP } from './state.js'
import { createVisited } from './visited.js'
import { createDeck } from './deck.js'
import { createMap } from './map.js'
import { renderPlaceCard, hidePlaceCard, renderFallback } from './card.js'
import * as curatorView from './curators.js'

const $ = (id) => document.getElementById(id)

const dom = {
  body: document.body,
  boot: $('boot'),
  fatal: $('fatal'),
  fatalMsg: $('fatal-msg'),
  retry: $('fatal-retry'),
  back: $('back'),
  sub: $('hd-sub'),
  count: $('hd-count'),
  curators: $('scr-curators'),
  deckScr: $('scr-deck'),
  list: $('curator-list'),
  pastWrap: $('past-wrap'),
  pastList: $('past-list'),
  pastToggle: $('past-toggle'),
  deckTrack: $('deck'),
  dots: $('dots'),
  mapLayer: $('map-layer'),
  mapEl: $('map'),
  mapFallback: $('map-fallback'),
  pcard: $('place-card')
}

/* 애니메이션 길이는 CSS 토큰이 원본이다. 여기에 숫자를 다시 적지 않는다. */
const cssMs = (name) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000
}

/* 덱은 최신순으로 보여준다 — 이벤트로 매달 쌓이는 구조라
 * 새로 들어온 곳이 먼저 눈에 띄어야 한다. */
const byNewest = (a, b) => String(b.added ?? '').localeCompare(String(a.added ?? ''))

/* 해시에는 id 가 아니라 이름을 쓴다. 링크만 보고 누구의 추천인지 알 수 있어야
 * 공유에 의미가 생긴다. GitHub Pages 는 정적이라 경로 라우팅을 못 쓴다. */
const urlFor = (depth, ctx) => {
  if (depth === CURATORS) return './'
  const who = encodeURIComponent(ctx?.curator?.name ?? '')
  if (depth === DECK) return `#/${who}`
  return `#/${who}/${encodeURIComponent(ctx?.place?.name ?? '')}`
}

const depthFromHash = () => {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
    .split('/')
    .filter(Boolean)
  return Math.min(parts.length, MAP)
}

function boot(data) {
  const visited = createVisited()
  const byId = new Map(data.places.map((p) => [p.id, p]))
  let shown = [] // 지금 덱에 올라간 장소들

  const refreshCount = () => {
    dom.count.textContent = `${visited.count()} / ${data.places.length}`
  }

  const map = createMap({
    el: dom.mapEl,
    fallbackEl: dom.mapFallback,
    onPick: (p) => openPlace(p),
    onTileFail: () => {
      const p = machine.ctx?.place
      if (p) renderFallback({ host: dom.mapFallback, place: p })
    }
  })

  /* 지도 레이어를 실제로 감추는 시점을 지키는 토큰.
   * 투명하기만 하면 화면을 덮은 채 덱의 터치를 가로챈다. */
  let mapToken = 0

  function enterMap(place) {
    mapToken += 1
    dom.deckTrack.classList.add('deck--flip')
    dom.mapLayer.hidden = false
    requestAnimationFrame(() => dom.mapLayer.classList.add('map-layer--on'))
    map.setPlaces(shown, { visited })
    map.refresh()
    map.focus(place)
    if (map.broken) renderFallback({ host: dom.mapFallback, place })
    renderPlaceCard({
      host: dom.pcard,
      place,
      visited,
      onToggle: (p) => {
        refreshCount()
        map.markVisited(p.id, visited.has(p.id), shown.indexOf(p))
        deck.refresh()
      },
      onClose: () => history.back()
    })
  }

  function leaveMap() {
    const token = (mapToken += 1)
    hidePlaceCard(dom.pcard)
    dom.mapLayer.classList.remove('map-layer--on')
    dom.deckTrack.classList.remove('deck--flip')
    setTimeout(() => {
      // 그 사이 다시 지도로 들어갔으면 건드리지 않는다
      if (token === mapToken) dom.mapLayer.hidden = true
    }, cssMs('--dur'))
  }

  function paint(depth, ctx) {
    dom.curators.hidden = depth !== CURATORS
    dom.deckScr.hidden = depth === CURATORS
    dom.body.dataset.depth = String(depth)
    dom.back.hidden = depth === CURATORS
    dom.sub.textContent =
      depth === CURATORS ? 'by. 사사로운 · 대구' : `${ctx?.curator?.name ?? ''}의 대구`
  }

  const machine = createMachine({
    onTransition: (from, to, ctx) => {
      paint(to, ctx)
      if (to === MAP) enterMap(ctx.place)
      else if (from === MAP) leaveMap()
      // 전환 길이만큼 기다렸다 도착을 알린다. 신호가 유실돼도 상태머신의
      // 타임아웃 폴백이 잠금을 풀어준다.
      setTimeout(() => machine.settle(), to === MAP || from === MAP ? cssMs('--dur-slow') : 0)
    }
  })

  function openPlace(place) {
    const ctx = { curator: machine.ctx?.curator, place }
    if (!machine.request(MAP, ctx)) return
    history.pushState({ depth: MAP }, '', urlFor(MAP, ctx))
  }

  const deck = createDeck({
    trackHost: dom.deckTrack,
    dotsHost: dom.dots,
    visited,
    onToggle: refreshCount,
    onOpen: openPlace
  })

  machine.onRealign((depth) =>
    history.replaceState({ depth }, '', urlFor(depth, machine.ctx))
  )
  history.replaceState({ depth: CURATORS }, '', urlFor(CURATORS))
  addEventListener('popstate', (e) => machine.pop(e.state?.depth ?? depthFromHash()))

  dom.back.addEventListener('click', () => history.back())
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && machine.depth !== CURATORS) {
      history.back()
      return
    }
    if (machine.depth === DECK && deck.handleKey(e.key)) e.preventDefault()
  })

  dom.pastToggle.addEventListener('click', () => {
    const open = dom.pastToggle.getAttribute('aria-expanded') === 'true'
    dom.pastToggle.setAttribute('aria-expanded', String(!open))
    dom.pastList.hidden = open
  })

  curatorView.render({
    listEl: dom.list,
    pastEl: dom.pastList,
    pastWrap: dom.pastWrap,
    curators: data.curators,
    thisMonth: new Date().toISOString().slice(0, 7),
    countVisited: (c) => visited.count(c.places),
    onPick: (c) => {
      shown = c.places.map((id) => byId.get(id)).filter(Boolean).sort(byNewest)
      deck.setPlaces(shown)
      if (!machine.request(DECK, { curator: c })) return
      history.pushState({ depth: DECK }, '', urlFor(DECK, { curator: c }))
    }
  })

  refreshCount()
  paint(CURATORS)
  dom.boot.hidden = true

  if (data.warnings.length) {
    console.warn(`[daegu-map] 데이터 경고 ${data.warnings.length}건`, data.warnings)
  }
}

async function start() {
  dom.fatal.hidden = true
  dom.boot.hidden = false
  try {
    boot(await load({ url: 'data/places.json' }))
  } catch (err) {
    dom.boot.hidden = true
    dom.fatal.hidden = false
    dom.fatalMsg.textContent = err.message
    console.error('[daegu-map]', err)
  }
}

dom.retry.addEventListener('click', start)
start()
