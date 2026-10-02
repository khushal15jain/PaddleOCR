# OCR Benchmark Audit Report

## 1. Missing Ground Truth Data
- **Problem**: All 50 `.txt` files in `data/ground_truth/` are completely empty (0 bytes). 
- **Severity**: **CRITICAL**
- **Affected File(s)**: `data/ground_truth/*.txt`, `scripts/validate_dataset.py`
- **Explanation**: The dataset validator only checks if the files *exist*, not if they contain valid transcriptions. Because the files are empty, there is no real reference text to compare against.
- **Recommended Fix**: Update dataset validation to strictly fail if ground truth files are empty or unreadable. 
- **Affects Scientific Validity?**: Yes. The benchmark is completely invalid without human-verified ground truth.

## 2. Invalid CER/WER Metrics (The "1.0 Bug")
- **Problem**: `metrics.py` incorrectly hardcodes CER and WER to `1.0` if the reference string is empty.
- **Severity**: **CRITICAL**
- **Affected File(s)**: `src/evaluation/metrics.py`
- **Explanation**: Combined with the empty ground truth files, this bug causes every evaluation to silently return a fake CER/WER of `1.0`. The script treats the missing reference as a 100% error rather than raising an exception.
- **Recommended Fix**: `metrics.py` must raise an error or mark the sample as invalid if the ground truth is empty, rather than assigning an arbitrary metric.
- **Affects Scientific Validity?**: Yes. It fabricated performance numbers for invalid data.

## 3. Missing PaddleOCR Results
- **Problem**: There are no PaddleOCR outputs, and the pipeline only ran Tesseract.
- **Severity**: HIGH
- **Affected File(s)**: `configs/config.yaml`, `scripts/run_ocr.py`
- **Explanation**: In `configs/config.yaml`, PaddleOCR is explicitly disabled (`paddleocr: false`). Consequently, the evaluation scripts were comparing Tesseract to nothing (or to NaN values).
- **Recommended Fix**: Enable PaddleOCR in the configuration and implement better pipeline logging to report skipped engines.
- **Affects Scientific Validity?**: Yes. The comparative aspect of the study was entirely missing from the outputs.

## 4. Tesseract JSON Output Schema Incomplete
- **Problem**: Tesseract runner does not record critical experimental configuration (PSM, language, version) in its output JSON.
- **Severity**: MEDIUM
- **Affected File(s)**: `src/ocr/tesseract_runner.py`
- **Explanation**: The required properties like `psm`, `language`, and `version` are missing from the JSON schema, making the results less traceable.
- **Recommended Fix**: Update the runner to record all experimental parameters in the output payload as requested.
- **Affects Scientific Validity?**: Yes. Poor reproducibility.

## 5. Statistical Testing Flaws
- **Problem**: `statistics.py` only runs a basic Wilcoxon test on available data, using `dropna`, and does not report effect size or handle multiple comparisons.
- **Severity**: HIGH
- **Affected File(s)**: `src/evaluation/statistics.py`
- **Explanation**: Silently dropping NaNs means the test is performed on a subset of the data (only where both succeeded), which biases the comparison. There is no correction for multiple hypothesis testing, and p-values alone are insufficient.
- **Recommended Fix**: Calculate effect sizes (e.g., rank-biserial correlation), add median differences, compute bootstrap confidence intervals, and apply Holm-Bonferroni corrections.
- **Affects Scientific Validity?**: Yes. Uncorrected p-values and lack of effect size can lead to misleading conclusions.

## 6. Project Structure and Missing Files
- **Problem**: The project structure deviates from the requested layout, and files like `pyproject.toml`, `CITATION.cff`, and `benchmark.yaml` are missing.
- **Severity**: MEDIUM
- **Affected File(s)**: Entire project root.
- **Explanation**: The codebase lacks standard research software engineering boilerplate.
- **Recommended Fix**: Restructure the project to match `src/ocr_benchmark/...`, generate the missing files, and consolidate the evaluation scripts into the package.
- **Affects Scientific Validity?**: No, but it impacts reproducibility and audibility.

## 7. No Automated Tests
- **Problem**: The `tests/` directory is effectively empty, and core metrics/normalization logic are untested.
- **Severity**: HIGH
- **Affected File(s)**: `tests/`
- **Explanation**: The absence of unit tests allowed the `1.0` metric bug to go completely unnoticed.
- **Recommended Fix**: Implement comprehensive pytest suites for dataset validation, metric calculation, text normalization, and statistical logic.
- **Affects Scientific Validity?**: Yes. It allowed pipeline bugs to pollute the results.
