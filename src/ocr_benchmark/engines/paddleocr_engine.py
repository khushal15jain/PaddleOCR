import time
import logging
from pathlib import Path
from typing import Dict, Any
from .base import BaseOCREngine

try:
    from paddleocr import PaddleOCR
except ImportError:
    PaddleOCR = None


class PaddleRunner(BaseOCREngine):
    """
    PaddleOCR >=3.0 rebuilt the pipeline on top of PaddleX and the legacy
    `.ocr(img, cls=True)` call became a thin, buggy compatibility shim that
    raises `predict() got an unexpected keyword argument 'cls'` on many
    3.x releases. The fix is to call `.predict()` directly, which is also
    the API PaddleOCR itself recommends going forward. `.predict()` always
    returns the "PaddleX" dict-style result, so only that branch is needed
    below (the old list-of-lines format from PaddleOCR <3.0 is kept for
    anyone who pins an older version).
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.engine_name = "PaddleOCR"
        self.paddle_config = config.get("paddleocr", {})

        if PaddleOCR is None:
            raise ImportError("paddleocr is not installed.")

        self.ocr = PaddleOCR(
            lang=self.paddle_config.get("lang", "fr"),
            use_doc_orientation_classify=self.paddle_config.get("use_doc_orientation_classify", False),
            use_doc_unwarping=self.paddle_config.get("use_doc_unwarping", False),
            use_textline_orientation=self.paddle_config.get("use_textline_orientation", False),
        )

    def process_image(self, image_path: Path) -> Dict[str, Any]:
        start_time = time.time()

        try:
            result = self.ocr.predict(str(image_path))
            runtime = time.time() - start_time

            words = []
            full_text = []
            confidences = []

            if result and isinstance(result, list) and len(result) > 0:
                if isinstance(result[0], dict):
                    # PaddleX / PaddleOCR >=3.0 result format
                    res_dict = result[0]
                    rec_texts = res_dict.get("rec_texts", [])
                    rec_scores = res_dict.get("rec_scores", [])
                    dt_polys = res_dict.get("dt_polys", [])

                    for i in range(len(rec_texts)):
                        txt = rec_texts[i]
                        conf = rec_scores[i]
                        box = dt_polys[i] if i < len(dt_polys) else [[0, 0], [0, 0], [0, 0], [0, 0]]

                        x_coords = [p[0] for p in box]
                        y_coords = [p[1] for p in box]
                        bbox = [int(min(x_coords)), int(min(y_coords)), int(max(x_coords)), int(max(y_coords))]

                        words.append({"text": str(txt), "confidence": float(conf), "bbox": bbox})
                        full_text.append(str(txt))
                        confidences.append(float(conf))
                else:
                    # PaddleOCR <3.0 list-of-lines format
                    for line in result[0]:
                        if not line:
                            continue
                        box = line[0]
                        txt = line[1][0]
                        conf = line[1][1]

                        x_coords = [p[0] for p in box]
                        y_coords = [p[1] for p in box]
                        bbox = [int(min(x_coords)), int(min(y_coords)), int(max(x_coords)), int(max(y_coords))]

                        words.append({"text": str(txt), "confidence": float(conf), "bbox": bbox})
                        full_text.append(str(txt))
                        confidences.append(float(conf))

            avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
            text_fr = " ".join(full_text)

            from src.ocr_benchmark.utils.translation import translate_fr_to_en
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
                "words": words,
            }
        except Exception as e:
            logging.error(f"PaddleOCR failed for {image_path.name}: {e}")
            return {
                "image_id": image_path.stem,
                "engine": self.engine_name,
                "status": "failed",
                "text": "",
                "runtime_seconds": None,
                "average_confidence": None,
                "error": str(e),
            }
