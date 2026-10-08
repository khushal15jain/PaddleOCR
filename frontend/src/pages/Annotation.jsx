import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  PenTool,
  Save,
  Download,
  Trash2,
  Plus,
  Wand2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Upload,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { PageHeader, Card, Btn, Badge, Modal, inputCls, LoadingSpinner, download, toCSV } from '../components/ui.jsx'
import {
  getAnnotations,
  updateAllAnnotations,
  deleteAnnotation,
  getImageDetails,
  getImageUrl,
  getDataset,
  uploadImageFile,
} from '../api.js'
import { useApp } from '../components/AppContext.jsx'

export default function Annotation() {
  const [searchParams, setSearchParams] = useSearchParams()
  const imageId = searchParams.get('id') || 'DEMO_HIST_01'

  const [datasetList, setDatasetList] = useState([])
  const [annotations, setAnnotations] = useState([])
  const [imageMeta, setImageMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(null)

  // Canvas drawing state
  const [zoom, setZoom] = useState(1.0)
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState(null)
  const [currentBox, setCurrentBox] = useState(null)

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadType, setUploadType] = useState('printed')
  const [uploading, setUploading] = useState(false)

  const { notify, online } = useApp()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    getDataset()
      .then(setDatasetList)
      .catch(() => {})
  }, [])

  const loadData = async id => {
    try {
      setLoading(true)
      setSelectedIdx(null)
      const [annRes, imgRes] = await Promise.all([
        getAnnotations(id),
        getImageDetails(id),
      ])
      setAnnotations(annRes || [])
      setImageMeta(imgRes)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(imageId)
  }, [imageId])

  const selectImage = id => {
    setSearchParams({ id })
  }

  const imgW = imageMeta?.resolution?.[0] || 800
  const imgH = imageMeta?.resolution?.[1] || 900

  // Mouse drawing events
  const handleMouseDown = e => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) / zoom)
    const y = Math.round((e.clientY - rect.top) / zoom)

    setDrawing(true)
    setStartPos({ x, y })
    setCurrentBox({ x_min: x, y_min: y, x_max: x, y_max: y })
  }

  const handleMouseMove = e => {
    if (!drawing || !startPos || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) / zoom)
    const y = Math.round((e.clientY - rect.top) / zoom)

    setCurrentBox({
      x_min: Math.min(startPos.x, x),
      y_min: Math.min(startPos.y, y),
      x_max: Math.max(startPos.x, x),
      y_max: Math.max(startPos.y, y),
    })
  }

  const handleMouseUp = () => {
    if (!drawing || !currentBox) return
    setDrawing(false)

    // Ignore tiny accidental clicks (< 6px)
    if (currentBox.x_max - currentBox.x_min < 6 || currentBox.y_max - currentBox.y_min < 6) {
      setCurrentBox(null)
      return
    }

    const newAnnot = {
      image_id: imageId,
      word_id: `w_${annotations.length}`,
      transcription: 'WORD',
      x_min: currentBox.x_min,
      y_min: currentBox.y_min,
      x_max: currentBox.x_max,
      y_max: currentBox.y_max,
      confidence: 1.0,
    }

    const nextAnnots = [...annotations, newAnnot]
    setAnnotations(nextAnnots)
    setSelectedIdx(nextAnnots.length - 1)
    setCurrentBox(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await updateAllAnnotations(imageId, annotations)
      notify('Annotations saved to backend ground truth database!', 'success')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSelected = () => {
    if (selectedIdx === null) return
    const next = annotations.filter((_, i) => i !== selectedIdx)
    setAnnotations(next)
    setSelectedIdx(null)
    notify('Annotation deleted.', 'info')
  }

  const handleClearAll = async () => {
    if (!window.confirm('Delete all annotations for this image?')) return
    try {
      await deleteAnnotation(imageId)
      setAnnotations([])
      setSelectedIdx(null)
      notify('All annotations deleted.', 'info')
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const handleAutoPopulate = engine => {
    const words =
      engine === 'paddle'
        ? imageMeta?.paddleocr?.output?.words
        : imageMeta?.tesseract?.output?.words

    if (!words || !words.length) {
      notify(`No ${engine} output found. Run ${engine} first in OCR Comparison.`, 'error')
      return
    }

    const converted = []
    words.forEach((w, i) => {
      const parts = w.text.trim().split(/\s+/)
      const b = w.bbox
      if (parts.length <= 1) {
        converted.push({
          image_id: imageId,
          word_id: `w_${converted.length}`,
          transcription: w.text.trim(),
          x_min: b[0],
          y_min: b[1],
          x_max: b[2],
          y_max: b[3],
          confidence: roundNum(w.confidence || 1.0),
        })
      } else {
        const span = maxNum(1, b[2] - b[0])
        const total = maxNum(1, w.text.length)
        let curX = b[0]
        parts.forEach(p => {
          const wW = Math.max(8, Math.round(span * (p.length / total)))
          converted.push({
            image_id: imageId,
            word_id: `w_${converted.length}`,
            transcription: p,
            x_min: curX,
            y_min: b[1],
            x_max: Math.min(b[2], curX + wW),
            y_max: b[3],
            confidence: roundNum(w.confidence || 1.0),
          })
          curX += wW + Math.round(span * (1 / total))
        })
      }
    })

    setAnnotations(converted)
    setSelectedIdx(null)
    notify(`Auto-populated ${converted.length} word bounding boxes from ${engine}!`, 'success')
  }

  const roundNum = n => Math.round(n * 100) / 100
  const maxNum = (a, b) => (a > b ? a : b)

  const handleExportJSON = () => {
    download(`${imageId}_annotations.json`, JSON.stringify(annotations, null, 2), 'application/json')
  }

  const handleExportCSV = () => {
    download(`${imageId}_annotations.csv`, toCSV(annotations), 'text/csv')
  }

  const handleUploadSubmit = async e => {
    e.preventDefault()
    if (!uploadFile) return
    try {
      setUploading(true)
      const res = await uploadImageFile(uploadFile, uploadType)
      notify(`Uploaded image: ${res.id}`, 'success')
      setUploadOpen(false)
      setUploadFile(null)
      selectImage(res.id)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const curSelected = selectedIdx !== null ? annotations[selectedIdx] : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ground Truth Annotation Studio"
        desc="Draw word-level bounding boxes, transcribe text, edit coordinates, and persist ground truth directly to the backend database."
      >
        {/* Document Selector */}
        <select
          value={imageId}
          onChange={e => selectImage(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {datasetList.map(d => (
            <option key={d.id} value={d.id}>
              {d.id} ({d.document_type} · {d.ground_truth_available ? 'GT' : 'unannotated'})
            </option>
          ))}
        </select>

        <Btn onClick={() => setUploadOpen(true)} disabled={!online}>
          <Upload size={14} />
          Upload Image
        </Btn>
        <Btn v="primary" onClick={handleSave} loading={saving} disabled={!online}>
          <Save size={14} />
          Save Annotations
        </Btn>
      </PageHeader>

      {/* Main Studio Workspace Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Canvas & Drawing Studio (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          <Card className="p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Interactive Annotation Canvas
                </span>
                <Badge tone="indigo">{annotations.length} boxes</Badge>
              </div>

              {/* Canvas toolbar */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
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

            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>👉 Click and drag on the scan below to create a new word bounding box.</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAutoPopulate('paddle')}
                  className="flex items-center gap-1 font-semibold text-teal-700 hover:underline dark:text-teal-400"
                >
                  <Wand2 size={12} /> From PaddleOCR
                </button>
                <button
                  onClick={() => handleAutoPopulate('tesseract')}
                  className="flex items-center gap-1 font-semibold text-amber-700 hover:underline dark:text-amber-400"
                >
                  <Wand2 size={12} /> From Tesseract
                </button>
              </div>
            </div>

            {/* Scrollable Container */}
            <div className="relative h-[600px] w-full overflow-auto rounded-lg border border-slate-200 bg-slate-950 dark:border-slate-800">
              <div
                ref={containerRef}
                style={{
                  width: `${imgW * zoom}px`,
                  height: `${imgH * zoom}px`,
                  position: 'relative',
                  cursor: 'crosshair',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <img
                  src={getImageUrl(imageId)}
                  alt={imageId}
                  className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
                />

                {/* SVG Render for Drawn Boxes */}
                <svg
                  viewBox={`0 0 ${imgW} ${imgH}`}
                  className="absolute inset-0 h-full w-full pointer-events-none"
                  style={{ width: `${imgW * zoom}px`, height: `${imgH * zoom}px` }}
                >
                  {annotations.map((a, i) => {
                    const bw = Math.max(2, a.x_max - a.x_min)
                    const bh = Math.max(2, a.y_max - a.y_min)
                    const isSelected = selectedIdx === i

                    return (
                      <g key={i}>
                        <rect
                          x={a.x_min}
                          y={a.y_min}
                          width={bw}
                          height={bh}
                          fill={isSelected ? 'rgba(13, 148, 136, 0.35)' : 'rgba(59, 130, 246, 0.18)'}
                          stroke={isSelected ? '#0d9488' : '#3b82f6'}
                          strokeWidth={isSelected ? 3 : 1.5}
                          className="pointer-events-auto cursor-pointer"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedIdx(i)
                          }}
                        />
                      </g>
                    )
                  })}

                  {/* Active drawing box */}
                  {drawing && currentBox && (
                    <rect
                      x={currentBox.x_min}
                      y={currentBox.y_min}
                      width={currentBox.x_max - currentBox.x_min}
                      height={currentBox.y_max - currentBox.y_min}
                      fill="rgba(16, 185, 129, 0.25)"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  )}
                </svg>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar: Inspector & Annotation List (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Annotation Editor */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Annotation Inspector
              </span>
              {selectedIdx !== null && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 text-xs text-rose-600 hover:underline"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>

            {curSelected ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Word ID
                  </label>
                  <input
                    value={curSelected.word_id}
                    onChange={e => {
                      const next = [...annotations]
                      next[selectedIdx].word_id = e.target.value
                      setAnnotations(next)
                    }}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Transcription (Ground Truth)
                  </label>
                  <input
                    value={curSelected.transcription}
                    onChange={e => {
                      const next = [...annotations]
                      next[selectedIdx].transcription = e.target.value
                      setAnnotations(next)
                    }}
                    className={inputCls + ' font-serif text-base font-bold'}
                  />
                </div>

                {/* Coordinate Fields */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-0.5">X Min</label>
                    <input
                      type="number"
                      value={curSelected.x_min}
                      onChange={e => {
                        const next = [...annotations]
                        next[selectedIdx].x_min = parseInt(e.target.value) || 0
                        setAnnotations(next)
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-0.5">Y Min</label>
                    <input
                      type="number"
                      value={curSelected.y_min}
                      onChange={e => {
                        const next = [...annotations]
                        next[selectedIdx].y_min = parseInt(e.target.value) || 0
                        setAnnotations(next)
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-0.5">X Max</label>
                    <input
                      type="number"
                      value={curSelected.x_max}
                      onChange={e => {
                        const next = [...annotations]
                        next[selectedIdx].x_max = parseInt(e.target.value) || 0
                        setAnnotations(next)
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-0.5">Y Max</label>
                    <input
                      type="number"
                      value={curSelected.y_max}
                      onChange={e => {
                        const next = [...annotations]
                        next[selectedIdx].y_max = parseInt(e.target.value) || 0
                        setAnnotations(next)
                      }}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Confidence (0.0 to 1.0)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={curSelected.confidence}
                    onChange={e => {
                      const next = [...annotations]
                      next[selectedIdx].confidence = parseFloat(e.target.value) || 1.0
                      setAnnotations(next)
                    }}
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Click on any box in the canvas or list to inspect and edit its transcription.
              </div>
            )}
          </Card>

          {/* Annotation Token List */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                All Words ({annotations.length})
              </span>
              <button
                onClick={handleClearAll}
                className="text-xs text-rose-500 hover:underline"
              >
                Clear All
              </button>
            </div>

            <div className="mt-2.5 max-h-64 overflow-y-auto space-y-1">
              {annotations.map((a, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className={`flex items-center justify-between rounded-md p-1.5 text-xs cursor-pointer transition ${
                    selectedIdx === i
                      ? 'bg-teal-50 border border-teal-300 font-bold dark:bg-teal-950 dark:border-teal-700'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate font-serif text-slate-800 dark:text-slate-200">
                    {a.transcription}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    [{a.x_min}, {a.y_min}]
                  </span>
                </div>
              ))}
            </div>

            {/* Export buttons */}
            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Btn size="sm" onClick={handleExportJSON} className="flex-1 justify-center">
                <Download size={12} /> JSON
              </Btn>
              <Btn size="sm" onClick={handleExportCSV} className="flex-1 justify-center">
                <Download size={12} /> CSV
              </Btn>
            </div>
          </Card>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Image for Annotation">
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Document Image
            </label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={e => setUploadFile(e.target.files[0])}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Document Classification
            </label>
            <select
              value={uploadType}
              onChange={e => setUploadType(e.target.value)}
              className={inputCls}
            >
              <option value="printed">Printed Historical</option>
              <option value="handwritten">Handwritten Manuscript</option>
              <option value="synthetic_demo">Synthetic Demo Document</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn onClick={() => setUploadOpen(false)}>Cancel</Btn>
            <Btn v="primary" type="submit" loading={uploading} disabled={!uploadFile}>
              Upload & Open Studio
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
