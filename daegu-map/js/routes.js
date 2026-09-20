/* 고정 ID로 공유하며 기존 이름 기반 주소도 계속 읽는다. */
import { CURATORS, DECK, MAP } from './state.js'
export function urlFor(depth, ctx) {
  if (depth === CURATORS) return './'
  const who = encodeURIComponent(ctx?.all ? 'all' : ctx?.curator?.id ?? '')
  return depth === DECK ? `#/${who}` : `#/${who}/${encodeURIComponent(ctx?.place?.id ?? 'map')}`
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
