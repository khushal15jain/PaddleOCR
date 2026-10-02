import json
import logging
from pathlib import Path

import yaml
from tqdm import tqdm

from src.ocr_benchmark.utils.translation import translate_fr_to_en

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def prepare_ground_truth(config):
    gt_dir = Path(config["dataset"]["ground_truth_dir"])
    json_dir = Path("data/ground_truth_json")
    json_dir.mkdir(parents=True, exist_ok=True)

    if not gt_dir.exists():
        logging.error(f"Ground truth directory not found: {gt_dir}")
        return

    gt_files = [p for p in gt_dir.glob("*.txt") if p.read_text(encoding="utf-8").strip()]
    if not gt_files:
        logging.error("No non-empty ground truth files found.")
        return

    logging.info(f"Converting and translating {len(gt_files)} ground truth files to JSON...")

    for gt_path in tqdm(gt_files):
        try:
            text_fr = gt_path.read_text(encoding="utf-8").strip()
            text_en = translate_fr_to_en(text_fr)

            data = {"image_id": gt_path.stem, "text_fr": text_fr, "translated_text_en": text_en}
            json_path = json_dir / f"{gt_path.stem}.json"
            json_path.write_text(json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            logging.error(f"Failed to process {gt_path.name}: {e}")


if __name__ == "__main__":
    with open("configs/config.yaml", "r") as f:
        prepare_ground_truth(yaml.safe_load(f))
