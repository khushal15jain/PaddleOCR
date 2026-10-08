# Changelog

## 2.2.0 — 2026-10-08 (Submission Release)

### Added
- **Curated & Standardized Historical French Benchmark ($N=20$)**:
  - Evaluated a balanced cohort of 20 authentic historical French archival scans partitioned into 10 printed and 10 handwritten documents.
  - Normalized scan dimensions to a standard 1600px maximum dimension, resolving runtime measurement distortion from 8–18 MB camera scans.
  - Provided 100% complete, verified ground truth transcriptions for all 20 documents (0 missing, 0 empty).
- **Comprehensive Audit of Metadata Labels**: Audited all 50 archival image labels in `metadata.csv`, correcting printed clippings and death notices that were previously misclassified as handwritten.
- **Committed `results/` Artifact Directory**: Added a permanent, version-controlled `results/` directory containing empirical CSV tables (`summary.csv`, `per_document_results.csv`, `statistical_tests.csv`), high-resolution figures (`results/figures/`), and full research report (`results/RESEARCH_REPORT.md`).
- **Viva Preparation & Defense Material**: Added `docs/VIVA_PREPARATION.md` addressing key viva questions (CER vs WER, Wilcoxon vs t-test, empty output scoring, model limits on handwriting, ground truth verification) and `docs/PRESENTATION_SLIDES.md` for project review presentation.

### Fixed
- **PaddleOCR Execution on French Corpus**: Confirmed end-to-end execution of `PaddleRunner` with French model weights (`lang='fr'`) and verified robust parsing of `rec_texts` and `dt_polys` outputs.
- **Academic README Reorientation**: Removed informal handoff language and restructured the documentation around scientific objectives, experimental methodology, empirical findings, and reproducible execution.
- **Package Metadata**: Renamed project metadata to `historical-french-ocr-benchmark` with updated author and citation details.

---

### Fixed
- **Synthetic Scoring Inflation Fixed (Critical)**: Synthetic images contained printed headers (e.g. `LETTER NO. 001`, `THE COUNTY HERALD — 1912`) and footers (`Document ID: IMG_001`) that were omitted from raw ground-truth `.txt` files. Both OCR engines recognized them cleanly, resulting in ~0.20 CER inflation across the dataset. Regenerated ground-truth text, word-level bounding boxes in `data/ground_truth.csv`, and `data/annotations/*.json` via `synthetic_generator.py` to match exact rendered layouts, resolving the discrepancy.
- **Tesseract Illumination Failure Resolved Fairly**: All 12 `uneven_illumination` documents produced ~0.93 CER under raw Tesseract due to binarization failure. Implemented OpenCV illumination normalization (`tesseract.preprocess: background_normalize` with large-kernel morphology/blur division and Otsu thresholding, plus `adaptive_threshold`). Benchmarked both raw and preprocessed Tesseract configurations with transparent reporting.
- **Audited Mislabeled Metadata**: Corrected `document_type` labels in historical French metadata for `IMG_008`, `IMG_010`, and `IMG_040` from `handwritten` to `printed`.
- **Repo Hygiene & Bloat Cleanup**:
  - Untracked `.paddlex/` model weights (~177 MB), `frontend/node_modules/` (~120 MB), build artifacts (`dist/`), and caches.
  - Renamed `frontend 2` to `frontend` (no spaces).
  - Flattened nested `backend/backend/` into `backend/` and removed committed `backend/dist/`.
  - Removed duplicate scripts `run_paddleocr_fast.py`, `run_paddleocr_all.py`, `batch_paddleocr.py` in favor of a single unified `run_ocr.py` with multi-threading `--workers`.
  - Removed hardcoded `/tmp/mpl` paths in favor of system `tempfile`.
  - Replaced inline translation imports in engines with module-level imports, defaulting `OCR_BENCHMARK_SKIP_TRANSLATION=1` to guarantee offline and CI reproducibility without network stalls.
- **Removed Duplicate Header**: Removed trailing duplicate `# PaddleOCR` heading in `README.md`.

### Added
- **Config-Driven Multi-Dataset Support**:
  - Added `dataset.name` and `dataset.language` (`en` / `fr`) to `configs/config.yaml`.
  - Dynamic derivation of PaddleOCR `lang` (`en` / `fr`) and Tesseract `language` (`eng` / `fra`) based on dataset settings, removing hardcoded language flags.
  - `--dataset` CLI parameter on `run_benchmark.py` supporting `synthetic_en` and `historical_fr`.
  - Moved legacy French scans into `data/raw/historical_fr/images/` and ground truth into `data/raw/historical_fr/ground_truth/`.
- **Degradation-Stratified Statistical Testing**: Stratified paired Wilcoxon signed-rank tests by both `degradation_type` and `document_type`, joining degradation metadata from `documents.csv` into per-document and summary results.
- **`synthetic_hard` Benchmark Generator**: Extended `synthetic_generator.py` with severe rotation, curved book warp, heavy blur, multi-column layout, and script handwriting typography.
- **GitHub Actions CI**: Added `.github/workflows/tests.yml` running `pytest tests/ -v` on push and pull request.
- **Extended Test Suite**: Added tests for evaluate end-to-end pipeline on fixtures, Holm-Bonferroni correction, bootstrap median difference CI, empty hypothesis handling, and header/footer ground truth presence (21 tests total).

---

## 2.0.0 — 2026-09-26

### Fixed
- PaddleOCR engine crashed on 20/50 images with `predict() got an unexpected keyword argument 'cls'`. Switched from `.ocr()` to `.predict()`.
- `run_ocr.py` retries previously-failed images instead of treating failed JSONs as completed.
- `jiwer.compute_measures` updated to direct `jiwer.cer()` / `jiwer.wer()` calls.
- Unified config to `configs/config.yaml`.
- Merged duplicate image directories.
- Pipeline halts on failed validation by default unless `--allow-partial` is passed.
- Holm-Bonferroni correction applied separately within accuracy and runtime families.
- Bootstrap iterations now drives a bootstrap 95% CI on median differences.
- Tesseract/PaddleOCR empty results flagged with `empty_result: true`.

---

## 1.0.0 (prior state, superseded)
See `docs/archive/AUDIT_REPORT.md` and `docs/archive/FINAL_VALIDATION_REPORT.md`.
