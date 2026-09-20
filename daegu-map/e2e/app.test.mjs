import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.TEST_URL || 'http://127.0.0.1:8765/daegu-map/'
let browser
before(async () => { browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined }) })
after(async () => { await browser?.close() })
async function pageFor(t, hash = '', setup) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  t.after(() => context.close())
  await setup?.(page)
  await page.goto(base + hash)
  await page.locator('#boot').waitFor({ state: 'hidden' })
  return page
}
const depth = (p, n) => p.waitForFunction((n) => document.body.dataset.depth === String(n), n)

test('공유 장소 직접 접속, 새로고침, 뒤로/앞으로 복원', async t => {
  const p = await pageFor(t, '#/parksajang/sasaroun')
  await depth(p, 2)
  assert.match(await p.locator('#place-card').innerText(), /사사로운/)
  await p.reload(); await depth(p, 2)
  await p.locator('#back').click(); await depth(p, 1)
  await p.goForward(); await depth(p, 2)
  await p.locator('#back').click(); await depth(p, 1)
  await p.locator('#back').click(); await depth(p, 0)
})
test('기존 한글 공유 주소와 잘못된 해시', async t => {
  const p = await pageFor(t, '#/' + encodeURIComponent('박사장') + '/' + encodeURIComponent('사사로운'))
  await depth(p, 2)
  await p.goto(base + '#/%ZZ'); await p.reload(); await depth(p, 0)
})
test('체크 버튼 Enter와 비활성 카드 초점', async t => {
  const p = await pageFor(t, '#/parksajang')
  await depth(p, 1)
  const check = p.locator('.pc:not([inert]) .chk')
  await check.focus(); await p.keyboard.press('Enter')
  assert.equal(await check.getAttribute('aria-pressed'), 'true')
  assert.equal(await p.locator('body').getAttribute('data-depth'), '1')
  assert.equal(await p.locator('.pc:not([inert])').count(), 1)
  await check.press('Space')
  assert.equal(await check.getAttribute('aria-pressed'), 'false')
})
test('스와이프는 카드만 넘기고 다음 정상 탭은 지도를 연다', async t => {
  const p = await pageFor(t, '#/parksajang')
  await depth(p, 1)
  const box = await p.locator('#deck').boundingBox()
  const y = box.y + 120
  await p.mouse.move(box.x + box.width - 25, y); await p.mouse.down()
  await p.mouse.move(box.x + 25, y, { steps: 12 }); await p.mouse.up()
  assert.equal(await p.locator('body').getAttribute('data-depth'), '1')
  assert.equal(await p.locator('.pc').nth(1).getAttribute('inert'), null)
  await p.locator('.pc:not([inert]) .pc__open').click(); await depth(p, 2)
})
test('전체 지도 타일 실패 안내와 재시도', async t => {
  let fail = true
  const p = await pageFor(t, '#/all/map', async p => {
    await p.route('**/light_all/**', r => fail ? r.abort() : r.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }))
  })
  await p.locator('#map-fallback').waitFor({ state: 'visible' })
  assert.match(await p.locator('#map-fallback').innerText(), /지도를 불러오지 못했습니다/)
  fail = false
  await p.getByRole('button', { name: '지도 다시 시도' }).click()
  await p.locator('#map-fallback').waitFor({ state: 'hidden' })
})
test('좌표 없는 장소도 지도 실패 시 안내가 보인다', async t => {
  const errors = []
  const p = await pageFor(t, '#/parksajang/sasaroun', async p => {
    p.on('pageerror', e => errors.push(e.message))
    await p.route('**/data/places.json', async r => {
      const data = await (await r.fetch()).json()
      data.places.find(p => p.id === 'sasaroun').lat = null
      data.places.find(p => p.id === 'sasaroun').lng = null
      await r.fulfill({ json: data })
    })
    await p.route('**/light_all/**', r => r.abort())
  })
  await p.locator('#map-fallback').waitFor({ state: 'visible' })
  assert.match(await p.locator('#map-fallback').innerText(), /위치 확인 중/)
  assert.deepEqual(errors, [])
})
test('앱 모듈 로드 실패 시 재시도 화면', async t => {
  const p = await pageFor(t, '', async p => { await p.route('**/js/main.js', r => r.abort()) })
  assert.equal(await p.locator('#fatal').isVisible(), true)
})
