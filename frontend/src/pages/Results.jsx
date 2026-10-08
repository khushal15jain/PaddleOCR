import { useState } from 'react'
import {
  GraduationCap,
  BookOpen,
  FileText,
  Target,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Award,
  ChevronRight,
} from 'lucide-react'
import { PageHeader, Card, Badge, Btn } from '../components/ui.jsx'

export default function Results() {
  const [activeSection, setActiveSection] = useState('problem')

  const sections = [
    { id: 'problem', title: '1. Problem Statement' },
    { id: 'objective', title: '2. Research Objective' },
    { id: 'dataset', title: '3. Historical Dataset' },
    { id: 'engines', title: '4. OCR Engine Architectures' },
    { id: 'methodology', title: '5. Methodology Pipeline' },
    { id: 'ground_truth', title: '6. Ground Truth Annotation' },
    { id: 'metrics', title: '7. Evaluation Metrics' },
    { id: 'experimental', title: '8. Experimental Setup' },
    { id: 'results', title: '9. Empirical Findings' },
    { id: 'discussion', title: '10. Discussion & Error Analysis' },
    { id: 'limitations', title: '11. Limitations' },
    { id: 'conclusion', title: '12. Conclusion & Future Work' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research Paper & Viva Defense Synthesis"
        desc="A Reproducible Benchmarking Framework for Printed Historical Document OCR Using PaddleOCR and Tesseract with Ground Truth-Based Accuracy Evaluation."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Navigation Outline (3 Cols) */}
        <div className="lg:col-span-3">
          <Card className="sticky top-20 p-3 space-y-1">
            <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Paper Sections
            </div>
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                  activeSection === s.id
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>{s.title}</span>
                {activeSection === s.id && <ChevronRight size={14} />}
              </button>
            ))}
          </Card>
        </div>

        {/* Content Body (9 Cols) */}
        <div className="lg:col-span-9 space-y-6">
          {/* 1. Problem Statement */}
          {activeSection === 'problem' && (
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <BookOpen size={20} />
                <h2 className="text-xl font-bold">1. Problem Statement</h2>
              </div>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                Historical document archives—ranging from 18th-century broadsheets and 19th-century municipal gazettes to civil registers—contain indispensable cultural and legal heritage. However, automated transcription of historical print faces extreme degradation challenges:
              </p>
              <ul className="list-disc space-y-2 pl-6 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <b>Physical Artifacts & Substrate Aging:</b> Ink bleed-through, paper yellowing, fungal foxing stains, uneven illumination, and irregular ink decay.
                </li>
                <li>
                  <b>Archaic Typography:</b> Antiquated serif typefaces, non-standard historical ligatures (such as long s &apos;ſ&apos;, &apos;œ&apos;, &apos;æ&apos;), and varying lead-type kerning.
                </li>
                <li>
                  <b>Complex Spatial Layouts:</b> Dense multi-column broadsheets, marginalia, nested obituary blocks, and arbitrary horizontal dividing lines that break conventional line segmentation heuristics.
                </li>
                <li>
                  <b>Lack of Standardized Benchmarks:</b> Existing OCR literature frequently relies on synthetic modern datasets or proprietary black-box APIs, creating an acute reproducibility deficit in cultural heritage document processing.
                </li>
              </ul>
            </Card>
          )}

          {/* 2. Research Objective */}
          {activeSection === 'objective' && (
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <Target size={20} />
                <h2 className="text-xl font-bold">2. Research Objective</h2>
              </div>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                This project establishes an open, reproducible, end-to-end benchmarking framework designed to empirically compare state-of-the-art deep learning OCR against industry-standard open-source OCR on historical printed documents:
              </p>
              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <h4 className="font-bold text-slate-900 dark:text-white">Comparative Paradigm</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Rigorous side-by-side evaluation of <b>PaddleOCR</b> (PP-OCRv6 DBNet + SVTR deep neural network) versus <b>Tesseract OCR</b> (v5.5 LSTM recurrent neural network + Leptonica).
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <h4 className="font-bold text-slate-900 dark:text-white">Dual-Metric Evaluation</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Simultaneous evaluation of <b>transcription text fidelity</b> (CER, WER via Levenshtein alignments) and <b>spatial bounding-box detection</b> (Word IoU, Precision, Recall, F1).
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* 3. Dataset */}
          {activeSection === 'dataset' && (
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <FileText size={20} />
                <h2 className="text-xl font-bold">3. Historical Dataset Characteristics</h2>
              </div>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                The corpus incorporates 50 authentic historical French document scans combined with 3 synthetic validation benchmarks specifically crafted for system calibration.
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Count</th>
                      <th className="px-4 py-3">Document Subtypes</th>
                      <th className="px-4 py-3">Ground Truth Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="px-4 py-3 font-semibold">Printed Historical</td>
                      <td className="px-4 py-3 font-mono">48 images</td>
                      <td className="px-4 py-3">Newspapers, Gazetteers, Notarial Obits, Civil Acts</td>
                      <td className="px-4 py-3"><Badge tone="teal">Verified Archive GT</Badge></td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold">Handwritten Manuscripts</td>
                      <td className="px-4 py-3 font-mono">2 images</td>
                      <td className="px-4 py-3">19th-century cursive register entries</td>
                      <td className="px-4 py-3"><Badge tone="amber">Manual Transcription</Badge></td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold">Synthetic Validation</td>
                      <td className="px-4 py-3 font-mono">3 images</td>
                      <td className="px-4 py-3">Simulated aged parchment, French revolutionary decrees</td>
                      <td className="px-4 py-3"><Badge tone="purple">Exhaustive Word BBox GT</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* 4. OCR Engines */}
          {activeSection === 'engines' && (
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <Award size={20} />
                <h2 className="text-xl font-bold">4. OCR Engine Architectures</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/20">
                  <h4 className="text-base font-bold text-teal-900 dark:text-teal-200">PaddleOCR (PP-OCRv6)</h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <li>• <b>Detection:</b> Differentiable Binarization (DBNet) deep convolutional detector.</li>
                    <li>• <b>Recognition:</b> Single Visual Model for Text Recognition (SVTR) with visual self-attention.</li>
                    <li>• <b>Advantage:</b> Exceptionally robust against bleed-through noise, warped contours, and non-rectangular text blocks.</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                  <h4 className="text-base font-bold text-amber-900 dark:text-amber-200">Tesseract OCR (v5.5.3)</h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <li>• <b>Binarization/Segmentation:</b> Classical morphological transforms via Leptonica.</li>
                    <li>• <b>Recognition:</b> Line-level bidirectional LSTM recurrent neural network.</li>
                    <li>• <b>Advantage:</b> Native word-level segmentation bounding box extraction and near-zero latency on clean print.</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* 7. Evaluation Metrics */}
          {activeSection === 'metrics' && (
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <Lightbulb size={20} />
                <h2 className="text-xl font-bold">7. Mathematical Evaluation Metrics</h2>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Character Error Rate (CER)</h4>
                  <div className="my-2 rounded bg-white p-3 font-mono text-xs dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    CER = (S_c + D_c + I_c) / N_c
                  </div>
                  <p className="text-xs text-slate-500">
                    Where S_c = character substitutions, D_c = deletions, I_c = insertions, and N_c = total reference ground-truth characters. Computed via Levenshtein dynamic programming alignment.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Word Error Rate (WER)</h4>
                  <div className="my-2 rounded bg-white p-3 font-mono text-xs dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    WER = (S_w + D_w + I_w) / N_w
                  </div>
                  <p className="text-xs text-slate-500">
                    Computed across tokenized whitespace-delimited word sequences.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Word-Level Spatial IoU & F1 Score</h4>
                  <div className="my-2 rounded bg-white p-3 font-mono text-xs dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    IoU(Box_A, Box_B) = Area(Box_A ∩ Box_B) / Area(Box_A ∪ Box_B)
                    <br />
                    Precision = TP / (TP + FP)  |  Recall = TP / (TP + FN)  |  F1 = 2 · (P · R) / (P + R)
                  </div>
                  <p className="text-xs text-slate-500">
                    A predicted word box is counted as True Positive (TP) if IoU ≥ 0.50 against an unmatched ground-truth box. Matches with 0.20 ≤ IoU &lt; 0.50 are classified as Localization Errors.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* 9. Empirical Findings */}
          {activeSection === 'results' && (
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <Award size={20} />
                <h2 className="text-xl font-bold">9. Empirical Findings & Benchmarking Results</h2>
              </div>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                Across both historical printed documents and synthetic validation benchmarks, the experimental results demonstrate clear, statistically defensible conclusions:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <CheckCircle size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <b>PaddleOCR delivers superior character and word accuracy:</b> On printed historical documents, PaddleOCR achieved an average CER of <b>3.79%</b> (strict) and <b>1.11%</b> (normalized), compared to Tesseract&apos;s <b>27.84%</b> (strict) and <b>25.27%</b> (normalized).
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900 dark:bg-amber-950/20">
                  <CheckCircle size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <b>Tesseract offers an order-of-magnitude faster inference:</b> Average runtime for Tesseract was <b>0.67s</b> per document, versus <b>13.25s</b> for PaddleOCR on CPU, making Tesseract 20× faster when batch throughput is prioritized over edge-case accuracy.
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50/60 p-3.5 dark:border-rose-900 dark:bg-rose-950/20">
                  <AlertTriangle size={18} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <b>Catastrophic Segmentation Failures in Tesseract:</b> On non-standard historical layouts (e.g., <code>IMG_008</code>), Tesseract&apos;s Leptonica binarizer produced 0 detected text lines (100% failure on that document), while PaddleOCR&apos;s DBNet detected all text lines with 95.3% confidence.
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 10. Discussion */}
          {activeSection === 'discussion' && (
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <BookOpen size={20} />
                <h2 className="text-xl font-bold">10. Qualitative Discussion & Error Typology</h2>
              </div>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                Analysis of recognition errors revealed three primary sources of divergence between deep learning and classical OCR:
              </p>
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <b>1. Faded Print & Broken Glyphs:</b> Tesseract frequently segments broken characters into punctuation (e.g. &apos;m&apos; → &apos;rn&apos; or &apos;...&apos;), whereas PaddleOCR&apos;s SVTR visual context attention resolves the semantic word token.
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <b>2. Historical Accent Marks & Diacritics:</b> Old French acute and grave accents (&apos;é&apos;, &apos;à&apos;) placed close to capital letters often trigger false deletions in Tesseract, while normalized evaluation narrows this gap significantly.
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <b>3. Word-Level Bounding Box Precision:</b> Because PaddleOCR natively predicts line/polygon contours, splitting them into word boxes is heuristic unless a dedicated word detector is trained. Tesseract natively predicts word boxes, yielding slightly higher spatial IoU on clean lines.
                </div>
              </div>
            </Card>
          )}

          {/* 12. Conclusion & Future Work */}
          {activeSection === 'conclusion' && (
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <GraduationCap size={20} />
                <h2 className="text-xl font-bold">12. Conclusion & Future Research Directions</h2>
              </div>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                This project demonstrates that modern deep-learning OCR architectures (PaddleOCR) offer dramatically higher transcription fidelity and robustness on degraded historical printed archives than legacy LSTM pipelines (Tesseract), albeit with increased computational latency.
              </p>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white pt-2">Recommended Future Work:</h4>
              <ul className="list-disc space-y-1.5 pl-6 text-xs text-slate-600 dark:text-slate-400">
                <li>Fine-tuning SVTR on specialized historical French ligatures (17th & 18th century font foundries).</li>
                <li>Integrating an ensemble voting pipeline combining Tesseract&apos;s fast word bounding boxes with PaddleOCR&apos;s character recognition confidence.</li>
                <li>Active learning integration with the built-in Ground Truth Annotation Studio to incrementally expand verified training datasets.</li>
              </ul>
            </Card>
          )}

          {/* Fallback for other sections */}
          {!['problem', 'objective', 'dataset', 'engines', 'metrics', 'results', 'discussion', 'conclusion'].includes(activeSection) && (
            <Card className="p-6">
              <h2 className="text-xl font-bold capitalize">
                {sections.find(s => s.id === activeSection)?.title}
              </h2>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                Detailed research documentation and empirical observations for this section are available in the full research report under <code>outputs/reports/research_report.md</code>.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
