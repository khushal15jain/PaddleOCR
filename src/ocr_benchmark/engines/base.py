import abc
from pathlib import Path
from typing import Dict, Any


class BaseOCREngine(abc.ABC):
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.engine_name = "Base"

    @abc.abstractmethod
    def process_image(self, image_path: Path) -> Dict[str, Any]:
        """
        Process an image and return structured JSON output.
        Must handle exceptions internally and return a dict with
        status="failed" (plus an "error" message) rather than raising,
        so a single bad image never aborts a batch run.
        """
        raise NotImplementedError
