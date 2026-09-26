import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRoute, urlFor } from '../js/routes.js'
const p = { id: 'place', name: 'A/B' }
const c = { id: 'person', name: '사람', places: [{ id: 'place' }] }
const data = { places: [p], curators: [c] }
test('내보낸 주소는 그대로 되읽힌다', () => {
  const url = urlFor(2, { curator: c, place: p })
  assert.equal(resolveRoute(url, data).ctx.place, p)
})

/* 링크만 보고 누구의 추천인지 알 수 있어야 공유에 의미가 생긴다.
 * 그래서 내보내는 주소에는 id 가 아니라 이름을 쓴다. */
test('공유 주소에는 사람과 장소의 이름을 쓴다', () => {
  assert.equal(urlFor(1, { curator: c }), '#/' + encodeURIComponent('사람'))
  assert.equal(
    urlFor(2, { curator: c, place: p }),
    '#/' + encodeURIComponent('사람') + '/' + encodeURIComponent('A/B')
  )
})

test('전체 목록도 한글 주소로 나간다', () => {
  assert.equal(urlFor(1, { all: true }), '#/' + encodeURIComponent('전체'))
  assert.equal(urlFor(2, { all: true }), '#/' + encodeURIComponent('전체') + '/' + encodeURIComponent('지도'))
})

/* 이름을 쓰기 전에 내보낸 링크가 이미 밖에 나가 있다. 그것도 계속 읽는다. */
test('예전에 내보낸 ID 주소도 그대로 읽는다', () => {
  assert.equal(resolveRoute('#/person/place', data).ctx.place, p)
  assert.equal(resolveRoute('#/person', data).depth, 1)
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
