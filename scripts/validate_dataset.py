import logging
import sys
from pathlib import Path

import yaml

from src.ocr_benchmark.dataset.validator import DatasetValidator

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

CONFIG_PATH = Path("configs/config.yaml")


def main():
    if not CONFIG_PATH.exists():
        logging.error(f"{CONFIG_PATH} not found.")
        return False
    config = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    return DatasetValidator(config).validate()


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
