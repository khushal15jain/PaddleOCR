import time
import os
import logging
from pathlib import Path
from typing import Dict, Any

import cv2

from .base import BaseOCREngine

try:
    import pytesseract
except ImportError:
    pytesseract = None


class TesseractRunner(BaseOCREngine):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.engine_name = "Tesseract"
        self.tess_config = config.get("tesseract", {})

        if pytesseract is None:
            raise ImportError("pytesseract is not installed.")

        self.lang = self.tess_config.get("language", "fra")
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

            data = pytesseract.image_to_data(
                img, lang=self.lang, config=self.custom_config, output_type=pytesseract.Output.DICT
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

            from src.ocr_benchmark.utils.translation import translate_fr_to_en
            text_en = translate_fr_to_en(text_fr)

            return {
                "image_id": image_path.stem,
                "engine": self.engine_name,
                "status": "success",
                # True when Tesseract ran cleanly but found no text at all
                # (blank scan, photo with no text, or a page it couldn't
                # segment). Kept separate from "failed" (an exception) so
                # the two causes aren't conflated in QA review.
                "empty_result": len(full_text) == 0,
                "text": text_fr,
                "translated_text_en": text_en,
                "runtime_seconds": round(runtime, 4),
                "word_count": len(words),
                "average_confidence": round(avg_conf, 4),
                "language": self.lang,
                "psm": self.psm,
                "version": self.version,
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
