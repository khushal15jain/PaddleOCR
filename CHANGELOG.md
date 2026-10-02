# Changelog

## 2.0.0 — 2026-09-26

### Fixed
- PaddleOCR engine crashed on 20/50 images with
  `predict() got an unexpected keyword argument 'cls'` (PaddleOCR ≥3.0 API
  change). Switched from `.ocr()` to `.predict()`.
- `run_ocr.py` treated any cached JSON — including ones from failed runs —
  as "already done" and skipped it forever. Now retries anything that
  didn't previously succeed.
- `jiwer.compute_measures`, used implicitly via an outdated API assumption,
  does not exist in jiwer 4.x. Metrics now call `jiwer.cer()` / `jiwer.wer()`
  directly.
- `configs/benchmark.yaml` and `configs/config.yaml` were both referenced by
  different scripts; neither script agreed with the other on which one to
  read, and only one of the two ever existed on disk. Unified to
  `configs/config.yaml`.
- Duplicate `data/images/` and `data/raw/images/` folders (identical
  content) merged into a single `data/raw/images/`.
- `run_benchmark.py` logged that a failed validation was "critical" but then
  continued anyway and generated a report that claimed the run "ran
  successfully" even with 0 valid ground-truth pairs. It now exits
  non-zero on failed validation unless `--allow-partial` is passed, and the
  report's conclusion is conditional on real data being present.
- `DatasetValidator.validate()`'s matched-pairs count didn't subtract images
  whose ground truth existed but was empty; it now only counts pairs with
  non-empty, readable ground truth, and also flags duplicate image stems.
- Holm-Bonferroni correction in `statistics.py` pooled CER/WER/runtime tests
  into a single correction family; now corrects the accuracy family
  (CER, WER) and runtime family separately.
- `bootstrap_iterations` was declared in config but never used anywhere;
  it now drives a bootstrap 95% CI on each median difference.
- Tesseract/PaddleOCR results that succeeded with zero detected text were
  indistinguishable from genuine failures in the raw JSON. Added an
  `empty_result` boolean field to both engines' output.
- `.gitignore` didn't exclude `.pytest_cache/` or `*.egg-info/`; both were
  present in the archive handed off.
- `requirements.txt` was missing `deep-translator`, which
  `utils/translation.py` imports; `pyproject.toml` already had it correctly.

### Added
- `--allow-partial` flag on `run_benchmark.py`.
- `OCR_BENCHMARK_SKIP_TRANSLATION` env var to skip network calls in
  offline/CI/sandbox environments.
- Bootstrap CI columns in `statistical_tests.csv`.
- 5 hand-verified ground truth transcriptions
  (`IMG_005`, `IMG_008`, `IMG_010`, `IMG_039`, `IMG_040`) so the full
  pipeline could be validated end-to-end for real, rather than left
  theoretical. `IMG_005` uses `[UNCLEAR: ...]` tags for genuinely
  ambiguous handwriting.
- `docs/archive/` holding the two previous, mutually-contradictory audit
  reports, for history.

### Known issues carried forward (not fixed, flagged for the maintainer)
- `data/metadata.csv` `document_type` labels for at least 3 of 7
  spot-checked images (`IMG_008`, `IMG_010`, `IMG_040`) look mislabeled as
  `handwritten` when the source images are printed/typed text. Not
  bulk-corrected here — needs a full manual audit before the
  handwritten-vs-printed comparison (the benchmark's core question) can be
  trusted.
- 45/50 images still need ground-truth transcription via
  `scripts/annotate_ui.py`.
- PaddleOCR's `.predict()` fix could not be executed in the sandbox this
  rebuild happened in (no GPU, no network access to PaddleOCR's model
  servers). Needs a real run to confirm before trusting PaddleOCR numbers.
- Large source images (8–18 MB) will dominate runtime comparisons; consider
  standardizing resolution.

## 1.0.0 (prior state, superseded)
See `docs/archive/AUDIT_REPORT.md` and `docs/archive/FINAL_VALIDATION_REPORT.md`.
