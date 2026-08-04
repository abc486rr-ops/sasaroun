/* 브라우저의 setTimeout 은 this 가 다른 객체면 Illegal invocation 을 던진다.
 * `{ set: setTimeout }` 처럼 함수를 떼어 담으면 정확히 그 상황이 된다.
 *
 * 이 검사는 state.js 를 **불러오기 전에** 전역을 바꿔야 의미가 있다.
 * 모듈 최상위에서 setTimeout 을 붙잡아 두는 구현은, 나중에 전역을 바꿔봐야
 * 이미 원본을 쥐고 있어서 걸리지 않는다. 그래서 별도 파일로 분리했다.
 * (node --test 는 파일마다 프로세스를 나누므로 전역 오염이 번지지 않는다) */

import { test } from 'node:test'
import assert from 'node:assert/strict'

const realSet = globalThis.setTimeout
const realClear = globalThis.clearTimeout

const guard = (real) =>
  function (...args) {
    // this 가 undefined(모듈에서의 맨 호출)면 브라우저도 허용한다.
    if (this !== undefined && this !== globalThis) {
      throw new TypeError('Illegal invocation')
    }
    return real(...args)
  }

globalThis.setTimeout = guard(realSet)
globalThis.clearTimeout = guard(realClear)

const { createMachine, DECK } = await import('../js/state.js')

globalThis.setTimeout = realSet
globalThis.clearTimeout = realClear

test('기본 타이머가 브라우저 호출 규칙을 어기지 않는다', () => {
  globalThis.setTimeout = guard(realSet)
  globalThis.clearTimeout = guard(realClear)
  try {
    const m = createMachine({ onTransition: () => {} })
    assert.doesNotThrow(() => m.request(DECK), 'request 에서 Illegal invocation 이 나면 안 된다')
    assert.doesNotThrow(() => m.settle())
    assert.equal(m.depth, DECK)
  } finally {
    globalThis.setTimeout = realSet
    globalThis.clearTimeout = realClear
  }
})
