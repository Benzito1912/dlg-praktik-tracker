import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { stats, validateEntry, toCsv, localDate } from '../src/lib/tracker'

const fixtures = [
  {
    id: 'a',
    date: '2026-09-07',
    hours: 7.5,
    description: 'Kundemøde og planlægning af ugens opgaver.',
    created_at: '2026-09-07T12:00:00Z',
  },
  {
    id: 'b',
    date: '2026-09-04',
    hours: 4,
    description: 'Introduktion til lagerarbejde og varemodtagelse.',
    created_at: '2026-09-04T12:00:00Z',
  },
  {
    id: 'c',
    date: '2026-09-04',
    hours: 3,
    description: 'Opfølgning med teamet.',
    created_at: '2026-09-04T14:00:00Z',
  },
  {
    id: 'd',
    date: '2026-08-31',
    hours: 8,
    description: null,
    created_at: '2026-08-31T14:00:00Z',
  },
]

async function mockApi(
  page,
  { rows = fixtures, failRead = false, failWrite = false } = {},
) {
  const state = { rows: structuredClone(rows), failRead, failWrite, writes: 0 }
  await page.route('https://tracker-test.supabase.co/**', async (route) => {
    const req = route.request()
    if (req.method() === 'GET') {
      if (state.failRead)
        return route.fulfill({ status: 500, json: { message: 'Test outage' } })
      const url = new URL(req.url())
      const from = Number(url.searchParams.get('offset') || 0)
      return route.fulfill({ json: state.rows.slice(from, from + 500) })
    }
    state.writes++
    if (state.failWrite)
      return route.fulfill({ status: 403, json: { message: 'Test denial' } })
    const id = new URL(req.url()).searchParams.get('id')?.replace('eq.', '')
    if (req.method() === 'DELETE') {
      state.rows = state.rows.filter((e) => e.id !== id)
      return route.fulfill({ json: { id } })
    }
    const row = {
      ...req.postDataJSON(),
      id: id || 'new-entry',
      created_at: '2026-09-08T12:00:00Z',
    }
    state.rows = [...state.rows.filter((e) => e.id !== row.id), row]
    return route.fulfill({ json: row })
  })
  return state
}

test('calculations handle duplicate dates, weekends, completed goals and local dates', () => {
  expect(stats(fixtures, '2026-11-27')).toMatchObject({
    total: 22.5,
    remaining: 207.5,
    days: 3,
    weekdays: 2,
    daily: 103.75,
  })
  expect(
    stats([{ date: '2026-06-15', hours: 240 }], '2026-12-01'),
  ).toMatchObject({ percent: 100, remaining: 0, weekdays: 0, daily: null })
  expect(localDate(new Date(2026, 8, 8, 0, 15))).toBe('2026-09-08')
  expect(validateEntry({ date: '2026-09-04', hours: 20 }, fixtures)).toContain(
    'højst have 24',
  )
  expect(validateEntry({ date: '2026-09-04', hours: 20 }, fixtures, 'b')).toBe(
    '',
  )
  expect(validateEntry({ date: '2026-12-01', hours: 1 }, [])).toContain(
    '30. november',
  )
  expect(
    toCsv([{ date: '2026-09-08', hours: 7.5, description: '=1+1' }]),
  ).toContain('"\'=1+1"')
})

test('create, edit, search, export and confirmed delete update the overview', async ({
  page,
}) => {
  const state = await mockApi(page)
  await page.goto('/')
  await expect(page.locator('.total strong')).toHaveText('22,5')
  await page.getByLabel('Dato', { exact: true }).fill('2026-09-08')
  await page.getByRole('button', { name: '7,5 t', exact: true }).click()
  await page.getByLabel('Hvad arbejdede du med?').fill('En ny testregistrering')
  await page
    .getByRole('button', { name: 'Gem registrering', exact: true })
    .click()
  await expect(page.locator('.total strong')).toHaveText('30')
  await expect(page.getByRole('status')).toContainText('7,5 timer er gemt')
  await page
    .getByRole('button', { name: 'Rediger registrering fra 8. sep. 2026' })
    .click()
  await expect(page.getByLabel('Dato', { exact: true })).toBeFocused()
  await page.getByLabel('Antal timer', { exact: true }).fill('6')
  await page.getByRole('button', { name: 'Gem ændringer' }).click()
  await expect(page.locator('.total strong')).toHaveText('28,5')
  await page.getByLabel('Søg i historik').fill('testregistrering')
  await expect(page.locator('.entry')).toHaveCount(1)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksportér CSV' }).click()
  expect((await download).suggestedFilename()).toBe('dlg-praktiktimer.csv')
  await page
    .getByRole('button', { name: 'Slet registrering fra 8. sep. 2026' })
    .click()
  expect(state.writes).toBe(2)
  await page.getByRole('button', { name: 'Annuller', exact: true }).click()
  expect(state.writes).toBe(2)
  await page
    .getByRole('button', { name: 'Slet registrering fra 8. sep. 2026' })
    .click()
  await page.getByRole('button', { name: 'Ja, slet' }).click()
  await expect(page.locator('.total strong')).toHaveText('22,5')
  expect(state.writes).toBe(3)
})

test('read and write errors preserve data and allow recovery', async ({
  page,
}) => {
  const state = await mockApi(page, { failRead: true })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('kunne ikke hente')
  await expect(
    page.getByRole('button', { name: 'Gem registrering' }),
  ).toBeDisabled()
  await expect(page.getByText('Din første dag starter her')).toHaveCount(0)
  state.failRead = false
  await page.getByRole('button', { name: 'Prøv igen' }).click()
  await expect(page.locator('.total strong')).toHaveText('22,5')
  state.failWrite = true
  await page.getByLabel('Antal timer', { exact: true }).fill('2')
  await page.getByLabel('Hvad arbejdede du med?').fill('Bevar denne note')
  await page.getByRole('button', { name: 'Gem registrering' }).click()
  await expect(page.getByRole('alert')).toContainText('Dine felter er bevaret')
  await expect(page.getByLabel('Hvad arbejdede du med?')).toHaveValue(
    'Bevar denne note',
  )
  await page
    .getByRole('button', { name: /Slet registrering fra/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Ja, slet' }).click()
  await expect(page.locator('.history [role=alert]')).toContainText(
    'kunne ikke bekræfte sletningen',
  )
  await expect(page.locator('.entry')).toHaveCount(4)
})

test('all API pages contribute to totals', async ({ page }) => {
  await mockApi(page, {
    rows: Array.from({ length: 501 }, (_, i) => ({
      ...fixtures[0],
      id: String(i),
      hours: 0.1,
    })),
  })
  await page.goto('/')
  await expect(page.locator('.total strong')).toHaveText('50,1')
  await expect(page.locator('.entry')).toHaveCount(10)
  await page.getByRole('button', { name: 'Vis flere registreringer' }).click()
  await expect(page.locator('.entry')).toHaveCount(20)
})

for (const width of [1440, 768, 390, 320]) {
  test(`layout, navigation and accessibility at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await mockApi(page)
    await page.goto('/')
    await expect(page.locator('.entry')).toHaveCount(4)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(page.getByRole('navigation')).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
    await page.screenshot({
      path: `artifacts/dashboard-${width}.png`,
      fullPage: true,
    })
  })
}

test('empty state and filters are actionable', async ({ page }) => {
  await mockApi(page, { rows: [] })
  await page.goto('/')
  await expect(page.getByText('Din første dag starter her')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Eksportér CSV' }),
  ).toBeDisabled()
})
