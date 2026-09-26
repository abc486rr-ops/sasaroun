import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate } from '../js/data.js'
import { createVisited } from '../js/visited.js'
import { split } from '../js/curators.js'

const p = { id: 'one', name: '장소', lat: null, lng: null }
test('잘못된 traits와 중복 추천을 경계에서 정리한다', () => {
  const result = validate({ places: [p], curators: [{ id: 'a', name: '사람', kind: 'team', traits: 'INTJ', places: ['one', 'one'] }] })
  assert.deepEqual(result.curators[0].traits, [])
  assert.equal(result.curators[0].places.length, 1)
  assert.equal(result.credits.get('one').length, 1)
})
test('localStorage 속성 접근이 거부되어도 메모리로 동작한다', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied') } })
  try {
    const visited = createVisited()
    assert.equal(visited.toggle('one'), true)
    assert.equal(visited.count(), 1)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
})

/* 아직 오지 않은 달의 손님은 첫 화면에 내걸지 않는다. 다만 데이터에 넣어둔 사람이
 * 왜 안 보이는지는 알 수 있어야 해서, 사라지는 대신 따로 모아 돌려준다. */
test('미래 달의 손님은 목록에서 빼되 따로 모은다', () => {
  const 손님 = (id, month) => ({ id, name: id, kind: 'special', month, places: [] })
  const { team, now, past, future } = split(
    [
      { id: 't', name: '팀', kind: 'team', places: [] },
      손님('이번달', '2026-09'),
      손님('다음달', '2026-10'),
      손님('지난달', '2026-08')
    ],
    '2026-09'
  )
  assert.deepEqual(team.map((c) => c.id), ['t'])
  assert.deepEqual(now.map((c) => c.id), ['이번달'])
  assert.deepEqual(past.map((c) => c.id), ['지난달'])
  assert.deepEqual(future.map((c) => c.id), ['다음달'])
})

test('URL 복원은 진행 중 전환과 타임아웃을 취소한다', async () => {
  const { createMachine } = await import('../js/state.js')
  const callbacks = new Map()
  let id = 0
  const machine = createMachine({ timers: { set(fn) { callbacks.set(++id, fn); return id }, clear(id) { callbacks.delete(id) } } })
  machine.request(2, { place: 'old' })
  machine.restore(1, { curator: 'new' })
  assert.equal(machine.depth, 1)
  assert.equal(machine.ctx.curator, 'new')
  assert.equal(callbacks.size, 0)
  machine.settle()
  assert.equal(machine.depth, 1)
})
