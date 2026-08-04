/* 외부 지도 서비스로 보내는 링크.
 *
 * 길찾기가 아니라 **장소 표시**로 연다. 손님이 지금 원하는 건 "여기가 어디쯤인가"
 * 이지 당장 출발하는 게 아니다. 길찾기는 앱 안에서 한 번 더 누르면 된다.
 *
 * 둘 다 **새 탭**으로 연다. 앱 스킴(nmap://)을 현재 창에서 직접 쏘는 방식은
 * 쓰지 않는다 — 앱이 떴는지 알아내려면 타이머와 visibilitychange 로 추측해야
 * 하는데, 실기기에서 그 신호가 늦게 오면 우리 페이지가 지도 웹으로 덮인다.
 * 그러면 손님이 돌아오려고 뒤로가기를 여러 번 눌러야 한다.
 * 웹 주소를 새 탭에 띄우면 우리 페이지는 그대로 남고, 앱으로 넘어가는 일은
 * 각 서비스가 자기 페이지에서 알아서 처리한다. */

const enc = encodeURIComponent

/* 카카오는 좌표로 핀을 찍으므로 이름이 달라도 위치는 정확하다. 이름은 라벨일 뿐이다. */
export const kakaoLink = (place) =>
  `https://map.kakao.com/link/map/${enc(place.name)},${place.lat},${place.lng}`

/* 네이버는 이름으로 검색한다. 우리가 부르는 이름과 지도에 등록된 상호가 다르면
 * 엉뚱한 곳이 나온다(예: 'E.C.C' → 네이버에는 '이씨씨커피'로 등록).
 * 그런 곳은 데이터에 map_query 를 적어 검색어를 따로 준다. */
export const naverLink = (place) =>
  `https://map.naver.com/p/search/${enc(place.map_query || place.name)}`

/** 새 탭으로 여는 앵커. rel 없이 target 만 주면 원본 창 참조가 넘어간다. */
export function externalLink(text, href, cls = 'pcard__go') {
  const a = document.createElement('a')
  a.className = cls
  a.textContent = text
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  return a
}
