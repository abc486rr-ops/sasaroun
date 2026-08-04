import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kakaoLink, naverLink } from '../js/links.js'

const place = { id: 'yurak', name: '유락', lat: 35.8731268038228, lng: 128.607293212309 }

/* 길찾기가 아니라 장소 표시로 연다. 열자마자 경로 탐색이 시작되면 안 된다. */
test('카카오는 길찾기(link/to)가 아니라 장소 표시(link/map)로 연다', () => {
  assert.equal(
    kakaoLink(place),
    'https://map.kakao.com/link/map/%EC%9C%A0%EB%9D%BD,35.8731268038228,128.607293212309'
  )
  assert.ok(!kakaoLink(place).includes('/link/to/'))
})

test('네이버는 장소명으로 검색해 연다', () => {
  assert.equal(naverLink(place), 'https://map.naver.com/p/search/%EC%9C%A0%EB%9D%BD')
  assert.ok(!naverLink(place).includes('route'))
})

/* 우리가 부르는 이름과 지도에 등록된 상호가 다른 곳이 있다.
 * 예: 'E.C.C' 는 네이버에 '이씨씨커피' 로 올라가 있어 이름으로 찾으면 엉뚱한 데가 나온다. */
test('map_query 가 있으면 그걸로 검색한다', () => {
  const ecc = { name: 'E.C.C', map_query: '이씨씨커피', lat: 35.87, lng: 128.59 }
  assert.equal(naverLink(ecc), `https://map.naver.com/p/search/${encodeURIComponent('이씨씨커피')}`)
})

test('map_query 가 비어 있으면 이름으로 되돌아간다', () => {
  for (const q of [undefined, null, '']) {
    assert.equal(naverLink({ ...place, map_query: q }), naverLink(place))
  }
})

test('카카오는 좌표로 찍으므로 map_query 를 쓰지 않는다', () => {
  const ecc = { name: 'E.C.C', map_query: '이씨씨커피', lat: 35.87, lng: 128.59 }
  assert.ok(kakaoLink(ecc).includes(encodeURIComponent('E.C.C')))
  assert.ok(kakaoLink(ecc).endsWith(',35.87,128.59'))
})

/* 앱 스킴을 현재 창에서 쏘면, 앱이 떴는지 타이머로 추측해야 하고
 * 그 추측이 빗나가면 우리 페이지가 지도 웹으로 덮인다. 아예 쓰지 않는다. */
test('앱 스킴(nmap://)을 만들지 않는다', () => {
  assert.ok(!naverLink(place).startsWith('nmap://'))
  assert.ok(!kakaoLink(place).startsWith('kakaomap://'))
})

test('이름에 특수문자가 있어도 URL 이 깨지지 않는다', () => {
  const odd = { ...place, name: 'A&B 카페 #1/2' }
  for (const url of [kakaoLink(odd), naverLink(odd)]) {
    assert.ok(!url.includes(' '), '공백이 그대로 남으면 안 된다')
    assert.ok(!url.slice(8).includes('#'), '해시가 그대로 남으면 경로가 잘린다')
  }
  assert.ok(!naverLink(odd).includes('&B'))
})

test('좌표는 문자열로 뭉개지 않고 그대로 싣는다', () => {
  assert.ok(kakaoLink({ name: 'a', lat: 35.5, lng: 128.5 }).endsWith('a,35.5,128.5'))
})
