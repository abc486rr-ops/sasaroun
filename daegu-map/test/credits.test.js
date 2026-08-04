/* 전체 목록이 쓰는 파생값 — 누가 어디를 추천했는지, 그래서 어떤 순서로 놓을지.
 * 추천 수는 데이터에 적지 않고 여기서 센다. 적어두면 사람이 고칠 때 어긋난다. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creditsOf, rankAll, validate } from '../js/data.js'

const place = (id, over = {}) => ({
  id,
  name: id,
  lat: 35.87,
  lng: 128.6,
  added: '2026-08-01',
  ...over
})

const curator = (id, places) => ({ id, name: id, kind: 'team', places })

test('한 곳을 여러 명이 추천하면 추천인이 쌓인다', () => {
  const credits = creditsOf([
    curator('a', [{ id: 'yurak' }]),
    curator('b', [{ id: 'yurak' }]),
    curator('c', [{ id: 'sobe' }])
  ])
  assert.deepEqual(
    credits.get('yurak').map((c) => c.id),
    ['a', 'b']
  )
  assert.equal(credits.get('sobe').length, 1)
})

test('추천인 순서는 입력 순서를 지킨다', () => {
  const credits = creditsOf([
    curator('kim', [{ id: 'yurak' }]),
    curator('park', [{ id: 'yurak' }]),
    curator('lee', [{ id: 'yurak' }])
  ])
  assert.deepEqual(
    credits.get('yurak').map((c) => c.id),
    ['kim', 'park', 'lee']
  )
})

test('아무도 추천하지 않은 곳은 키가 아예 없다', () => {
  const credits = creditsOf([curator('a', [{ id: 'yurak' }])])
  assert.equal(credits.has('sobe'), false)
  assert.equal(credits.get('sobe'), undefined)
})

test('추천인이 없으면 빈 Map 이다', () => {
  assert.equal(creditsOf([]).size, 0)
})

test('추천인 수가 많은 곳이 앞에 온다', () => {
  const places = [place('solo'), place('duo'), place('trio')]
  const credits = creditsOf([
    curator('a', [{ id: 'solo' }, { id: 'duo' }, { id: 'trio' }]),
    curator('b', [{ id: 'duo' }, { id: 'trio' }]),
    curator('c', [{ id: 'trio' }])
  ])
  assert.deepEqual(
    rankAll(places, credits).map((p) => p.id),
    ['trio', 'duo', 'solo']
  )
})

test('추천인 수가 같으면 최신순', () => {
  const places = [
    place('old', { added: '2026-01-01' }),
    place('new', { added: '2026-08-01' }),
    place('mid', { added: '2026-05-01' })
  ]
  const credits = creditsOf([curator('a', [{ id: 'old' }, { id: 'new' }, { id: 'mid' }])])
  assert.deepEqual(
    rankAll(places, credits).map((p) => p.id),
    ['new', 'mid', 'old']
  )
})

test('수도 날짜도 같으면 이름순으로 고정한다 — 새로고침마다 순서가 흔들리면 안 된다', () => {
  const places = [place('나', { name: '나비' }), place('가', { name: '가람' })]
  const credits = creditsOf([curator('a', [{ id: '나' }, { id: '가' }])])
  assert.deepEqual(
    rankAll(places, credits).map((p) => p.name),
    ['가람', '나비']
  )
})

test('rankAll 은 원본 배열을 건드리지 않는다', () => {
  const places = [place('duo'), place('solo')]
  const credits = creditsOf([curator('a', [{ id: 'solo' }]), curator('b', [{ id: 'solo' }])])
  rankAll(places, credits)
  assert.deepEqual(
    places.map((p) => p.id),
    ['duo', 'solo']
  )
})

test('추천인이 없는 장소도 목록에서 빠지지 않는다 — 맨 뒤로 갈 뿐이다', () => {
  const places = [place('orphan'), place('picked')]
  const credits = creditsOf([curator('a', [{ id: 'picked' }])])
  assert.deepEqual(
    rankAll(places, credits).map((p) => p.id),
    ['picked', 'orphan']
  )
})

test('validate 결과에 credits 가 함께 온다', () => {
  const r = validate({
    places: [place('yurak'), place('sobe')],
    curators: [curator('a', [{ id: 'yurak' }]), curator('b', [{ id: 'yurak' }])]
  })
  assert.equal(r.credits.get('yurak').length, 2)
  assert.equal(r.credits.has('sobe'), false)
})

test('없는 장소를 가리키던 참조는 credits 에도 남지 않는다', () => {
  const r = validate({
    places: [place('yurak')],
    curators: [curator('a', [{ id: 'yurak' }, { id: 'ghost' }])]
  })
  assert.equal(r.credits.has('ghost'), false)
  assert.equal(r.credits.get('yurak').length, 1)
})
