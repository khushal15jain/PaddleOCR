# Historical Document OCR Benchmark: PaddleOCR vs. Tesseract

> **A Reproducible Benchmarking Framework for Printed and Handwritten Historical Document OCR with Ground-Truth-Based Accuracy Evaluation**

[![Tests](https://github.com/khushal15jain/PaddleOCR/actions/workflows/tests.yml/badge.svg)](https://github.com/khushal15jain/PaddleOCR/actions)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Research Aim & Overview

This benchmark investigates the comparative performance of modern deep learning OCR (**PaddleOCR v3** with PP-OCRv6) and classical OCR (**Tesseract 5.x** with LSTM engines) on authentic historical French documents (spanning 1789–1950s), evaluating both engines across two central modalities:
1. **Printed Typography**: Historical newspaper death notices, civil status declarations, city directories, and genealogical records.
2. **Cursive Handwriting**: Parish registers, baptismal records, handwritten index cards, and historical cursive manuscripts.

Performance is scored against **100% human-verified ground truth** using Character Error Rate (CER), Word Error Rate (WER), Word-level IoU, Bounding-Box Precision/Recall/F1, inference runtime, and non-parametric paired Wilcoxon signed-rank significance testing with Holm-Bonferroni correction.

---

## 2. Benchmark Results Summary

All metrics are evaluated on the standardized historical benchmark cohort ($N = 20$ documents: 10 printed, 10 handwritten; normalized to 1600px max dimension; Apple Silicon CPU):

### Empirical Accuracy & Performance by Document Modality

| Document Modality | Engine | Strict CER (Median) | Strict WER (Median) | Normalized CER (Median) | Normalized WER (Median) | Avg Runtime (CPU) | Mean Confidence |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Printed Documents** | **PaddleOCR** | **0.0802** (8.0%) | **0.7084** (70.8%) | **0.0388** (3.9%) | **0.1581** (15.8%) | 11.88 s | **0.9655** |
| *(N = 10 documents)* | **Tesseract (raw)** | 0.4157 (41.6%) | 0.9466 (94.7%) | 0.2886 (28.9%) | 0.5009 (50.1%) | 0.58 s | 0.7071 |
| | **Tesseract (preprocessed)** | 0.3949 (39.5%) | 0.9175 (91.8%) | 0.3294 (32.9%) | 0.5534 (55.3%) | **0.51 s** | 0.7104 |
| **Handwritten Documents** | **PaddleOCR** | **0.6892** (68.9%) | 1.0294 (100+%) | **0.6793** (67.9%) | 1.0000 (100%) | 12.51 s | **0.8563** |
| *(N = 10 documents)* | **Tesseract (raw)** | 0.8734 (87.3%) | **1.0000** (100%) | 0.8045 (80.5%) | 1.0000 (100%) | 0.65 s | 0.3951 |
| | **Tesseract (preprocessed)** | 0.9574 (95.7%) | **1.0000** (100%) | 0.7940 (79.4%) | 1.0000 (100%) | **0.59 s** | 0.3164 |

Full per-document records and statistical hypothesis outputs are committed directly in the [`results/`](results/) folder:
- [`results/summary.csv`](results/summary.csv): Full aggregated statistics stratified by modality and degradation.
- [`results/per_document_results.csv`](results/per_document_results.csv): Individual document error metrics.
- [`results/statistical_tests.csv`](results/statistical_tests.csv): Wilcoxon test statistics, p-values, rank-biserial effect sizes, and bootstrap 95% CIs.
- [`results/figures/`](results/figures/): High-resolution boxplots and performance distribution figures.

---

## 3. Key Findings & Scientific Conclusions

1. **Printed Historical Text Supremacy**:
   - On printed historical French scans, **PaddleOCR drastically outperforms Tesseract**, achieving a median Normalized CER of **3.9%** compared to Tesseract's **28.9%** ($>7\times$ error reduction).
   - PaddleOCR’s DBNet detection network accurately segments low-contrast, aged ink letters where Tesseract’s Otsu binarization breaks text lines into disjointed fragments.

2. **The Handwriting Recognition Bottleneck**:
   - Both general-purpose OCR engines collapse on 18th/19th-century cursive handwriting (PaddleOCR median Normalized CER: **67.9%**; Tesseract: **80.5%**).
   - *Conclusion*: Off-the-shelf printed OCR models cannot substitute for specialized Handwritten Text Recognition (HTR) architectures (such as PyLaia, Kraken, or TrOCR) when processing cursive archival registries.

3. **Runtime vs. Accuracy Trade-Off**:
   - On standard CPU architectures, Tesseract completes inference in **~0.58s** per document, whereas PaddleOCR requires **~12.0s** per document (**PaddleOCR is ~20× slower on CPU**).
   - *Operational Recommendation*: For large-scale archival digitization projects with budget constraints, Tesseract offers superior throughput for high-quality printed scans, whereas PaddleOCR is essential when accuracy on degraded typography is paramount.

4. **Image Normalization Control**:
   - Normalizing all benchmark scans to a standard 1600px maximum dimension eliminated timing distortions previously caused by 8–18 MB camera scan outliers.

---

## 4. Benchmark Datasets

The framework is config-driven and supports multi-dataset execution:

| Dataset | Modalities / Language | Documents | Ground Truth | Role in Study |
| :--- | :---: | :---: | :---: | :--- |
| **`historical_fr`** *(default)* | Printed & Handwritten (`fr`) | 20 scans (standardized 1600px) | **100% verified** | Primary academic study: authentic French archival records comparing printed vs. cursive handwriting. |
| **`synthetic_en`** | Printed Historical (`en`) | 103 images (1800×2400) | **100% verified** | Auxiliary controlled study: 7 document genres across 7 calibrated visual degradation models. |
| **`synthetic_hard`** | Stress Test (`en`) | 15 images (1200×1600) | **100% verified** | Stress testing: cylindrical book warp, heavy rotation, multi-column layouts, and script typography. |

*Note*: The full set of 50 original, uncurated French scans is preserved in `data/raw/historical_fr/original_scans/` for archival reference.

---

## 5. Methodology & Evaluation Metrics

### Accuracy Evaluation
- **Character Error Rate (CER)**: Levenshtein edit distance at character level:
  $$\text{CER} = \frac{S + D + I}{N}$$
  where $S$ is substitutions, $D$ is deletions, $I$ is insertions, and $N$ is ground-truth character count.
- **Word Error Rate (WER)**: Levenshtein edit distance at whitespace-tokenized word level.
- **Strict vs. Normalized Modes**:
  - `strict`: Case-sensitive, exact accent and punctuation evaluation.
  - `normalized`: Lowercased, whitespace-collapsed, punctuation-stripped evaluation while preserving Unicode diacritics (`é`, `è`, `ê`, `ç`).

### Statistical Significance Testing
- Non-parametric **paired Wilcoxon signed-rank tests** stratified by document type (`printed` vs. `handwritten`) and degradation type.
- **Holm-Bonferroni step-down correction** applied family-wise across accuracy and runtime comparisons.
- **Bootstrap 95% Confidence Intervals** computed on the median differences (1,000 iterations).

---

## 6. Installation & Quickstart

```bash
# 1. Clone repository
git clone https://github.com/khushal15jain/PaddleOCR.git
cd PaddleOCR

# 2. Set up virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

### PaddleOCR Weights
PaddleOCR models download automatically on first run. If you prefer a custom cache location:
```bash
export PADDLE_PDX_CACHE_HOME="/custom/path/to/paddlex"
```

### Running the Benchmark
```bash
# Run historical French benchmark (default):
python run_benchmark.py

# Run synthetic English benchmark:
python run_benchmark.py --dataset synthetic_en

# Run OCR with multi-threading:
python scripts/run_ocr.py --workers 4
```

---

## 7. Interactive Research Dashboard

The repository includes a modern web interface for research presentations and oral defense:

```bash
# Launch FastAPI backend (port 8000)
uvicorn backend.main:app --port 8000

# Launch React frontend (port 5173)
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to explore:
- **Research Dashboard**: Live metrics, CER/WER distribution charts, runtime graphs.
- **Side-by-Side Comparison**: True Positive / False Positive / False Negative bounding box overlays.
- **Interactive Annotation Tool**: Word-level bounding box editor and ground truth export.

---

## 8. Repository Layout

```
configs/
  config.yaml                 Master configuration for datasets, engines, and thresholds
data/
  raw/
    historical_fr/            Historical French benchmark (20 standardized scans + GT)
      images/                 Curated benchmark images (10 printed, 10 handwritten)
      ground_truth/           Verified ground-truth transcriptions (.txt)
      metadata.csv            Audited modality labels (printed vs. handwritten)
      original_scans/         Original full-resolution camera scans (50 images)
    images/                   100 synthetic English document scans
    synthetic_hard/           15 high-difficulty test images
results/                      Tracked benchmark artifacts and figures
  summary.csv                 Aggregated performance metrics
  per_document_results.csv    Document-level scores
  statistical_tests.csv       Wilcoxon significance test results
  figures/                    Publication-quality plots (.png and .pdf)
docs/
  RESEARCH_REPORT.md          Full unabridged research report
  VIVA_PREPARATION.md         Comprehensive oral exam & viva defense guide
  PRESENTATION_SLIDES.md      Structured slide deck for research review
src/ocr_benchmark/
  engines/                    PaddleOCR and Tesseract runners (with OpenCV preprocess)
  evaluation/                 CER, WER, Bounding-Box IoU, and Wilcoxon statistics
  dataset/                    Validator and synthetic generator
tests/                        Automated pytest suite (21 unit and integration tests)
```

---

## 9. Academic Defense Resources

- **Viva Preparation Guide**: [`docs/VIVA_PREPARATION.md`](docs/VIVA_PREPARATION.md) — Detailed answers to critical viva questions (CER vs. WER, Wilcoxon vs. t-test, empty output handling, handwriting model limits, ground-truth verification).
- **Presentation Slide Deck**: [`docs/PRESENTATION_SLIDES.md`](docs/PRESENTATION_SLIDES.md) — Slide outline for project presentation.
- **Full Research Report**: [`results/RESEARCH_REPORT.md`](results/RESEARCH_REPORT.md) — Complete experimental write-up.

---

## 10. Verification & CI

Run the automated test suite:
```bash
pytest tests/ -v
```
All 21 tests pass, verifying metric mathematics, statistical calculations, normalization behaviors, and end-to-end evaluation.
