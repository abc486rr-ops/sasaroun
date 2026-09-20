import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate } from '../js/data.js'
import { createVisited } from '../js/visited.js'

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
