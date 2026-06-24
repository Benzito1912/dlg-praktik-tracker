import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import './index.css'

const TOTAL_HOURS = 230
const INTERNSHIP_START = new Date('2026-06-15')
const INTERNSHIP_END = new Date('2026-11-30')

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getDaysRemaining() {
  const today = new Date()
  const diff = INTERNSHIP_END - today
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// Animated counter hook
function useAnimatedNumber(target, duration = 800) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const start = prev.current
    const diff = target - start
    if (diff === 0) return
    const startTime = performance.now()
    const tick = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + diff * eased)
      if (progress < 1) requestAnimationFrame(tick)
      else prev.current = target
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return display
}

// Intersection observer hook
function useFadeIn(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function FadeSection({ children, delay = 0, className = '' }) {
  const [ref, visible] = useFadeIn()
  return (
    <div
      ref={ref}
      className={`fade-section ${visible ? 'fade-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default function App() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [formError, setFormError] = useState('')
  const [justAdded, setJustAdded] = useState(null)
  const [progressStarted, setProgressStarted] = useState(false)
  const progressRef = useRef(null)

  useEffect(() => { fetchEntries() }, [])

  useEffect(() => {
    const el = progressRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setProgressStarted(true); obs.disconnect() } },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loading])

  async function fetchEntries() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .order('date', { ascending: false })
    if (error) {
      setError('Kunne ikke hente data: ' + error.message)
    } else {
      setEntries(data || [])
    }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    const hours = parseFloat(form.hours)
    if (!form.date) return setFormError('Vælg en dato')
    if (isNaN(hours) || hours <= 0 || hours > 24) return setFormError('Indtast gyldige timer (0–24)')
    setSubmitting(true)
    const { data, error } = await supabase.from('time_entries').insert([{
      date: form.date,
      hours,
      description: form.description.trim() || null,
    }]).select().single()
    if (error) {
      setFormError('Fejl: ' + error.message)
    } else {
      setJustAdded(data?.id)
      setForm({ date: new Date().toISOString().split('T')[0], hours: '', description: '' })
      await fetchEntries()
      setTimeout(() => setJustAdded(null), 2000)
    }
    setSubmitting(false)
  }

  async function handleDelete(id) {
    setDeleteId(id)
    const { error } = await supabase.from('time_entries').delete().eq('id', id)
    if (!error) await fetchEntries()
    setDeleteId(null)
    setConfirmDelete(null)
  }

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)
  const progressPct = Math.min(100, (totalHours / TOTAL_HOURS) * 100)
  const remaining = TOTAL_HOURS - totalHours
  const daysLeft = getDaysRemaining()

  const animatedHours = useAnimatedNumber(progressStarted ? totalHours : 0)
  const animatedPct = useAnimatedNumber(progressStarted ? progressPct : 0)

  return (
    <div className="app">
      {/* HEADER */}
      <header className="site-header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-mark">D</div>
            <div className="logo-text">
              <span className="logo-title">DLG Praktik</span>
              <span className="logo-sub">Timetracker</span>
            </div>
          </div>
          <nav className="header-nav">
            <a href="#oversigt">Oversigt</a>
            <a href="#registrer">Registrer</a>
            <a href="#log">Log</a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-eyebrow">Jun 2026 – Nov 2026</div>
          <h1 className="hero-title">
            <span className="hero-title-main">Praktik</span>
            <span className="hero-title-accent">Timetracker</span>
          </h1>
          <p className="hero-desc">Hold styr på dine {TOTAL_HOURS} praktiktimer hos DLG Group. Registrer, følg med og bliv klar til afslutningen.</p>
          <div className="hero-cta">
            <a href="#registrer" className="btn-primary">+ Tilføj timer</a>
            <a href="#oversigt" className="btn-ghost">Se oversigt →</a>
          </div>
        </div>
        <div className="hero-scroll-hint">
          <span>Scroll</span>
          <div className="scroll-line" />
        </div>
      </section>

      <main className="main-content">

        {/* PROGRESS SECTION */}
        <section id="oversigt" className="section">
          <FadeSection>
            <div className="section-eyebrow">Oversigt</div>
            <h2 className="section-title">Din fremgang</h2>
          </FadeSection>

          <div ref={progressRef} className="progress-card">
            <FadeSection delay={100}>
              <div className="progress-header">
                <span className="progress-label">
                  <span className="progress-hours">{animatedHours.toFixed(1)}</span>
                  <span className="progress-sep"> / {TOTAL_HOURS} timer</span>
                </span>
                <span className="progress-pct">{animatedPct.toFixed(1)}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: progressStarted ? progressPct + '%' : '0%' }}
                />
              </div>
            </FadeSection>

            <div className="stats-grid">
              {[
                { label: 'Timer tilbage', value: Math.max(0, remaining).toFixed(1) + ' t', delay: 150 },
                { label: 'Registreret', value: entries.length + ' dage', delay: 200 },
                { label: 'Dage til slut', value: daysLeft, delay: 250 },
                ...(totalHours > 0 && daysLeft > 0 ? [{
                  label: 'Snit nødvendigt',
                  value: (remaining / daysLeft * 5 / 7).toFixed(1) + ' t/dag',
                  hint: 'på arbejdsdage',
                  delay: 300
                }] : [])
              ].map((stat, i) => (
                <FadeSection key={i} delay={stat.delay}>
                  <div className="stat-card">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                    {stat.hint && <div className="stat-hint">{stat.hint}</div>}
                  </div>
                </FadeSection>
              ))}
            </div>
          </div>

          {error && (
            <div className="error-banner">{error}</div>
          )}
        </section>

        {/* FORM SECTION */}
        <section id="registrer" className="section">
          <FadeSection>
            <div className="section-eyebrow">Log</div>
            <h2 className="section-title">Registrer timer</h2>
          </FadeSection>

          <FadeSection delay={100}>
            <div className="form-card">
              <form onSubmit={handleSubmit} className="entry-form">
                <div className="form-row">
                  <label className="form-field">
                    <span className="form-label">Dato</span>
                    <input
                      type="date"
                      value={form.date}
                      min={INTERNSHIP_START.toISOString().split('T')[0]}
                      max={INTERNSHIP_END.toISOString().split('T')[0]}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className="form-input"
                    />
                  </label>
                  <label className="form-field">
                    <span className="form-label">Timer</span>
                    <input
                      type="number"
                      placeholder="f.eks. 7.5"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={form.hours}
                      onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                      className="form-input"
                    />
                  </label>
                </div>
                <label className="form-field">
                  <span className="form-label">Beskrivelse <span className="form-optional">(valgfri)</span></span>
                  <input
                    type="text"
                    placeholder="Hvad lavede du?"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="form-input"
                  />
                </label>
                {formError && <div className="form-error">{formError}</div>}
                <button type="submit" disabled={submitting} className={`btn-submit ${submitting ? 'loading' : ''}`}>
                  {submitting ? (
                    <><span className="spinner" /> Gemmer...</>
                  ) : (
                    '+ Tilføj timer'
                  )}
                </button>
              </form>
            </div>
          </FadeSection>
        </section>

        {/* LOG SECTION */}
        <section id="log" className="section">
          <FadeSection>
            <div className="section-eyebrow">Historik</div>
            <h2 className="section-title">Registrerede dage</h2>
          </FadeSection>

          <div className="log-card">
            {loading ? (
              <div className="log-loading">
                <div className="loading-dots">
                  <span /><span /><span />
                </div>
                <p>Henter data...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="log-empty">
                <div className="log-empty-icon">◷</div>
                <p>Ingen timer registreret endnu.</p>
                <a href="#registrer" className="btn-ghost-sm">Tilføj din første dag →</a>
              </div>
            ) : (
              <ul className="entry-list">
                {entries.map((entry, i) => (
                  <li
                    key={entry.id}
                    className={`entry-item ${justAdded === entry.id ? 'entry-new' : ''} ${confirmDelete === entry.id ? 'entry-confirm' : ''}`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="entry-badge">
                      <span className="entry-hours">{Number(entry.hours).toFixed(1)}</span>
                      <span className="entry-unit">t</span>
                    </div>
                    <div className="entry-info">
                      <div className="entry-date">{formatDate(entry.date)}</div>
                      {entry.description && (
                        <div className="entry-desc">{entry.description}</div>
                      )}
                    </div>

                    {confirmDelete === entry.id ? (
                      <div className="entry-confirm-actions">
                        <span className="confirm-text">Slet?</span>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleteId === entry.id}
                          className="btn-confirm-yes"
                        >
                          {deleteId === entry.id ? '...' : 'Ja'}
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="btn-confirm-no">
                          Nej
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(entry.id)}
                        className="entry-delete"
                        title="Slet"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <span className="footer-logo">DLG Praktik Tracker</span>
          <span className="footer-meta">Jun – Nov 2026 · {TOTAL_HOURS} timer</span>
        </div>
      </footer>
    </div>
  )
}
