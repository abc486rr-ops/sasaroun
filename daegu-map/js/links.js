/* 외부 지도 앱으로 보내는 링크.
 *
 * 길찾기가 아니라 **장소 표시**로 연다. 손님이 지금 원하는 건 "여기가 어디쯤인가"
 * 이지, 당장 출발하는 게 아니다. 길찾기는 앱 안에서 한 번 더 누르면 된다.
 * (카카오 link/to · 네이버 route/public 은 열자마자 경로 탐색이 시작된다)
 *
 * 카카오는 URL 하나로 웹과 앱을 모두 처리한다 — 앱이 있으면 앱, 없으면 웹.
 * 네이버는 그게 안 된다. 앱은 nmap:// 스킴으로만 열리고, 앱이 없으면
 * 아무 일도 일어나지 않아 웹 폴백을 직접 붙여야 한다. */

const enc = encodeURIComponent

export const kakaoLink = (place) =>
  `https://map.kakao.com/link/map/${enc(place.name)},${place.lat},${place.lng}`

/** appname 은 네이버 URL Scheme 의 필수 파라미터다. 호출 주체를 식별한다. */
export const naverAppLink = (place, appname = location.hostname || 'sasaroun') =>
  `nmap://place?lat=${place.lat}&lng=${place.lng}&name=${enc(place.name)}&appname=${enc(appname)}`

export const naverWebLink = (place) => `https://map.naver.com/p/search/${enc(place.name)}`

const APP_WAIT = 1400

/**
 * 네이버 링크를 건다.
 *
 * href 에는 웹 주소를 넣어둔다 — 스크립트가 죽어도 링크는 살아 있고,
 * 새 탭으로 열기 같은 브라우저 기본 동작도 그대로 동작한다.
 * 클릭하면 앱을 먼저 시도하고, 앱이 뜨지 않으면 웹으로 넘어간다.
 */
export function bindNaver(anchor, place, { timers = { set: (f, m) => setTimeout(f, m), clear: (id) => clearTimeout(id) } } = {}) {
  anchor.href = naverWebLink(place)
  anchor.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return // 새 탭 열기 등은 건드리지 않는다
    e.preventDefault()

    const web = naverWebLink(place)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      document.removeEventListener('visibilitychange', onHide)
    }
    // 앱이 뜨면 이 페이지는 숨겨진다 — 그때는 웹으로 넘기지 않는다
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        timers.clear(timer)
        finish()
      }
    }
    const timer = timers.set(() => {
      finish()
      location.href = web
    }, APP_WAIT)

    document.addEventListener('visibilitychange', onHide)
    location.href = naverAppLink(place)
  })
}
