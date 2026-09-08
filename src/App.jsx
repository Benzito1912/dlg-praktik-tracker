import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  TOTAL_HOURS,
  START_DATE,
  END_DATE,
  defaultDate,
  formatDate,
  number,
  stats,
  validateEntry,
  toCsv,
} from './lib/tracker'

const emptyForm = () => ({ date: defaultDate(), hours: '', description: '' })
const sortEntries = (entries) =>
  [...entries].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      String(b.created_at).localeCompare(String(a.created_at)),
  )

function Icon({ name, ...props }) {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    check: 'm5 12 4 4L19 6',
    clock: 'M12 8v4l3 2',
    download: 'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4',
    search: 'm16 16 5 5',
    edit: 'm15 5 4 4M4 20l4-1L20 7l-4-4L4 15v5',
    trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  }
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {name === 'clock' && <circle cx="12" cy="12" r="9" />}
      {name === 'search' && <circle cx="10" cy="10" r="6" />}
      <path d={paths[name]} />
    </svg>
  )
}

export default function App() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(!!supabase)
  const [loadError, setLoadError] = useState(supabase ? '' : 'Forbindelsen til databasen er ikke konfigureret. Kontakt sidens administrator.')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(null)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(10)
  const [month, setMonth] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const writeLock = useRef(false)
  const dateInput = useRef(null)
  const loadController = useRef(null)

  const fetchEntries = useCallback(async () => {
    if (!supabase) return
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const all = []
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabase
          .from('time_entries')
          .select('id,date,hours,description,created_at')
          .order('date', { ascending: false })
          .order('id')
          .range(from, from + 499)
          .abortSignal(controller.signal)
        if (error) throw error
        all.push(...data)
        if (data.length < 500) break
      }
      if (loadController.current === controller) setEntries(sortEntries(all))
    } catch {
      if (loadController.current === controller)
        setLoadError(
          supabase
            ? 'Vi kunne ikke hente dine timer. Tjek forbindelsen, og prøv igen.'
            : 'Forbindelsen til databasen er ikke konfigureret. Kontakt sidens administrator.',
        )
    } finally {
      clearTimeout(timeout)
      if (loadController.current === controller) setLoading(false)
    }
  }, [])

  function reloadEntries() {
    if (!supabase) return
    setLoading(true)
    setLoadError('')
    setActionError('')
    fetchEntries()
  }

  useEffect(() => {
    // Starts an external request; state changes occur only after its response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEntries()
    return () => {
      const controller = loadController.current
      loadController.current = null
      controller?.abort()
    }
  }, [fetchEntries])

  async function handleSubmit(event) {
    event.preventDefault()
    if (writeLock.current || loading || loadError || !supabase) return
    const validation = validateEntry(form, entries, editingId)
    setFormError(validation)
    if (validation) return
    writeLock.current = true
    setBusy('save')
    setMessage('')
    const payload = {
      date: form.date,
      hours: Number(form.hours),
      description: form.description.trim() || null,
    }
    try {
      const request = editingId
        ? supabase.from('time_entries').update(payload).eq('id', editingId)
        : supabase.from('time_entries').insert(payload)
      const { data, error } = await request
        .select('id,date,hours,description,created_at')
        .single()
      if (error || !data) throw error || new Error('Missing result')
      setEntries((previous) =>
        sortEntries([...previous.filter((e) => e.id !== data.id), data]),
      )
      setMessage(
        editingId
          ? 'Registreringen er opdateret.'
          : `${number.format(payload.hours)} timer er gemt for ${formatDate(payload.date)}.`,
      )
      setForm(emptyForm())
      setEditingId(null)
    } catch {
      setFormError(
        'Registreringen kunne ikke bekræftes. Dine felter er bevaret. Opdater historikken, før du prøver igen, så du undgår en dobbeltregistrering.',
      )
    } finally {
      writeLock.current = false
      setBusy(null)
    }
  }

  async function handleDelete(entry) {
    if (writeLock.current || !supabase) return
    writeLock.current = true
    setBusy(entry.id)
    setActionError('')
    setMessage('')
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entry.id)
        .select('id')
        .single()
      if (error || !data) throw error || new Error('Missing result')
      setEntries((previous) => previous.filter((e) => e.id !== entry.id))
      setConfirmId(null)
      setMessage(`Registreringen fra ${formatDate(entry.date)} er slettet.`)
      if (editingId === entry.id) {
        setEditingId(null)
        setForm(emptyForm())
      }
    } catch {
      setActionError(
        'Vi kunne ikke bekræfte sletningen. Opdater historikken, og prøv igen.',
      )
    } finally {
      writeLock.current = false
      setBusy(null)
    }
  }

  function editEntry(entry) {
    setEditingId(entry.id)
    setForm({
      date: entry.date,
      hours: String(entry.hours),
      description: entry.description || '',
    })
    setFormError('')
    setMessage('')
    dateInput.current?.focus()
  }

  const summary = stats(entries)
  const ready = !loading && !loadError
  const months = [...new Set(entries.map((e) => e.date.slice(0, 7)))]
    .sort()
    .reverse()
  const filtered = entries.filter(
    (e) =>
      (!month || e.date.startsWith(month)) &&
      `${e.description || ''} ${formatDate(e.date)} ${e.date}`
        .toLocaleLowerCase('da-DK')
        .includes(query.toLocaleLowerCase('da-DK').trim()),
  )
  const filteredHours = filtered.reduce((sum, e) => sum + Number(e.hours), 0)

  function exportEntries() {
    const url = URL.createObjectURL(
      new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8;' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'dlg-praktiktimer.csv'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Spring til indhold
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#oversigt"
            aria-label="DLG Praktik – oversigt"
          >
            <span className="brand-mark">D</span>
            <span>
              DLG <span className="brand-light">/ Praktik</span>
            </span>
          </a>
          <nav aria-label="Hovednavigation">
            <a href="#oversigt">Oversigt</a>
            <a href="#registrer">Registrer timer</a>
            <a href="#historik">Historik</a>
          </nav>
          <span className="header-period">15. juni – 30. nov. 2026</span>
        </div>
      </header>
      <main id="main" className="dashboard">
        <section id="oversigt" aria-labelledby="page-title">
          <div className="page-heading">
            <div>
              <p className="eyebrow">DIT PRAKTIKFORLØB HOS DLG</p>
              <h1 id="page-title">Små skridt. Fuld oversigt.</h1>
              <p className="intro">
                Dine timer, din fremgang og plads til det, du lærer undervejs.
              </p>
            </div>
            <a className="button primary heading-cta" href="#registrer">
              <Icon name="plus" />
              Registrer timer
            </a>
          </div>
          <div className="overview-grid" aria-busy={loading}>
            <div className="progress-card">
              <div className="card-kicker">
                <span>
                  <span className="status-dot" /> Din fremgang
                </span>
                <span>
                  {ready ? `${number.format(summary.percent)} %` : '—'}
                </span>
              </div>
              <div className="total">
                <strong>{ready ? number.format(summary.total) : '—'}</strong>
                <span>/ {TOTAL_HOURS} timer</span>
              </div>
              <progress
                max={TOTAL_HOURS}
                value={ready ? Math.min(summary.total, TOTAL_HOURS) : 0}
                aria-label={
                  ready
                    ? 'Registrerede praktiktimer'
                    : 'Praktiktimer er ikke indlæst'
                }
              />
              <p className="progress-caption">
                {!ready
                  ? loading
                    ? 'Henter dine registreringer…'
                    : 'Fremgangen vises, når forbindelsen er tilbage.'
                  : summary.remaining === 0
                    ? 'Godt gået! Du har nået dit mål på 230 timer.'
                    : `${number.format(summary.remaining)} timer tilbage til dit mål.`}
              </p>
              <div className="period-line">
                <span>15. JUN 2026</span>
                <span>30. NOV 2026</span>
              </div>
            </div>
            <div className="metrics">
              <article className="metric">
                <span className="metric-icon">
                  <Icon name="clock" />
                </span>
                <div>
                  <p>Timer tilbage</p>
                  <strong>
                    {ready ? number.format(summary.remaining) : '—'}{' '}
                    <small>timer</small>
                  </strong>
                </div>
              </article>
              <article className="metric">
                <span className="metric-icon">
                  <Icon name="check" />
                </span>
                <div>
                  <p>Registrerede dage</p>
                  <strong>
                    {ready ? summary.days : '—'} <small>unikke datoer</small>
                  </strong>
                </div>
              </article>
              <article className="metric">
                <span className="metric-icon">
                  <Icon name="arrow" />
                </span>
                <div>
                  <p>For at nå dit mål</p>
                  <strong>
                    {ready && summary.daily !== null
                      ? number.format(summary.daily)
                      : '—'}{' '}
                    <small>timer / hverdag</small>
                  </strong>
                  <p className="metric-hint">
                    {summary.weekdays
                      ? `${summary.weekdays} hverdage inkl. i dag · uden helligdagsfradrag`
                      : 'Praktikperioden er afsluttet'}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>
        {loadError && (
          <div role="alert" className="notice error">
            <p>{loadError}</p>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={reloadEntries}
            >
              Prøv igen
            </button>
          </div>
        )}
        <div
          className={`notice success ${message ? '' : 'visually-hidden'}`}
          role="status"
        >
          {message && <Icon name="check" />}
          <span>{message}</span>
        </div>
        <div className="workspace">
          <section
            className="panel registration"
            id="registrer"
            aria-labelledby="form-title"
          >
            <div className="panel-heading">
              <p className="eyebrow">EN DAG AD GANGEN</p>
              <h2 id="form-title">
                {editingId ? 'Rediger registrering' : 'Registrer dine timer'}
              </h2>
              <p>Gem dagens indsats, mens den er frisk i hukommelsen.</p>
            </div>
            <form
              onSubmit={handleSubmit}
              aria-describedby={formError ? 'form-error' : undefined}
            >
              <fieldset disabled={!!busy || !ready}>
                <legend className="visually-hidden">Timeregistrering</legend>
                <div className="form-row">
                  <label htmlFor="entry-date">
                    Dato
                    <input
                      ref={dateInput}
                      id="entry-date"
                      type="date"
                      required
                      min={START_DATE}
                      max={END_DATE}
                      value={form.date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, date: e.target.value }))
                      }
                    />
                  </label>
                  <label htmlFor="entry-hours">
                    Antal timer
                    <input
                      id="entry-hours"
                      type="number"
                      inputMode="decimal"
                      required
                      min="0.01"
                      max="24"
                      step="0.01"
                      placeholder="Fx 7,5"
                      value={form.hours}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, hours: e.target.value }))
                      }
                    />
                  </label>
                </div>
                <div
                  className="quick-hours"
                  role="group"
                  aria-label="Vælg antal timer"
                >
                  <span>Hurtigt valg</span>
                  {[4, 7.5, 8].map((hours) => (
                    <button
                      type="button"
                      key={hours}
                      aria-pressed={Number(form.hours) === hours}
                      onClick={() =>
                        setForm((f) => ({ ...f, hours: String(hours) }))
                      }
                    >
                      {number.format(hours)} t
                    </button>
                  ))}
                </div>
                <label htmlFor="entry-description">
                  Hvad arbejdede du med?{' '}
                  <span className="optional">Valgfrit</span>
                  <textarea
                    id="entry-description"
                    maxLength="2000"
                    rows="4"
                    placeholder="Fx kundemøde, lagerarbejde eller en ny opgave, du lærte…"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </label>
                <p className="field-hint">
                  En kort note gør det lettere at huske dit forløb.
                </p>
                <button type="submit" className="button primary save-button">
                  <Icon name={editingId ? 'check' : 'plus'} />
                  {busy === 'save'
                    ? 'Gemmer…'
                    : editingId
                      ? 'Gem ændringer'
                      : 'Gem registrering'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="button secondary cancel-edit"
                    onClick={() => {
                      setEditingId(null)
                      setForm(emptyForm())
                      setFormError('')
                    }}
                  >
                    Annuller redigering
                  </button>
                )}
              </fieldset>
              {formError && (
                <div className="form-error" role="alert" id="form-error">
                  {formError}
                  <button
                    type="button"
                    className="text-button"
                    disabled={!!busy || loading}
                    onClick={reloadEntries}
                  >
                    Opdater historikken
                  </button>
                </div>
              )}
            </form>
            <div className="form-footnote">
              <Icon name="check" />
              <span>Gemte timer indgår automatisk i din oversigt.</span>
            </div>
          </section>
          <section
            className="panel history"
            id="historik"
            aria-labelledby="history-title"
          >
            <div className="history-heading">
              <div>
                <p className="eyebrow">DIT ARBEJDE, SAMLET</p>
                <h2 id="history-title">Timehistorik</h2>
              </div>
              <button
                className="button secondary export-button"
                onClick={exportEntries}
                disabled={!ready || !filtered.length}
              >
                <Icon name="download" />
                Eksportér CSV
              </button>
            </div>
            <div className="filters">
              <label className="search-field">
                <span className="visually-hidden">Søg i historik</span>
                <Icon name="search" />
                <input
                  type="search"
                  placeholder="Søg i dine noter…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setVisibleCount(10) }}
                />
              </label>
              <label>
                <span className="visually-hidden">Filtrer efter måned</span>
                <select
                  value={month}
                  onChange={(e) => { setMonth(e.target.value); setVisibleCount(10) }}
                >
                  <option value="">Alle måneder</option>
                  {months.map((value) => (
                    <option key={value} value={value}>
                      {new Date(`${value}-01T12:00:00`).toLocaleDateString(
                        'da-DK',
                        { month: 'long', year: 'numeric' },
                      )}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="history-summary">
              <span>
                {ready
                  ? `${filtered.length} registreringer · ${number.format(filteredHours)} timer`
                  : 'Afventer data'}
              </span>
              <button
                className="text-button"
                disabled={!!busy || loading}
                onClick={reloadEntries}
              >
                Opdater
              </button>
            </div>
            {actionError && (
              <div className="form-error" role="alert">
                {actionError}
              </div>
            )}
            {loading ? (
              <div className="empty-state" role="status">
                <span className="loading-indicator" />
                <h3>Henter dine timer…</h3>
                <p>Din historik er på vej.</p>
              </div>
            ) : loadError ? (
              <div className="empty-state">
                <Icon name="clock" />
                <h3>Historikken er utilgængelig</h3>
                <p>Prøv at hente dine timer igen ovenfor.</p>
              </div>
            ) : !filtered.length ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <Icon name={entries.length ? 'search' : 'clock'} />
                </span>
                <h3>
                  {entries.length
                    ? 'Ingen registreringer matcher'
                    : 'Din første dag starter her'}
                </h3>
                <p>
                  {entries.length
                    ? 'Prøv en anden søgning eller vælg en anden måned.'
                    : 'Registrer dine timer, og se dit praktikforløb tage form.'}
                </p>
                {entries.length ? (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setQuery('')
                      setMonth('')
                      setVisibleCount(10)
                    }}
                  >
                    Nulstil filtre
                  </button>
                ) : (
                  <a className="text-button" href="#registrer">
                    Registrer din første dag →
                  </a>
                )}
              </div>
            ) : (
              <ul className="entry-list">
                {filtered.slice(0, visibleCount).map((entry) => (
                  <li key={entry.id} className="entry">
                    <div className="entry-main">
                      <div className="date-badge">
                        <strong>{Number(entry.date.slice(8))}</strong>
                        <span>
                          {new Date(
                            `${entry.date}T12:00:00`,
                          ).toLocaleDateString('da-DK', { month: 'short' })}
                        </span>
                      </div>
                      <div className="entry-copy">
                        <time dateTime={entry.date}>
                          {formatDate(entry.date)}
                        </time>
                        <p>
                          {entry.description || (
                            <span className="no-note">Ingen note tilføjet</span>
                          )}
                        </p>
                      </div>
                      <span className="hours-tag">
                        {number.format(Number(entry.hours))} t
                      </span>
                    </div>
                    <div className="entry-actions">
                      {confirmId === entry.id ? (
                        <>
                          <span className="delete-question">
                            Slet denne registrering?
                          </span>
                          <button
                            className="button danger"
                            disabled={!!busy}
                            onClick={() => handleDelete(entry)}
                          >
                            {busy === entry.id ? 'Sletter…' : 'Ja, slet'}
                          </button>
                          <button
                            className="button secondary"
                            disabled={!!busy}
                            onClick={() => setConfirmId(null)}
                          >
                            Annuller
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="icon-button"
                            disabled={!!busy}
                            aria-label={`Rediger registrering fra ${formatDate(entry.date)}`}
                            onClick={() => editEntry(entry)}
                          >
                            <Icon name="edit" />
                            <span>Rediger</span>
                          </button>
                          <button
                            className="icon-button delete-button"
                            disabled={!!busy}
                            aria-label={`Slet registrering fra ${formatDate(entry.date)}`}
                            onClick={() => setConfirmId(entry.id)}
                          >
                            <Icon name="trash" />
                            <span>Slet</span>
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {ready && filtered.length > visibleCount && <div className="show-more"><p>Viser {visibleCount} af {filtered.length} registreringer</p><button className="button secondary" onClick={() => setVisibleCount(count => count + 10)}>Vis flere registreringer</button></div>}
          </section>
        </div>
        <footer>
          <span>
            DLG Praktik <span className="footer-divider">/</span> Ét overblik
            over dit forløb.
          </span>
          <span>15. juni – 30. november 2026</span>
        </footer>
      </main>
    </>
  )
}
