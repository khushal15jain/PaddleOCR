import json
import logging
from collections import Counter
from pathlib import Path
from typing import Dict, Any

VALID_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}


class DatasetValidator:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.image_dir = Path(config["dataset"]["image_dir"])
        self.gt_dir = Path(config["dataset"]["ground_truth_dir"])

    def validate(self) -> bool:
        logging.info("Starting dataset validation...")

        if not self.image_dir.exists():
            logging.error(f"Image directory not found: {self.image_dir}")
            return False

        images = [f for f in self.image_dir.iterdir() if f.is_file() and f.suffix.lower() in VALID_IMAGE_EXTS]

        if not self.gt_dir.exists():
            logging.error(f"Ground truth directory not found: {self.gt_dir}")
            return False

        gt_files = [f for f in self.gt_dir.iterdir() if f.is_file() and f.suffix.lower() == ".txt"]

        image_stems = {f.stem: f for f in images}
        gt_stems = {f.stem: f for f in gt_files}

        # Duplicate image stems (e.g. IMG_001.jpg and IMG_001.png both present)
        stem_counts = Counter(f.stem for f in images)
        duplicates = sorted([stem for stem, n in stem_counts.items() if n > 1])

        missing_gt = []
        missing_images = []
        invalid_files = []  # ground truth present but empty/unreadable

        for stem in image_stems:
            if stem not in gt_stems:
                missing_gt.append(stem)
                continue
            gt_path = gt_stems[stem]
            try:
                with open(gt_path, "r", encoding="utf-8") as f:
                    text = f.read().strip()
                if not text:
                    invalid_files.append(f"{stem} (empty ground truth)")
            except Exception as e:
                invalid_files.append(f"{stem} (unreadable ground truth: {e})")

        for stem in gt_stems:
            if stem not in image_stems:
                missing_images.append(stem)

        invalid_stems = {f.split(" ", 1)[0] for f in invalid_files}
        matched = len([s for s in image_stems if s in gt_stems and s not in invalid_stems])

        report = {
            "total_images": len(images),
            "total_ground_truth": len(gt_files),
            "matched_pairs": matched,
            "missing_images": missing_images,
            "missing_ground_truth": missing_gt,
            "duplicates": duplicates,
            "invalid_files": invalid_files,
        }

        metrics_out = Path(self.config.get("output_dir", "outputs")) / "metrics"
        metrics_out.mkdir(parents=True, exist_ok=True)

        with open(metrics_out / "dataset_validation.json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=4)

        if missing_images or missing_gt or invalid_files or duplicates:
            logging.error(
                f"Dataset validation failed. Missing GT: {len(missing_gt)}, "
                f"Missing images: {len(missing_images)}, Invalid GT: {len(invalid_files)}, "
                f"Duplicate stems: {len(duplicates)}. Matched pairs so far: {matched}/{len(images)}."
            )
            return False

        logging.info(f"Dataset validation passed. {matched} matched pairs.")
        return True
