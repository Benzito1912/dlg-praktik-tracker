export const TOTAL_HOURS = 230
export const START_DATE = '2026-06-15'
export const END_DATE = '2026-11-30'
export const number = new Intl.NumberFormat('da-DK', {
  maximumFractionDigits: 2,
})

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function defaultDate() {
  return [START_DATE, localDate(), END_DATE].sort()[1]
}

export function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function stats(entries, today = localDate()) {
  const total =
    Math.round(
      entries.reduce((sum, entry) => sum + Number(entry.hours), 0) * 100,
    ) / 100
  const remaining = Math.max(0, TOTAL_HOURS - total)
  let weekdays = 0
  const day = new Date(`${today > START_DATE ? today : START_DATE}T12:00:00`)
  const end = new Date(`${END_DATE}T12:00:00`)
  while (day <= end) {
    if (day.getDay() !== 0 && day.getDay() !== 6) weekdays++
    day.setDate(day.getDate() + 1)
  }
  return {
    total,
    remaining,
    weekdays,
    days: new Set(entries.map((e) => e.date)).size,
    percent: Math.min(100, (total / TOTAL_HOURS) * 100),
    daily: weekdays ? remaining / weekdays : null,
  }
}

export function validateEntry(form, entries, editingId = null) {
  const hours = Number(form.hours)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(form.date) ||
    form.date < START_DATE ||
    form.date > END_DATE
  )
    return 'Vælg en dato mellem 15. juni og 30. november 2026.'
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24)
    return 'Indtast et timetal større end 0 og højst 24.'
  const existing = entries
    .filter((e) => e.date === form.date && e.id !== editingId)
    .reduce((sum, e) => sum + Number(e.hours), 0)
  if (existing + hours > 24)
    return `Der er allerede registreret ${number.format(existing)} timer på denne dato. En dag kan højst have 24 timer.`
  return ''
}

export function toCsv(entries) {
  const cell = (value) =>
    `"${String(value ?? '')
      .replace(/^[=+@\-\t\r\n]/, "'$&")
      .replaceAll('"', '""')}"`
  return (
    '\uFEFF' +
    [
      ['Dato', 'Timer', 'Beskrivelse'],
      ...entries.map((e) => [
        e.date,
        number.format(Number(e.hours)),
        e.description,
      ]),
    ]
      .map((row) => row.map(cell).join(';'))
      .join('\r\n')
  )
}
