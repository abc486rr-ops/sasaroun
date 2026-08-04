/* 진입점. 모듈을 엮는 일만 한다 — 화면 로직은 각 모듈이 갖는다. */

import { load } from './data.js'
import { createMachine, CURATORS, DECK } from './state.js'
import { createVisited } from './visited.js'
import { createDeck } from './deck.js'
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
  deck: $('scr-deck'),
  list: $('curator-list'),
  pastWrap: $('past-wrap'),
  pastList: $('past-list'),
  pastToggle: $('past-toggle'),
  deckTrack: $('deck'),
  dots: $('dots')
}

const SCREENS = [dom.curators, dom.deck]

function showDepth(depth, ctx) {
  SCREENS.forEach((el, i) => {
    el.hidden = i !== depth
  })
  dom.body.dataset.depth = String(depth)
  dom.back.hidden = depth === CURATORS
  dom.sub.textContent =
    depth === CURATORS ? 'by. 사사로운 · 대구' : `${ctx?.curator?.name ?? ''}의 대구`
}

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
  return Math.min(parts.length, 2)
}

/* 덱은 최신순으로 보여준다 — 이벤트로 매달 쌓이는 구조라
 * 새로 들어온 곳이 먼저 눈에 띄어야 한다. */
const byNewest = (a, b) => String(b.added ?? '').localeCompare(String(a.added ?? ''))

function boot(data) {
  const visited = createVisited()
  const byId = new Map(data.places.map((p) => [p.id, p]))
  const totalCount = () => {
    dom.count.textContent = `${visited.count()} / ${data.places.length}`
  }

  const machine = createMachine({
    onTransition: (from, to, ctx) => {
      showDepth(to, ctx)
      requestAnimationFrame(() => machine.settle())
    }
  })

  machine.onRealign((depth) =>
    history.replaceState({ depth }, '', urlFor(depth, machine.ctx))
  )
  history.replaceState({ depth: CURATORS }, '', urlFor(CURATORS))
  addEventListener('popstate', (e) => machine.pop(e.state?.depth ?? depthFromHash()))

  const deck = createDeck({
    trackHost: dom.deckTrack,
    dotsHost: dom.dots,
    visited,
    onToggle: totalCount,
    onOpen: (place) => {
      // Phase 5 에서 지도로 내려간다. 지금은 자리만 잡아둔다.
      console.info('[daegu-map] open', place.name)
    }
  })

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
      const list = c.places.map((id) => byId.get(id)).filter(Boolean).sort(byNewest)
      deck.setPlaces(list)
      if (!machine.request(DECK, { curator: c })) return
      history.pushState({ depth: DECK }, '', urlFor(DECK, { curator: c }))
    }
  })

  totalCount()
  showDepth(CURATORS)
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
