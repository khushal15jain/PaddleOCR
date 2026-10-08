import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  CheckCircle,
  Clock,
  AlertOctagon,
  Layers,
  Target,
  BarChart2,
  Cpu,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { PageHeader, Card, StatCard, Btn, Badge, SyntheticBanner, LoadingSpinner } from '../components/ui.jsx'
import { GroupedBarChart, MetricComparisonBars } from '../components/Charts.jsx'
import { getDashboard, runEvaluation } from '../api.js'
import { useApp } from '../components/AppContext.jsx'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [evaluating, setEvaluating] = useState(false)
  const { online, notify } = useApp()

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getDashboard()
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const handleRecalculate = async () => {
    try {
      setEvaluating(true)
      await runEvaluation()
      notify('Evaluation recalculated successfully!', 'success')
      await loadDashboard()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setEvaluating(false)
    }
  }

  if (loading && !data) {
    return <LoadingSpinner label="Loading live research dashboard metrics..." />
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
        <h3 className="text-base font-semibold text-rose-800 dark:text-rose-300">
          Failed to load dashboard metrics
        </h3>
        <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        <Btn className="mt-4" onClick={loadDashboard}>
          Retry Connection
        </Btn>
      </div>
    )
  }

  const s = data?.summary || {}
  const c = data?.charts || {}

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research Benchmark Dashboard"
        desc="A Reproducible Benchmarking Framework for Printed Historical Document OCR Using PaddleOCR and Tesseract with Ground Truth-Based Accuracy Evaluation."
      >
        <Btn onClick={handleRecalculate} loading={evaluating} disabled={!online}>
          <RefreshCw size={14} className={evaluating ? 'animate-spin' : ''} />
          Recalculate Metrics
        </Btn>
        <Link to="/comparison">
          <Btn v="primary" className="gap-1.5">
            Open OCR Comparison
            <ArrowRight size={14} />
          </Btn>
        </Link>
      </PageHeader>

      <SyntheticBanner />

      {/* Row 1: Core Corpus & Execution Counts */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Documents"
          value={s.total_images}
          subtitle="Complete historical corpus & demo set"
          icon={FileText}
          tone="indigo"
          badge={<Badge tone="indigo">50 Historical + 3 Demo</Badge>}
        />
        <StatCard
          title="Evaluated with Ground Truth"
          value={s.evaluated_count}
          subtitle="Verified transcribed ground truth pairs"
          icon={Target}
          tone="teal"
          badge={<Badge tone="teal">Strict Ground Truth Matching</Badge>}
        />
        <StatCard
          title="PaddleOCR Processed"
          value={s.paddleocr_processed_images}
          subtitle="Processed via DBNet + SVTR / PP-OCRv6"
          icon={Layers}
          tone="emerald"
          badge={
            <Badge tone="green">
              Avg Runtime: {s.average_processing_time?.paddle?.toFixed(2)}s
            </Badge>
          }
        />
        <StatCard
          title="Tesseract Processed"
          value={s.tesseract_processed_images}
          subtitle="Processed via Leptonica + LSTM 5.5"
          icon={Cpu}
          tone="amber"
          badge={
            <Badge tone="amber">
              Avg Runtime: {s.average_processing_time?.tesseract?.toFixed(2)}s
            </Badge>
          }
        />
      </div>

      {/* Row 2: Accuracy & Error Metrics Comparison */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Character Error Rate (CER)"
          value={`${((s.average_cer?.paddle ?? 0) * 100).toFixed(2)}%`}
          subtitle={`PaddleOCR vs Tesseract ${((s.average_cer?.tesseract ?? 0) * 100).toFixed(2)}%`}
          tone={s.average_cer?.better === 'PaddleOCR' ? 'emerald' : 'amber'}
          delta={
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
              ✓ {s.average_cer?.better} achieved lower CER
            </span>
          }
        />
        <StatCard
          title="Word Error Rate (WER)"
          value={`${((s.average_wer?.paddle ?? 0) * 100).toFixed(2)}%`}
          subtitle={`PaddleOCR vs Tesseract ${((s.average_wer?.tesseract ?? 0) * 100).toFixed(2)}%`}
          tone={s.average_wer?.better === 'PaddleOCR' ? 'emerald' : 'amber'}
          delta={
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
              ✓ {s.average_wer?.better} achieved lower WER
            </span>
          }
        />
        <StatCard
          title="Mean Word IoU"
          value={`${((s.average_word_iou?.paddle ?? 0) * 100).toFixed(2)}%`}
          subtitle={`PaddleOCR vs Tesseract ${((s.average_word_iou?.tesseract ?? 0) * 100).toFixed(2)}%`}
          tone="teal"
          delta={
            <span className="text-teal-700 dark:text-teal-400 font-bold">
              Spatial overlap threshold: IoU ≥ 0.50
            </span>
          }
        />
        <StatCard
          title="OCR Failure Rate"
          value={`${((s.ocr_failure_rate?.paddle ?? 0) * 100).toFixed(1)}%`}
          subtitle={`PaddleOCR vs Tesseract ${((s.ocr_failure_rate?.tesseract ?? 0) * 100).toFixed(1)}%`}
          tone="rose"
          delta={
            <span className="text-slate-600 dark:text-slate-400">
              Empty results or segmentation drops
            </span>
          }
        />
      </div>

      {/* Row 3: Interactive Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chart 1: CER Comparison */}
        <Card>
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Character Error Rate (CER) per Document
            </h3>
            <p className="text-xs text-slate-500">
              Evaluated strictly as CER = (S + D + I) / N. Lower is better.
            </p>
          </div>
          <GroupedBarChart
            data={c.cer_comparison || []}
            xKey="image_id"
            series={[
              { key: 'paddle_cer', label: 'PaddleOCR', color: '#0d9488' },
              { key: 'tesseract_cer', label: 'Tesseract', color: '#f59e0b' },
            ]}
            yLabel="CER Rate"
          />
        </Card>

        {/* Chart 2: WER Comparison */}
        <Card>
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Word Error Rate (WER) per Document
            </h3>
            <p className="text-xs text-slate-500">
              Evaluated strictly as WER = (S + D + I) / N. Lower is better.
            </p>
          </div>
          <GroupedBarChart
            data={c.wer_comparison || []}
            xKey="image_id"
            series={[
              { key: 'paddle_wer', label: 'PaddleOCR', color: '#0d9488' },
              { key: 'tesseract_wer', label: 'Tesseract', color: '#f59e0b' },
            ]}
            yLabel="WER Rate"
          />
        </Card>

        {/* Chart 3: Word IoU Overlap */}
        <Card>
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Mean Word Bounding Box IoU
            </h3>
            <p className="text-xs text-slate-500">
              Bipartite matching IoU = |A ∩ B| / |A ∪ B|. Higher is better.
            </p>
          </div>
          <GroupedBarChart
            data={c.iou_comparison || []}
            xKey="image_id"
            series={[
              { key: 'paddle_iou', label: 'PaddleOCR', color: '#0d9488' },
              { key: 'tesseract_iou', label: 'Tesseract', color: '#f59e0b' },
            ]}
            yLabel="IoU Score"
            maxVal={1.0}
          />
        </Card>

        {/* Chart 4: Bounding Box Detection Precision, Recall & F1 */}
        <Card>
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Bounding-Box Localization Metrics (IoU ≥ 0.5)
            </h3>
            <p className="text-xs text-slate-500">
              Precision (TP / Pred), Recall (TP / GT), and F1 Harmonic Mean.
            </p>
          </div>
          <MetricComparisonBars
            metrics={[
              {
                metric: 'Bounding-box Precision',
                paddle: s.bounding_box_precision?.paddle,
                tesseract: s.bounding_box_precision?.tesseract,
              },
              {
                metric: 'Bounding-box Recall',
                paddle: s.bounding_box_recall?.paddle,
                tesseract: s.bounding_box_recall?.tesseract,
              },
              {
                metric: 'Bounding-box F1 Score',
                paddle: s.bounding_box_f1?.paddle,
                tesseract: s.bounding_box_f1?.tesseract,
              },
              {
                metric: 'Mean Word IoU Overlap',
                paddle: s.average_word_iou?.paddle,
                tesseract: s.average_word_iou?.tesseract,
              },
            ]}
          />
        </Card>

        {/* Chart 5: Runtime Comparison */}
        <Card>
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Processing Time per Document (Seconds)
            </h3>
            <p className="text-xs text-slate-500">
              Inference latency comparing deep CNN/SVTR vs classical Leptonica+LSTM.
            </p>
          </div>
          <GroupedBarChart
            data={c.runtime_comparison || []}
            xKey="image_id"
            series={[
              { key: 'paddle_runtime', label: 'PaddleOCR', color: '#0d9488' },
              { key: 'tesseract_runtime', label: 'Tesseract', color: '#f59e0b' },
            ]}
            yLabel="Seconds"
          />
        </Card>

        {/* Chart 6: Success & Failure Distribution */}
        <Card>
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              OCR Engine Success & Robustness
            </h3>
            <p className="text-xs text-slate-500">
              Distribution of cleanly recognized documents vs empty segmentation drops.
            </p>
          </div>
          <div className="space-y-4 pt-2">
            {(c.status_distribution || []).map(dist => (
              <div key={dist.engine} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex justify-between text-sm font-semibold mb-2">
                  <span>{dist.engine}</span>
                  <span className="text-xs font-mono text-slate-500">
                    {dist.successful} succeeded / {dist.failed_or_empty} failed
                  </span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-rose-200 dark:bg-rose-950">
                  <div
                    className="h-full bg-emerald-600 transition-all"
                    style={{
                      width: `${
                        (dist.successful / Math.max(1, dist.successful + dist.failed_or_empty)) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
