import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Upload,
  ArrowUpDown,
  Filter,
  CheckCircle,
  XCircle,
  FileText,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { PageHeader, Card, Btn, Badge, SyntheticBadge, Modal, inputCls, LoadingSpinner, EmptyState } from '../components/ui.jsx'
import { getDataset, uploadImageFile, getImageUrl } from '../api.js'
import { useApp } from '../components/AppContext.jsx'

export default function Dataset() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [gtFilter, setGtFilter] = useState('all')
  const [errorFilter, setErrorFilter] = useState('all')
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const pageSize = 12

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadType, setUploadType] = useState('printed')
  const [uploading, setUploading] = useState(false)

  const nav = useNavigate()
  const { notify, online } = useApp()

  const loadDataset = async () => {
    try {
      setLoading(true)
      const data = await getDataset()
      setItems(data)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDataset()
  }, [])

  // Filtering & Sorting
  const filtered = useMemo(() => {
    return items.filter(item => {
      // Search
      const matchQ =
        !q ||
        item.id.toLowerCase().includes(q.toLowerCase()) ||
        item.document_type.toLowerCase().includes(q.toLowerCase())

      // Document Type Filter
      const matchType =
        typeFilter === 'all' ||
        (typeFilter === 'synthetic_demo' && item.is_synthetic) ||
        item.document_type === typeFilter

      // Ground Truth Filter
      const matchGt =
        gtFilter === 'all' ||
        (gtFilter === 'yes' && item.ground_truth_available) ||
        (gtFilter === 'no' && !item.ground_truth_available)

      // Error Filter
      let matchErr = true
      if (errorFilter === 'low_cer') {
        matchErr = item.paddle_cer !== null && item.paddle_cer < 0.05
      } else if (errorFilter === 'high_cer') {
        matchErr = item.paddle_cer !== null && item.paddle_cer >= 0.05
      } else if (errorFilter === 'discrepancy') {
        matchErr =
          item.paddle_cer !== null &&
          item.tesseract_cer !== null &&
          Math.abs(item.paddle_cer - item.tesseract_cer) > 0.1
      }

      return matchQ && matchType && matchGt && matchErr
    })
  }, [items, q, typeFilter, gtFilter, errorFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]

      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })
  }, [filtered, sortBy, sortOrder])

  const totalPages = Math.ceil(sorted.length / pageSize) || 1
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page])

  const handleSort = field => {
    if (sortBy === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
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
      await loadDataset()
      nav(`/comparison?id=${res.id}`)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dataset Explorer"
        desc="Corpus of historical printed documents, archival manuscripts, and calibrated synthetic validation documents with ground-truth transcriptions and OCR evaluations."
      >
        <Btn v="primary" onClick={() => setUploadOpen(true)} disabled={!online}>
          <Upload size={14} />
          Upload Document
        </Btn>
      </PageHeader>

      {/* Filter and Search Bar */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative min-w-[240px] flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={q}
              onChange={e => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Search by Document ID or Type..."
              className={inputCls + ' pl-9'}
            />
          </div>

          {/* Document Type Filter */}
          <select
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">All Document Types</option>
            <option value="printed">Printed Historical</option>
            <option value="handwritten">Handwritten Manuscript</option>
            <option value="synthetic_demo">Synthetic Demo</option>
          </select>

          {/* Ground Truth Filter */}
          <select
            value={gtFilter}
            onChange={e => {
              setGtFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">All GT Statuses</option>
            <option value="yes">With Ground Truth Only</option>
            <option value="no">Unannotated Documents</option>
          </select>

          {/* Error Rate Filter */}
          <select
            value={errorFilter}
            onChange={e => {
              setErrorFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">All Error Rates</option>
            <option value="low_cer">High Accuracy (CER &lt; 5%)</option>
            <option value="high_cer">High Error (CER ≥ 5%)</option>
            <option value="discrepancy">High Model Discrepancy (|Δ| &gt; 10%)</option>
          </select>
        </div>

        {/* Results summary bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{filtered.length}</span> documents
            (Page {page} of {totalPages})
          </div>
          <div className="flex items-center gap-3">
            <span>Sort by:</span>
            {['id', 'paddle_cer', 'tesseract_cer', 'paddle_wer', 'paddle_iou', 'paddle_runtime'].map(f => (
              <button
                key={f}
                onClick={() => handleSort(f)}
                className={`flex items-center gap-1 font-semibold hover:underline ${
                  sortBy === f ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500'
                }`}
              >
                <span>{f.replace('_', ' ').toUpperCase()}</span>
                {sortBy === f && <ArrowUpDown size={12} />}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Dataset Table / Grid */}
      {loading ? (
        <LoadingSpinner label="Loading dataset documents..." />
      ) : !paginated.length ? (
        <EmptyState
          title="No documents matched"
          desc="No images in the corpus match your search query and filters."
          action={<Btn onClick={() => { setQ(''); setTypeFilter('all'); setGtFilter('all'); setErrorFilter('all'); }}>Clear Filters</Btn>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Image Preview & ID</th>
                  <th className="px-4 py-3 font-semibold">Document Type</th>
                  <th className="px-4 py-3 font-semibold">Resolution</th>
                  <th className="px-4 py-3 font-semibold">Ground Truth</th>
                  <th className="px-4 py-3 font-semibold">PaddleOCR Status</th>
                  <th className="px-4 py-3 font-semibold">Tesseract Status</th>
                  <th className="px-4 py-3 font-semibold">Paddle CER</th>
                  <th className="px-4 py-3 font-semibold">Tesseract CER</th>
                  <th className="px-4 py-3 font-semibold">Paddle WER</th>
                  <th className="px-4 py-3 font-semibold">Word IoU</th>
                  <th className="px-4 py-3 font-semibold">Runtimes</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginated.map(doc => {
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => nav(`/comparison?id=${doc.id}`)}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      {/* Image & ID */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getImageUrl(doc.id)}
                            alt={doc.id}
                            className="h-10 w-12 rounded object-cover border border-slate-200 bg-slate-100 dark:border-slate-700"
                            loading="lazy"
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{doc.id}</div>
                            {doc.is_synthetic && <SyntheticBadge size="sm" />}
                          </div>
                        </div>
                      </td>

                      {/* Document Type */}
                      <td className="px-4 py-3">
                        <Badge tone={doc.is_synthetic ? 'purple' : doc.document_type === 'printed' ? 'teal' : 'amber'}>
                          {doc.document_type}
                        </Badge>
                      </td>

                      {/* Resolution */}
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {doc.resolution[0]} × {doc.resolution[1]}
                      </td>

                      {/* Ground Truth Availability */}
                      <td className="px-4 py-3">
                        {doc.ground_truth_available ? (
                          <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle size={14} />
                            <span>{doc.ground_truth_words} words</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400">
                            <XCircle size={14} />
                            <span>Unannotated</span>
                          </span>
                        )}
                      </td>

                      {/* Paddle Status */}
                      <td className="px-4 py-3">
                        <Badge tone={doc.paddle_status === 'success' ? 'green' : 'slate'}>
                          {doc.paddle_status}
                        </Badge>
                      </td>

                      {/* Tesseract Status */}
                      <td className="px-4 py-3">
                        <Badge tone={doc.tesseract_status === 'success' ? 'green' : 'slate'}>
                          {doc.tesseract_status}
                        </Badge>
                      </td>

                      {/* Paddle CER */}
                      <td className="px-4 py-3 font-mono">
                        {doc.paddle_cer !== null ? (
                          <span className={doc.paddle_cer <= (doc.tesseract_cer ?? 1) ? 'font-bold text-emerald-600 dark:text-emerald-400' : ''}>
                            {(doc.paddle_cer * 100).toFixed(2)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Tesseract CER */}
                      <td className="px-4 py-3 font-mono">
                        {doc.tesseract_cer !== null ? (
                          <span className={doc.tesseract_cer < (doc.paddle_cer ?? 1) ? 'font-bold text-amber-600 dark:text-amber-400' : ''}>
                            {(doc.tesseract_cer * 100).toFixed(2)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Paddle WER */}
                      <td className="px-4 py-3 font-mono">
                        {doc.paddle_wer !== null ? `${(doc.paddle_wer * 100).toFixed(2)}%` : '—'}
                      </td>

                      {/* Word IoU */}
                      <td className="px-4 py-3 font-mono">
                        {doc.paddle_iou !== null ? `${(doc.paddle_iou * 100).toFixed(1)}%` : '—'}
                      </td>

                      {/* Runtimes */}
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        P: {doc.paddle_runtime ? `${doc.paddle_runtime.toFixed(1)}s` : '—'} | T:{' '}
                        {doc.tesseract_runtime ? `${doc.tesseract_runtime.toFixed(1)}s` : '—'}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
                          <span>Inspect</span>
                          <ExternalLink size={12} />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Btn size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
                Previous
              </Btn>
              <Btn size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next
                <ChevronRight size={14} />
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Historical Document">
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Document Image File (PNG, JPG, TIFF, WEBP)
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
              <option value="printed">Printed Historical (Broadsheet / Book / Newspaper)</option>
              <option value="handwritten">Handwritten Manuscript / Archive</option>
              <option value="synthetic_demo">Synthetic Demo Document</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn onClick={() => setUploadOpen(false)}>Cancel</Btn>
            <Btn v="primary" type="submit" loading={uploading} disabled={!uploadFile}>
              Upload & Open OCR
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
