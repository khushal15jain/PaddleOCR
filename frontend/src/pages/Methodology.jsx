import { useState } from 'react'
import {
  GitBranch,
  ArrowDown,
  Layers,
  Cpu,
  CheckCircle,
  FileText,
  Calculator,
  Sliders,
  Sparkles,
  Code2,
  ChevronRight,
} from 'lucide-react'
import { PageHeader, Card, Badge, Btn } from '../components/ui.jsx'

export default function Methodology() {
  const [selectedStep, setSelectedStep] = useState('pipeline_overview')

  const steps = [
    {
      id: 'input',
      title: '1. Historical Document Input',
      desc: 'High-resolution archival scans of newspapers, broadsheets, and civil acts (or synthetic validation documents).',
      details: {
        spec: 'Input Format: TIFF / JPG / PNG (300+ DPI recommended)',
        algorithm: 'Dataset Loading & Metadata Indexing',
        notes:
          'Documents undergo format verification, dimension checking, and metadata association (printed, handwritten, or synthetic demo).',
        code: `# Load dataset metadata and ground truth\nground_truth_text = Path("data/ground_truth/IMG_010.txt").read_text()\nraw_image = cv2.imread("data/raw/images/IMG_010.jpg")`,
      },
    },
    {
      id: 'preprocessing',
      title: '2. Image Preprocessing & Normalization',
      desc: 'Noise filtering, contrast stretching, and optional orientation and unwarping correction.',
      details: {
        spec: 'Color Space: Grayscale / RGB normalization',
        algorithm: 'Otsu Binarization & Adaptive Thresholding',
        notes:
          'PaddleOCR applies optional doc orientation classification and unwarping. Tesseract utilizes Leptonica image processing primitives (Otsu binarization, skew detection).',
        code: `# Normalization pipeline\ngray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)\nbinarized = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]`,
      },
    },
    {
      id: 'paddleocr',
      title: '3a. PaddleOCR Processing (Deep Learning)',
      desc: 'DBNet convolutional detector + SVTR visual transformer recognition.',
      details: {
        spec: 'Model: PP-OCRv6 (French language configuration)',
        algorithm: 'Differentiable Binarization (DBNet) + SVTR',
        notes:
          'Predicts polygon contours for arbitrary text orientations followed by character sequence recognition with visual self-attention.',
        code: `result = paddle_ocr.predict(image_path)\n# Extracts rec_texts, rec_scores, and dt_polys polygons\nfor text, score, poly in zip(rec_texts, rec_scores, dt_polys):\n    words.append({"text": text, "confidence": score, "bbox": poly_to_bbox(poly)})`,
      },
    },
    {
      id: 'tesseract',
      title: '3b. Tesseract OCR Processing (LSTM Recurrent)',
      desc: 'Page segmentation mode 3 (PSM 3) + LSTM line-level recurrent recognition.',
      details: {
        spec: 'Engine: Tesseract 5.5 (fra.traineddata)',
        algorithm: 'Leptonica morphological segmentation + Bidirectional LSTM',
        notes:
          'Segments lines and words through connected component analysis, followed by LSTM sequence-to-sequence character classification.',
        code: `data = pytesseract.image_to_data(img, lang="fra", config="--psm 3 --oem 1", output_type=Output.DICT)\nfor i in range(len(data["text"])):\n    words.append({"text": data["text"][i], "confidence": data["conf"][i]/100.0, "bbox": [x, y, x+w, y+h]})`,
      },
    },
    {
      id: 'extraction',
      title: '4. Text & Bounding Box Extraction',
      desc: 'Harmonization of word-level bounding coordinates, transcriptions, and confidence scores.',
      details: {
        spec: 'Coordinate System: [x_min, y_min, x_max, y_max]',
        algorithm: 'Proportional Word Span Decomposition',
        notes:
          'Ensures both engines output standard word-level tokens with bounding coordinates for direct 1-to-1 comparison with ground truth.',
        code: `# Coordinate normalization\nbbox = [int(min(x_coords)), int(min(y_coords)), int(max(x_coords)), int(max(y_coords))]`,
      },
    },
    {
      id: 'comparison',
      title: '5. Ground Truth Alignment & Levenshtein Distance',
      desc: 'Levenshtein edit distance alignments (Substitutions, Deletions, Insertions).',
      details: {
        spec: 'Alignment Level: Character & whitespace-delimited word tokens',
        algorithm: 'Needleman-Wunsch & Levenshtein Dynamic Programming',
        notes:
          'Evaluates exact string edit operations between reference ground truth and OCR hypothesis, generating color-coded diff alignments.',
        code: `matcher = difflib.SequenceMatcher(None, gt_words, pred_words)\nfor tag, i1, i2, j1, j2 in matcher.get_opcodes():\n    # Classifies: 'equal', 'replace', 'delete', 'insert'`,
      },
    },
    {
      id: 'metrics',
      title: '6. Error & Spatial Metric Calculation',
      desc: 'CER, WER, Word-level IoU, Bounding-Box Precision, Recall, and F1 score.',
      details: {
        spec: 'IoU Threshold: 0.50 (Localization threshold: 0.20)',
        algorithm: 'Greedy Bipartite IoU Box Matching',
        notes:
          'Computes exact character error rate, word error rate, intersection-over-union between predicted and ground-truth boxes, and detection precision/recall.',
        code: `CER = (S_c + D_c + I_c) / N_c\nWER = (S_w + D_w + I_w) / N_w\nIoU = inter_area / union_area\nF1 = 2 * (Precision * Recall) / (Precision + Recall)`,
      },
    },
    {
      id: 'benchmark',
      title: '7. Benchmark Comparison & Statistical Tests',
      desc: 'Wilcoxon signed-rank non-parametric tests with Holm-Bonferroni correction.',
      details: {
        spec: 'Significance Threshold: α = 0.05',
        algorithm: 'Paired Wilcoxon Signed-Rank Test',
        notes:
          'Assesses whether observed accuracy differences between PaddleOCR and Tesseract are statistically significant or attributable to chance.',
        code: `stat, p_val = scipy.stats.wilcoxon(paddle_scores, tesseract_scores)\nsignificant = p_val < (0.05 / family_size)`,
      },
    },
    {
      id: 'results',
      title: '8. Final Research Synthesis & Export',
      desc: 'Comprehensive research dashboard, research report markdown, CSV, Excel, and JSON datasets.',
      details: {
        spec: 'Outputs: summary.csv, per_document_results.csv, research_report.md',
        algorithm: 'Automated Research Artifact Generation',
        notes:
          'Generates review-ready reproducible artifacts, tables, and interactive visualizations.',
        code: `# Export endpoints\nGET /api/export/csv\nGET /api/export/excel\nGET /api/export/report`,
      },
    },
  ]

  const active = steps.find(s => s.id === selectedStep) || steps[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Methodology Pipeline Visualization"
        desc="Interactive architectural diagram showing the complete end-to-end evaluation pipeline from historical scan to statistical verification."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Interactive Flowchart Diagram (6 Cols) */}
        <div className="lg:col-span-6 space-y-3">
          <Card className="p-5">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Interactive Execution Pipeline (Click Any Step)
            </h3>

            <div className="space-y-3">
              {/* Step 1: Input */}
              <button
                onClick={() => setSelectedStep('input')}
                className={`w-full rounded-xl border p-3.5 text-left transition ${
                  selectedStep === 'input'
                    ? 'border-teal-600 bg-teal-50 dark:border-teal-500 dark:bg-teal-950/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Historical Document Scan
                  </span>
                  <Badge tone="indigo">Input Stage</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Archival newspapers, obituary notices, civil acts & synthetic demo documents
                </p>
              </button>

              <div className="flex justify-center text-slate-400">
                <ArrowDown size={18} />
              </div>

              {/* Step 2: Preprocessing */}
              <button
                onClick={() => setSelectedStep('preprocessing')}
                className={`w-full rounded-xl border p-3.5 text-left transition ${
                  selectedStep === 'preprocessing'
                    ? 'border-teal-600 bg-teal-50 dark:border-teal-500 dark:bg-teal-950/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Image Preprocessing & Normalization
                  </span>
                  <Badge tone="slate">Preprocessing</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Grayscale conversion, Otsu binarization, unwarping & orientation correction
                </p>
              </button>

              <div className="flex justify-center text-slate-400">
                <ArrowDown size={18} />
              </div>

              {/* Step 3: Split into PaddleOCR & Tesseract */}
              <div className="rounded-xl border border-dashed border-slate-300 p-3 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Parallel OCR Engine Inference
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedStep('paddleocr')}
                    className={`rounded-lg border p-3 text-left transition ${
                      selectedStep === 'paddleocr'
                        ? 'border-teal-600 bg-white dark:border-teal-400 dark:bg-slate-900 shadow-sm ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="font-bold text-xs text-teal-700 dark:text-teal-400">
                      PaddleOCR (PP-OCRv6)
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">DBNet + SVTR Transformer</div>
                  </button>

                  <button
                    onClick={() => setSelectedStep('tesseract')}
                    className={`rounded-lg border p-3 text-left transition ${
                      selectedStep === 'tesseract'
                        ? 'border-amber-600 bg-white dark:border-amber-400 dark:bg-slate-900 shadow-sm ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="font-bold text-xs text-amber-700 dark:text-amber-400">
                      Tesseract OCR (5.5)
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">Leptonica + Line LSTM</div>
                  </button>
                </div>
              </div>

              <div className="flex justify-center text-slate-400">
                <ArrowDown size={18} />
              </div>

              {/* Step 4: Extraction & Harmonization */}
              <button
                onClick={() => setSelectedStep('extraction')}
                className={`w-full rounded-xl border p-3.5 text-left transition ${
                  selectedStep === 'extraction'
                    ? 'border-teal-600 bg-teal-50 dark:border-teal-500 dark:bg-teal-950/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Text Tokens + Bounding Box Harmonization
                  </span>
                  <Badge tone="slate">Extraction</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Standardized tokens with coordinates: [x_min, y_min, x_max, y_max, confidence]
                </p>
              </button>

              <div className="flex justify-center text-slate-400">
                <ArrowDown size={18} />
              </div>

              {/* Step 5: Ground Truth Comparison */}
              <button
                onClick={() => setSelectedStep('comparison')}
                className={`w-full rounded-xl border p-3.5 text-left transition ${
                  selectedStep === 'comparison'
                    ? 'border-teal-600 bg-teal-50 dark:border-teal-500 dark:bg-teal-950/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Ground Truth Alignment (Levenshtein)
                  </span>
                  <Badge tone="blue">Evaluation Core</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Substitutions (S), Deletions (D), Insertions (I), Hits (H) token mapping
                </p>
              </button>

              <div className="flex justify-center text-slate-400">
                <ArrowDown size={18} />
              </div>

              {/* Step 6: Metric Calculation */}
              <button
                onClick={() => setSelectedStep('metrics')}
                className={`w-full rounded-xl border p-3.5 text-left transition ${
                  selectedStep === 'metrics'
                    ? 'border-teal-600 bg-teal-50 dark:border-teal-500 dark:bg-teal-950/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Metrics Engine: CER · WER · IoU · Precision · Recall · F1
                  </span>
                  <Badge tone="green">Calculated</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Strict and normalized evaluations + spatial bipartite IoU matching
                </p>
              </button>

              <div className="flex justify-center text-slate-400">
                <ArrowDown size={18} />
              </div>

              {/* Step 7 & 8: Benchmark & Results */}
              <button
                onClick={() => setSelectedStep('benchmark')}
                className={`w-full rounded-xl border p-3.5 text-left transition ${
                  selectedStep === 'benchmark'
                    ? 'border-teal-600 bg-teal-50 dark:border-teal-500 dark:bg-teal-950/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Benchmark Comparison & Statistical Tests
                  </span>
                  <Badge tone="teal">Synthesis</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Wilcoxon signed-rank tests with Holm-Bonferroni significance control
                </p>
              </button>
            </div>
          </Card>
        </div>

        {/* Step Deep Dive Details Card (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-6 sticky top-20 space-y-4">
            <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                Step Deep Dive
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {active.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {active.desc}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Specification & Parameters
                </span>
                <div className="mt-1 rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  {active.details.spec}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Algorithmic Rationale
                </span>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {active.details.notes}
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Code2 size={14} /> Implementation Code Snippet
                </span>
                <pre className="mt-1.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-teal-300 dark:border-slate-800">
                  {active.details.code}
                </pre>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
