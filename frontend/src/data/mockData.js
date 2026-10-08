// ALL MOCK DATA LIVES HERE. Replace with real API calls when a backend exists.
// Facts taken from the repo README: 50 images, 5 verified ground-truth files, 2 engines.
// Everything in `summary`, `perDoc`, `stats` is ILLUSTRATIVE and not a real benchmark result.

export const MOCK_NOTICE = 'Mock data: not real benchmark results.'
export const VERIFIED = [5, 8, 10, 39, 40]
export const SUSPECT = [8, 10, 40] // README: labeled handwritten but look printed
const HW_ODD_EXCEPT = [39, 41, 43]
const HW_EVEN = [8, 10, 40]

export const images = Array.from({ length: 50 }, (_, k) => {
  const n = k + 1
  const hw = (n % 2 === 1 && !HW_ODD_EXCEPT.includes(n)) || HW_EVEN.includes(n)
  return {
    id: `IMG_${String(n).padStart(3, '0')}`,
    type: hw ? 'handwritten' : 'printed',
    gtVerified: VERIFIED.includes(n),
    labelSuspect: SUSPECT.includes(n),
    note: n === 5 ? 'Contains [UNCLEAR: word] tags; needs a second pass.' : SUSPECT.includes(n) ? 'Metadata label likely wrong (looks typed/printed).' : ''
  }
})

export const engines = ['PaddleOCR', 'Tesseract']

export const pipelineStages = [
  ['Validate dataset', 'scripts/validate_dataset.py'],
  ['Run OCR', 'scripts/run_ocr.py'],
  ['Evaluate', 'scripts/evaluate.py'],
  ['Statistics', 'src/ocr_benchmark/evaluation'],
  ['Generate plots', 'scripts/generate_plots.py'],
  ['Generate report', 'scripts/generate_report.py']
]

export const activity = [
  'v2.0.0 rebuild: PaddleOCR 3.x .predict() fix (per README)',
  'jiwer 4.x metrics adopted (per README)',
  'Configs unified into configs/config.yaml (per README)',
  '5 of 50 ground-truth files hand-verified (per README)'
]

export const summary = [
  { engine: 'PaddleOCR', type: 'printed', mode: 'strict', cer: 0.12, wer: 0.27, runtime: 3.1 },
  { engine: 'Tesseract', type: 'printed', mode: 'strict', cer: 0.15, wer: 0.31, runtime: 1.9 },
  { engine: 'PaddleOCR', type: 'handwritten', mode: 'strict', cer: 0.34, wer: 0.58, runtime: 3.4 },
  { engine: 'Tesseract', type: 'handwritten', mode: 'strict', cer: 0.46, wer: 0.74, runtime: 2.2 },
  { engine: 'PaddleOCR', type: 'printed', mode: 'normalized', cer: 0.09, wer: 0.2, runtime: 3.1 },
  { engine: 'Tesseract', type: 'printed', mode: 'normalized', cer: 0.12, wer: 0.25, runtime: 1.9 },
  { engine: 'PaddleOCR', type: 'handwritten', mode: 'normalized', cer: 0.3, wer: 0.5, runtime: 3.4 },
  { engine: 'Tesseract', type: 'handwritten', mode: 'normalized', cer: 0.41, wer: 0.66, runtime: 2.2 }
]

export const perDoc = images.filter(i => i.gtVerified).flatMap((im, k) =>
  engines.flatMap((engine, e) => ['strict', 'normalized'].map((mode, m) => ({
    id: im.id, type: im.type, engine, mode,
    cer: +(0.08 + 0.05 * k + 0.04 * e - (m ? 0.02 : 0)).toFixed(3),
    wer: +(0.2 + 0.04 * k + 0.06 * e - (m ? 0.04 : 0)).toFixed(3),
    runtime: +(2 + 0.7 * k + 1.5 * e).toFixed(1)
  }))))

export const stats = [
  { type: 'printed', mode: 'strict', metric: 'CER', n: 2, p: '0.50', effect: '0.40', ci: '[-0.06, 0.01]' },
  { type: 'handwritten', mode: 'strict', metric: 'CER', n: 3, p: '0.25', effect: '0.67', ci: '[-0.18, -0.04]' },
  { type: 'printed', mode: 'normalized', metric: 'WER', n: 2, p: '0.50', effect: '0.35', ci: '[-0.09, 0.02]' },
  { type: 'handwritten', mode: 'normalized', metric: 'Runtime', n: 3, p: '0.25', effect: '0.80', ci: '[0.4, 1.3]' }
]

export const reports = [
  { id: 'r1', name: 'Research report', file: 'outputs/reports/research_report.md', desc: 'Narrative conclusions with tables and figures.' },
  { id: 'r2', name: 'Dataset validation', file: 'outputs/metrics/dataset_validation.json', desc: 'Integrity checks for images and ground truth.' },
  { id: 'r3', name: 'Per-document results', file: 'outputs/metrics/per_document_results.csv', desc: 'CER, WER and runtime for every image and engine.' },
  { id: 'r4', name: 'Summary metrics', file: 'outputs/metrics/summary.csv', desc: 'Aggregated scores by engine, type and mode.' },
  { id: 'r5', name: 'Statistical tests', file: 'outputs/metrics/statistical_tests.csv', desc: 'Wilcoxon tests, effect sizes and bootstrap intervals.' }
]

export const reportTemplate = `# Historical French OCR Benchmark: report template

> TEMPLATE PREVIEW (mock). No benchmark has been run from this UI.

## 1. Dataset
50 scans, ground truth coverage and label audit.

## 2. Methods
CER/WER (strict and normalized), paired Wilcoxon, bootstrap 95% CI.

## 3. Results
Filled in by scripts/generate_report.py once the pipeline runs.
`
