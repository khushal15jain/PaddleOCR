/**
 * Unified API Client for OCR Benchmarking Framework
 */

export const getBaseUrl = () => {
  const saved = localStorage.getItem('api_url')
  if (saved) return saved.replace(/\/$/, '')
  // If hosted on backend (e.g. port 8000), use origin.
  // If on vite dev server (port 5173), proxy handles /api, or use http://127.0.0.1:8000
  if (window.location.port === '5173') {
    return 'http://127.0.0.1:8000'
  }
  return window.location.origin
}

export async function apiRequest(endpoint, options = {}) {
  const base = getBaseUrl()
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`

  const headers = { ...options.headers }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    let msg = `HTTP ${res.status}: ${res.statusText}`
    try {
      const err = await res.json()
      msg = err.detail || err.message || msg
    } catch {
      // not json
    }
    throw new Error(msg)
  }

  const cType = res.headers.get('content-type') || ''
  if (cType.includes('application/json')) {
    return res.json()
  }
  return res.text()
}

// Health & System
export const getHealth = () => apiRequest('/api/health')
export const getReproducibility = () => apiRequest('/api/reproducibility')

// Dashboard
export const getDashboard = () => apiRequest('/api/dashboard')

// Dataset & Images
export const getDataset = () => apiRequest('/api/dataset')
export const getImageDetails = id => apiRequest(`/api/images/${id}`)
export const getImageUrl = id => `${getBaseUrl()}/api/images/${id}/file`

export async function uploadImageFile(file, documentType = 'printed') {
  const fd = new FormData()
  fd.append('file', file)
  return apiRequest(`/api/upload?document_type=${encodeURIComponent(documentType)}`, {
    method: 'POST',
    body: fd,
  })
}

// OCR Execution
export const runPaddleOCR = (imageId, force = false) =>
  apiRequest('/api/ocr/paddle', {
    method: 'POST',
    body: JSON.stringify({ image_id: imageId, force }),
  })

export const runTesseractOCR = (imageId, force = false) =>
  apiRequest('/api/ocr/tesseract', {
    method: 'POST',
    body: JSON.stringify({ image_id: imageId, force }),
  })

export const runCompareOCR = imageId =>
  apiRequest('/api/ocr/compare', {
    method: 'POST',
    body: JSON.stringify({ image_id: imageId }),
  })

// Evaluation
export const runEvaluation = () =>
  apiRequest('/api/evaluate', {
    method: 'POST',
  })

export const getResults = (name = 'summary') =>
  apiRequest(`/api/results?name=${encodeURIComponent(name)}`)

// Annotations
export const getAnnotations = id => apiRequest(`/api/annotations/${id}`)

export const saveAnnotation = annot =>
  apiRequest('/api/annotations', {
    method: 'POST',
    body: JSON.stringify(annot),
  })

export const updateAllAnnotations = (id, annots) =>
  apiRequest(`/api/annotations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(annots),
  })

export const deleteAnnotation = (id, wordId = null) =>
  apiRequest(`/api/annotations/${id}${wordId ? `?word_id=${encodeURIComponent(wordId)}` : ''}`, {
    method: 'DELETE',
  })

// Benchmark runner
export const runBenchmark = (allowPartial = true) =>
  apiRequest('/api/benchmark/run', {
    method: 'POST',
    body: JSON.stringify({ allow_partial: allowPartial }),
  })

export const stopBenchmark = () =>
  apiRequest('/api/benchmark/stop', {
    method: 'POST',
  })

export const getBenchmarkStatus = () => apiRequest('/api/benchmark/status')

// Export URLs
export const getExportUrl = type => `${getBaseUrl()}/api/export/${type}`
