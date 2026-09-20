import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRoute, urlFor } from '../js/routes.js'
const p = { id: 'place', name: 'A/B' }
const c = { id: 'person', name: '사람', places: [{ id: 'place' }] }
const data = { places: [p], curators: [c] }
test('ID 주소를 공유하고 복원한다', () => {
  const url = urlFor(2, { curator: c, place: p })
  assert.equal(resolveRoute(url, data).ctx.place, p)
})
test('슬래시가 포함된 옛 이름 주소도 복원한다', () => {
  assert.equal(resolveRoute('#/사람/A%2FB', data).ctx.place, p)
})
test('깨진 해시와 없는 추천인은 첫 화면으로 복구한다', () => {
  for (const hash of ['#/%ZZ', '#/none', '#/a/b/c']) assert.equal(resolveRoute(hash, data).depth, 0)
})
test('전체 지도와 없는 장소 처리', () => {
  assert.equal(resolveRoute('#/all/map', data).depth, 2)
  assert.equal(resolveRoute('#/person/missing', data).depth, 1)
})
