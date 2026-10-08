import time
import os
import logging
from pathlib import Path
from typing import Dict, Any, Optional

import cv2
import numpy as np

from .base import BaseOCREngine
from src.ocr_benchmark.utils.translation import translate_fr_to_en

try:
    import pytesseract
except ImportError:
    pytesseract = None


def preprocess_image(img: np.ndarray, method: str = "none") -> np.ndarray:
    """
    Optional OpenCV preprocessing for illumination and contrast degradation.
    Supported methods:
      - 'none': returns original image untouched
      - 'adaptive_threshold': grayscale + Gaussian adaptive thresholding
      - 'background_normalize': grayscale + large-kernel blur division + Otsu thresholding
    """
    if method == "none" or not method:
        return img

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img

    if method == "background_normalize":
        # Estimate uneven illumination using large median blur
        bg = cv2.medianBlur(gray, 51)
        # Background division to normalize uneven lighting
        diff = 255 - cv2.absdiff(gray, bg)
        norm = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)
        _, thresh = cv2.threshold(norm, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        return thresh
    elif method == "adaptive_threshold":
        return cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
        )
    return img


class TesseractRunner(BaseOCREngine):
    def __init__(
        self,
        config: Dict[str, Any],
        engine_name: Optional[str] = None,
        config_key: str = "tesseract",
    ):
        super().__init__(config)
        self.tess_config = config.get(config_key, {})
        self.preprocess = self.tess_config.get("preprocess", "none")
        default_name = "Tesseract (preprocessed)" if self.preprocess != "none" else "Tesseract"
        self.engine_name = engine_name or self.tess_config.get("engine_name", default_name)

        if pytesseract is None:
            raise ImportError("pytesseract is not installed.")

        ds_lang = config.get("dataset", {}).get("language", "en")
        default_lang = "eng" if ds_lang == "en" else "fra"
        self.lang = self.tess_config.get("language", default_lang)
        self.psm = self.tess_config.get("psm", 3)
        self.oem = self.tess_config.get("oem", 1)
        # tessdata/ lives at the repo root; this file is three levels under src/.
        self.tessdata_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "tessdata")
        )
        self.custom_config = f'--tessdata-dir "{self.tessdata_dir}" --oem {self.oem} --psm {self.psm}'

        try:
            self.version = str(pytesseract.get_tesseract_version())
        except Exception:
            self.version = "unknown"

    def process_image(self, image_path: Path) -> Dict[str, Any]:
        start_time = time.time()
        try:
            img = cv2.imread(str(image_path))
            if img is None:
                raise ValueError(f"Could not read image: {image_path}")

            # Apply illumination preprocessing if configured
            processed_img = preprocess_image(img, self.preprocess)

            data = pytesseract.image_to_data(
                processed_img, lang=self.lang, config=self.custom_config, output_type=pytesseract.Output.DICT
            )
            runtime = time.time() - start_time

            words = []
            full_text = []
            confidences = []

            n_boxes = len(data["level"])
            for i in range(n_boxes):
                text = data["text"][i].strip()
                conf = float(data["conf"][i])

                if conf > -1 and text:
                    x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
                    bbox = [x, y, x + w, y + h]
                    norm_conf = conf / 100.0

                    words.append({"text": text, "confidence": round(norm_conf, 4), "bbox": bbox})
                    full_text.append(text)
                    confidences.append(norm_conf)

            avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
            text_fr = " ".join(full_text)
            text_en = translate_fr_to_en(text_fr)

            return {
                "image_id": image_path.stem,
                "engine": self.engine_name,
                "status": "success",
                "empty_result": len(full_text) == 0,
                "text": text_fr,
                "translated_text_en": text_en,
                "runtime_seconds": round(runtime, 4),
                "word_count": len(words),
                "average_confidence": round(avg_conf, 4),
                "language": self.lang,
                "psm": self.psm,
                "version": self.version,
                "preprocess": self.preprocess,
                "words": words,
            }
        except Exception as e:
            logging.error(f"Tesseract failed for {image_path.name}: {e}")
            return {
                "image_id": image_path.stem,
                "engine": self.engine_name,
                "status": "failed",
                "text": "",
                "runtime_seconds": None,
                "average_confidence": None,
                "error": str(e),
            }
