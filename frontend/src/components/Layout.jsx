import { useState, useMemo, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  SplitSquareVertical,
  PenTool,
  FlaskConical,
  GraduationCap,
  GitBranch,
  ShieldCheck,
  HelpCircle,
  Search,
  Menu,
  Sun,
  Moon,
  Download,
  Play,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import { useApp } from './AppContext.jsx'
import { Btn, Modal, Badge } from './ui.jsx'
import { runBenchmark, stopBenchmark, getBenchmarkStatus, getExportUrl } from '../api.js'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dataset', label: 'Dataset', icon: Database },
  { to: '/comparison', label: 'OCR Comparison', icon: SplitSquareVertical },
  { to: '/annotation', label: 'Annotation', icon: PenTool },
  { to: '/benchmark', label: 'Benchmark', icon: FlaskConical },
  { to: '/results', label: 'Results', icon: GraduationCap },
  { to: '/methodology', label: 'Methodology', icon: GitBranch },
  { to: '/reproducibility', label: 'Reproducibility', icon: ShieldCheck },
  { to: '/about', label: 'About Project', icon: HelpCircle },
]

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const [benchModal, setBenchModal] = useState(false)
  const [benchStatus, setBenchStatus] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const nav = useNavigate()
  const { theme, setTheme, online, checking, health, notify } = useApp()

  // Benchmark status polling when modal is open
  useEffect(() => {
    if (!benchModal) return
    const poll = async () => {
      try {
        const s = await getBenchmarkStatus()
        setBenchStatus(s)
      } catch {}
    }
    poll()
    const timer = setInterval(poll, 1500)
    return () => clearInterval(timer)
  }, [benchModal])

  const handleStartBenchmark = async () => {
    try {
      await runBenchmark(true)
      notify('Benchmark started...', 'info')
      setBenchModal(true)
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const handleStopBenchmark = async () => {
    try {
      await stopBenchmark()
      notify('Stopping benchmark...', 'info')
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return NAV.filter(n => n.label.toLowerCase().includes(s)).map(n => ({
      key: n.to,
      label: n.label,
      to: n.to,
    }))
  }, [q])

  const go = to => {
    nav(to)
    setQ('')
    setFocus(false)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-100 lg:flex">
      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? 'block' : 'hidden'
        } fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:static lg:block lg:shrink-0`}
      >
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-indigo-700 text-white shadow-md">
            <FlaskConical size={20} />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              OCR Benchmark
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              PaddleOCR vs Tesseract
            </div>
          </div>
        </div>

        {/* Backend status card */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              System Core
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <span
                className={`h-2 w-2 rounded-full ${
                  online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className={online ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}>
                {online ? 'Connected' : 'Offline'}
              </span>
            </span>
          </div>
          {online && health && (
            <div className="mt-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>PaddleOCR:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {health.paddleocr_version}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tesseract:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {health.tesseract_version}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Images:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {health.dataset_summary.total_images} docs
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Quick action button */}
        <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
          <Btn
            v="primary"
            className="w-full justify-center"
            onClick={handleStartBenchmark}
            disabled={!online}
          >
            <Play size={14} className="fill-current" />
            Run Full Benchmark
          </Btn>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu size={20} />
            </button>

            {/* Quick Search */}
            <div className="relative w-64 sm:w-80">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                onFocus={() => setFocus(true)}
                onBlur={() => setTimeout(() => setFocus(false), 200)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setQ('')
                  if (e.key === 'Enter' && hits[0]) go(hits[0].to)
                }}
                placeholder="Search tabs, images, metrics..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {focus && q && (
                <ul className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {hits.length ? (
                    hits.map(h => (
                      <li key={h.key}>
                        <button
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                          onMouseDown={() => go(h.to)}
                        >
                          {h.label}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-sm text-slate-500">No matching routes</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Export Dropdown */}
            <div className="relative">
              <Btn
                size="sm"
                className="gap-1.5"
                onClick={() => setExportOpen(o => !o)}
                disabled={!online}
              >
                <Download size={14} />
                <span className="hidden sm:inline">Export</span>
              </Btn>
              {exportOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-30"
                  onMouseLeave={() => setExportOpen(false)}
                >
                  <a
                    href={getExportUrl('csv')}
                    download="ocr_benchmark_evaluation.csv"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span>Export Evaluation CSV</span>
                    <span className="text-[10px] text-slate-400">.csv</span>
                  </a>
                  <a
                    href={getExportUrl('excel')}
                    download="ocr_benchmark_results.xlsx"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span>Export Excel Spreadsheet</span>
                    <span className="text-[10px] text-slate-400">.xlsx</span>
                  </a>
                  <a
                    href={getExportUrl('json')}
                    download="ocr_benchmark_dataset.json"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span>Export Complete JSON</span>
                    <span className="text-[10px] text-slate-400">.json</span>
                  </a>
                  <a
                    href={getExportUrl('report')}
                    download="ocr_research_report.md"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span>Download Markdown Report</span>
                    <span className="text-[10px] text-slate-400">.md</span>
                  </a>
                </div>
              )}
            </div>

            {/* Benchmark Console toggle */}
            <Btn
              size="sm"
              onClick={() => setBenchModal(true)}
              className="gap-1.5 text-slate-600 dark:text-slate-300"
            >
              <Activity size={14} />
              <span className="hidden sm:inline">Execution Console</span>
            </Btn>

            {/* Theme Toggle */}
            <button
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Benchmark Execution Modal */}
      <Modal
        open={benchModal}
        onClose={() => setBenchModal(false)}
        title="Benchmark Execution Engine"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-100 p-3.5 dark:bg-slate-800">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Job State
              </div>
              <div className="flex items-center gap-2 mt-0.5 font-bold">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    benchStatus?.state === 'running'
                      ? 'bg-amber-500 animate-ping'
                      : benchStatus?.state === 'done'
                      ? 'bg-emerald-500'
                      : benchStatus?.state === 'failed'
                      ? 'bg-rose-500'
                      : 'bg-slate-400'
                  }`}
                />
                <span className="capitalize">{benchStatus?.state || 'Idle'}</span>
                {benchStatus?.returncode !== null && benchStatus?.returncode !== undefined && (
                  <Badge tone={benchStatus.returncode === 0 ? 'green' : 'rose'}>
                    Code: {benchStatus.returncode}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {benchStatus?.state === 'running' ? (
                <Btn v="danger" size="sm" onClick={handleStopBenchmark}>
                  Abort Benchmark
                </Btn>
              ) : (
                <Btn v="primary" size="sm" onClick={handleStartBenchmark} disabled={!online}>
                  <Play size={12} className="fill-current" />
                  Run Benchmark
                </Btn>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Process Standard Output Log:
            </div>
            <pre className="h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-950 p-3.5 font-mono text-xs leading-relaxed text-emerald-400 dark:border-slate-800">
              {benchStatus?.log?.length
                ? benchStatus.log.join('\n')
                : 'No benchmark execution logs yet. Click "Run Benchmark" above to begin.'}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  )
}
