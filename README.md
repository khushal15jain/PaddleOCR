# Historical Document OCR Benchmark

A reproducible, research-grade benchmarking framework comparing **PaddleOCR** and **Tesseract OCR** (both raw and preprocessed) on historical and historical-style printed documents, evaluating performance against human-verified ground truth using Character Error Rate (CER), Word Error Rate (WER), Word-level IoU, Bounding-Box Precision/Recall/F1, inference runtime, and paired Wilcoxon signed-rank significance testing with Holm-Bonferroni correction.

---

## 1. Datasets Available in Repository

The benchmark architecture is fully config-driven and supports multiple datasets via `--dataset`:

| Dataset Identifier | Language | Images | Ground Truth Status | Description |
| :--- | :---: | :---: | :---: | :--- |
| **`synthetic_en`** *(default)* | English (`en`) | 100 PNGs (1800×2400) + 3 demo | **100% verified** (word-level boxes + full text) | Historical-style documents across 7 genres (letters, newspapers, directories, registers, certificates, notices, obituaries) with calibrated degradations (blur, noise, low contrast, uneven lighting, skew). Includes exact rendered headers and footers. |
| **`historical_fr`** | French (`fr`) | 50 JPG archival scans | **5/50 transcribed** (45 pending) | Authentic scanned French archival documents (1789–1920). Use `--allow-partial` for developmental evaluation or `scripts/annotate_ui.py` for transcription. |
| **`synthetic_hard`** | English (`en`) | 15 PNGs (1200×1600) | **100% verified** | High-difficulty evaluation set featuring severe rotation (±8°), curved cylindrical book binding warp, heavy blur, multi-column narrow text, and script typography to discriminate state-of-the-art models. |

---

## 2. Key Methodological Improvements (v2.1.0)

- **Scoring Discrepancy Resolved**: Synthetic documents render physical headers (`LETTER NO. 001`, `THE COUNTY HERALD — 1912`) and footers (`Document ID: IMG_001`). Previous raw transcriptions omitted these lines, causing an artificial ~0.20 CER inflation despite perfect recognition. Ground-truth text and word bounding boxes have been regenerated to match exact physical layouts.
- **Fair Preprocessing Evaluation**: Under raw Tesseract, all 12 documents with `uneven_illumination` fail binarization (~0.93 CER). An OpenCV-based background estimation normalization (`tesseract.preprocess: background_normalize` with large-kernel blur division and Otsu thresholding) is benchmarked alongside raw Tesseract and reported as a separate engine row (**Tesseract (preprocessed)** vs **Tesseract (raw)**).
- **Dual Statistical Stratification**: Paired Wilcoxon signed-rank tests are stratified by both **document genre** and **degradation type**, with bootstrap 95% confidence intervals on the median difference and Holm-Bonferroni correction applied separately within accuracy and runtime metric families.
- **Runtime Transparency**: On CPU hardware, Tesseract averages **~0.58s** per image whereas PaddleOCR averages **~8.4s** per image (**PaddleOCR is ~15× slower on CPU**). PaddleOCR delivers lower character error on complex prints, while Tesseract provides substantially higher batch throughput.

---

## 3. Installation & Setup

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
# or: pip install -e ".[dev]"
```

### PaddleOCR Weights
PaddleOCR models download automatically on first run. If you want a custom cache location for downloaded weights, set the `PADDLE_PDX_CACHE_HOME` environment variable:
```bash
export PADDLE_PDX_CACHE_HOME="/custom/path/to/paddlex"
```

### Tesseract Language Packs
Tesseract traineddata models are bundled in `tessdata/` (`eng.traineddata`, `fra.traineddata`, `osd.traineddata`). The engine automatically sets `TESSDATA_PREFIX` to the repository's `tessdata/` directory.

---

## 4. Running the Benchmark

```bash
# Run full benchmark on synthetic English dataset (default):
python run_benchmark.py --dataset synthetic_en

# Run benchmark on historical French scans (with partial ground-truth support):
python run_benchmark.py --dataset historical_fr --allow-partial

# Run OCR with multi-threading:
python scripts/run_ocr.py --workers 4

# Annotate remaining French scans:
streamlit run scripts/annotate_ui.py
```

### Generated Outputs
Outputs land in `outputs/`:
- `outputs/metrics/per_document_results.csv`: Per-document metrics across strict and normalized modes.
- `outputs/metrics/summary.csv`: Aggregated means, medians, IQRs, and failure rates stratified by document genre and degradation.
- `outputs/metrics/statistical_tests.csv`: Paired Wilcoxon signed-rank tests with Holm correction and bootstrap 95% CIs.
- `outputs/figures/`: Boxplots comparing CER, WER, and runtime across engines and degradation categories.
- `outputs/reports/research_report.md`: Complete research report summarizing experimental results.

---

## 5. Web Application (Research Laboratory Dashboard)

The repository includes a FastAPI backend and a React/Tailwind frontend for research presentation:

```bash
# Launch FastAPI backend (port 8000)
uvicorn backend.main:app --port 8000

# Launch React frontend (port 5173)
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to explore:
- **Interactive Dashboard**: Summary metrics, CER/WER distribution charts, runtime comparisons.
- **Dataset Explorer**: Search, filter by document type / degradation, and preview images.
- **OCR Comparison View**: Side-by-side bounding box overlay (True Positive, False Positive, False Negative) and aligned word transcriptions.
- **Annotation Tool**: Canvas for drawing, modifying, and saving word-level bounding boxes.
- **Export**: One-click download of benchmark results as CSV, Excel, or JSON.

---

## 6. Repository Layout

```
configs/
  config.yaml               Single source of truth for pipeline settings
data/
  raw/
    images/                 100 synthetic English document scans (1800×2400)
    historical_fr/          50 authentic French archive scans (images + gt + metadata)
    synthetic_hard/         15 severe degradation documents (rotation, warp, script)
  ground_truth/             Ground-truth transcriptions (.txt)
  annotations/              Word-level bounding box annotations (.json)
  documents.csv             Detailed degradation and document metadata
  metadata.csv              Dataset taxonomy and document types
backend/
  main.py                   FastAPI backend server (30 REST endpoints)
  requirements.txt          Backend Python dependencies
frontend/
  src/                      React + Vite UI components and dashboard pages
  package.json              Frontend dependencies
tessdata/                   Bundled Tesseract language models (eng, fra, osd)
src/ocr_benchmark/
  engines/                  PaddleOCR and Tesseract engine runners (with OpenCV preprocess)
  evaluation/               Metrics (CER, WER, IoU), normalization, and Wilcoxon statistics
  dataset/                  Validator and synthetic dataset generators
scripts/                    CLI runners (run_ocr, evaluate, generate_plots, annotate_ui)
run_benchmark.py            Master pipeline orchestrator
tests/                      Comprehensive pytest suite
```

---

## 7. Testing

```bash
pytest tests/ -v
```

All 21 unit and end-to-end tests pass, including:
- Perfect hypothesis accuracy (CER == 0, WER == 0)
- Empty / failed hypothesis handling
- Synthetic header and footer presence verification
- Holm-Bonferroni step-down correction logic
- Bootstrap 95% confidence interval estimation
- End-to-end evaluation pipeline execution on fixture images
