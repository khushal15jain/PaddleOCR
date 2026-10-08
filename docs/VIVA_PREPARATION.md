# Viva Defense & Oral Examination Preparation Guide

> **Project Title**: *A Reproducible Benchmarking Framework for Printed and Handwritten Historical Document OCR Comparing PaddleOCR and Tesseract with Ground-Truth-Based Accuracy Evaluation*  
> **Author**: Khushal Jain  

---

## Question 1: Why CER and WER, and what is the fundamental difference between them?

### The Core Answer
Both Character Error Rate (CER) and Word Error Rate (WER) quantify the edit distance between an OCR hypothesis string ($H$) and the reference ground truth ($R$), but they measure recognition fidelity at different linguistic granularities:

$$\text{CER} = \frac{S_c + D_c + I_c}{N_c}, \quad \text{WER} = \frac{S_w + D_w + I_w}{N_w}$$

- $S$: Substitutions (incorrect characters/words).
- $D$: Deletions (missed characters/words).
- $I$: Insertions (hallucinated or spurious characters/words).
- $N$: Total number of characters/words in the reference ground truth.

### Key Conceptual Differences
1. **Granularity & Tolerance to Minor Errors**:
   - In CER, a single misrecognized character in a 10-letter word (e.g., `"décédé"` $\to$ `"decédé"`) incurs an error of $1/6 \approx 16.7\%$.
   - In WER, that identical single-character error invalidates the entire word, incurring a $1/1 = 100\%$ word error.
2. **Why Both Are Necessary in Historical OCR**:
   - **CER** provides an objective measure of the **acoustic/visual recognition capability** of the model (how well the CNN/ViT reads individual glyphs and ligatures).
   - **WER** reflects the **downstream semantic utility** of the text for digital humanities applications (information retrieval, full-text search, and named-entity recognition). An indexer cannot reliably search for `"Gougeon"` if the OCR produces `"Gongeon"`.
3. **Can CER or WER Exceed 1.0 (100%)?**:
   - Yes! Because insertions ($I$) are unbounded (e.g., if noise causes an engine to hallucinate 50 characters when the ground truth only contains 10), the numerator $S + D + I$ can exceed the denominator $N$.

---

## Question 2: Why use the Wilcoxon signed-rank test instead of a paired Student's t-test?

### The Core Answer
We used the **paired Wilcoxon signed-rank test** because OCR accuracy metrics systematically violate the foundational assumptions of parametric Student's t-tests:

1. **Non-Normality of Error Distributions**:
   - CER and WER distributions on real documents are heavily skewed, non-Gaussian, and bounded on the left at $0.0$.
   - On clean printed documents, errors cluster tightly around $0.0$; on heavily degraded scans or cursive handwriting, errors jump to $0.80 - 1.0$. This produces a bimodal or heavy-tailed distribution where the mean and standard deviation fail as meaningful summary statistics.
2. **Robustness to Extreme Outliers**:
   - A Student's t-test compares sample means ($\bar{X}$), which are acutely sensitive to catastrophic failures (e.g., a single scan where an engine hallucinates a large block of noise).
   - The Wilcoxon signed-rank test evaluates the **median of paired differences** by ranking the absolute differences between pairs:
     $$W = \sum_{i=1}^{N_r} \left[ \text{sgn}(x_{2,i} - x_{1,i}) \cdot R_i \right]$$
3. **Methodological Rigor**:
   - In addition to reporting the Wilcoxon test statistic ($W$) and asymptotic $p$-value, our framework reports:
     - The **Rank-Biserial Correlation ($r_{rb}$)** as a standardized effect size:
       $$r_{rb} = \frac{W_+ - W_-}{W_+ + W_-}$$
     - **Bootstrap 95% Confidence Intervals** on the median difference across 1,000 resamples.
     - **Holm-Bonferroni step-down correction** to control the family-wise error rate (FWER) across multiple testing hypotheses without the excessive conservatism of standard Bonferroni.

---

## Question 3: Why exclude crashed runs but score empty OCR outputs as 100% error?

### The Core Answer
This distinction is fundamental to maintaining **scientific validity** and preventing metric distortion:

1. **Empty Output $\to$ Legitimate Recognition Failure ($\text{CER} = 1.0, \text{WER} = 1.0$)**:
   - When an engine successfully initializes, processes an image, but returns an empty string `""` (common in Tesseract when adaptive binarization erases low-contrast or faded text), this is a **substantive model failure**.
   - If the ground truth has $N$ characters and the hypothesis has 0 characters, the Levenshtein distance requires exactly $N$ deletions:
     $$\text{CER} = \frac{0 + N + 0}{N} = 1.0$$
   - Treating an empty output as missing/null would reward an engine for returning nothing whenever an image is difficult, artificially deflating its error rate!
2. **Crashed Run $\to$ Pipeline Infrastructure Failure (Exclusion with Failure Flag)**:
   - If an engine crashes due to an out-of-memory error, missing system library, or corrupted file descriptor, assigning an arbitrary numerical metric like $1.0$ fabricates data that was never computed by the recognition algorithm.
   - The benchmark records a discrete flag (`status: "failed"`) and computes an explicit **Failure Rate** metric:
     $$\text{Failure Rate} = \frac{N_{\text{failed}}}{N_{\text{total}}}$$
   - This prevents conflating software engineering environment failures with algorithmic OCR accuracy.

---

## Question 4: What are the limits of using Tesseract's `fra` model on historical handwriting?

### The Core Answer
Tesseract's standard `fra.traineddata` model is structurally and statistically incapable of recognizing cursive historical handwriting due to fundamental architecture and training constraints:

1. **Training Distribution Mismatch**:
   - The official `fra` model was trained on millions of synthetic and scanned lines of **printed, typeset modern French typography** (standard fonts, uniform stroke widths, discrete character glyphs).
   - It possesses zero exposure to 18th- and 19th-century French paleography, such as secretary hand (*écriture coulée* or *ronde*), connected cursive ligatures, or irregular baseline slant.
2. **Line and Word Segmentation Breakdown**:
   - Tesseract relies on classical projection profiles and connected component analysis to segment text into discrete words and character boxes.
   - In cursive handwriting, ascenders and descenders intersect across adjacent lines (inter-line stroke collisions), and letters within a word are continuous. Tesseract's segmenter either fails to find text baselines or produces meaningless fragments.
3. **Language Model Bias**:
   - Tesseract’s internal character-level and word-level language model expects modern French vocabulary and grammar. Historical abbreviations, Latin phrases in Catholic parish registers, and archaic French orthography (e.g., `&` for `et`, `f` for long-s `ſ`) are aggressively miscorrected.
4. **Empirical Evidence from Our Study**:
   - On the 10 handwritten documents in our benchmark, Tesseract achieved a median Normalized CER of **80.5%** and a WER of **100%**.

---

## Question 5: How do you know your ground truth is correct?

### The Core Answer
A benchmark is only as trustworthy as its ground truth. We established ground-truth fidelity through a multi-tiered validation protocol:

1. **Human Transcription Protocol**:
   - All 20 historical documents in the primary benchmark cohort were manually transcribed and cross-verified by human reviewers using high-resolution archival scans.
   - Names, dates, locations, and legal formulas from Quebec civil and parish registers were validated against known archival naming conventions.
2. **Header and Footer Synchronization**:
   - In our audit of the synthetic dataset, we discovered and fixed a major scoring bug where previous transcriptions omitted rendered headers (`LETTER NO. 001`) and footers (`Document ID: IMG_001`). Both OCR engines read these lines, artificially inflating CER by ~0.20. In the current release, all headers and footers are 100% synchronized between image and ground truth.
3. **Automated Sanity Testing (`pytest`)**:
   - Unit tests in `tests/test_evaluation_pipeline.py` verify that passing an exact hypothesis string into the evaluation engine yields mathematically exact $\text{CER} = 0.000$ and $\text{WER} = 0.000$.
   - Dataset validators (`src/ocr_benchmark/dataset/validator.py`) enforce that no ground-truth file is empty (0 bytes) and that every image ID has an exact 1:1 matching ground truth text file.
4. **Unicode Normalization Verification**:
   - Both ground truth and hypothesis strings undergo identical Unicode NFKC normalization, whitespace collapsing, and accent preservation (`é`, `è`, `ê`, `ç`, `ô`, `î`), ensuring that differences in character encoding do not penalize the engines.
