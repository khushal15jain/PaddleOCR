# Project Presentation Slide Deck

**Title**: A Reproducible Benchmarking Framework for Printed and Historical Document OCR  
**Subtitle**: Evaluating PaddleOCR and Tesseract with Ground-Truth-Based Accuracy and Statistical Rigor  
**Author**: Khushal Jain  

---

## Slide 1: Title & Executive Summary
- **Title**: A Reproducible Benchmarking Framework for Printed Historical Document OCR Using PaddleOCR and Tesseract
- **Core Research Question**: How do modern deep learning multilingual OCR models (PaddleOCR v3) compare against traditional open-source engines (Tesseract 5.x) when applied to authentic historical documents across printed typography and cursive handwriting?
- **Key Takeaways**:
  - PaddleOCR achieves superior accuracy on printed historical French documents (Normalized CER **3.9%** vs Tesseract's **28.9%**).
  - General-purpose OCR fails catastrophically on cursive handwriting (CER **67.9% - 80.5%**).
  - Tesseract offers **~20× faster inference on CPU** (~0.58s vs ~12.0s per page).
  - Morphological background normalization completely eliminates Tesseract's illumination binarization failure.

---

## Slide 2: The Problem Space in Historical Document OCR
- **Challenges in Archival Digitization**:
  - Aged, faded ink and physical paper yellowing.
  - Complex historical typography (fraktur, antique French fonts, non-standard ligatures).
  - Variable lighting, scanner gradients, and physical paper warping.
  - Interleaved printed forms with cursive handwritten annotations.
- **Why a Rigorous Benchmark is Needed**:
  - Many existing benchmarks rely on synthetic fonts or small, non-representative samples.
  - Flawed ground truth or uncorrected multiple hypothesis testing often misleads practitioners.

---

## Slide 3: Framework Architecture & Pipeline
- **Input Image** $\to$ **Image Standardization (1600px)** $\to$ **OCR Processing (PaddleOCR & Tesseract)** $\to$ **Text Normalization** $\to$ **Ground-Truth Comparison** $\to$ **Metrics Calculation (CER, WER, IoU)** $\to$ **Wilcoxon Significance Testing** $\to$ **Interactive Research Dashboard**.
- **Dual Modalities**:
  - Strict evaluation: Case, punctuation, and diacritics strictly preserved.
  - Normalized evaluation: Case and punctuation stripped, Unicode accents (`é`, `è`, `ê`, `ç`) preserved.

---

## Slide 4: Dataset Design & Standardization
- **Primary Benchmark Cohort**: Authentic Historical French Documents ($N = 20$).
  - **10 Printed Documents**: 19th/20th-century newspaper death notices, civil status declarations, city directories, and genealogical records.
  - **10 Handwritten Documents**: 18th/19th-century parish registries, Methodist church marriage acts, cursive index cards, and historical ledgers.
- **Normalization Control**:
  - Standardized resolution (max dimension 1600px) eliminates runtime distortions previously caused by 8–18 MB camera scan outliers.
  - 100% verified ground-truth transcriptions (0 missing, 0 empty).

---

## Slide 5: Empirical Results — Printed Documents
- **Comparison on Printed Scans ($N = 10$)**:
  - **PaddleOCR**: Strict CER = 8.0%, **Normalized CER = 3.9%**, Normalized WER = 15.8%.
  - **Tesseract (raw)**: Strict CER = 41.6%, **Normalized CER = 28.9%**, Normalized WER = 50.1%.
  - **Tesseract (preprocessed)**: Strict CER = 39.5%, **Normalized CER = 32.9%**, Normalized WER = 55.3%.
- **Analysis**:
  - PaddleOCR’s DBNet detection network accurately segments low-contrast, aged ink letters where Tesseract’s Otsu binarization breaks text lines into disjointed fragments.
  - Over $7\times$ lower character error rate with PaddleOCR.

---

## Slide 6: Empirical Results — Cursive Handwriting
- **Comparison on Handwritten Scans ($N = 10$)**:
  - **PaddleOCR**: Strict CER = 68.9%, **Normalized CER = 67.9%**, Normalized WER = 100%.
  - **Tesseract (raw)**: Strict CER = 87.3%, **Normalized CER = 80.5%**, Normalized WER = 100%.
  - **Tesseract (preprocessed)**: Strict CER = 95.7%, **Normalized CER = 79.4%**, Normalized WER = 100%.
- **Analysis**:
  - Neither general-purpose OCR model is suitable for 18th/19th-century cursive paleography.
  - Tesseract's `fra` model was trained exclusively on printed text and lacks line-level continuous handwriting decoders.
  - *Recommendation*: Digital humanities archives must employ specialized HTR frameworks (PyLaia, Kraken, or TrOCR) for manuscript collections.

---

## Slide 7: Preprocessing & Illumination Resolution
- **The Uneven Illumination Failure**:
  - Scans with shadow gradients cause raw Tesseract to binarize text into solid black or blank blocks (CER $> 0.85$).
- **The Computer Vision Solution**:
  - Large-kernel morphological background estimation:
    $$I_{\text{norm}} = \frac{I}{\text{MedianBlur}(I, k=51)} \times 255$$
  - Followed by Otsu thresholding.
- **Result**:
  - Drops Tesseract CER on uneven lighting down to **0.3%**, matching PaddleOCR while preserving Tesseract's $15\times$ speed advantage.

---

## Slide 8: Runtime & Computational Trade-Offs
- **CPU Execution Benchmark (Apple Silicon arm64)**:
  - **Tesseract (raw)**: Mean runtime **0.58 s** / page.
  - **Tesseract (preprocessed)**: Mean runtime **0.51 s** / page (slight binarization speedup).
  - **PaddleOCR**: Mean runtime **11.88 s** / page.
- **The Deployment Matrix**:
  - **Throughput Priority**: Large archives with millions of printed pages $\to$ Tesseract (preprocessed).
  - **Accuracy Priority**: High-value archival collections with degraded typography $\to$ PaddleOCR.

---

## Slide 9: Statistical Significance & Hypothesis Testing
- **Non-Parametric Paired Wilcoxon Signed-Rank Tests**:
  - Stratified by document type (`printed` vs `handwritten`) and degradation type.
  - Applied **Holm-Bonferroni step-down correction** within accuracy and runtime families.
  - Computed **bootstrap 95% confidence intervals** on median differences (1,000 resamples).
- **Key Finding**:
  - PaddleOCR’s superiority on printed historical text is statistically significant ($p < 0.05$).
  - Neither engine shows a statistically significant advantage on cursive handwriting ($p > 0.10$).

---

## Slide 10: System Architecture & Reproducibility
- **End-to-End Scientific Rigor**:
  - Config-driven pipeline (`configs/config.yaml`).
  - Unit & pipeline test suite (`pytest tests/ -v`, 21 passing tests).
  - GitHub Actions CI workflow (`.github/workflows/tests.yml`).
  - Full interactive research dashboard (FastAPI backend + React frontend).
- **Public Git Repository**: [github.com/khushal15jain/PaddleOCR](https://github.com/khushal15jain/PaddleOCR)
  - Results tracked in [`results/`](results/) folder.
  - Complete research report in [`results/RESEARCH_REPORT.md`](results/RESEARCH_REPORT.md).
