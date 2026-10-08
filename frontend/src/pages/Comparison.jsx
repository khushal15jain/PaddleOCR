import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  RotateCcw,
  Layers,
  Eye,
  EyeOff,
  PenTool,
  Check,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { PageHeader, Card, Btn, Badge, SyntheticBanner, LoadingSpinner, Tabs } from '../components/ui.jsx'
import {
  getImageDetails,
  getImageUrl,
  getDataset,
  runPaddleOCR,
  runTesseractOCR,
  runCompareOCR,
} from '../api.js'
import { useApp } from '../components/AppContext.jsx'

export default function Comparison() {
  const [searchParams, setSearchParams] = useSearchParams()
  const imageId = searchParams.get('id') || 'DEMO_HIST_01'

  const [datasetList, setDatasetList] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [runningPaddle, setRunningPaddle] = useState(false)
  const [runningTess, setRunningTess] = useState(false)
  const [runningBoth, setRunningBoth] = useState(false)

  // Viewer controls
  const [zoom, setZoom] = useState(1.0)
  const [boxLayer, setBoxLayer] = useState('eval') // 'none' | 'gt' | 'paddle' | 'tess' | 'eval'
  const [selectedWord, setSelectedWord] = useState(null)
  const [activeTab, setActiveTab] = useState('Transcription Diff')

  const { notify, online } = useApp()
  const imgRef = useRef(null)

  // Load dataset list for dropdown
  useEffect(() => {
    getDataset()
      .then(list => setDatasetList(list))
      .catch(() => {})
  }, [])

  // Load details for current imageId
  const loadDetails = async id => {
    try {
      setLoading(true)
      setSelectedWord(null)
      const res = await getImageDetails(id)
      setData(res)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetails(imageId)
  }, [imageId])

  const selectImage = id => {
    setSearchParams({ id })
  }

  const handleRunPaddle = async () => {
    try {
      setRunningPaddle(true)
      notify('Running PaddleOCR...', 'info')
      const res = await runPaddleOCR(imageId, true)
      setData(res)
      notify('PaddleOCR execution completed!', 'success')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setRunningPaddle(false)
    }
  }

  const handleRunTess = async () => {
    try {
      setRunningTess(true)
      notify('Running Tesseract OCR...', 'info')
      const res = await runTesseractOCR(imageId, true)
      setData(res)
      notify('Tesseract OCR execution completed!', 'success')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setRunningTess(false)
    }
  }

  const handleRunBoth = async () => {
    try {
      setRunningBoth(true)
      notify('Running both OCR engines & evaluation...', 'info')
      const res = await runCompareOCR(imageId)
      setData(res)
      notify('Comparison pipeline completed!', 'success')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setRunningBoth(false)
    }
  }

  const gt = data?.ground_truth || {}
  const paddle = data?.paddleocr || {}
  const tess = data?.tesseract || {}
  const res = data?.resolution || [800, 900]
  const imgWidth = res[0] || 800
  const imgHeight = res[1] || 900

  // Bounding box overlay helper
  const getBoxesToRender = () => {
    if (boxLayer === 'none') return []
    if (boxLayer === 'gt') {
      return (gt.annotations || []).map(a => ({
        bbox: [a.x_min, a.y_min, a.x_max, a.y_max],
        text: a.transcription,
        color: '#3b82f6',
        label: 'GT',
      }))
    }
    if (boxLayer === 'paddle') {
      return (paddle.output?.words || []).map(w => ({
        bbox: w.bbox,
        text: w.text,
        color: '#0d9488',
        label: 'Paddle',
        conf: w.confidence,
      }))
    }
    if (boxLayer === 'tess') {
      return (tess.output?.words || []).map(w => ({
        bbox: w.bbox,
        text: w.text,
        color: '#f59e0b',
        label: 'Tess',
        conf: w.confidence,
      }))
    }
    if (boxLayer === 'eval') {
      // Show evaluated boxes classified: TP (green), FP (red), Loc Error (purple)
      const list = []
      const pEval = paddle.evaluation?.pred_eval || []
      pEval.forEach(p => {
        let col = '#10b981' // correct TP
        if (p.status === 'false_positive') col = '#ef4444' // FP
        if (p.status === 'incorrect_localization') col = '#8b5cf6' // loc error
        list.push({
          bbox: p.bbox,
          text: p.text,
          status: p.status,
          iou: p.iou,
          color: col,
          label: `Paddle: ${p.status}`,
        })
      })

      // Also mark False Negatives from GT in orange
      const gtEval = paddle.evaluation?.gt_eval || []
      gtEval.forEach(g => {
        if (g.status === 'false_negative') {
          list.push({
            bbox: g.bbox,
            text: g.text,
            status: 'false_negative',
            color: '#f97316',
            label: 'GT Missed (FN)',
          })
        }
      })
      return list
    }
    return []
  }

  const boxes = getBoxesToRender()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Side-by-Side OCR Comparison"
        desc="Examine document scans with live bounding box overlays, ground truth alignments, and token-level error classifications."
      >
        {/* Document Selector */}
        <select
          value={imageId}
          onChange={e => selectImage(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {datasetList.map(d => (
            <option key={d.id} value={d.id}>
              {d.id} ({d.document_type}
              {d.ground_truth_available ? ' · GT verified' : ''})
            </option>
          ))}
        </select>

        {/* OCR Action Buttons */}
        <Btn onClick={handleRunPaddle} loading={runningPaddle} disabled={!online}>
          Run PaddleOCR
        </Btn>
        <Btn onClick={handleRunTess} loading={runningTess} disabled={!online}>
          Run Tesseract
        </Btn>
        <Btn v="primary" onClick={handleRunBoth} loading={runningBoth} disabled={!online}>
          <Play size={14} className="fill-current" />
          Run Both Engines
        </Btn>
        <Link to={`/annotation?id=${imageId}`}>
          <Btn className="gap-1.5">
            <PenTool size={14} />
            Edit Annotations
          </Btn>
        </Link>
      </PageHeader>

      {data?.is_synthetic && <SyntheticBanner />}

      {/* Row: Main side-by-side view (Image with Overlay on Left, 3 Comparison Columns on Right) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN (5 Cols): Original Document Scan & Overlay */}
        <div className="lg:col-span-5 space-y-3">
          <Card className="p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Scan Viewer
                </span>
                <span className="text-xs text-slate-400">
                  {imgWidth} × {imgHeight}
                </span>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-400 w-12 text-center">
                  {(zoom * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={() => setZoom(1.0)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Overlay Layer Selector */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">BBox Layer:</span>
              {[
                { id: 'eval', label: 'Evaluation Status' },
                { id: 'paddle', label: 'PaddleOCR' },
                { id: 'tess', label: 'Tesseract' },
                { id: 'gt', label: 'Ground Truth' },
                { id: 'none', label: 'Scan Only' },
              ].map(layer => (
                <button
                  key={layer.id}
                  onClick={() => setBoxLayer(layer.id)}
                  className={`rounded-md px-2 py-1 font-semibold transition ${
                    boxLayer === layer.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {layer.label}
                </button>
              ))}
            </div>

            {/* BBox Indicators Legend when in Evaluation Status */}
            {boxLayer === 'eval' && (
              <div className="mb-2 flex flex-wrap gap-2.5 rounded-lg bg-slate-50 p-2 text-[11px] font-medium dark:bg-slate-950/60">
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Correct Detection (TP)
                </span>
                <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
                  <span className="h-2 w-2 rounded-sm bg-rose-500" /> False Positive (FP)
                </span>
                <span className="flex items-center gap-1 text-orange-700 dark:text-orange-400">
                  <span className="h-2 w-2 rounded-sm bg-orange-500" /> False Negative (FN Missed)
                </span>
                <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
                  <span className="h-2 w-2 rounded-sm bg-purple-500" /> Localization Error (IoU &lt; 0.5)
                </span>
              </div>
            )}

            {/* Interactive Image & SVG Canvas */}
            <div className="relative h-[550px] w-full overflow-auto rounded-lg border border-slate-200 bg-slate-950/90 dark:border-slate-800">
              <div
                style={{
                  width: `${imgWidth * zoom}px`,
                  height: `${imgHeight * zoom}px`,
                  position: 'relative',
                }}
              >
                <img
                  ref={imgRef}
                  src={getImageUrl(imageId)}
                  alt={imageId}
                  className="absolute inset-0 h-full w-full object-contain"
                  style={{ pointerEvents: 'none' }}
                />

                {/* SVG Overlay */}
                <svg
                  viewBox={`0 0 ${imgWidth} ${imgHeight}`}
                  className="absolute inset-0 h-full w-full"
                  style={{ width: `${imgWidth * zoom}px`, height: `${imgHeight * zoom}px` }}
                >
                  {boxes.map((b, idx) => {
                    const bx = b.bbox[0]
                    const by = b.bbox[1]
                    const bw = Math.max(2, b.bbox[2] - b.bbox[0])
                    const bh = Math.max(2, b.bbox[3] - b.bbox[1])
                    const isSelected = selectedWord?.idx === idx

                    return (
                      <g key={idx}>
                        <rect
                          x={bx}
                          y={by}
                          width={bw}
                          height={bh}
                          fill={isSelected ? `${b.color}40` : `${b.color}18`}
                          stroke={b.color}
                          strokeWidth={isSelected ? 3 : 1.5}
                          className="cursor-pointer transition-all hover:stroke-width-3"
                          onClick={() => setSelectedWord({ ...b, idx })}
                        />
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>

            {/* Selected box inspector */}
            {selectedWord && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Inspected Bounding Box:
                  </span>
                  <button
                    onClick={() => setSelectedWord(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  <span>Text: &quot;{selectedWord.text}&quot;</span>
                  <span>
                    BBox: [{selectedWord.bbox.join(', ')}]
                  </span>
                  {selectedWord.iou !== undefined && <span>IoU: {selectedWord.iou}</span>}
                  {selectedWord.conf !== undefined && (
                    <span>Confidence: {(selectedWord.conf * 100).toFixed(1)}%</span>
                  )}
                  {selectedWord.status && (
                    <span className="capitalize font-semibold text-teal-700 dark:text-teal-400">
                      Status: {selectedWord.status}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN (7 Cols): 3-Way Transcript & Metric Comparison */}
        <div className="lg:col-span-7 space-y-4">
          {/* Summary Metric Header for this Image */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 text-center">
              <div className="text-[11px] font-semibold uppercase text-slate-400">Paddle CER</div>
              <div className="text-xl font-bold text-teal-700 dark:text-teal-400 font-mono mt-1">
                {paddle.metrics?.cer !== null && paddle.metrics?.cer !== undefined
                  ? `${(paddle.metrics.cer * 100).toFixed(2)}%`
                  : '—'}
              </div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-[11px] font-semibold uppercase text-slate-400">Tesseract CER</div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono mt-1">
                {tess.metrics?.cer !== null && tess.metrics?.cer !== undefined
                  ? `${(tess.metrics.cer * 100).toFixed(2)}%`
                  : '—'}
              </div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-[11px] font-semibold uppercase text-slate-400">Paddle WER</div>
              <div className="text-xl font-bold text-teal-700 dark:text-teal-400 font-mono mt-1">
                {paddle.metrics?.wer !== null && paddle.metrics?.wer !== undefined
                  ? `${(paddle.metrics.wer * 100).toFixed(2)}%`
                  : '—'}
              </div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-[11px] font-semibold uppercase text-slate-400">Tesseract WER</div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono mt-1">
                {tess.metrics?.wer !== null && tess.metrics?.wer !== undefined
                  ? `${(tess.metrics.wer * 100).toFixed(2)}%`
                  : '—'}
              </div>
            </Card>
          </div>

          {/* Three Parallel Transcriptions */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* 1. Ground Truth */}
            <Card className="p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="font-bold text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    1. Ground Truth
                  </span>
                  <Badge tone="indigo">{gt.word_count || 0} words</Badge>
                </div>
                <div className="mt-2.5 max-h-56 overflow-y-auto text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-serif">
                  {gt.text || <span className="italic text-slate-400">No ground truth provided for this image.</span>}
                </div>
              </div>
            </Card>

            {/* 2. PaddleOCR Output */}
            <Card className="p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="font-bold text-xs uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    2. PaddleOCR
                  </span>
                  <Badge tone={paddle.output?.status === 'success' ? 'green' : 'slate'}>
                    {paddle.output?.runtime_seconds ? `${paddle.output.runtime_seconds.toFixed(2)}s` : 'Not run'}
                  </Badge>
                </div>
                <div className="mt-2.5 max-h-56 overflow-y-auto text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-serif">
                  {paddle.output?.text || <span className="italic text-slate-400">Click &quot;Run PaddleOCR&quot; to execute.</span>}
                </div>
              </div>
              {paddle.output && (
                <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] font-mono text-slate-500">
                  Conf: {((paddle.output.average_confidence ?? 0) * 100).toFixed(1)}% | BBoxes: {paddle.output.words?.length || 0}
                </div>
              )}
            </Card>

            {/* 3. Tesseract Output */}
            <Card className="p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    3. Tesseract OCR
                  </span>
                  <Badge tone={tess.output?.status === 'success' ? 'amber' : 'slate'}>
                    {tess.output?.runtime_seconds ? `${tess.output.runtime_seconds.toFixed(2)}s` : 'Not run'}
                  </Badge>
                </div>
                <div className="mt-2.5 max-h-56 overflow-y-auto text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-serif">
                  {tess.output?.text ? (
                    tess.output.text
                  ) : tess.output?.empty_result ? (
                    <span className="italic text-rose-500">[Empty Result: Tesseract segmented 0 text lines]</span>
                  ) : (
                    <span className="italic text-slate-400">Click &quot;Run Tesseract&quot; to execute.</span>
                  )}
                </div>
              </div>
              {tess.output && (
                <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] font-mono text-slate-500">
                  Conf: {((tess.output.average_confidence ?? 0) * 100).toFixed(1)}% | BBoxes: {tess.output.words?.length || 0}
                </div>
              )}
            </Card>
          </div>

          {/* Word-Level Error Highlight View (Diff Viewer) */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Word-Level Error Alignment & Token Highlighting
                </h4>
                <p className="text-xs text-slate-500">
                  Tokens aligned against Ground Truth with Levenshtein Sequence Matching.
                </p>
              </div>

              {/* Color Legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Correct
                </span>
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Substitution (Error)
                </span>
                <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Deletion (Missing)
                </span>
                <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Insertion (Extra)
                </span>
              </div>
            </div>

            <Tabs
              tabs={['PaddleOCR Alignment', 'Tesseract Alignment']}
              value={activeTab === 'Tesseract Alignment' ? 'Tesseract Alignment' : 'PaddleOCR Alignment'}
              onChange={setActiveTab}
            />

            {/* Token Diff Flow */}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-4 font-serif text-sm leading-loose dark:border-slate-800 dark:bg-slate-950/40">
              {activeTab === 'PaddleOCR Alignment' ? (
                paddle.alignment?.aligned_pred?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {paddle.alignment.aligned_pred.map((token, i) => {
                      const type = token.type
                      return (
                        <span
                          key={i}
                          title={type === 'substitution' ? `Replaced: ${token.paired_with}` : type}
                          className={`rounded px-1.5 py-0.5 transition ${
                            type === 'correct'
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200'
                              : type === 'substitution'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                              : type === 'insertion'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-200'
                              : 'bg-rose-100 text-rose-900 line-through dark:bg-rose-950 dark:text-rose-200'
                          }`}
                        >
                          {token.word}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400">
                    No alignment available. Run PaddleOCR to calculate word-level alignments.
                  </div>
                )
              ) : tess.alignment?.aligned_pred?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {tess.alignment.aligned_pred.map((token, i) => {
                    const type = token.type
                    return (
                      <span
                        key={i}
                        title={type === 'substitution' ? `Replaced: ${token.paired_with}` : type}
                        className={`rounded px-1.5 py-0.5 transition ${
                          type === 'correct'
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200'
                            : type === 'substitution'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                            : type === 'insertion'
                            ? 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-200'
                            : 'bg-rose-100 text-rose-900 line-through dark:bg-rose-950 dark:text-rose-200'
                        }`}
                      >
                        {token.word}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-400">
                  No alignment available. Run Tesseract to calculate word-level alignments.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
