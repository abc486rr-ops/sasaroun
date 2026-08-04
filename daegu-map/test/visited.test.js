import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createVisited } from '../js/visited.js'

const KEY = 'sasaroun.daegu.visited'

/** 최소한의 localStorage 흉내. opts.failWrite 로 저장 실패를 만든다. */
function fakeStorage(initial = null, { failWrite = false, failRead = false } = {}) {
  const box = { [KEY]: initial }
  return {
    getItem: (k) => {
      if (failRead) throw new Error('blocked')
      return box[k] ?? null
    },
    setItem: (k, v) => {
      if (failWrite) throw new Error('QuotaExceeded')
      box[k] = v
    },
    peek: () => box[KEY]
  }
}

test('처음에는 아무것도 방문하지 않았다', () => {
  const v = createVisited(fakeStorage())
  assert.equal(v.count(), 0)
  assert.equal(v.has('yurak'), false)
  assert.deepEqual(v.all(), [])
})

test('저장된 값을 읽어온다', () => {
  const v = createVisited(fakeStorage('["yurak","neuel"]'))
  assert.equal(v.count(), 2)
  assert.equal(v.has('yurak'), true)
  assert.equal(v.has('ecc'), false)
})

test('토글하면 켜지고 다시 토글하면 꺼진다', () => {
  const v = createVisited(fakeStorage())
  assert.equal(v.toggle('yurak'), true)
  assert.equal(v.has('yurak'), true)
  assert.equal(v.toggle('yurak'), false)
  assert.equal(v.has('yurak'), false)
})

test('토글하면 저장소에 반영된다', () => {
  const s = fakeStorage()
  const v = createVisited(s)
  v.toggle('yurak')
  assert.deepEqual(JSON.parse(s.peek()), ['yurak'])
  v.toggle('ecc')
  assert.deepEqual(JSON.parse(s.peek()).sort(), ['ecc', 'yurak'])
})

test('특정 목록에 대해서만 셀 수 있다', () => {
  const v = createVisited(fakeStorage('["yurak","neuel","ecc"]'))
  assert.equal(v.count(['yurak', 'sasaroun']), 1)
  assert.equal(v.count(['sasaroun']), 0)
  assert.equal(v.count([]), 0)
  assert.equal(v.count(), 3)
})

/* 사파리 프라이빗 모드 등 — 체크가 안 될 뿐 지도는 정상 동작해야 한다 */
test('저장에 실패해도 메모리에서는 동작한다', () => {
  const v = createVisited(fakeStorage(null, { failWrite: true }))
  assert.doesNotThrow(() => v.toggle('yurak'))
  assert.equal(v.has('yurak'), true)
  assert.equal(v.count(), 1)
})

test('읽기에 실패해도 빈 상태로 시작한다', () => {
  const v = createVisited(fakeStorage('["yurak"]', { failRead: true }))
  assert.equal(v.count(), 0)
  assert.doesNotThrow(() => v.toggle('ecc'))
})

test('저장소 자체가 없어도 동작한다', () => {
  const v = createVisited(null)
  assert.doesNotThrow(() => v.toggle('yurak'))
  assert.equal(v.has('yurak'), true)
})

test('깨진 JSON 은 빈 상태로 본다', () => {
  const v = createVisited(fakeStorage('{이건 JSON 이 아니다'))
  assert.equal(v.count(), 0)
})

test('배열이 아닌 값은 빈 상태로 본다', () => {
  assert.equal(createVisited(fakeStorage('{"a":1}')).count(), 0)
  assert.equal(createVisited(fakeStorage('42')).count(), 0)
  assert.equal(createVisited(fakeStorage('null')).count(), 0)
})

test('배열 안의 문자열이 아닌 값은 걸러낸다', () => {
  const v = createVisited(fakeStorage('["yurak",42,null,{"x":1},"ecc"]'))
  assert.deepEqual(v.all().sort(), ['ecc', 'yurak'])
})

test('all() 이 돌려준 배열을 고쳐도 내부는 그대로다', () => {
  const v = createVisited(fakeStorage('["yurak"]'))
  const got = v.all()
  got.push('침입')
  assert.equal(v.count(), 1)
  assert.equal(v.has('침입'), false)
})
