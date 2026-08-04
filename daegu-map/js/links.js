/* 외부 지도 서비스로 보내는 링크.
 *
 * 네이버지도 하나만 건다. 국내 사용 비중이 가장 높고, 우리 화면에 이미 지도가
 * 떠 있어서 외부 링크는 "내 앱에서 열기" 용 편의에 가깝다.
 * (카카오맵도 걸어봤지만, 앱이 이 주소를 네이티브 지도가 아니라 앱 내장
 *  브라우저로 열어 동작이 달랐다. 링크 둘이 서로 다르게 굴면 그 자체가 걸림돌이다)
 *
 * 길찾기가 아니라 **장소 표시**로 연다. 손님이 지금 원하는 건 "여기가 어디쯤인가"
 * 이지 당장 출발하는 게 아니다. 길찾기는 앱 안에서 한 번 더 누르면 된다.
 *
 * **새 탭**으로 연다. 앱 스킴(nmap://)을 현재 창에서 직접 쏘는 방식은 쓰지 않는다 —
 * 앱이 떴는지 알아내려면 타이머로 추측해야 하는데, 그 추측이 빗나가면 우리
 * 페이지가 지도 웹으로 덮여 손님이 뒤로가기를 여러 번 눌러야 한다. */

const enc = encodeURIComponent

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
