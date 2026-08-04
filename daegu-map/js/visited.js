/* 방문 체크 — 종이 여행갈피의 체크박스를 웹으로 옮긴 것.
 * 저장은 거들 뿐이다. localStorage 가 막혀도(사파리 프라이빗 등) 지도는 정상 동작해야 한다. */

const KEY = 'sasaroun.daegu.visited'

function readRaw(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function createVisited(storage = globalThis.localStorage) {
  const safe = storage ?? null
  let ids = safe ? new Set(readRaw(safe)) : new Set()

  const persist = () => {
    if (!safe) return false
    try {
      safe.setItem(KEY, JSON.stringify([...ids]))
      return true
    } catch {
      return false // 저장 실패는 조용히 넘어간다
    }
  }

  return {
    has: (id) => ids.has(id),
    count: (placeIds = null) =>
      placeIds ? placeIds.filter((id) => ids.has(id)).length : ids.size,
    toggle(id) {
      const next = new Set(ids)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      ids = next
      persist()
      return ids.has(id)
    },
    all: () => [...ids]
  }
}
