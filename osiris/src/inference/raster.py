from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.coords import BoundingBox
from rasterio.transform import Affine


@dataclass
class RasterScene:
    """
    Native-resolution raster scene with its geospatial reference.
    """

    data: np.ndarray
    transform: Affine
    crs: CRS | None
    bounds: BoundingBox
    path: Path

    @property
    def height(self) -> int:
        return self.data.shape[0]

    @property
    def width(self) -> int:
        return self.data.shape[1]

    @property
    def resolution(self) -> tuple[float, float]:
        """
        Pixel resolution in source CRS units.
        """
        return (
            abs(self.transform.a),
            abs(self.transform.e),
        )


def load_raster(
    path: str | Path,
) -> RasterScene:
    """
    Load a raster while preserving its geospatial metadata.

    Returns
    -------
    RasterScene
        Data is returned as HxW for single-band rasters or HxWxC
        for multi-band rasters.
    """
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Raster not found: {path}")

    with rasterio.open(path) as src:
        data = src.read()
        transform = src.transform
        crs = src.crs
        bounds = src.bounds

    # Rasterio returns C x H x W.
    # The ML pipeline expects H x W x C.
    if data.shape[0] == 1:
        data = data[0]
    else:
        data = np.moveaxis(data, 0, -1)

    return RasterScene(
        data=data,
        transform=transform,
        crs=crs,
        bounds=bounds,
        path=path,
    )


def pixel_to_world(
    scene: RasterScene,
    x: float,
    y: float,
) -> tuple[float, float]:
    """
    Convert raster pixel coordinates to source CRS coordinates.

    x = column
    y = row
    """
    world_x, world_y = scene.transform * (x, y)

    return float(world_x), float(world_y)


def pixels_to_world(
    scene: RasterScene,
    x: np.ndarray,
    y: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Vectorized pixel-to-world conversion.
    """
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)

    world_x, world_y = scene.transform * (x, y)

    return world_x, world_y
