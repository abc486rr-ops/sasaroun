import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate, load, DAEGU_BOUNDS } from '../js/data.js'

const place = (over = {}) => ({
  id: 'yurak',
  name: '유락',
  sector: '카페',
  lat: 35.8731,
  lng: 128.6073,
  one_liner: '한 줄',
  added: '2026-08-04',
  ...over
})

const curator = (over = {}) => ({
  id: 'parksajang',
  name: '박사장',
  kind: 'team',
  tagline: '조용한 곳',
  places: ['yurak'],
  ...over
})

const raw = (over = {}) => ({ places: [place()], curators: [curator()], ...over })

test('정상 데이터는 그대로 통과한다', () => {
  const r = validate(raw())
  assert.equal(r.places.length, 1)
  assert.equal(r.curators.length, 1)
  assert.deepEqual(r.warnings, [])
})

test('입력을 변형하지 않는다', () => {
  const input = raw({ places: [place(), place({ id: 'x', lat: 0, lng: 0 })] })
  const snapshot = JSON.stringify(input)
  validate(input)
  assert.equal(JSON.stringify(input), snapshot)
})

test('필수 필드가 없는 장소는 제외하고 나머지는 살린다', () => {
  const r = validate(raw({ places: [place(), place({ id: 'bad', name: '' })] }))
  assert.deepEqual(r.places.map((p) => p.id), ['yurak'])
  assert.match(r.warnings.join(' '), /bad/)
})

test('한 줄 소개는 없어도 된다', () => {
  const r = validate(raw({ places: [place({ one_liner: undefined })] }))
  assert.equal(r.places.length, 1)
})

/* ── 좌표 ── */

test('대구 범위 밖 좌표는 제외한다', () => {
  const seoul = place({ id: 'seoul', lat: 37.5665, lng: 126.978 })
  const r = validate(raw({ places: [place(), seoul] }))
  assert.deepEqual(r.places.map((p) => p.id), ['yurak'])
  assert.match(r.warnings.join(' '), /seoul/)
})

test('경계값은 포함한다', () => {
  const edge = place({ id: 'edge', lat: DAEGU_BOUNDS.lat[0], lng: DAEGU_BOUNDS.lng[1] })
  const r = validate({ places: [edge], curators: [curator({ places: ['edge'] })] })
  assert.equal(r.places.length, 1)
  assert.equal(r.places[0].located, true)
})

/* 좌표를 아직 못 구한 곳도 목록에는 남는다 — 추천 이유가 이 지도의 내용이고
 * 지도 핀은 그다음이다. 다만 located=false 로 표시해 지도에서 걸러낼 수 있게 한다. */
test('좌표가 없어도 장소는 살아남고 located 가 false 다', () => {
  const r = validate(raw({ places: [place({ lat: null, lng: null })] }))
  assert.equal(r.places.length, 1)
  assert.equal(r.places[0].located, false)
  assert.match(r.warnings.join(' '), /좌표 없는 장소/)
})

test('좌표가 하나만 있으면 제외한다', () => {
  for (const half of [{ lat: 35.87, lng: null }, { lat: null, lng: 128.6 }]) {
    const r = validate(raw({ places: [place(half)] }))
    assert.equal(r.places.length, 0, JSON.stringify(half))
  }
})

test('좌표가 문자열이면 제외한다', () => {
  assert.equal(validate(raw({ places: [place({ lat: '35.87' })] })).places.length, 0)
})

test('id 가 중복되면 뒤엣것을 버린다', () => {
  const r = validate(raw({ places: [place({ one_liner: '먼저' }), place({ one_liner: '나중' })] }))
  assert.equal(r.places.length, 1)
  assert.equal(r.places[0].one_liner, '먼저')
})

/* ── 추천인의 장소 참조 ── */

test('참조는 문자열로도 객체로도 적을 수 있다', () => {
  const r = validate(raw({
    places: [place(), place({ id: 'neuel', name: '느을' })],
    curators: [curator({ places: ['yurak', { id: 'neuel', note: '제철 한상' }] })]
  }))
  assert.deepEqual(r.curators[0].places, [
    { id: 'yurak', note: '' },
    { id: 'neuel', note: '제철 한상' }
  ])
})

/* 같은 곳을 여러 사람이 추천해도 각자의 한 줄 평이 따로 남아야 한다. */
test('같은 장소에 사람마다 다른 한 줄 평을 붙일 수 있다', () => {
  const r = validate(raw({
    curators: [
      curator({ id: 'a', places: [{ id: 'yurak', note: '조용해서 좋다' }] }),
      curator({ id: 'b', places: [{ id: 'yurak', note: '한시간 순삭' }] })
    ]
  }))
  assert.equal(r.places.length, 1, '장소는 하나만 둔다')
  assert.equal(r.curators[0].places[0].note, '조용해서 좋다')
  assert.equal(r.curators[1].places[0].note, '한시간 순삭')
})

test('없는 장소를 가리키는 참조는 떼어낸다', () => {
  const r = validate(raw({ curators: [curator({ places: ['yurak', { id: '없는곳', note: 'x' }] })] }))
  assert.deepEqual(r.curators[0].places.map((p) => p.id), ['yurak'])
  assert.match(r.warnings.join(' '), /없는곳/)
})

test('추천 장소가 없는 추천인은 목록에서 빠진다', () => {
  const r = validate(raw({ curators: [curator(), curator({ id: 'empty', places: [] })] }))
  assert.deepEqual(r.curators.map((c) => c.id), ['parksajang'])
})

test('special 추천인은 month 가 있어야 한다', () => {
  const ok = curator({ id: 'g1', kind: 'special', month: '2026-08' })
  const no = curator({ id: 'g2', kind: 'special' })
  const bad = curator({ id: 'g3', kind: 'special', month: '2026/08' })
  const r = validate(raw({ curators: [ok, no, bad] }))
  assert.deepEqual(r.curators.map((c) => c.id), ['g1'])
})

test('알 수 없는 kind 는 제외한다', () => {
  assert.equal(validate(raw({ curators: [curator({ kind: 'robot' })] })).curators.length, 0)
})

test('places / curators 키 자체가 없어도 죽지 않는다', () => {
  const r = validate({})
  assert.deepEqual(r.places, [])
  assert.deepEqual(r.curators, [])
  assert.ok(r.warnings.length > 0)
})

test('null 을 넣어도 죽지 않는다', () => {
  const r = validate(null)
  assert.deepEqual(r.places, [])
  assert.deepEqual(r.curators, [])
})

/* ── 로드 ── */

test('load 는 첫 시도에 성공하면 한 번만 호출한다', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1; return { ok: true, json: async () => raw() } }
  const r = await load({ url: '/x.json', fetchImpl })
  assert.equal(calls, 1)
  assert.equal(r.places.length, 1)
})

test('load 는 실패하면 한 번 재시도한다', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    if (calls === 1) throw new Error('network')
    return { ok: true, json: async () => raw() }
  }
  await load({ url: '/x.json', fetchImpl })
  assert.equal(calls, 2)
})

test('load 는 두 번 다 실패하면 에러를 던진다', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1; throw new Error('network') }
  await assert.rejects(() => load({ url: '/x.json', fetchImpl }), /불러오지 못했습니다/)
  assert.equal(calls, 2)
})

test('load 는 HTTP 오류도 실패로 본다', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) })
  await assert.rejects(() => load({ url: '/x.json', fetchImpl }), /불러오지 못했습니다/)
})
