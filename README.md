# Historical French OCR Benchmark

A reproducible benchmark comparing **PaddleOCR** and **Tesseract** on 50 scanned
historical documents (25 printed, 25 handwritten — see caveat below), scoring
both engines against human-verified ground truth with Character Error Rate
(CER), Word Error Rate (WER), runtime, and paired significance tests.

## Status (v2.0.0)

This is a rebuild of a pipeline that had never produced a real result: all 50
ground-truth files were empty, so every prior run silently produced `NaN`
metrics while a stale report claimed success. What changed:

- **PaddleOCR's `.ocr(cls=...)` crash is fixed.** PaddleOCR ≥3.0 rebuilt its
  API on PaddleX; the old `.ocr()` call became a broken compatibility shim.
  The engine now calls `.predict()` directly (see `paddleocr_engine.py`).
- **`run_ocr.py` now retries previously-failed images** instead of treating
  any existing JSON (success or crash) as "done".
- **`jiwer.compute_measures` (removed in jiwer 4.x) is gone**; metrics use
  `jiwer.cer()` / `jiwer.wer()` directly.
- **The pipeline halts on failed validation by default** (`run_benchmark.py`
  exits non-zero) instead of silently continuing and generating an empty
  report that claims success. Pass `--allow-partial` to override during
  development.
- **The report's conclusion is conditional on real data being present.**
- **Config files were unified** into a single `configs/config.yaml` (the old
  code inconsistently referenced both `configs/benchmark.yaml` and
  `configs/config.yaml`), and the duplicate `data/images/` /
  `data/raw/images/` folders were merged into one (`data/raw/images/`).
- Holm-Bonferroni correction in `statistics.py` is now applied **separately**
  within the accuracy family (CER/WER) and the runtime family, instead of
  pooling unrelated metrics into one correction, and `bootstrap_iterations`
  (previously declared in config but unused) now drives a bootstrap 95% CI
  on the median CER/WER/runtime difference.
- Tesseract/PaddleOCR results that succeed but return no text are now
  flagged with an `empty_result: true` field, separate from `status:
  "failed"` (an exception), so QA review can tell "engine crashed" apart
  from "engine ran cleanly but found nothing" (blank page, unreadable scan).

**5 of 50 images now have real, hand-verified ground truth** (see "Current
data status" below) so the pipeline could be tested end-to-end for real,
rather than fixed and left theoretical.

## Known limitation of this rebuild

I fixed the PaddleOCR API bug by reading the PaddleOCR 3.x source and
changelogs, but **could not execute PaddleOCR in the sandbox this was built
in**: it isn't installed, and even if installed, PaddleOCR downloads its
detection/recognition models from Baidu's servers at first run, which this
sandbox can't reach. The fix is standard and well-documented, but **please
run `python run_benchmark.py` yourself once, on a machine with real network
access, before trusting PaddleOCR's numbers.** Tesseract was fully tested
here on all 50 images.

## Current data status

| | |
|---|---|
| Images | 50/50 present, no duplicates |
| Ground truth | **5/50** hand-transcribed and verified (`IMG_005`, `IMG_008`, `IMG_010`, `IMG_039`, `IMG_040`) |
| Remaining | 45 images need transcription — run `streamlit run scripts/annotate_ui.py` |

`IMG_005` (handwritten) contains `[UNCLEAR: word]` tags for words I genuinely
couldn't read with confidence, per the annotation convention in
`annotate_ui.py`. Don't treat these as resolved — a second pass by someone
who can compare against the original document would help.

### ⚠️ Metadata quality: spot-check found likely mislabeled `document_type` values

While transcribing the 5 sample images I noticed `data/metadata.csv` labels
`IMG_008`, `IMG_010`, and `IMG_040` as `handwritten`, but all three are
clearly **typed/printed** text (a newspaper clipping, a printed obituary, and
a typed genealogy card in the same font as `IMG_039`, which *is* labeled
`printed`). I only closely inspected 7 of the 50 images and found 3
likely mismatches — that's a high enough hit rate that the `document_type`
column should be audited before drawing any handwritten-vs-printed
conclusions from this benchmark, since that comparison is the study's main
point. I didn't bulk-correct the file myself, since I can't verify all 50
labels with confidence — flagging it here so you can.

## Setup

```bash
pip install -r requirements.txt
# or: pip install -e .
```

PaddleOCR models download automatically on first run. If you want a custom cache location for model weights, set the `PADDLE_PDX_CACHE_HOME` environment variable (e.g. `export PADDLE_PDX_CACHE_HOME="/path/to/cache"`).

Tesseract's French language pack is bundled in `tessdata/fra.traineddata`
(the engine points `--tessdata-dir` there directly, so it works even if your
system Tesseract only has `eng`/`osd` installed).

## Usage

```bash
# Full pipeline: validate -> OCR -> evaluate -> stats -> plots -> report
python run_benchmark.py

# Continue even with incomplete ground truth (development only —
# don't trust conclusions drawn from a partial run):
python run_benchmark.py --allow-partial

# Annotate remaining ground truth:
streamlit run scripts/annotate_ui.py
```

Outputs land in `outputs/`:
- `outputs/metrics/dataset_validation.json`, `per_document_results.csv`, `summary.csv`, `statistical_tests.csv`
- `outputs/figures/*.png` / `*.pdf`
- `outputs/reports/research_report.md`
- `outputs/paddleocr/*.json`, `outputs/tesseract/*.json` (raw per-image OCR output)

`outputs/` (like the old repo) is gitignored and regenerated by the
pipeline — the copies currently in this archive are a demo run with
Tesseract only, produced when this project was rebuilt, so you can see the
pipeline actually working before you run it yourself.

## Methodology notes

- **CER/WER**: computed with `jiwer`, in two modes — `strict` (raw
  transcription, case and punctuation preserved) and `normalized`
  (lowercased, punctuation stripped, whitespace collapsed, accents kept).
- **Failure handling**: an engine that crashes is excluded from the mean
  (not scored as 100% error); an engine that runs cleanly but returns no
  text *is* scored as CER=WER=1.0, since that's a real, meaningful result.
- **Statistics**: paired Wilcoxon signed-rank test per (mode, document
  type), rank-biserial effect size, and a bootstrap 95% CI on the median
  difference. Only images where **both** engines succeeded are compared, so
  N can be smaller than the total image count for a given cell — check the
  `N` column, not just significance, before citing a comparison.
- **Runtime caveat**: several source scans are 8–18 MB; large images will
  dominate runtime comparisons regardless of OCR quality. Consider
  resizing to a standard resolution if runtime is a claim you want to make
  confidently.
- **Translation**: `translated_text_en` fields use Google Translate via
  `deep-translator` and are for skimming convenience only, not part of any
  scored metric. Set `OCR_BENCHMARK_SKIP_TRANSLATION=1` to skip this
  (useful offline or in CI — every result still gets the field, just with a
  placeholder value).

## Project layout

```
configs/config.yaml          Single source of truth for all pipeline settings
data/raw/images/              50 source scans
data/ground_truth/*.txt       Human-verified transcriptions (5/50 done)
data/annotations/              Reserved for future word-level annotations
tessdata/fra.traineddata      Bundled Tesseract French model
src/ocr_benchmark/
  engines/                    PaddleOCR + Tesseract wrappers
  evaluation/                 normalization, CER/WER, significance tests
  dataset/validator.py        Dataset integrity checks
  utils/translation.py        Optional FR->EN translation of OCR output
scripts/                      run_ocr, evaluate, generate_plots/report,
                               validate_dataset, prepare_dataset, annotate_ui
run_benchmark.py              Orchestrates the full pipeline
tests/                        pytest unit + smoke tests
docs/archive/                 Superseded audit/validation reports, kept for history
```

## Testing

```bash
pytest tests/ -v
```

All 15 tests pass in this environment (the PaddleOCR-specific import test
skips automatically when `paddleocr` isn't installed, rather than failing).
# PaddleOCR
