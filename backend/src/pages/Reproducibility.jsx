import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Play,
  CheckCircle,
  Copy,
  Terminal,
  Cpu,
  Layers,
  Database,
  RefreshCw,
  HardDrive,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { PageHeader, Card, Btn, Badge, LoadingSpinner, download } from '../components/ui.jsx'
import { getReproducibility, runBenchmark, getBenchmarkStatus } from '../api.js'
import { useApp } from '../components/AppContext.jsx'

export default function Reproducibility() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [benchStatus, setBenchStatus] = useState(null)

  const { notify, online } = useApp()

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await getReproducibility()
      setData(res)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Poll status while benchmark is running
  useEffect(() => {
    if (!running) return
    const poll = async () => {
      try {
        const s = await getBenchmarkStatus()
        setBenchStatus(s)
        if (s.state === 'done' || s.state === 'failed') {
          setRunning(false)
          notify(`Benchmark completed with state: ${s.state}`, s.state === 'done' ? 'success' : 'error')
          loadData()
        }
      } catch {}
    }
    const timer = setInterval(poll, 1500)
    return () => clearInterval(timer)
  }, [running])

  const handleRun = async () => {
    try {
      setRunning(true)
      await runBenchmark(true)
      notify('Benchmark execution launched...', 'info')
    } catch (err) {
      notify(err.message, 'error')
      setRunning(false)
    }
  }

  const handleCopyManifest = () => {
    if (!data) return
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    notify('Reproducibility manifest copied to clipboard!', 'success')
  }

  if (loading && !data) {
    return <LoadingSpinner label="Querying system reproducibility environment..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scientific Reproducibility & Environment Matrix"
        desc="Exhaustive experimental configuration, software dependencies, and hardware parameters ensuring full artifact determinism and replication fidelity."
      >
        <Btn onClick={handleCopyManifest} className="gap-1.5">
          <Copy size={14} />
          {copied ? 'Copied JSON!' : 'Copy Manifest'}
        </Btn>
        <Btn v="primary" onClick={handleRun} loading={running} disabled={!online}>
          <Play size={14} className="fill-current" />
          {running ? 'Executing Benchmark...' : 'Run Full Benchmark'}
        </Btn>
      </PageHeader>

      {/* Live Benchmark Execution Output if running */}
      {running && (
        <Card className="border-teal-500 bg-slate-950 p-4 font-mono text-xs text-emerald-400">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-300">
            <span className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin text-teal-400" />
              Live Benchmark Subprocess Output (PID Active)
            </span>
            <Badge tone="green">Running</Badge>
          </div>
          <pre className="h-48 overflow-y-auto leading-relaxed">
            {benchStatus?.log?.join('\n') || 'Starting subprocess: python run_benchmark.py --allow-partial...'}
          </pre>
        </Card>
      )}

      {/* Matrix Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Dataset Specification */}
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 border-b border-slate-100 pb-2 dark:border-slate-800">
            <Database size={18} />
            <h3 className="font-bold text-sm">Dataset Specification</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Dataset Version:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{data?.dataset_version}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Total Document Images:</span>
              <span className="font-mono font-semibold">{data?.total_images} files</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Ground Truth Verified:</span>
              <span className="font-mono font-semibold text-emerald-600">{data?.ground_truth_images} files</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Historical Archives:</span>
              <span className="font-mono">{data?.evaluation_split?.historical_archive_count}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Synthetic Validations:</span>
              <span className="font-mono">{data?.evaluation_split?.synthetic_demo_count}</span>
            </div>
          </div>
        </Card>

        {/* Card 2: Engine Versions */}
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 border-b border-slate-100 pb-2 dark:border-slate-800">
            <Layers size={18} />
            <h3 className="font-bold text-sm">OCR Engine Versions</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">PaddleOCR Version:</span>
              <span className="font-mono font-semibold">{data?.engine_specifications?.PaddleOCR?.version}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Paddle Framework:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{data?.engine_specifications?.PaddleOCR?.framework}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Paddle Detection Model:</span>
              <span className="font-mono text-[11px]">{data?.engine_specifications?.PaddleOCR?.detection_model}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Tesseract Version:</span>
              <span className="font-mono font-semibold">{data?.engine_specifications?.Tesseract?.version}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Tesseract Config:</span>
              <span className="font-mono text-[11px]">{data?.engine_specifications?.Tesseract?.page_segmentation_mode}</span>
            </div>
          </div>
        </Card>

        {/* Card 3: Execution Environment */}
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 border-b border-slate-100 pb-2 dark:border-slate-800">
            <Cpu size={18} />
            <h3 className="font-bold text-sm">Hardware & OS Matrix</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Operating System:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{data?.system_environment?.operating_system}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Python Interpreter:</span>
              <span className="font-mono font-semibold">{data?.system_environment?.python_version}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">CPU Architecture:</span>
              <span className="font-mono">{data?.system_environment?.cpu_architecture}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Deterministic Seed:</span>
              <span className="font-mono font-semibold">{data?.evaluation_configuration?.random_seed}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Experiment Timestamp:</span>
              <span className="font-mono text-[11px]">{data?.experiment_timestamp}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Terminal Replication Script Instructions */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-teal-600 dark:text-teal-400" />
            <h3 className="font-bold text-sm">Command-Line Replication Instructions</h3>
          </div>
          <Badge tone="teal">100% Deterministic</Badge>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          To independently verify these results outside of the browser, run the following commands in your shell from the repository root:
        </p>
        <pre className="rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-emerald-400 dark:border-slate-800 overflow-x-auto">
{`# 1. Activate virtual environment
source .venv/bin/activate

# 2. Run the complete 6-phase benchmark pipeline
python run_benchmark.py --allow-partial

# 3. View the generated evaluation tables and significance tests
cat outputs/metrics/summary.csv
cat outputs/reports/research_report.md`}
        </pre>
      </Card>
    </div>
  )
}
