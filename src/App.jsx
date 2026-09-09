import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { defaultDate, formatDate, number, stats, toCsv, validateEntry, validateInternship } from './lib/tracker'

const sortEntries = rows => [...rows].sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at)))
const blankInternship = () => ({ name: '', organization: '', start_date: '', end_date: '', target_hours: '' })

function Icon({ name }) {
  const paths = { plus: 'M12 5v14M5 12h14', check: 'm5 12 4 4L19 6', clock: 'M12 8v4l3 2', download: 'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4', search: 'm16 16 5 5', edit: 'm15 5 4 4M4 20l4-1L20 7l-4-4L4 15v5', trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7' }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'clock' && <circle cx="12" cy="12" r="9" />}{name === 'search' && <circle cx="10" cy="10" r="6" />}<path d={paths[name]} /></svg>
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('')
    if (!supabase) return setError('Databasen er ikke konfigureret.')
    if (mode === 'signup' && password !== confirm) return setError('Adgangskoderne er ikke ens.')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
      } else if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/` } })
        if (authError) throw authError
        if (!data.session) setMessage('Tjek din indbakke og bekræft din e-mail. Derefter kan du logge ind.')
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` })
        if (resetError) throw resetError
        setMessage('Hvis adressen findes, har vi sendt et link til at vælge en ny adgangskode.')
      }
    } catch { setError(mode === 'login' ? 'E-mail eller adgangskode er forkert.' : 'Det lykkedes ikke. Kontrollér oplysningerne, og prøv igen.') }
    finally { setBusy(false) }
  }

  return <main className="auth-layout"><section className="auth-story"><a className="brand auth-brand" href="/"><span className="brand-mark">P</span><span>Praktik <span className="brand-light">Tracker</span></span></a><div><p className="eyebrow">DIT PRAKTIKFORLØB, SAMLET</p><h1>Timerne går.<br />Overblikket bliver.</h1><p>Opret dit eget forløb, følg fremgangen og gem det, du lærer undervejs.</p></div><p className="auth-footnote">Ét sikkert overblik – kun for dig.</p></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">PRAKTIK TRACKER</p><h2>{mode === 'login' ? 'Velkommen tilbage' : mode === 'signup' ? 'Opret din bruger' : 'Nulstil adgangskode'}</h2><p className="auth-intro">{mode === 'login' ? 'Log ind for at fortsætte dit praktikforløb.' : mode === 'signup' ? 'Din konto holder dine forløb og timer private.' : 'Indtast din e-mail, så sender vi et sikkert link.'}</p><form onSubmit={submit}><label htmlFor="auth-email">E-mail<input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>{mode !== 'reset' && <><label htmlFor="auth-password">Adgangskode<input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="8" required value={password} onChange={e => setPassword(e.target.value)} /></label>{mode === 'signup' && <label htmlFor="auth-confirm">Gentag adgangskode<input id="auth-confirm" type="password" autoComplete="new-password" minLength="8" required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>}</>}<button className="button primary auth-submit" disabled={busy}>{busy ? 'Vent et øjeblik…' : mode === 'login' ? 'Log ind' : mode === 'signup' ? 'Opret bruger' : 'Send link'}</button></form>{error && <div className="form-error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}<div className="auth-links">{mode === 'login' && <button onClick={() => setMode('reset')}>Glemt adgangskode?</button>}<button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setMessage('') }}>{mode === 'signup' ? 'Har du allerede en bruger? Log ind' : 'Ny her? Opret en bruger'}</button></div></div></section></main>
}

function InternshipForm({ internship, userId, onSaved, onCancel }) {
  const [form, setForm] = useState(internship || blankInternship())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event) {
    event.preventDefault(); const validation = validateInternship(form); setError(validation); if (validation) return
    setBusy(true)
    const payload = { user_id: userId, name: form.name.trim(), organization: form.organization.trim() || null, start_date: form.start_date, end_date: form.end_date, target_hours: Number(form.target_hours) }
    const request = internship ? supabase.from('internships').update(payload).eq('id', internship.id) : supabase.from('internships').insert(payload)
    const { data, error: saveError } = await request.select().single()
    setBusy(false)
    if (saveError) return setError('Forløbet kunne ikke gemmes. Prøv igen.')
    onSaved(data)
  }
  return <form className="internship-form" onSubmit={save}><div className="form-row"><label>Navn på forløbet<input required maxLength="100" placeholder="Fx Mit praktikforløb hos DLG" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label><label>Praktiksted <span className="optional">Valgfrit</span><input maxLength="100" placeholder="Fx DLG" value={form.organization || ''} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} /></label></div><div className="form-row three"><label>Startdato<input type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></label><label>Slutdato<input type="date" required min={form.start_date} value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></label><label>Timemål<input type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" required placeholder="Fx 230" value={form.target_hours} onChange={e => setForm(f => ({ ...f, target_hours: e.target.value }))} /></label></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-actions"><button className="button primary" disabled={busy}>{busy ? 'Gemmer…' : internship ? 'Gem ændringer' : 'Opret forløb'}</button>{onCancel && <button type="button" className="button secondary" onClick={onCancel}>Annuller</button>}</div></form>
}

function Tracker({ internship, user, onSignOut, controls }) {
  const emptyEntry = () => ({ date: defaultDate(internship), hours: '', description: '' })
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState(emptyEntry)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState('')
  const [visible, setVisible] = useState(10)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: loadError } = await supabase.from('time_entries').select('id,date,hours,description,created_at').eq('internship_id', internship.id).order('date', { ascending: false }).order('id')
    if (loadError) setError('Vi kunne ikke hente dine timer. Prøv igen.')
    else setEntries(sortEntries(data || []))
    setLoading(false)
  }, [internship.id])
  // Data is synchronized with the active server-side internship.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function saveEntry(event) {
    event.preventDefault(); const validation = validateEntry(form, entries, internship, editingId); setError(validation); if (validation) return
    setBusy('save'); setMessage('')
    const payload = { internship_id: internship.id, date: form.date, hours: Number(form.hours), description: form.description.trim() || null }
    const request = editingId ? supabase.from('time_entries').update(payload).eq('id', editingId).eq('internship_id', internship.id) : supabase.from('time_entries').insert(payload)
    const { data, error: saveError } = await request.select().single()
    setBusy('')
    if (saveError) return setError('Registreringen kunne ikke gemmes. Dine felter er bevaret.')
    setEntries(previous => sortEntries([...previous.filter(e => e.id !== data.id), data])); setForm(emptyEntry()); setEditingId(null); setError(''); setMessage('Registreringen er gemt.')
  }
  async function remove(entry) {
    setBusy(entry.id); const { data, error: deleteError } = await supabase.from('time_entries').delete().eq('id', entry.id).eq('internship_id', internship.id).select('id').single(); setBusy('')
    if (deleteError || !data) return setError('Registreringen kunne ikke slettes.')
    setEntries(previous => previous.filter(e => e.id !== entry.id)); setConfirmId(null); setMessage('Registreringen er slettet.')
  }
  const summary = stats(entries, internship)
  const months = [...new Set(entries.map(e => e.date.slice(0, 7)))].sort().reverse()
  const filtered = entries.filter(e => (!month || e.date.startsWith(month)) && `${e.description || ''} ${formatDate(e.date)} ${e.date}`.toLocaleLowerCase('da-DK').includes(query.toLocaleLowerCase('da-DK').trim()))
  function exportCsv() { const url = URL.createObjectURL(new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'praktiktracker-timer.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }

  return <><a className="skip-link" href="#main">Spring til indhold</a><header className="site-header"><div className="header-inner"><a className="brand" href="#oversigt"><span className="brand-mark">P</span><span>Praktik <span className="brand-light">Tracker</span></span></a><nav aria-label="Hovednavigation"><a href="#oversigt">Oversigt</a><a href="#registrer">Registrer timer</a><a href="#historik">Historik</a></nav><div className="account-actions"><span title={user.email}>{user.email}</span><button className="button secondary" onClick={onSignOut}>Log ud</button></div></div></header><main id="main" className="dashboard">{controls}<section id="oversigt"><div className="page-heading"><div><p className="eyebrow">DIT PRAKTIKFORLØB</p><h1>{internship.name}</h1><p className="intro">{internship.organization ? `${internship.organization} · ` : ''}{formatDate(internship.start_date)} – {formatDate(internship.end_date)}</p></div><a className="button primary heading-cta" href="#registrer"><Icon name="plus" />Registrer timer</a></div><div className="overview-grid"><div className="progress-card"><div className="card-kicker"><span><span className="status-dot" />Din fremgang</span><span>{number.format(summary.percent)} %</span></div><div className="total"><strong>{loading ? '—' : number.format(summary.total)}</strong><span>/ {number.format(internship.target_hours)} timer</span></div><progress max={Number(internship.target_hours)} value={summary.total} /><p className="progress-caption">{number.format(summary.remaining)} timer tilbage til dit mål.</p><div className="period-line"><span>{formatDate(internship.start_date)}</span><span>{formatDate(internship.end_date)}</span></div></div><div className="metrics"><article className="metric"><span className="metric-icon"><Icon name="clock" /></span><div><p>Timer tilbage</p><strong>{number.format(summary.remaining)} <small>timer</small></strong></div></article><article className="metric"><span className="metric-icon"><Icon name="check" /></span><div><p>Registrerede dage</p><strong>{summary.days} <small>unikke datoer</small></strong></div></article><article className="metric"><span className="metric-icon"><Icon name="clock" /></span><div><p>For at nå dit mål</p><strong>{summary.daily === null ? '—' : number.format(summary.daily)} <small>timer / hverdag</small></strong><p className="metric-hint">{summary.weekdays} hverdage inkl. i dag</p></div></article></div></div></section>{message && <div className="notice success" role="status"><Icon name="check" />{message}</div>}{error && <div className="notice error" role="alert">{error}<button className="button secondary" onClick={load}>Prøv igen</button></div>}<div className="workspace"><section className="panel registration" id="registrer"><div className="panel-heading"><p className="eyebrow">EN DAG AD GANGEN</p><h2>{editingId ? 'Rediger registrering' : 'Registrer dine timer'}</h2><p>Gem dagens indsats, mens den er frisk i hukommelsen.</p></div><form onSubmit={saveEntry}><fieldset disabled={!!busy || loading}><div className="form-row"><label>Dato<input type="date" min={internship.start_date} max={internship.end_date} required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></label><label>Antal timer<input type="number" inputMode="decimal" min="0.01" max="24" step="0.01" required value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} /></label></div><div className="quick-hours"><span>Hurtigt valg</span>{[4, 7.5, 8].map(hours => <button type="button" key={hours} onClick={() => setForm(f => ({ ...f, hours: String(hours) }))}>{number.format(hours)} t</button>)}</div><label>Hvad arbejdede du med? <span className="optional">Valgfrit</span><textarea rows="4" maxLength="2000" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label><button className="button primary save-button">{busy === 'save' ? 'Gemmer…' : editingId ? 'Gem ændringer' : 'Gem registrering'}</button>{editingId && <button type="button" className="button secondary cancel-edit" onClick={() => { setEditingId(null); setForm(emptyEntry()) }}>Annuller</button>}</fieldset></form></section><section className="panel history" id="historik"><div className="history-heading"><div><p className="eyebrow">DIT ARBEJDE, SAMLET</p><h2>Timehistorik</h2></div><button className="button secondary" onClick={exportCsv} disabled={!filtered.length}><Icon name="download" />Eksportér CSV</button></div><div className="filters"><label className="search-field"><span className="visually-hidden">Søg</span><Icon name="search" /><input type="search" placeholder="Søg i dine noter…" value={query} onChange={e => { setQuery(e.target.value); setVisible(10) }} /></label><select aria-label="Filtrer efter måned" value={month} onChange={e => { setMonth(e.target.value); setVisible(10) }}><option value="">Alle måneder</option>{months.map(m => <option key={m} value={m}>{formatDate(`${m}-01`, { day: undefined, month: 'long' })}</option>)}</select></div><div className="history-summary">{filtered.length} registreringer · {number.format(filtered.reduce((s, e) => s + Number(e.hours), 0))} timer</div>{loading ? <div className="empty-state">Henter dine timer…</div> : !filtered.length ? <div className="empty-state"><h3>Ingen registreringer endnu</h3><p>Tilføj din første dag for at komme i gang.</p></div> : <ul className="entry-list">{filtered.slice(0, visible).map(entry => <li className="entry" key={entry.id}><div className="entry-main"><div className="date-badge"><strong>{Number(entry.date.slice(8))}</strong><span>{formatDate(entry.date, { day: undefined, year: undefined })}</span></div><div className="entry-copy"><time>{formatDate(entry.date)}</time><p>{entry.description || 'Ingen note tilføjet'}</p></div><span className="hours-tag">{number.format(entry.hours)} t</span></div><div className="entry-actions">{confirmId === entry.id ? <><span>Slet denne registrering?</span><button className="button danger" disabled={!!busy} onClick={() => remove(entry)}>Ja, slet</button><button className="button secondary" onClick={() => setConfirmId(null)}>Annuller</button></> : <><button className="icon-button" onClick={() => { setEditingId(entry.id); setForm({ date: entry.date, hours: String(entry.hours), description: entry.description || '' }); location.hash = 'registrer' }}><Icon name="edit" />Rediger</button><button className="icon-button delete-button" onClick={() => setConfirmId(entry.id)}><Icon name="trash" />Slet</button></>}</div></li>)}</ul>}{filtered.length > visible && <div className="show-more"><button className="button secondary" onClick={() => setVisible(v => v + 10)}>Vis flere</button></div>}</section></div><footer><span>Praktik Tracker · Dit forløb, dit overblik.</span></footer></main></>
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [internships, setInternships] = useState([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!supabase) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  const loadInternships = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const { data } = await supabase.from('internships').select('*').order('created_at')
    setInternships(data || []); setActiveId(previous => (data || []).some(i => i.id === previous) ? previous : data?.[0]?.id || ''); setLoading(false)
  }, [session])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadInternships() }, [loadInternships])
  const active = useMemo(() => internships.find(i => i.id === activeId), [internships, activeId])
  if (session === undefined) return <main className="splash"><span className="brand-mark">P</span><p>Åbner Praktik Tracker…</p></main>
  if (!session) return <AuthScreen />
  const controls = <section className="internship-controls"><div><label htmlFor="internship-picker">Aktivt praktikforløb</label>{internships.length > 0 && <select id="internship-picker" value={activeId} onChange={e => { setActiveId(e.target.value); setEditing(false) }}>{internships.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</div><div><button className="button secondary" onClick={() => setEditing(active ? active : true)}>{active ? 'Rediger forløb' : 'Opret dit første forløb'}</button><button className="button primary" onClick={() => setEditing(true)}><Icon name="plus" />Nyt forløb</button></div>{editing && <div className="internship-editor"><h2>{editing === true ? 'Nyt praktikforløb' : 'Rediger praktikforløb'}</h2><InternshipForm internship={editing === true ? null : editing} userId={session.user.id} onCancel={() => setEditing(false)} onSaved={saved => { setInternships(previous => [...previous.filter(i => i.id !== saved.id), saved]); setActiveId(saved.id); setEditing(false) }} /></div>}</section>
  if (loading) return <main className="splash"><span className="brand-mark">P</span><p>Henter dine praktikforløb…</p></main>
  if (!active) return <><header className="site-header"><div className="header-inner"><div className="brand"><span className="brand-mark">P</span>Praktik Tracker</div><button className="button secondary" onClick={() => supabase.auth.signOut()}>Log ud</button></div></header><main className="dashboard onboarding"><p className="eyebrow">VELKOMMEN</p><h1>Opret dit første praktikforløb</h1><p>Vælg selv navn, praktiksted, periode og timemål.</p><InternshipForm userId={session.user.id} onSaved={saved => { setInternships([saved]); setActiveId(saved.id) }} /></main></>
  return <Tracker key={active.id} internship={active} user={session.user} controls={controls} onSignOut={() => supabase.auth.signOut()} />
}
