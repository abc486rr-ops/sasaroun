/* 진입점. 모듈을 엮는 일만 한다 — 화면 로직은 각 모듈이 갖는다. */

import { load, rankAll } from './data.js'
import { createMachine, CURATORS, DECK, MAP } from './state.js'
import { createVisited } from './visited.js'
import { createDeck } from './deck.js'
import { createAll } from './all.js'
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
  hd: document.querySelector('.hd'),
  sub: $('hd-sub'),
  count: $('hd-count'),
  curators: $('scr-curators'),
  deckScr: $('scr-deck'),
  allScr: $('scr-all'),
  allList: $('all-list'),
  allMap: $('all-map'),
  allLead: $('all-lead'),
  allEntry: $('all-entry'),
  allEntryLabel: $('all-entry-label'),
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

/* 전체 목록도 '누구'의 자리를 차지한다 — 한 사람 대신 모두라는 뜻이다.
 * 추천인 중에 같은 이름이 생기면 링크가 겹치므로, 사람 이름으로는 쓰지 않는다. */
const ALL_SLUG = '전체'

/* 장소 없이 지도만 열었을 때의 자리. 아직 아무 카드도 안 뜬 상태다. */
const MAP_SLUG = '지도'

/* 핀이 이보다 많으면 이름표가 서로 겹친다 — 그때는 번호만 남긴다 */
const DENSE_PINS = 12

/* 해시에는 id 가 아니라 이름을 쓴다. 링크만 보고 누구의 추천인지 알 수 있어야
 * 공유에 의미가 생긴다. GitHub Pages 는 정적이라 경로 라우팅을 못 쓴다. */
const urlFor = (depth, ctx) => {
  if (depth === CURATORS) return './'
  const who = encodeURIComponent(ctx?.all ? ALL_SLUG : ctx?.curator?.name ?? '')
  if (depth === DECK) return `#/${who}`
  return `#/${who}/${encodeURIComponent(ctx?.place?.name ?? MAP_SLUG)}`
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
  let shown = [] // 지금 1층에 올라간 장소들 — 지도의 핀 번호가 이 순서를 따른다

  /* 1층이 지금 무엇을 보여주는지. 상태머신은 '몇 층'만 알고,
   * 그 층이 한 사람의 덱인지 전체 목록인지는 여기가 갖는다. */
  let view = { all: false, curator: null }
  const ctxOf = (place) => ({ ...view, place })

  const refreshCount = () => {
    dom.count.textContent = `${visited.count()} / ${data.places.length}`
    // 추천인 카드의 'n / m' 도 같은 체크를 센다. 여기서 같이 갱신하지 않으면
    // 목록으로 돌아왔을 때 방금 체크한 게 반영되지 않은 숫자가 남는다.
    renderCurators()
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
  /* 지금 가라앉아 있는 화면. 들어갈 때 잡아두고 나올 때 그대로 되돌린다 —
   * 그 사이 보는 화면이 바뀌면 엉뚱한 쪽의 클래스를 벗기게 된다. */
  let dived = null
  /* 장소 없이 열린 지도인가. 그렇다면 카드는 있어도 그만 없어도 그만이라,
   * 카드를 닫아도 지도에 머문다. */
  let mapAll = false

  /** 지도 위 카드를 지금 장소로 맞춘다. 진입할 때도, 다른 핀을 눌렀을 때도 여기를 지난다. */
  function showCard(place, { animate = true } = {}) {
    map.setCurrent(place.id)
    map.focus(place, { animate })
    if (map.broken) renderFallback({ host: dom.mapFallback, place })
    renderPlaceCard({
      host: dom.pcard,
      place,
      visited,
      // 한 사람의 덱에서 내려왔다면 누가 골랐는지는 이미 아는 얘기다
      credits: view.all ? data.credits.get(place.id) ?? [] : null,
      onCurator: openCurator,
      onToggle: () => {
        refreshCount()
        map.markVisited()
        deck.refresh()
        all.refresh()
      },
      onClose: closeCard
    })
  }

  /* 덱에서 내려온 지도는 그 장소를 보러 온 것이라, 카드를 닫으면 나간다.
   * 목록에서 지도만 열었을 때는 카드가 곁가지다 — 닫으면 핀만 남기고 지도에 머문다. */
  function closeCard() {
    if (!mapAll) {
      history.back()
      return
    }
    hidePlaceCard(dom.pcard)
    map.setCurrent(null)
    const ctx = { ...view, place: null }
    if (machine.replaceCtx(ctx)) {
      history.replaceState({ depth: MAP }, '', urlFor(MAP, ctx))
    }
  }

  function enterMap(place) {
    mapToken += 1
    mapAll = !place
    dived = view.all ? dom.allScr : dom.deckScr
    dived.classList.add('scr--dive')
    // 핀이 많으면 이름표끼리 겹쳐 글씨가 뭉갠다. 그때는 번호만 남긴다.
    dom.mapLayer.classList.toggle('map-layer--dense', shown.length > DENSE_PINS)
    dom.mapLayer.hidden = false
    // 리플로를 강제해 transition 시작점을 확정한다.
    // requestAnimationFrame 은 탭이 백그라운드로 취급되면 돌지 않아,
    // 지도가 투명한 채로 남는 상태가 만들어진다.
    void dom.mapLayer.offsetWidth
    dom.mapLayer.classList.add('map-layer--on')
    map.setPlaces(shown, { visited })
    map.refresh()
    if (place) {
      showCard(place, { animate: false })
      return
    }
    // 아직 고른 곳이 없다. 전부 들어오게 맞춰 보여준다.
    map.setCurrent(null)
    map.fitAll(shown, { top: dom.hd.offsetHeight + 24 })
  }

  function leaveMap() {
    const token = (mapToken += 1)
    hidePlaceCard(dom.pcard)
    dom.mapLayer.classList.remove('map-layer--on')
    dived?.classList.remove('scr--dive')
    dived = null
    setTimeout(() => {
      // 그 사이 다시 지도로 들어갔으면 건드리지 않는다
      if (token === mapToken) dom.mapLayer.hidden = true
    }, cssMs('--dur'))
  }

  /* 1층은 덱과 전체 목록이 번갈아 쓴다. 어느 쪽인지는 view 가 안다. */
  function paint(depth) {
    dom.curators.hidden = depth !== CURATORS
    dom.deckScr.hidden = depth === CURATORS || view.all
    dom.allScr.hidden = depth === CURATORS || !view.all
    dom.body.dataset.depth = String(depth)
    dom.back.hidden = depth === CURATORS
    dom.sub.textContent =
      depth === CURATORS
        ? 'by. 사사로운 · 대구'
        : view.all
          ? `모두의 대구 ${data.places.length}곳`
          : `${view.curator?.name ?? ''}의 대구`
  }

  const machine = createMachine({
    onTransition: (from, to, ctx) => {
      paint(to)
      if (to === MAP) enterMap(ctx.place)
      else if (from === MAP) leaveMap()
      // 전환 길이만큼 기다렸다 도착을 알린다. 신호가 유실돼도 상태머신의
      // 타임아웃 폴백이 잠금을 풀어준다.
      setTimeout(() => machine.settle(), to === MAP || from === MAP ? cssMs('--dur-slow') : 0)
    }
  })

  function openPlace(place) {
    const ctx = ctxOf(place)

    /* 이미 지도에 있으면 카드만 갈아끼운다.
     * pushState 를 쌓으면 핀을 누른 횟수만큼 뒤로가기를 눌러야 덱으로 나온다. */
    if (machine.depth === MAP && machine.replaceCtx(ctx)) {
      history.replaceState({ depth: MAP }, '', urlFor(MAP, ctx))
      showCard(place)
      return
    }

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

  const all = createAll({
    host: dom.allList,
    credits: data.credits,
    visited,
    onOpen: openPlace,
    onToggle: refreshCount
  })

  /** 1층을 한 사람의 덱으로 채운다. */
  function setCuratorView(c) {
    view = { all: false, curator: c }
    // 한 줄 평은 추천인이 갖고 있다. 장소와 합쳐 덱에 올린다.
    shown = c.places
      .map(({ id, note }) => {
        const p = byId.get(id)
        return p && { ...p, note }
      })
      .filter(Boolean)
      .sort(byNewest)
    deck.setPlaces(shown)
  }

  /** 1층을 전체 목록으로 채운다. */
  function setAllView() {
    view = { all: true, curator: null }
    /* 여기서는 한 줄 평을 붙이지 않는다. 여러 명이 고른 곳은 말도 여럿이라,
     * 그중 하나만 이름 없이 얹으면 누가 한 말인지 사라진다. */
    shown = rankAll(data.places, data.credits)
    all.setPlaces(shown)
  }

  /* 지도에서 추천인 이름을 눌렀을 때 건너갈 사람.
   * 뒤로 한 칸 물러난 그 자리를 그 사람의 덱으로 갈아끼운다 — 새 칸을 밀어 넣으면
   * '전체' 칸이 뒤에 남아 뒤로가기가 한 번 헛돈다. */
  let pending = null

  function openCurator(c) {
    if (machine.transiting) return
    pending = c
    history.back()
  }

  machine.onRealign((depth) =>
    history.replaceState({ depth }, '', urlFor(depth, ctxOf(machine.ctx?.place)))
  )
  history.replaceState({ depth: CURATORS }, '', urlFor(CURATORS))
  addEventListener('popstate', (e) => {
    const to = e.state?.depth ?? depthFromHash()
    /* 이번 popstate 에서 쓰지 못하면 버린다. 들고 있으면 한참 뒤의
     * 엉뚱한 이동에 가서 붙는다. */
    const c = pending
    pending = null
    machine.pop(to)
    if (to !== DECK || !c) return
    setCuratorView(c)
    paint(DECK) // 전환은 이미 시작됐다. 내용만 그 사람 것으로 바꿔 끼운다.
    history.replaceState({ depth: DECK }, '', urlFor(DECK, { curator: c }))
  })

  dom.back.addEventListener('click', () => history.back())
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && machine.depth !== CURATORS) {
      history.back()
      return
    }
    // 전체 목록은 세로로 훑는 화면이라 좌우 키를 가로채면 안 된다
    if (machine.depth === DECK && !view.all && deck.handleKey(e.key)) e.preventDefault()
  })

  dom.pastToggle.addEventListener('click', () => {
    const open = dom.pastToggle.getAttribute('aria-expanded') === 'true'
    dom.pastToggle.setAttribute('aria-expanded', String(!open))
    dom.pastList.hidden = open
  })

  function renderCurators() {
    curatorView.render({
      listEl: dom.list,
      pastEl: dom.pastList,
      pastWrap: dom.pastWrap,
      curators: data.curators,
      thisMonth: new Date().toISOString().slice(0, 7),
      countVisited: (c) => visited.count(c.places.map((r) => r.id)),
      onPick: (c) => {
        setCuratorView(c)
        if (!machine.request(DECK, { curator: c })) return
        history.pushState({ depth: DECK }, '', urlFor(DECK, { curator: c }))
      }
    })
  }

  dom.allEntryLabel.textContent = `${data.places.length}곳 한눈에 보기 →`
  dom.allLead.textContent = `모두가 고른 ${data.places.length}곳`
  dom.allEntry.addEventListener('click', () => {
    setAllView()
    if (!machine.request(DECK, { all: true })) return
    history.pushState({ depth: DECK }, '', urlFor(DECK, { all: true }))
  })

  // 목록을 거치지 않고 바로 지도로. 어디를 볼지 아직 안 정했을 때의 문이다.
  dom.allMap.addEventListener('click', () => {
    const ctx = { ...view, place: null }
    if (!machine.request(MAP, ctx)) return
    history.pushState({ depth: MAP }, '', urlFor(MAP, ctx))
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
