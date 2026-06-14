import { useState, useEffect } from 'react'
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
  const [formError, setFormError] = useState('')

  useEffect(() => { fetchEntries() }, [])

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
    if (!form.date) return setFormError('Vaelg en dato')
    if (isNaN(hours) || hours <= 0 || hours > 24) return setFormError('Indtast gyldige timer (0-24)')
    setSubmitting(true)
    const { error } = await supabase.from('time_entries').insert([{
      date: form.date,
      hours,
      description: form.description.trim() || null,
    }])
    if (error) {
      setFormError('Fejl: ' + error.message)
    } else {
      setForm({ date: new Date().toISOString().split('T')[0], hours: '', description: '' })
      await fetchEntries()
    }
    setSubmitting(false)
  }

  async function handleDelete(id) {
    setDeleteId(id)
    const { error } = await supabase.from('time_entries').delete().eq('id', id)
    if (!error) await fetchEntries()
    setDeleteId(null)
  }

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)
  const progressPct = Math.min(100, (totalHours / TOTAL_HOURS) * 100)
  const remaining = TOTAL_HOURS - totalHours
  const daysLeft = getDaysRemaining()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header style={{
        background: 'var(--dlg-green)',
        color: 'white',
        padding: '0 24px',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0
          }}>D</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>DLG Praktik Tracker</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Jun 2026 - Nov 2026 &middot; {TOTAL_HOURS} timer i alt</div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 48px' }}>

        <div style={{
          background: 'white', borderRadius: 'var(--radius)', padding: 24,
          boxShadow: 'var(--shadow)', marginBottom: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--gray-800)' }}>
              {totalHours.toFixed(1)} / {TOTAL_HOURS} timer
            </span>
            <span style={{ fontSize: 14, color: 'var(--dlg-green)', fontWeight: 600 }}>
              {progressPct.toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 12, background: 'var(--gray-200)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: progressPct + '%',
              background: 'var(--dlg-green)',
              borderRadius: 99, transition: 'width 0.6s ease'
            }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            <Stat label="Tilbage" value={Math.max(0, remaining).toFixed(1) + ' t'} />
            <Stat label="Registreret" value={entries.length + ' dage'} />
            <Stat label="Dage til slut" value={daysLeft} />
            {totalHours > 0 && daysLeft > 0 && (
              <Stat
                label="Snit noedvendigt"
                value={(remaining / daysLeft * 5 / 7).toFixed(1) + ' t/dag'}
                hint="paa arbejdsdage"
              />
            )}
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 24, boxShadow: 'var(--shadow)', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--gray-800)' }}>Registrer timer</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-600)' }}>Dato</span>
                <input
                  type="date"
                  value={form.date}
                  min={INTERNSHIP_START.toISOString().split('T')[0]}
                  max={INTERNSHIP_END.toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-600)' }}>Timer</span>
                <input
                  type="number"
                  placeholder="f.eks. 7.5"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={form.hours}
                  onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                  style={inputStyle}
                />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-600)' }}>Beskrivelse (valgfri)</span>
              <input
                type="text"
                placeholder="Hvad lavede du?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={inputStyle}
              />
            </label>
            {formError && (
              <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{formError}</div>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: submitting ? 'var(--gray-400)' : 'var(--dlg-green)',
                color: 'white', border: 'none', borderRadius: 'var(--radius)',
                padding: '10px 20px', fontWeight: 600, fontSize: 14,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Gemmer...' : '+ Tilfoej'}
            </button>
          </form>
        </div>

        <div style={{ background: 'white', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-800)' }}>Registrerede dage</h2>
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>Henter data...</div>
          ) : entries.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>
              Ingen timer registreret endnu.
            </div>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {entries.map((entry, i) => (
                <li key={entry.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 20px',
                  borderBottom: i < entries.length - 1 ? '1px solid var(--gray-100)' : 'none',
                }}>
                  <div style={{
                    minWidth: 44, height: 44, borderRadius: 8,
                    background: 'var(--dlg-green-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', flexShrink: 0
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--dlg-green)', lineHeight: 1 }}>
                      {Number(entry.hours).toFixed(1)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--dlg-green)', opacity: 0.8 }}>t</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--gray-800)' }}>
                      {formatDate(entry.date)}
                    </div>
                    {entry.description && (
                      <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleteId === entry.id}
                    title="Slet"
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'var(--gray-400)', padding: 4, borderRadius: 4,
                      fontSize: 18, lineHeight: 1,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-400)' }}
                  >
                    {deleteId === entry.id ? '...' : 'x'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

const inputStyle = {
  padding: '9px 12px',
  border: '1px solid var(--gray-200)',
  borderRadius: 'var(--radius)',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  background: 'var(--gray-50)',
  color: 'var(--gray-800)',
}

function Stat({ label, value, hint }) {
  return (
    <div style={{ flex: 1, minWidth: 80 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-800)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{hint}</div>}
    </div>
  )
}
