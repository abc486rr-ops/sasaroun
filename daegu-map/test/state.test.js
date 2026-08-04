import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMachine, CURATORS, DECK, MAP } from '../js/state.js'

/* 시간을 손으로 돌린다. 1.5초 폴백이 진짜 도는지 보려면 실제로 기다릴 수 없다. */
function fakeTimers() {
  const jobs = new Map()
  let seq = 0
  return {
    api: {
      set: (fn, ms) => {
        seq += 1
        jobs.set(seq, { fn, at: ms })
        return seq
      },
      clear: (id) => jobs.delete(id)
    },
    fire: () => {
      const all = [...jobs.values()]
      jobs.clear()
      all.forEach((j) => j.fn())
    },
    pending: () => jobs.size
  }
}

function setup(opts = {}) {
  const timers = fakeTimers()
  const log = []
  const m = createMachine({
    timers: timers.api,
    timeoutMs: 1500,
    onTransition: (from, to, ctx) => log.push({ from, to, ctx }),
    ...opts
  })
  return { m, timers, log }
}

test('처음에는 추천인 화면에서 멈춰 있다', () => {
  const { m } = setup()
  assert.equal(m.depth, CURATORS)
  assert.equal(m.transiting, false)
})

test('전환을 시작하면 잠금 상태가 된다', () => {
  const { m, log } = setup()
  assert.equal(m.request(DECK, { curator: 'parksajang' }), true)
  assert.equal(m.transiting, true)
  assert.equal(m.depth, CURATORS, '아직 도착하지 않았다')
  assert.deepEqual(log[0], { from: CURATORS, to: DECK, ctx: { curator: 'parksajang' } })
})

test('settle 하면 목표 뎁스에 도착한다', () => {
  const { m } = setup()
  m.request(DECK, { curator: 'parksajang' })
  m.settle()
  assert.equal(m.depth, DECK)
  assert.equal(m.transiting, false)
  assert.deepEqual(m.ctx, { curator: 'parksajang' })
})

test('전환 중에는 다른 요청을 무시한다', () => {
  const { m, log } = setup()
  m.request(DECK)
  assert.equal(m.request(MAP), false)
  assert.equal(log.length, 1)
})

test('같은 뎁스로는 전환하지 않는다', () => {
  const { m, log } = setup()
  assert.equal(m.request(CURATORS), false)
  assert.equal(log.length, 0)
})

/* ── 원본에서 고치기로 한 부분 ── */

test('완료 콜백이 오지 않아도 타임아웃이 상태를 확정한다', () => {
  const { m, timers } = setup()
  m.request(DECK)
  assert.equal(m.transiting, true)
  timers.fire()
  assert.equal(m.transiting, false, '멈춰 있으면 안 된다')
  assert.equal(m.depth, DECK)
  assert.equal(m.forcedCount, 1)
})

test('settle 이 먼저 오면 타이머를 해제한다', () => {
  const { m, timers } = setup()
  m.request(DECK)
  m.settle()
  assert.equal(timers.pending(), 0)
  assert.equal(m.forcedCount, 0)
})

test('늦게 도착한 콜백은 상태를 흔들지 않는다', () => {
  const { m, timers } = setup()
  m.request(DECK)
  timers.fire()
  m.settle()
  assert.equal(m.depth, DECK)
  assert.equal(m.transiting, false)
})

/* ── 뒤로가기 ── */

test('뒤로가기는 한 단계씩 역재생한다', () => {
  const { m, log } = setup()
  m.request(DECK); m.settle()
  m.request(MAP); m.settle()
  log.length = 0

  m.pop(CURATORS)
  assert.deepEqual([log[0].from, log[0].to], [MAP, DECK], '두 단계를 건너뛰면 안 된다')
  assert.equal(m.transiting, true)

  m.settle()
  assert.equal(m.depth, DECK)
  assert.deepEqual([log[1].from, log[1].to], [DECK, CURATORS])

  m.settle()
  assert.equal(m.depth, CURATORS)
  assert.equal(m.transiting, false)
  assert.equal(log.length, 2)
})

test('역재생 도중 타임아웃이 나도 끝까지 간다', () => {
  const { m, timers } = setup()
  m.request(DECK); m.settle()
  m.request(MAP); m.settle()

  m.pop(CURATORS)
  timers.fire()
  assert.equal(m.depth, DECK)
  timers.fire()
  assert.equal(m.depth, CURATORS)
  assert.equal(m.transiting, false)
})

test('앞으로가기는 무시하고 현재 상태로 재정렬한다', () => {
  const { m, log } = setup()
  const realigned = []
  m.onRealign((d) => realigned.push(d))

  m.pop(MAP)
  assert.equal(log.length, 0, '앞으로는 전환하지 않는다')
  assert.deepEqual(realigned, [CURATORS])
})

test('현재와 같은 뎁스로 pop 하면 아무 일도 없다', () => {
  const { m, log } = setup()
  m.pop(CURATORS)
  assert.equal(log.length, 0)
  assert.equal(m.transiting, false)
})

test('전환 중 들어온 pop 은 도착 후에 처리한다', () => {
  const { m, log } = setup()
  m.request(DECK)
  m.pop(CURATORS)
  assert.equal(log.length, 1, '전환 중에는 역재생을 시작하지 않는다')

  m.settle()
  assert.equal(m.depth, DECK)
  assert.deepEqual([log[1].from, log[1].to], [DECK, CURATORS], '도착하자마자 빚을 갚는다')
  m.settle()
  assert.equal(m.depth, CURATORS)
})

/* ── 같은 뎁스에서 맥락만 교체 (지도에서 다른 핀을 눌렀을 때) ── */

test('같은 뎁스에서 맥락만 갈아끼운다', () => {
  const { m, log } = setup()
  m.request(DECK, { curator: 'a' }); m.settle()
  log.length = 0

  assert.equal(m.replaceCtx({ curator: 'a', place: 'yurak' }), true)
  assert.equal(m.depth, DECK, '뎁스는 그대로다')
  assert.deepEqual(m.ctx, { curator: 'a', place: 'yurak' })
  assert.equal(log.length, 0, '전환을 일으키지 않는다')
})

test('전환 중에는 맥락을 갈아끼우지 않는다', () => {
  const { m } = setup()
  m.request(DECK, { curator: 'a' })
  assert.equal(m.replaceCtx({ curator: 'b' }), false)
})

/* 기본 타이머의 브라우저 호출 규칙 검사는 state-timers.test.js 에 있다.
 * state.js 를 불러오기 전에 전역을 바꿔야 해서 파일을 분리했다. */

test('범위를 벗어난 뎁스는 받지 않는다', () => {
  const { m } = setup()
  assert.equal(m.request(9), false)
  assert.equal(m.request(-1), false)
})
