import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kakaoLink, naverAppLink, naverWebLink } from '../js/links.js'

const place = { id: 'yurak', name: '유락', lat: 35.8731268038228, lng: 128.607293212309 }

/* 길찾기가 아니라 장소 표시로 연다. 열자마자 경로 탐색이 시작되면 안 된다. */
test('카카오는 길찾기(link/to)가 아니라 장소 표시(link/map)로 연다', () => {
  assert.equal(
    kakaoLink(place),
    'https://map.kakao.com/link/map/%EC%9C%A0%EB%9D%BD,35.8731268038228,128.607293212309'
  )
  assert.ok(!kakaoLink(place).includes('/link/to/'))
})

test('네이버는 길찾기(route)가 아니라 장소 표시(place)로 연다', () => {
  const url = naverAppLink(place, 'sasaroun.example')
  assert.match(url, /^nmap:\/\/place\?/)
  assert.ok(!url.includes('route'))
  assert.match(url, /lat=35\.8731268038228/)
  assert.match(url, /lng=128\.607293212309/)
  assert.match(url, /name=%EC%9C%A0%EB%9D%BD/)
  assert.match(url, /appname=sasaroun\.example/, 'appname 은 필수 파라미터다')
})

test('이름에 특수문자가 있어도 URL 이 깨지지 않는다', () => {
  const odd = { ...place, name: 'A&B 카페 #1/2' }
  assert.ok(!kakaoLink(odd).includes(' '))
  assert.ok(!kakaoLink(odd).includes('#'))
  assert.ok(!naverWebLink(odd).includes('#'))
  assert.ok(!naverAppLink(odd, 'x').includes('&B'))
})

test('좌표는 문자열로 뭉개지 않고 그대로 싣는다', () => {
  const url = kakaoLink({ name: 'a', lat: 35.5, lng: 128.5 })
  assert.ok(url.endsWith('a,35.5,128.5'))
})

test('네이버 웹 주소는 장소명으로 검색한다', () => {
  assert.equal(naverWebLink(place), 'https://map.naver.com/p/search/%EC%9C%A0%EB%9D%BD')
})
