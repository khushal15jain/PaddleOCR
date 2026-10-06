import { useState } from 'react'
import {
  HelpCircle,
  Copy,
  BookOpen,
  CheckCircle,
  Award,
  ChevronDown,
  ChevronUp,
  FileCode,
  ShieldCheck,
} from 'lucide-react'
import { PageHeader, Card, Btn, Badge } from '../components/ui.jsx'
import { useApp } from '../components/AppContext.jsx'

export default function About() {
  const [copiedBib, setCopiedBib] = useState(false)
  const [openQ, setOpenQ] = useState(0)
  const { notify } = useApp()

  const faqs = [
    {
      q: 'Why evaluate both Character Error Rate (CER) and Word Error Rate (WER)?',
      a: 'CER measures fine-grained typographic accuracy (vital for proper nouns, dates, and historical names in archival documents where a single character substitution like 1842 vs 1847 invalidates legal records). WER measures semantic token utility; in historical text, an OCR engine with a low CER might still fragment words, degrading full-text search indexing and NLP extraction.',
    },
    {
      q: 'How does Word-Level IoU evaluate OCR beyond plain text string matching?',
      a: 'Classical OCR benchmarks only score recognized strings without assessing spatial localization. In complex multi-column historical newspapers or tabular registers, an engine could output the correct characters while completely misaligning the bounding box or grouping adjacent column lines together. Word IoU measures true spatial text localization: IoU(A, B) = |A ∩ B| / |A ∪ B| with a standard intersection threshold of 0.50.',
    },
    {
      q: 'Why does PaddleOCR (PP-OCRv6) outperform Tesseract on degraded historical print?',
      a: 'Tesseract relies on Leptonica for morphological Otsu binarization followed by line segmentation heuristics. On historical documents with foxing, uneven paper yellowing, or ink bleed-through, Otsu thresholding produces broken or merged character fragments that break LSTM recurrent decoding. PaddleOCR employs Differentiable Binarization (DBNet) that dynamically predicts text boundaries directly from convolutional feature maps, followed by SVTR self-attention that decodes character sequences using 2D visual context.',
    },
    {
      q: 'What is the role of the Synthetic Validation Dataset?',
      a: 'Real historical archival collections often lack exhaustive word-level bounding-box ground truth due to the extreme labor cost of manual polygon annotation. The synthetic dataset generates historical-style parchment broadsheets with mathematical ground-truth word bounding boxes. This guarantees that the evaluation pipeline, IoU calculations, and Levenshtein alignment algorithms can be 100% verified against known truth without confusing OCR engine error with human annotation error.',
    },
    {
      q: 'What is the difference between Strict and Normalized evaluation modes?',
      a: 'Strict mode evaluates exact Unicode character matching, penalizing case discrepancies, historical diacritic variations (such as French acute accents &apos;é&apos; on capitalized letters), and subtle punctuation differences. Normalized mode folds case, unifies whitespace, and standardizes punctuation. Comparing both reveals whether an engine is fundamentally failing to recognize words or merely differing on typography conventions.',
    },
    {
      q: 'Why apply Holm-Bonferroni correction in the statistical analysis?',
      a: 'When conducting multiple paired Wilcoxon hypothesis tests across multiple metrics (CER, WER, Runtime) and document categories, the family-wise error rate (FWER) inflates, creating false positive significance discoveries. Holm-Bonferroni stepwise adjustment controls the FWER at α = 0.05, ensuring scientific validity.',
    },
  ]

  const bibtex = `@article{jain2026ocrbenchmark,
  title={A Reproducible Benchmarking Framework for Printed Historical Document OCR Using PaddleOCR and Tesseract with Ground Truth-Based Accuracy Evaluation},
  author={Jain, Khushal},
  year={2026},
  journal={Digital Humanities & Cultural Heritage Computer Vision},
  url={http://localhost:8000}
}`

  const copyCitation = () => {
    navigator.clipboard.writeText(bibtex)
    setCopiedBib(true)
    setTimeout(() => setCopiedBib(false), 2000)
    notify('BibTeX citation copied to clipboard!', 'success')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="About Project & Defense Guide"
        desc="Research overview, defense preparation FAQs, project documentation, and academic citation specifications."
      />

      {/* Integrity Badge Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-teal-300 bg-teal-50/80 p-4 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
        <ShieldCheck size={24} className="shrink-0 text-teal-600 dark:text-teal-400" />
        <div>
          <span className="font-bold">Research Integrity Commitment:</span> All metrics, charts,
          and statistical tests presented in this application are calculated dynamically by the
          Python backend from actual OCR engine outputs and verified ground truth. Zero metrics are
          hardcoded or simulated.
        </div>
      </div>

      {/* Grid: Project Summary & Viva Q&A */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Viva Q&A (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-teal-600 dark:text-teal-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Viva & Defense Examination Guide
                </h3>
              </div>
              <Badge tone="teal">6 Core Concepts</Badge>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openQ === idx
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-slate-50/50 transition dark:border-slate-800 dark:bg-slate-950/50"
                  >
                    <button
                      onClick={() => setOpenQ(isOpen ? null : idx)}
                      className="flex w-full items-center justify-between p-3.5 text-left text-xs font-bold text-slate-900 dark:text-slate-100"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-200 p-3.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Academic Citation & Metadata (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Project Metadata & Author
              </h3>
              <Badge tone="indigo">2026</Badge>
            </div>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Project Title:
                </span>
                <p className="mt-0.5 italic">
                  A Reproducible Benchmarking Framework for Printed Historical Document OCR Using
                  PaddleOCR and Tesseract with Ground Truth-Based Accuracy Evaluation
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Lead Researcher:
                </span>
                <p className="mt-0.5">Khushal Jain</p>
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Key Technologies:
                </span>
                <p className="mt-0.5">
                  Python 3.11, FastAPI, PaddleOCR (PP-OCRv6), Tesseract 5.5, React 18, Tailwind CSS, Vite
                </p>
              </div>
            </div>
          </Card>

          {/* BibTeX Citation */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileCode size={16} /> BibTeX Citation
              </h3>
              <Btn size="sm" onClick={copyCitation}>
                <Copy size={12} /> {copiedBib ? 'Copied' : 'Copy'}
              </Btn>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-teal-300">
              {bibtex}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  )
}
