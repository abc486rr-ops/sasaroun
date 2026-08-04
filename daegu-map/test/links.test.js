import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kakaoLink, naverAppLink, naverWebLink } from '../js/links.js'

const place = { id: 'yurak', name: '유락', lat: 35.8731268038228, lng: 128.607293212309 }

test('카카오는 이름·위도·경도를 쉼표로 잇는다', () => {
  assert.equal(
    kakaoLink(place),
    'https://map.kakao.com/link/to/%EC%9C%A0%EB%9D%BD,35.8731268038228,128.607293212309'
  )
})

test('네이버 앱 스킴에는 appname 이 반드시 들어간다', () => {
  const url = naverAppLink(place, 'sasaroun.example')
  assert.match(url, /^nmap:\/\/route\/public\?/)
  assert.match(url, /dlat=35\.8731268038228/)
  assert.match(url, /dlng=128\.607293212309/)
  assert.match(url, /dname=%EC%9C%A0%EB%9D%BD/)
  assert.match(url, /appname=sasaroun\.example/)
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
