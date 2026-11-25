import React, { useState, useRef, useCallback, useEffect } from 'react'

// ── constants ───────────────────────────────────────────────────────────────
const API = ''   // empty = same origin; set to 'http://localhost:8000' for dev if needed

// ── tiny helpers ─────────────────────────────────────────────────────────────
const cls = (...a) => a.filter(Boolean).join(' ')

function ScoreBar({ value, max, color = 'bg-indigo-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-10 text-right">{pct}%</span>
    </div>
  )
}

function Spinner({ size = 5 }) {
  return (
    <svg className={`spinner w-${size} h-${size} text-indigo-600`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

// ── Step 1: Configure ────────────────────────────────────────────────────────
function ConfigStep({ onNext }) {
  const [subject, setSubject] = useState('Data Science')

  return (
    <div className="max-w-lg mx-auto mt-20 fade-in">
      <div className="text-center mb-10">
        <div className="text-5xl mb-3">🎓</div>
        <h1 className="text-3xl font-bold text-slate-800">AI Exam Grader</h1>
        <p className="text-slate-500 mt-2">Upload student answer sheets · Get instant, fair grades &amp; parent reports</p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject / Exam Name</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Data Science"
            className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => subject.trim() && onNext({ subject: subject.trim() })}
          disabled={!subject.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          Next: Upload Files →
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Upload ───────────────────────────────────────────────────────────
function DropZone({ label, accept, multiple, file, files, onFile, onFiles, icon }) {
  const ref = useRef()
  const [over, setOver] = useState(false)

  const handle = (f) => {
    if (multiple) onFiles([...f])
    else onFile(f[0])
  }

  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); handle([...e.dataTransfer.files]) }}
      className={cls(
        'border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all text-center',
        over ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
      )}
    >
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={e => handle([...e.target.files])} />
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {multiple
        ? <p className="text-xs text-slate-400 mt-1">{files?.length ? `${files.length} file(s) selected` : 'Drop PDFs here or click'}</p>
        : <p className="text-xs text-slate-400 mt-1">{file ? `✓ ${file.name}` : 'Drop PDF or TXT here or click'}</p>
      }
    </div>
  )
}

function UploadStep({ config, onBack, onGrade }) {
  const [qPaper, setQPaper] = useState(null)
  const [scheme, setScheme] = useState(null)
  const [sheets, setSheets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ready = qPaper && scheme && sheets.length > 0

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('subject', config.subject)
      form.append('question_paper', qPaper)
      form.append('marking_scheme', scheme)
      sheets.forEach(s => form.append('answer_sheets', s))

      const res = await fetch(`${API}/api/grade`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const { job_id } = await res.json()
      onGrade(job_id)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 fade-in">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 text-sm">← Back</button>
        <h2 className="text-2xl font-bold text-slate-800">Upload Exam Files</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-4">
        <DropZone label="Question Paper" icon="📄" accept=".pdf,.txt" multiple={false}
          file={qPaper} onFile={setQPaper} />
        <DropZone label="Marking Scheme / Answer Key" icon="📋" accept=".pdf,.txt" multiple={false}
          file={scheme} onFile={setScheme} />
        <DropZone label="Student Answer Sheets (multiple PDFs)" icon="📚" accept=".pdf" multiple
          files={sheets} onFiles={setSheets} />

        {sheets.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto">
            {sheets.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-slate-600 truncate">{f.name}</span>
                <button onClick={e => { e.stopPropagation(); setSheets(s => s.filter((_, j) => j !== i)) }}
                  className="text-slate-400 hover:text-red-500 ml-2 text-xs">✕</button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button onClick={handleSubmit} disabled={!ready || loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
          {loading ? <><Spinner /> Starting…</> : `🚀 Grade ${sheets.length} Student Sheet${sheets.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Progress ─────────────────────────────────────────────────────────
const PHASES = [
  { id: 'scheme',     label: '1. Marking Scheme' },
  { id: 'transcribe', label: '2. Reading Answers' },
  { id: 'grade',      label: '3. Checking Questions' },
  { id: 'report',     label: '4. Writing Report' },
]

function ProgressStep({ jobId, onDone }) {
  const [logs, setLogs] = useState([])
  const [doneCount, setDoneCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [pct, setPct] = useState(0)
  const [phase, setPhase] = useState('scheme')
  const [action, setAction] = useState('Starting pipeline…')
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState('running')
  const logRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(s => (status === 'running' ? s + 1 : s))
    }, 1000)
    return () => clearInterval(timer)
  }, [status])

  useEffect(() => {
    const es = new EventSource(`${API}/api/jobs/${jobId}/stream`)

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'final') {
        setStatus(msg.status)
        if (msg.status === 'done') setPct(100)
        es.close()
        if (msg.status === 'done') setTimeout(() => onDone(), 900)
        return
      }
      setLogs(prev => [...prev, msg])
      if (typeof msg.pct === 'number') setPct(p => Math.max(p, msg.pct))
      if (msg.phase) setPhase(msg.phase === 'mcq' ? 'grade' : msg.phase)
      if (msg.action) setAction(msg.action)
      if (msg.type === 'student_done') setDoneCount(c => c + 1)
      if (msg.total_students) setTotalCount(msg.total_students)
    }

    // Fallback poll so progress stays in sync even if SSE drops
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/jobs/${jobId}`)
        const j = await r.json()
        if (j.total_students) setTotalCount(j.total_students)
        if (typeof j.done_students === 'number') setDoneCount(j.done_students)
        if (typeof j.pct === 'number') setPct(p => Math.max(p, j.pct))
        if (j.current_action) setAction(j.current_action)
        if (j.phase) setPhase(j.phase === 'mcq' ? 'grade' : j.phase)
        if (j.status === 'done' || j.status === 'error') {
          setStatus(j.status)
          clearInterval(poll)
        }
      } catch {}
    }, 1500)

    return () => { es.close(); clearInterval(poll) }
  }, [jobId])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const mins = Math.floor(elapsed / 60)
  const secs = String(elapsed % 60).padStart(2, '0')
  const phaseOrder = ['scheme', 'transcribe', 'grade', 'report', 'student_done', 'complete']
  const currentPhaseIdx = phaseOrder.indexOf(phase)

  return (
    <div className="max-w-2xl mx-auto mt-12 fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {status === 'running' ? <Spinner size={6} /> : <span className="text-2xl">{status === 'done' ? '✅' : '❌'}</span>}
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {status === 'running' ? 'Grading in progress…' : status === 'done' ? 'Grading complete!' : 'Error occurred'}
              </h2>
              <p className="text-sm text-slate-500">
                Job {jobId} · {doneCount} of {totalCount || '?'} students done
              </p>
            </div>
          </div>
          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            ⏱ {mins}:{secs}
          </span>
        </div>

        {/* Stage tracker */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PHASES.map((p, idx) => {
            const pIdx = phaseOrder.indexOf(p.id)
            const done = status === 'done' || currentPhaseIdx > pIdx
            const active = status === 'running' && currentPhaseIdx === pIdx
            return (
              <div key={p.id} className={cls(
                'rounded-lg px-2.5 py-2 text-xs font-medium text-center border transition-all',
                done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                active ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm' :
                'bg-slate-50 border-slate-200 text-slate-400'
              )}>
                {done ? '✓ ' : active ? '● ' : ''}{p.label}
              </div>
            )
          })}
        </div>

        {/* Live current action banner */}
        {status === 'running' && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-4 flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
            <span className="text-sm font-medium text-indigo-900 truncate">{action}</span>
          </div>
        )}

        {/* Granular progress bar */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Overall Progress</span>
            <span className="font-semibold text-indigo-600">{pct}%</span>
          </div>
          <div className="bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Live activity log */}
        <div ref={logRef} className="log-scroll bg-slate-950 rounded-xl p-4 font-mono text-xs space-y-1">
          {logs.length === 0 && <p className="text-slate-500">Waiting for pipeline to start…</p>}
          {logs.map((msg, i) => (
            <div key={i} className={cls(
              msg.type === 'error' ? 'text-red-400' :
              msg.type === 'warn' ? 'text-amber-400' :
              msg.type === 'student_done' ? 'text-emerald-400 font-semibold' :
              msg.type === 'student_start' ? 'text-indigo-300 font-semibold' :
              msg.type === 'step' ? 'text-sky-300' :
              msg.type === 'complete' ? 'text-emerald-300 font-semibold' :
              'text-slate-400'
            )}>
              {msg.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Results ──────────────────────────────────────────────────────────
function StudentRow({ result }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('breakdown')
  const pct = result.max_marks > 0 ? Math.round((result.total / result.max_marks) * 100) : 0
  const passing = pct >= 40

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden fade-in">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
      >
        <span className="font-mono text-sm text-slate-500 w-32 truncate">{result.student_id}</span>
        <div className="flex-1">
          <ScoreBar value={result.total} max={result.max_marks}
            color={pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'} />
        </div>
        <span className={cls(
          'text-sm font-semibold w-20 text-right',
          passing ? 'text-emerald-600' : 'text-red-500'
        )}>
          {result.total}/{result.max_marks}
        </span>
        <div className="flex gap-1.5">
          {result.flags?.map(f => (
            <span key={f} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{f}</span>
          ))}
        </div>
        <span className="text-slate-400 ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-200 bg-slate-50">
          {/* Sub-tabs */}
          <div className="flex border-b border-slate-200 bg-white">
            {['breakdown', 'mcq', 'short', 'report'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cls(
                  'px-5 py-2.5 text-sm font-medium capitalize transition-colors',
                  tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                )}>
                {t === 'report' ? '📄 Parent Report' : t === 'mcq' ? '🔘 MCQ' : t === 'short' ? '✍️ Short Answers' : '📊 Breakdown'}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'breakdown' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">MCQ Score</p>
                  <p className="text-3xl font-bold text-slate-800">{result.mcq_score}<span className="text-lg text-slate-400">/{result.mcq_max}</span></p>
                  <ScoreBar value={result.mcq_score} max={result.mcq_max} color="bg-indigo-500" />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Short Answer Score</p>
                  <p className="text-3xl font-bold text-slate-800">{result.short_score}<span className="text-lg text-slate-400">/{result.short_max}</span></p>
                  <ScoreBar value={result.short_score} max={result.short_max} color="bg-purple-500" />
                </div>
                {result.flags?.length > 0 && (
                  <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-amber-800">⚠️ Flagged for teacher review: {result.flags.join(', ')}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'mcq' && (
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(result.per_question)
                  .filter(([, v]) => v.type === 'mcq')
                  .map(([qn, v]) => (
                    <div key={qn} className={cls(
                      'rounded-lg p-2 text-center text-sm border',
                      v.awarded ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                    )}>
                      <div className="text-xs text-slate-500">Q{qn}</div>
                      <div className="font-bold">{v.student_answer || '–'}</div>
                      <div className="text-xs">{v.awarded ? '✓' : `✗ ${v.correct}`}</div>
                    </div>
                  ))}
              </div>
            )}

            {tab === 'short' && (
              <div className="space-y-3">
                {Object.entries(result.per_question)
                  .filter(([, v]) => v.type === 'short')
                  .map(([qn, v]) => (
                    <div key={qn} className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-slate-700">Q{qn}</span>
                        <span className={cls(
                          'text-sm font-semibold px-2 py-0.5 rounded-full',
                          v.awarded === v.max ? 'bg-emerald-100 text-emerald-700' :
                          v.awarded > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                        )}>
                          {v.awarded}/{v.max}
                        </span>
                      </div>
                      {v.transcript && (
                        <p className="text-xs text-slate-500 italic mb-1">"{v.transcript}"</p>
                      )}
                      <p className="text-xs text-slate-600">{v.feedback}</p>
                      {(v.needs_review || v.injection_attempt) && (
                        <p className="text-xs text-amber-600 mt-1">
                          {v.injection_attempt ? '⚠️ Prompt injection detected' : '🔍 Needs teacher review'}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {tab === 'report' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Parent Progress Report</h3>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{result.parent_report}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultsStep({ jobId, onReset }) {
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('total')

  useEffect(() => {
    const load = async () => {
      const r = await fetch(`${API}/api/jobs/${jobId}`)
      setJob(await r.json())
      setLoading(false)
    }
    load()
  }, [jobId])

  if (loading) return <div className="flex justify-center mt-32"><Spinner size={8} /></div>
  if (!job) return <p className="text-center mt-20 text-slate-500">Could not load results.</p>

  const { summary, results = [] } = job
  const filtered = results
    .filter(r => r.student_id.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'total' ? b.total - a.total : a.student_id.localeCompare(b.student_id))

  return (
    <div className="max-w-4xl mx-auto mt-10 pb-16 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Results</h2>
          <p className="text-slate-500 text-sm">Job {jobId} · {results.length} students graded</p>
        </div>
        <div className="flex gap-2">
          <a href={`${API}/api/jobs/${jobId}/csv`}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5">
            ⬇️ CSV
          </a>
          <a href={`${API}/api/jobs/${jobId}/reports`}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5">
            📄 Reports
          </a>
          <button onClick={onReset}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            + New Session
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Students', value: summary.total_students, icon: '👥' },
            { label: 'Average', value: `${summary.average_score}/${summary.max_marks}`, icon: '📊' },
            { label: 'Pass Rate', value: `${summary.pass_rate}%`, icon: '✅' },
            { label: 'Highest', value: summary.highest, icon: '🏆' },
            { label: 'Lowest', value: summary.lowest, icon: '📉' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-xl mb-1">{c.icon}</div>
              <div className="text-xl font-bold text-slate-800">{c.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="total">Sort by Score</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Student rows */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-12">No students found</p>
        )}
        {filtered.map(r => <StudentRow key={r.student_id} result={r} />)}
      </div>
    </div>
  )
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState('config')
  const [config, setConfig] = useState(null)
  const [jobId, setJobId] = useState(null)

  const reset = () => { setStep('config'); setConfig(null); setJobId(null) }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <span className="text-lg font-bold text-slate-800 cursor-pointer" onClick={reset}>🎓 AI Exam Grader</span>
        <div className="flex-1" />
        {step !== 'config' && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {['Configure', 'Upload', 'Grading', 'Results'].map((s, i) => {
              const steps = ['config', 'upload', 'progress', 'results']
              const active = steps.indexOf(step) >= i
              return (
                <React.Fragment key={s}>
                  {i > 0 && <span className="text-slate-300">›</span>}
                  <span className={active ? 'text-indigo-600 font-medium' : ''}>{s}</span>
                </React.Fragment>
              )
            })}
          </div>
        )}
      </nav>

      <div className="px-4">
        {step === 'config' && (
          <ConfigStep onNext={cfg => { setConfig(cfg); setStep('upload') }} />
        )}
        {step === 'upload' && (
          <UploadStep config={config} onBack={() => setStep('config')}
            onGrade={id => { setJobId(id); setStep('progress') }} />
        )}
        {step === 'progress' && (
          <ProgressStep jobId={jobId} onDone={() => setStep('results')} />
        )}
        {step === 'results' && (
          <ResultsStep jobId={jobId} onReset={reset} />
        )}
      </div>
    </div>
  )
}
