/* 3뎁스 상태머신.
 *
 * CURATORS(0) → DECK(1) → MAP(2)
 *
 * DOM 을 모른다. 화면을 실제로 바꾸는 일은 onTransition 을 받은 쪽이 하고,
 * 애니메이션이 끝나면 settle() 을 불러 도착을 알린다.
 *
 * 원본(smallbrand.archive.daegu.kr)은 도착 신호를 애니메이션 완료 콜백에만
 * 의존한다. 콜백이 유실되면 전환 잠금에서 영영 못 빠져나오고 복구 수단이 없다.
 * 여기서는 전환마다 타임아웃을 같이 걸어, 콜백이 오지 않아도 상태를 확정한다. */

export const CURATORS = 0
export const DECK = 1
export const MAP = 2

const MIN = CURATORS
const MAX = MAP

const isDepth = (d) => Number.isInteger(d) && d >= MIN && d <= MAX

/* setTimeout 을 { set: setTimeout } 처럼 떼어 담으면 안 된다.
 * 브라우저는 this 가 window 가 아닌 호출을 Illegal invocation 으로 거부한다.
 * 화살표 함수로 감싸 호출 시점의 this 를 전역으로 유지한다. */
const defaultTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id)
}

export function createMachine({
  onTransition,
  timers = defaultTimers,
  timeoutMs = 1500
} = {}) {
  let depth = CURATORS
  let ctx = null
  let target = null
  let pendingCtx = null
  let timer = null
  let desired = CURATORS
  let forcedCount = 0
  const realignHandlers = []

  const transiting = () => target !== null

  function clearTimer() {
    if (timer !== null) {
      timers.clear(timer)
      timer = null
    }
  }

  function arrive(forced) {
    if (!transiting()) return
    clearTimer()
    depth = target
    ctx = pendingCtx
    target = null
    pendingCtx = null
    if (forced) forcedCount += 1
    reconcile()
  }

  function start(to, nextCtx) {
    target = to
    pendingCtx = nextCtx ?? null
    timer = timers.set(() => arrive(true), timeoutMs)
    onTransition?.(depth, to, pendingCtx)
  }

  /* 목표 뎁스와 현재 뎁스의 차이를 한 단계씩 갚는다.
   * 브라우저 '앞으로'는 지원하지 않는다 — 목표가 앞서 있으면 현재로 끌어내린다. */
  function reconcile() {
    if (transiting()) return
    if (desired === depth) return
    if (desired > depth) {
      desired = depth
      realignHandlers.forEach((fn) => fn(depth))
      return
    }
    start(depth - 1, ctx)
  }

  return {
    get depth() {
      return depth
    },
    get ctx() {
      return ctx
    },
    get transiting() {
      return transiting()
    },
    get forcedCount() {
      return forcedCount
    },

    /** 사용자가 더 깊이(또는 특정 뎁스로) 들어간다. 잠금 중이면 거절한다. */
    request(to, nextCtx) {
      if (!isDepth(to)) return false
      if (transiting()) return false
      if (to === depth) return false
      desired = to
      start(to, nextCtx)
      return true
    },

    /** 화면 전환이 실제로 끝났음을 알린다. */
    settle() {
      arrive(false)
    },

    /** popstate 등 외부에서 목표 뎁스가 바뀌었을 때. */
    pop(to) {
      if (!isDepth(to)) return
      desired = to
      reconcile()
    },

    /** 앞으로가기를 무시하고 히스토리를 현재로 되돌려야 할 때 호출된다. */
    onRealign(fn) {
      realignHandlers.push(fn)
    }
  }
}
