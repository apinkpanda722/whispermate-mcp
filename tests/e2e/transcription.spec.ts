import { test, expect, type Page } from '@playwright/test'
import {
  cleanupTranscriptions,
  seedTranscription,
  waitForAnonSession,
} from './supabase-test-helpers'

const MOCK_TRANSCRIPT = '이것은 테스트 변환 결과입니다.'

async function mockTranscribeFunction(page: Page, text = MOCK_TRANSCRIPT) {
  await page.route('**/functions/v1/transcribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text, language: 'ko', duration: 3 }),
    })
  })
}

test.describe('Whisper Mate 핵심 플로우', () => {
  test.afterEach(async ({ page }) => {
    await cleanupTranscriptions(page).catch(() => {
      // best-effort cleanup; nothing to assert on failure
    })
  })

  test('녹음 → 변환 → 클립보드 복사 → 히스토리 저장', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', '가짜 마이크 장치는 Chromium에서만 설정되어 있습니다')

    await context.grantPermissions(['microphone', 'clipboard-read', 'clipboard-write'])
    await mockTranscribeFunction(page)

    await page.goto('/')
    await waitForAnonSession(page)

    await page.getByRole('button', { name: '녹음 시작' }).click()
    await expect(page.getByText('녹음 중...')).toBeVisible()

    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: '녹음 중지' }).click()

    await expect(page.getByText('텍스트로 변환 중...')).toBeVisible()
    await expect(page.getByRole('heading', { name: '변환 결과' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(MOCK_TRANSCRIPT)).toBeVisible()
    await expect(page.getByText('클립보드에 복사되었습니다')).toBeVisible()

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toBe(MOCK_TRANSCRIPT)

    await page.getByRole('tab', { name: '히스토리' }).click()
    await expect(page.getByTestId('transcription-item').first()).toContainText(MOCK_TRANSCRIPT)
  })

  test('히스토리 검색 필터링', async ({ page }) => {
    await page.goto('/')
    await waitForAnonSession(page)

    const uniqueText = `테스트 검색용 항목 ${Date.now()}`
    await seedTranscription(page, uniqueText)
    await seedTranscription(page, '검색어와 무관한 다른 항목')

    await page.getByRole('tab', { name: '히스토리' }).click()
    await expect(page.getByTestId('transcription-item')).toHaveCount(2)

    await page.getByPlaceholder('변환 결과 검색...').fill('검색용')
    await page.waitForTimeout(500) // 디바운스 대기

    await expect(page.getByTestId('transcription-item')).toHaveCount(1)
    await expect(page.getByTestId('transcription-item').first()).toContainText(uniqueText)
  })

  test('히스토리 항목 재복사', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', '클립보드 읽기 검증은 Chromium에서만 안정적으로 동작합니다')

    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.goto('/')
    await waitForAnonSession(page)

    const uniqueText = `재복사 테스트 항목 ${Date.now()}`
    await seedTranscription(page, uniqueText)

    await page.getByRole('tab', { name: '히스토리' }).click()
    const item = page.getByTestId('transcription-item').filter({ hasText: uniqueText })
    await expect(item).toBeVisible()

    await item.getByRole('button', { name: '복사' }).click()
    await expect(page.getByText('클립보드에 복사되었습니다')).toBeVisible()

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toBe(uniqueText)
  })
})
