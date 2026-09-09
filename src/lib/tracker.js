export const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 })
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
export function defaultDate(internship) { return [internship.start_date, localDate(), internship.end_date].sort()[1] }
export function formatDate(value, options = {}) { return new Date(`${value}T12:00:00`).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric', ...options }) }
export function stats(entries, internship, today = localDate()) {
  const target = Number(internship.target_hours)
  const total = Math.round(entries.reduce((sum, entry) => sum + Number(entry.hours), 0) * 100) / 100
  const remaining = Math.max(0, target - total)
  let weekdays = 0
  const day = new Date(`${today > internship.start_date ? today : internship.start_date}T12:00:00`)
  const end = new Date(`${internship.end_date}T12:00:00`)
  while (day <= end) { if (day.getDay() !== 0 && day.getDay() !== 6) weekdays++; day.setDate(day.getDate() + 1) }
  return { total, remaining, weekdays, days: new Set(entries.map(e => e.date)).size, percent: Math.min(100, target ? total / target * 100 : 0), daily: weekdays ? remaining / weekdays : null }
}
export function validateInternship(form) {
  if (form.name.trim().length < 2) return 'Giv forløbet et navn på mindst 2 tegn.'
  if (!form.start_date || !form.end_date || form.end_date < form.start_date) return 'Vælg en gyldig start- og slutdato.'
  const target = Number(form.target_hours)
  if (!Number.isFinite(target) || target <= 0 || target > 10000) return 'Timemålet skal være mellem 0 og 10.000 timer.'
  return ''
}
export function validateEntry(form, entries, internship, editingId = null) {
  const hours = Number(form.hours)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || form.date < internship.start_date || form.date > internship.end_date) return `Vælg en dato mellem ${formatDate(internship.start_date)} og ${formatDate(internship.end_date)}.`
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return 'Indtast et timetal større end 0 og højst 24.'
  const existing = entries.filter(e => e.date === form.date && e.id !== editingId).reduce((sum, e) => sum + Number(e.hours), 0)
  if (existing + hours > 24) return `Der er allerede registreret ${number.format(existing)} timer på denne dato. En dag kan højst have 24 timer.`
  return ''
}
export function toCsv(entries) {
  const cell = value => `"${String(value ?? '').replace(/^[=+@\-\t\r\n]/, "'$&").replaceAll('"', '""')}"`
  return '\uFEFF' + [['Dato', 'Timer', 'Beskrivelse'], ...entries.map(e => [e.date, number.format(Number(e.hours)), e.description])].map(row => row.map(cell).join(';')).join('\r\n')
}
