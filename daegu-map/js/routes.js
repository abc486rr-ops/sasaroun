/* 내보낼 때는 이름을, 읽을 때는 이름과 ID 둘 다.
 *
 * 해시에 이름을 쓰는 건 링크 자체가 내용을 말하게 하려는 것이다 — 카톡에 붙인
 * `#/박사장/사사로운` 은 열어보기 전에 이미 누구의 추천인지 알려준다.
 * `#/parksajang/sasaroun` 은 그걸 못 한다.
 *
 * 대신 이름이 바뀌면 이미 나간 링크가 끊긴다. 그래서 읽기는 ID 도 받아준다 —
 * 한동안 ID 주소가 나갔던 적이 있고, 그것들도 계속 열려야 한다. */
import { CURATORS, DECK, MAP } from './state.js'

const ALL = '전체'
const MAP_ONLY = '지도'

export function urlFor(depth, ctx) {
  if (depth === CURATORS) return './'
  const who = encodeURIComponent(ctx?.all ? ALL : ctx?.curator?.name ?? '')
  return depth === DECK ? `#/${who}` : `#/${who}/${encodeURIComponent(ctx?.place?.name ?? MAP_ONLY)}`
}
export function resolveRoute(hash, data) {
  const root = { depth: CURATORS, ctx: null }
  let parts
  try { parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent) }
  catch { return root }
  if (!parts.length || parts.length > 2) return root
  const all = parts[0] === 'all' || parts[0] === '전체'
  const curator = all ? null : data.curators.find(c => c.id === parts[0]) ?? data.curators.find(c => c.name === parts[0])
  if (!all && !curator) return root
  const ctx = { all, curator, place: null }
  if (parts.length === 1) return { depth: DECK, ctx }
  if (parts[1] === 'map' || parts[1] === '지도') return { depth: MAP, ctx }
  const candidates = all ? data.places : data.places.filter(p => curator.places.some(r => r.id === p.id))
  const place = candidates.find(p => p.id === parts[1]) ?? candidates.find(p => p.name === parts[1])
  return place ? { depth: MAP, ctx: { ...ctx, place } } : { depth: DECK, ctx }
}
