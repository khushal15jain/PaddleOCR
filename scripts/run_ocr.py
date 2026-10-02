import json
import logging
from pathlib import Path

import yaml
from tqdm import tqdm

from src.ocr_benchmark.engines.paddleocr_engine import PaddleRunner
from src.ocr_benchmark.engines.tesseract_engine import TesseractRunner

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

VALID_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}


def _is_cached_success(json_path: Path) -> bool:
    """A cached result only counts as done if it previously succeeded.
    Previously-failed images are retried on every run, since a code fix
    (e.g. the PaddleOCR API change) should not require the user to know to
    delete stale failure JSONs by hand."""
    if not json_path.exists():
        return False
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f).get("status") == "success"
    except Exception:
        return False


def run_ocr(config):
    image_dir = Path(config["dataset"]["image_dir"])

    out_dir = Path(config.get("output_dir", "outputs"))
    paddle_out = out_dir / "paddleocr"
    tesseract_out = out_dir / "tesseract"
    paddle_out.mkdir(parents=True, exist_ok=True)
    tesseract_out.mkdir(parents=True, exist_ok=True)

    image_files = sorted(
        f for f in image_dir.iterdir() if f.is_file() and f.suffix.lower() in VALID_EXTENSIONS
    )

    if not image_files:
        logging.error("No images found to process.")
        return

    engines = []
    engine_names = config.get("engines", [])
    if "paddleocr" in engine_names:
        engines.append(PaddleRunner(config))
    if "tesseract" in engine_names:
        engines.append(TesseractRunner(config))

    repeats = config.get("runtime", {}).get("repeats", 1)

    for engine in engines:
        logging.info(f"Starting {engine.engine_name} processing...")
        output_dir = paddle_out if engine.engine_name == "PaddleOCR" else tesseract_out

        n_retried = 0
        for img_path in tqdm(image_files, desc=f"{engine.engine_name}"):
            json_path = output_dir / f"{img_path.stem}.json"

            if _is_cached_success(json_path):
                continue
            if json_path.exists():
                n_retried += 1

            best_result = None
            min_runtime = float("inf")

            for _ in range(repeats):
                result = engine.process_image(img_path)
                if result["status"] == "failed":
                    best_result = result
                    break
                if result["runtime_seconds"] < min_runtime:
                    min_runtime = result["runtime_seconds"]
                    best_result = result

            if best_result:
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(best_result, f, indent=4, ensure_ascii=False)

        if n_retried:
            logging.info(f"{engine.engine_name}: retried {n_retried} previously-failed image(s).")


if __name__ == "__main__":
    with open("configs/config.yaml", "r") as f:
        run_ocr(yaml.safe_load(f))
