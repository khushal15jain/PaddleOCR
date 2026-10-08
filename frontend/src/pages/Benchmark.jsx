import { useState, useEffect } from 'react'
import {
  FlaskConical,
  Play,
  Download,
  RefreshCw,
  Award,
  CheckCircle2,
  SlidersHorizontal,
  FileSpreadsheet,
} from 'lucide-react'
import { PageHeader, Card, Btn, Badge, Tabs, LoadingSpinner, download, toCSV } from '../components/ui.jsx'
import { getResults, getDashboard, runEvaluation, getExportUrl } from '../api.js'
import { useApp } from '../components/AppContext.jsx'

export default function Benchmark() {
  const [summaryData, setSummaryData] = useState([])
  const [perDocData, setPerDocData] = useState([])
  const [statData, setStatData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modeFilter, setModeFilter] = useState('strict')
  const [docTypeFilter, setDocTypeFilter] = useState('printed')
  const [evaluating, setEvaluating] = useState(false)

  const { notify, online } = useApp()

  const loadAllResults = async () => {
    try {
      setLoading(true)
      const [sumRes, docRes, statRes] = await Promise.all([
        getResults('summary').catch(() => []),
        getResults('per-document').catch(() => []),
        getResults('statistics').catch(() => []),
      ])
      setSummaryData(sumRes || [])
      setPerDocData(docRes || [])
      setStatData(statRes || [])
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllResults()
  }, [])

  const handleRecalculate = async () => {
    try {
      setEvaluating(true)
      await runEvaluation()
      notify('Benchmark evaluation recomputed!', 'success')
      await loadAllResults()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setEvaluating(false)
    }
  }

  // Filter summary rows for selected mode and document type
  const activeRows = summaryData.filter(
    r =>
      r.mode === modeFilter &&
      (docTypeFilter === 'all' || r['Document Type'] === docTypeFilter)
  )

  const paddleRow = activeRows.find(r => r.Engine === 'PaddleOCR') || {}
  const tessRow = activeRows.find(r => r.Engine === 'Tesseract') || {}

  const num = v => {
    if (v === null || v === undefined || v === '' || v === 'nan') return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }

  const fmtPct = v => (v !== null ? `${(v * 100).toFixed(2)}%` : '—')
  const fmtSec = v => (v !== null ? `${v.toFixed(3)}s` : '—')

  // Build research comparison table
  const metricsComparison = [
    {
      metric: 'Character Error Rate (CER)',
      formula: 'CER = (S + D + I) / N_chars',
      paddle: num(paddleRow['CER Mean']),
      tesseract: num(tessRow['CER Mean']),
      lowerIsBetter: true,
      format: fmtPct,
    },
    {
      metric: 'Word Error Rate (WER)',
      formula: 'WER = (S + D + I) / N_words',
      paddle: num(paddleRow['WER Mean']),
      tesseract: num(tessRow['WER Mean']),
      lowerIsBetter: true,
      format: fmtPct,
    },
    {
      metric: 'Mean Word IoU Overlap',
      formula: 'IoU = |A ∩ B| / |A ∪ B|',
      paddle: num(paddleRow['Word IoU Mean']),
      tesseract: num(tessRow['Word IoU Mean']),
      lowerIsBetter: false,
      format: fmtPct,
    },
    {
      metric: 'Bounding-Box Precision',
      formula: 'Precision = TP / (TP + FP)',
      paddle: num(paddleRow['Precision Mean']),
      tesseract: num(tessRow['Precision Mean']),
      lowerIsBetter: false,
      format: fmtPct,
    },
    {
      metric: 'Bounding-Box Recall',
      formula: 'Recall = TP / (TP + FN)',
      paddle: num(paddleRow['Recall Mean']),
      tesseract: num(tessRow['Recall Mean']),
      lowerIsBetter: false,
      format: fmtPct,
    },
    {
      metric: 'Bounding-Box F1 Score',
      formula: 'F1 = 2 · (P · R) / (P + R)',
      paddle: num(paddleRow['F1 Mean']),
      tesseract: num(tessRow['F1 Mean']),
      lowerIsBetter: false,
      format: fmtPct,
    },
    {
      metric: 'Average Processing Time',
      formula: 'Latency per image',
      paddle: num(paddleRow['Runtime Mean']),
      tesseract: num(tessRow['Runtime Mean']),
      lowerIsBetter: true,
      format: fmtSec,
    },
    {
      metric: 'OCR Failure Rate',
      formula: 'Empty outputs or segmentation crash',
      paddle: num(paddleRow['Failure Rate']),
      tesseract: num(tessRow['Failure Rate']),
      lowerIsBetter: true,
      format: fmtPct,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Benchmark Results & Engine Comparison"
        desc="Rigorous, ground-truth-derived accuracy metrics comparing PaddleOCR and Tesseract across historical printed archives, synthetic validations, and manuscripts."
      >
        <Btn onClick={handleRecalculate} loading={evaluating} disabled={!online}>
          <RefreshCw size={14} className={evaluating ? 'animate-spin' : ''} />
          Recompute Evaluation
        </Btn>
        <a href={getExportUrl('csv')} download="benchmark_evaluation.csv">
          <Btn className="gap-1.5">
            <Download size={14} />
            Export CSV
          </Btn>
        </a>
      </PageHeader>

      {/* Control Filters */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Evaluation Mode:
            </span>
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-950">
            <button
              onClick={() => setModeFilter('strict')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                modeFilter === 'strict'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Strict Evaluation (Exact Diacritics & Case)
            </button>
            <button
              onClick={() => setModeFilter('normalized')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                modeFilter === 'normalized'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Normalized (Case-insensitive & Whitespace Folded)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Corpus Slice:
          </span>
          <select
            value={docTypeFilter}
            onChange={e => setDocTypeFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="printed">Printed Historical Documents (N=4)</option>
            <option value="synthetic_demo">Synthetic Validation Benchmarks (N=3)</option>
            <option value="handwritten">Handwritten Manuscripts (N=1)</option>
          </select>
        </div>
      </Card>

      {/* Main Benchmark Comparison Table */}
      {loading ? (
        <LoadingSpinner label="Loading calculated benchmark metrics..." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/60">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Primary Model Comparison Matrix ({docTypeFilter.toUpperCase()} · {modeFilter.toUpperCase()})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              All metrics are dynamically evaluated from raw ground truth annotations and OCR detections.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 uppercase text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3.5 font-bold">Research Metric</th>
                  <th className="px-6 py-3.5 font-bold">Mathematical Formula</th>
                  <th className="px-6 py-3.5 font-bold text-teal-700 dark:text-teal-400">
                    PaddleOCR
                  </th>
                  <th className="px-6 py-3.5 font-bold text-amber-700 dark:text-amber-400">
                    Tesseract
                  </th>
                  <th className="px-6 py-3.5 font-bold">Superior Engine</th>
                  <th className="px-6 py-3.5 font-bold">Relative Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {metricsComparison.map((m, idx) => {
                  const pVal = m.paddle
                  const tVal = m.tesseract

                  let better = 'Equivalent'
                  let delta = '—'

                  if (pVal !== null && tVal !== null) {
                    if (m.lowerIsBetter) {
                      if (pVal < tVal) better = 'PaddleOCR'
                      else if (tVal < pVal) better = 'Tesseract'
                    } else {
                      if (pVal > tVal) better = 'PaddleOCR'
                      else if (tVal > pVal) better = 'Tesseract'
                    }

                    const diff = Math.abs(pVal - tVal)
                    delta = `${(diff * 100).toFixed(2)} pts`
                  }

                  return (
                    <tr key={idx} className="transition hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {m.metric}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {m.formula}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-teal-700 dark:text-teal-400">
                        {m.format(pVal)}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-amber-700 dark:text-amber-400">
                        {m.format(tVal)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          tone={
                            better === 'PaddleOCR'
                              ? 'teal'
                              : better === 'Tesseract'
                              ? 'amber'
                              : 'slate'
                          }
                          className="font-bold"
                        >
                          <Award size={12} className="inline mr-1" />
                          {better}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {delta}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Statistical Hypothesis Testing Section */}
      <Card className="p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            Statistical Hypothesis Testing & Wilcoxon Signed-Rank Analysis
          </h4>
          <p className="text-xs text-slate-500">
            Non-parametric paired evaluation assessing whether observed differences between PaddleOCR and Tesseract are statistically significant with Holm-Bonferroni Family-Wise Error Rate (FWER) control (α = 0.05).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-2.5 font-bold">Metric</th>
                <th className="px-4 py-2.5 font-bold">Document Type</th>
                <th className="px-4 py-2.5 font-bold">Mode</th>
                <th className="px-4 py-2.5 font-bold">Sample N</th>
                <th className="px-4 py-2.5 font-bold">Median Diff (Paddle − Tess)</th>
                <th className="px-4 py-2.5 font-bold">95% CI</th>
                <th className="px-4 py-2.5 font-bold">p-value</th>
                <th className="px-4 py-2.5 font-bold">Significant (α=0.05)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {statData.map((st, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 font-bold">{st.metric}</td>
                  <td className="px-4 py-2.5">{st.document_type}</td>
                  <td className="px-4 py-2.5 capitalize">{st.mode}</td>
                  <td className="px-4 py-2.5 font-mono">{st.N}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {num(st.median_difference_paddle_minus_tesseract)?.toFixed(4) || '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-500">
                    [{num(st.median_diff_ci_low)?.toFixed(3)}, {num(st.median_diff_ci_high)?.toFixed(3)}]
                  </td>
                  <td className="px-4 py-2.5 font-mono">{num(st.p_value)?.toFixed(4) || '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={st.significant === 'True' ? 'green' : 'slate'}>
                      {st.significant === 'True' ? 'Significant' : 'Not Significant'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
