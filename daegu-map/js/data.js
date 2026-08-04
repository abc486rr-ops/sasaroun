/* 데이터 로드와 검증.
 * 경계에서만 검증한다 — 이 파일을 통과한 뒤로는 값을 믿고 쓴다.
 * 한 항목의 오타가 전체를 죽이지 않도록, 문제가 있는 항목만 떼어내고 나머지는 살린다.
 *
 * 한 줄 평(note)은 장소가 아니라 **추천인의 장소 참조**에 붙는다.
 * 같은 곳도 사람마다 다르게 말하기 때문이다 — 사사로운을 두고 누구는
 * "의미를 전하는 소품샵", 누구는 "한시간 순삭...텅장..." 이라고 쓴다.
 * 그 차이가 이 지도의 내용이므로 장소당 하나로 뭉개면 안 된다. */

export const DAEGU_BOUNDS = Object.freeze({
  lat: Object.freeze([35.6, 36.0]),
  lng: Object.freeze([128.3, 128.8])
})

const KINDS = Object.freeze(['team', 'special'])
const MONTH = /^\d{4}-\d{2}$/

const isText = (v) => typeof v === 'string' && v.trim() !== ''
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const inRange = (v, [min, max]) => isNum(v) && v >= min && v <= max

/** 좌표는 둘 다 있거나 둘 다 없어야 한다. 하나만 있으면 지도에 찍을 수 없다. */
function coordState(p) {
  const has = p.lat != null || p.lng != null
  if (!has) return { located: false }
  if (!inRange(p.lat, DAEGU_BOUNDS.lat)) return { error: `위도가 대구 범위 밖입니다: ${p.lat}` }
  if (!inRange(p.lng, DAEGU_BOUNDS.lng)) return { error: `경도가 대구 범위 밖입니다: ${p.lng}` }
  return { located: true }
}

function checkPlace(p) {
  if (!p || typeof p !== 'object') return '장소 항목이 객체가 아닙니다'
  const missing = ['id', 'name'].filter((k) => !isText(p[k]))
  if (missing.length) return `필수 항목 누락: ${missing.join(', ')}`
  return coordState(p).error ?? null
}

function checkCurator(c) {
  if (!c || typeof c !== 'object') return '추천인 항목이 객체가 아닙니다'
  const missing = ['id', 'name'].filter((k) => !isText(c[k]))
  if (missing.length) return `필수 항목 누락: ${missing.join(', ')}`
  if (!KINDS.includes(c.kind)) return `알 수 없는 kind: ${c.kind}`
  if (!Array.isArray(c.places)) return 'places 가 배열이 아닙니다'
  if (c.kind === 'special' && !MONTH.test(c.month ?? '')) {
    return `special 추천인은 month(YYYY-MM)가 필요합니다: ${c.month}`
  }
  return null
}

function collectPlaces(list, warn) {
  const seen = new Set()
  return list.reduce((acc, p, i) => {
    const label = p?.id || `#${i + 1}`
    const err = checkPlace(p)
    if (err) {
      warn(`장소 '${label}' 제외 — ${err}`)
      return acc
    }
    if (seen.has(p.id)) {
      warn(`장소 '${label}' 제외 — id 중복`)
      return acc
    }
    seen.add(p.id)
    return [...acc, Object.freeze({ ...p, located: coordState(p).located === true })]
  }, [])
}

/** 추천인의 장소 참조. 문자열 하나만 적어도 되고, 한 줄 평을 붙이려면 객체로 적는다. */
const refOf = (v) => (typeof v === 'string' ? { id: v, note: '' } : { id: v?.id, note: v?.note ?? '' })

function collectCurators(list, placeIds, warn) {
  const seen = new Set()
  return list.reduce((acc, c, i) => {
    const label = c?.id || `#${i + 1}`
    const err = checkCurator(c)
    if (err) {
      warn(`추천인 '${label}' 제외 — ${err}`)
      return acc
    }
    if (seen.has(c.id)) {
      warn(`추천인 '${label}' 제외 — id 중복`)
      return acc
    }
    const refs = c.places.map(refOf)
    const kept = refs.filter((r) => placeIds.has(r.id))
    refs
      .filter((r) => !placeIds.has(r.id))
      .forEach((r) => warn(`추천인 '${label}' 의 참조 '${r.id}' 는 없는 장소입니다`))
    if (kept.length === 0) {
      warn(`추천인 '${label}' 은 추천 장소가 없어 목록에서 뺍니다`)
      return acc
    }
    seen.add(c.id)
    return [...acc, Object.freeze({ ...c, places: Object.freeze(kept.map(Object.freeze)) })]
  }, [])
}

export function validate(raw) {
  const warnings = []
  const warn = (m) => warnings.push(m)

  if (!raw || typeof raw !== 'object') {
    return { places: [], curators: [], warnings }
  }
  if (!Array.isArray(raw.places)) warn('places 배열이 없습니다')
  if (!Array.isArray(raw.curators)) warn('curators 배열이 없습니다')

  const places = collectPlaces(Array.isArray(raw.places) ? raw.places : [], warn)
  const ids = new Set(places.map((p) => p.id))
  const curators = collectCurators(
    Array.isArray(raw.curators) ? raw.curators : [],
    ids,
    warn
  )

  const unlocated = places.filter((p) => !p.located)
  if (unlocated.length) {
    warn(`좌표 없는 장소 ${unlocated.length}곳: ${unlocated.map((p) => p.name).join(', ')}`)
  }

  return { places, curators, warnings, meta: raw.meta ?? null }
}

export async function load({ url, fetchImpl = fetch, retries = 1 }) {
  let last = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(url, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return validate(await res.json())
    } catch (err) {
      last = err
    }
  }
  throw new Error(`장소 정보를 불러오지 못했습니다 (${last?.message ?? '알 수 없는 오류'})`)
}
