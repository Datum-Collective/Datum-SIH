from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from src.inference.tiling import SceneTiler, Tile, stitch_predictions
from src.osiris_detector import OSIRISDetector


@dataclass
class ScenePrediction:
    """
    Complete prediction for one source scene.
    """

    probability: np.ndarray
    tiles: list[Tile]


class SceneInference:
    """
    Run OSIRIS across a complete native-resolution scene.

    The scene is tiled into overlapping 256x256 windows, processed in
    GPU batches, then stitched back into the original scene dimensions.
    """

    def __init__(
        self,
        detector: OSIRISDetector,
        tile_size: int = 256,
        overlap: int = 64,
        batch_size: int = 16,
    ):
        if batch_size <= 0:
            raise ValueError("batch_size must be positive.")

        self.detector = detector
        self.tiler = SceneTiler(
            tile_size=tile_size,
            overlap=overlap,
        )
        self.batch_size = batch_size

    def predict(
        self,
        scene: np.ndarray,
    ) -> ScenePrediction:
        """
        Run OSIRIS over a complete scene.

        Parameters
        ----------
        scene:
            Native-resolution HxW or HxWxC NumPy array.

        Returns
        -------
        ScenePrediction
            Full-resolution probability map plus tile metadata.
        """
        if scene.ndim not in (2, 3):
            raise ValueError(
                "Scene must have shape HxW or HxWxC. "
                f"Received {scene.shape}."
            )

        scene_height, scene_width = scene.shape[:2]

        tiles = list(self.tiler.iter_tiles(scene))

        predictions: list[np.ndarray] = []

        for start in range(0, len(tiles), self.batch_size):
            batch_tiles = tiles[
                start : start + self.batch_size
            ]

            batch = np.stack(
                [tile.image for tile in batch_tiles],
                axis=0,
            )

            batch_predictions = self.detector.predict_batch(batch)

            predictions.extend(batch_predictions)

        probability = stitch_predictions(
            predictions=predictions,
            tiles=tiles,
            scene_shape=(scene_height, scene_width),
        )

        return ScenePrediction(
            probability=probability,
            tiles=tiles,
        )
