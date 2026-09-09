import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { defaultDate, stats, validateEntry, validateInternship, toCsv, localDate } from '../src/lib/tracker'

const internship = { start_date: '2026-08-01', end_date: '2026-11-30', target_hours: 230 }
const entries = [
  { id: 'a', date: '2026-09-04', hours: 4, description: 'Lager' },
  { id: 'b', date: '2026-09-04', hours: 3, description: 'Team' },
  { id: 'c', date: '2026-09-07', hours: 7.5, description: '=SUM(A1:A2)' },
]

test('beregninger, validering og eksport følger det valgte forløb', () => {
  expect(stats(entries, internship, '2026-11-27')).toMatchObject({ total: 14.5, remaining: 215.5, days: 2, weekdays: 2, daily: 107.75 })
  expect(defaultDate(internship)).toMatch(/^2026-/)
  expect(localDate(new Date(2026, 8, 8, 0, 15))).toBe('2026-09-08')
  expect(validateInternship({ name: 'DLG', start_date: '2026-09-01', end_date: '2026-08-01', target_hours: 230 })).toContain('gyldig')
  expect(validateEntry({ date: '2026-09-04', hours: 20 }, entries, internship)).toContain('højst have 24')
  expect(validateEntry({ date: '2027-01-01', hours: 1 }, entries, internship)).toContain('30. nov.')
  expect(toCsv(entries)).toContain('"\'=SUM(A1:A2)"')
})

for (const width of [1440, 768, 390, 320]) {
  test(`login er responsivt og tilgængeligt ved ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Velkommen tilbage' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log ind' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
  })
}

test('oprettelse og nulstilling viser de rigtige felter', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ny her? Opret en bruger' }).click()
  await expect(page.getByRole('heading', { name: 'Opret din bruger' })).toBeVisible()
  await expect(page.getByLabel('Gentag adgangskode')).toBeVisible()
  await page.getByRole('button', { name: 'Har du allerede en bruger? Log ind' }).click()
  await page.getByRole('button', { name: 'Glemt adgangskode?' }).click()
  await expect(page.getByRole('heading', { name: 'Nulstil adgangskode' })).toBeVisible()
  await expect(page.getByLabel('Adgangskode')).toHaveCount(0)
})
