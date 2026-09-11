from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import numpy as np


@dataclass(frozen=True)
class Tile:
    """
    A 256x256 image tile and its position in the source scene.
    """

    image: np.ndarray
    x: int
    y: int


class SceneTiler:
    """
    Split a native-resolution scene into overlapping 256x256 tiles.

    Coordinates are expressed in source-image pixel coordinates.

    Parameters
    ----------
    tile_size:
        Model input size. OSIRIS expects 256.
    overlap:
        Number of pixels shared between adjacent tiles.
    """

    def __init__(
        self,
        tile_size: int = 256,
        overlap: int = 64,
    ):
        if tile_size <= 0:
            raise ValueError("tile_size must be positive.")

        if overlap < 0 or overlap >= tile_size:
            raise ValueError(
                "overlap must satisfy 0 <= overlap < tile_size."
            )

        self.tile_size = tile_size
        self.overlap = overlap
        self.stride = tile_size - overlap

    def _positions(
        self,
        length: int,
    ) -> list[int]:
        """
        Return tile start positions covering an entire dimension.

        The final tile is shifted toward the edge so that the scene is
        fully covered without requiring padding.
        """
        if length <= 0:
            raise ValueError("Scene dimensions must be positive.")

        if length <= self.tile_size:
            return [0]

        positions = list(range(0, length - self.tile_size + 1, self.stride))

        final_position = length - self.tile_size

        if positions[-1] != final_position:
            positions.append(final_position)

        return positions

    def iter_tiles(
        self,
        scene: np.ndarray,
    ) -> Iterator[Tile]:
        """
        Yield overlapping tiles covering the complete scene.

        Parameters
        ----------
        scene:
            H x W or H x W x C NumPy array.

        Yields
        ------
        Tile
            Tile image and its source-scene x/y coordinates.
        """
        if scene.ndim not in (2, 3):
            raise ValueError(
                "Scene must have shape HxW or HxWxC. "
                f"Received shape {scene.shape}."
            )

        height, width = scene.shape[:2]

        y_positions = self._positions(height)
        x_positions = self._positions(width)

        for y in y_positions:
            for x in x_positions:
                tile = scene[
                    y : y + self.tile_size,
                    x : x + self.tile_size,
                ]

                actual_height, actual_width = tile.shape[:2]

                if (
                    actual_height != self.tile_size
                    or actual_width != self.tile_size
                ):
                    tile = self._pad_tile(tile)

                yield Tile(
                    image=tile,
                    x=x,
                    y=y,
                )

    def _pad_tile(
        self,
        tile: np.ndarray,
    ) -> np.ndarray:
        """
        Pad a tile that touches a scene smaller than 256x256.

        Reflect padding preserves local image statistics better than
        constant zero padding for SAR imagery.
        """
        height, width = tile.shape[:2]

        pad_bottom = self.tile_size - height
        pad_right = self.tile_size - width

        if tile.ndim == 2:
            pad_width = (
                (0, pad_bottom),
                (0, pad_right),
            )
        else:
            pad_width = (
                (0, pad_bottom),
                (0, pad_right),
                (0, 0),
            )

        return np.pad(
            tile,
            pad_width,
            mode="reflect",
        )


def stitch_predictions(
    predictions: list[np.ndarray],
    tiles: list[Tile],
    scene_shape: tuple[int, int],
) -> np.ndarray:
    """
    Stitch overlapping tile predictions into one scene-sized map.

    Overlapping predictions are averaged.

    Parameters
    ----------
    predictions:
        One HxW probability map per tile.
    tiles:
        Tiles returned by SceneTiler.iter_tiles().
    scene_shape:
        Original scene shape as (height, width).

    Returns
    -------
    np.ndarray
        Scene-sized probability map.
    """
    if len(predictions) != len(tiles):
        raise ValueError(
            "Number of predictions must equal number of tiles."
        )

    height, width = scene_shape

    accumulated = np.zeros(
        (height, width),
        dtype=np.float32,
    )

    weights = np.zeros(
        (height, width),
        dtype=np.float32,
    )

    for prediction, tile in zip(predictions, tiles):
        prediction = np.asarray(prediction)

        if prediction.shape != (
            tile.image.shape[0],
            tile.image.shape[1],
        ):
            raise ValueError(
                "Prediction shape does not match tile shape: "
                f"{prediction.shape} vs {tile.image.shape[:2]}"
            )

        tile_height = min(
            prediction.shape[0],
            height - tile.y,
        )

        tile_width = min(
            prediction.shape[1],
            width - tile.x,
        )

        if tile_height <= 0 or tile_width <= 0:
            continue

        accumulated[
            tile.y : tile.y + tile_height,
            tile.x : tile.x + tile_width,
        ] += prediction[:tile_height, :tile_width]

        weights[
            tile.y : tile.y + tile_height,
            tile.x : tile.x + tile_width,
        ] += 1.0

    output = np.zeros_like(accumulated)

    valid = weights > 0
    output[valid] = accumulated[valid] / weights[valid]

    return output


def stitch_predictions_weighted(
    predictions,
    tiles,
    scene_shape,
    sigma_fraction=0.25,
):
    """
    Stitch tile predictions using a Gaussian center-weighting.

    Pixels near the center of each tile receive higher weight.
    Pixels near tile boundaries receive lower weight.

    This reduces boundary artifacts caused by convolutional
    predictions having less context near tile edges.
    """

    if len(predictions) != len(tiles):
        raise ValueError(
            "Number of predictions must match number of tiles"
        )

    scene_height, scene_width = scene_shape

    probability_sum = np.zeros(
        (scene_height, scene_width),
        dtype=np.float32,
    )

    weight_sum = np.zeros(
        (scene_height, scene_width),
        dtype=np.float32,
    )

    for prediction, tile in zip(
        predictions,
        tiles,
    ):

        tile_height, tile_width = prediction.shape

        y = np.arange(tile_height)
        x = np.arange(tile_width)

        yy, xx = np.meshgrid(
            y,
            x,
            indexing="ij",
        )

        center_y = (tile_height - 1) / 2.0
        center_x = (tile_width - 1) / 2.0

        sigma_y = (
            tile_height
            * sigma_fraction
        )

        sigma_x = (
            tile_width
            * sigma_fraction
        )

        weight_y = np.exp(
            -0.5
            * (
                (yy - center_y)
                / sigma_y
            ) ** 2
        )

        weight_x = np.exp(
            -0.5
            * (
                (xx - center_x)
                / sigma_x
            ) ** 2
        )

        weight = (
            weight_y
            * weight_x
        ).astype(np.float32)

        y0 = tile.y
        x0 = tile.x

        y1 = min(
            y0 + tile_height,
            scene_height,
        )

        x1 = min(
            x0 + tile_width,
            scene_width,
        )

        actual_height = y1 - y0
        actual_width = x1 - x0

        probability_sum[
            y0:y1,
            x0:x1,
        ] += (
            prediction[
                :actual_height,
                :actual_width,
            ]
            * weight[
                :actual_height,
                :actual_width,
            ]
        )

        weight_sum[
            y0:y1,
            x0:x1,
        ] += weight[
            :actual_height,
            :actual_width,
        ]

    return (
        probability_sum
        / np.maximum(
            weight_sum,
            1e-8,
        )
    )
