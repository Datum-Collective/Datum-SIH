from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np
from pyproj import Geod, Transformer
from rasterio.features import shapes
from rasterio.transform import Affine
from shapely.geometry import shape, mapping
from shapely.ops import transform as shapely_transform

from src.inference.raster import RasterScene


@dataclass
class SpillRegion:
    """
    One extracted oil-spill candidate.
    """

    geometry: dict[str, Any]
    area_m2: float
    pixel_count: int
    mean_probability: float
    max_probability: float


class SpillExtractor:
    """
    Convert a scene-level OSIRIS probability map into
    georeferenced spill regions.
    """

    def __init__(
        self,
        threshold: float = 0.5,
        min_region_pixels: int = 32,
        morph_open_ksize: int = 3,
        morph_close_ksize: int = 5,
    ):
        self.threshold = float(threshold)
        self.min_region_pixels = int(min_region_pixels)
        self.morph_open_ksize = int(morph_open_ksize)
        self.morph_close_ksize = int(morph_close_ksize)

        self.geod = Geod(ellps="WGS84")

    def _clean_mask(
        self,
        probability: np.ndarray,
    ) -> np.ndarray:
        """
        Threshold and morphologically clean the probability map.
        """
        mask = (
            probability >= self.threshold
        ).astype(np.uint8)

        if self.morph_open_ksize > 1:
            kernel = np.ones(
                (
                    self.morph_open_ksize,
                    self.morph_open_ksize,
                ),
                dtype=np.uint8,
            )

            mask = cv2.morphologyEx(
                mask,
                cv2.MORPH_OPEN,
                kernel,
            )

        if self.morph_close_ksize > 1:
            kernel = np.ones(
                (
                    self.morph_close_ksize,
                    self.morph_close_ksize,
                ),
                dtype=np.uint8,
            )

            mask = cv2.morphologyEx(
                mask,
                cv2.MORPH_CLOSE,
                kernel,
            )

        return mask

    def _remove_small_regions(
        self,
        mask: np.ndarray,
    ) -> np.ndarray:
        """
        Remove connected components smaller than the configured
        minimum number of pixels.
        """
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
            mask,
            connectivity=8,
        )

        cleaned = np.zeros_like(mask)

        for label in range(1, num_labels):
            pixel_count = stats[label, cv2.CC_STAT_AREA]

            if pixel_count >= self.min_region_pixels:
                cleaned[labels == label] = 1

        return cleaned

    def _polygonize(
        self,
        mask: np.ndarray,
        scene: RasterScene,
    ) -> list[tuple[dict[str, Any], int]]:
        """
        Convert connected mask regions into source-CRS polygons.
        """
        results = []

        for geometry, value in shapes(
            mask.astype(np.uint8),
            mask=mask.astype(bool),
            transform=scene.transform,
        ):
            if value != 1:
                continue

            pixel_count = int(
                np.count_nonzero(
                    mask[
                        self._geometry_window(
                            geometry,
                            scene,
                        )
                    ]
                )
            )

            results.append(
                (
                    geometry,
                    pixel_count,
                )
            )

        return results

    @staticmethod
    def _geometry_window(
        geometry: dict[str, Any],
        scene: RasterScene,
    ):
        """
        Get an approximate raster window for a polygon.

        This helper is only used to estimate pixel count for
        polygonized regions.
        """
        geom = shape(geometry)

        min_x, min_y, max_x, max_y = geom.bounds

        inv = ~scene.transform

        px1, py1 = inv * (min_x, max_y)
        px2, py2 = inv * (max_x, min_y)

        x1 = max(0, int(np.floor(min(px1, px2))))
        x2 = min(scene.width, int(np.ceil(max(px1, px2))))

        y1 = max(0, int(np.floor(min(py1, py2))))
        y2 = min(scene.height, int(np.ceil(max(py1, py2))))

        return (
            slice(y1, y2),
            slice(x1, x2),
        )

    def _to_wgs84(
        self,
        geometry,
        scene: RasterScene,
    ):
        """
        Convert a source-CRS geometry to WGS84.
        """
        if scene.crs is None:
            raise ValueError(
                "Cannot convert spill geometry to WGS84: "
                "raster has no CRS."
            )

        source_crs = scene.crs

        if source_crs.to_epsg() == 4326:
            return geometry

        transformer = Transformer.from_crs(
            source_crs,
            "EPSG:4326",
            always_xy=True,
        )

        return shapely_transform(
            transformer.transform,
            geometry,
        )

    def _geodesic_area(
        self,
        geometry,
    ) -> float:
        """
        Calculate polygon area on the WGS84 ellipsoid in m².
        """
        area, _ = self.geod.geometry_area_perimeter(
            geometry,
        )

        return abs(float(area))

    def extract(
        self,
        probability: np.ndarray,
        scene: RasterScene,
    ) -> list[SpillRegion]:
        """
        Extract georeferenced spill regions from a probability map.
        """
        probability = np.asarray(
            probability,
            dtype=np.float32,
        )

        if probability.ndim != 2:
            raise ValueError(
                "Probability map must be HxW."
            )

        if probability.shape != (
            scene.height,
            scene.width,
        ):
            raise ValueError(
                "Probability map shape does not match "
                "the raster scene."
            )

        if not np.isfinite(probability).all():
            probability = np.nan_to_num(
                probability,
                nan=0.0,
                posinf=1.0,
                neginf=0.0,
            )

        mask = self._clean_mask(probability)
        mask = self._remove_small_regions(mask)

        regions: list[SpillRegion] = []

        for geometry_dict, _ in self._polygonize(
            mask,
            scene,
        ):
            source_geometry = shape(
                geometry_dict,
            )

            wgs84_geometry = self._to_wgs84(
                source_geometry,
                scene,
            )

            area_m2 = self._geodesic_area(
                wgs84_geometry,
            )

            # Rasterize the polygon bounds to identify the
            # corresponding probability pixels accurately.
            min_x, min_y, max_x, max_y = source_geometry.bounds

            inv = ~scene.transform

            px1, py1 = inv * (min_x, max_y)
            px2, py2 = inv * (max_x, min_y)

            x1 = max(0, int(np.floor(min(px1, px2))))
            x2 = min(scene.width, int(np.ceil(max(px1, px2))))

            y1 = max(0, int(np.floor(min(py1, py2))))
            y2 = min(scene.height, int(np.ceil(max(py1, py2))))

            region_probability = probability[
                y1:y2,
                x1:x2,
            ]

            region_mask = np.zeros(
                region_probability.shape,
                dtype=np.uint8,
            )

            local_geometry = source_geometry

            from rasterio.features import rasterize

            region_mask = rasterize(
                [(mapping(local_geometry), 1)],
                out_shape=region_probability.shape,
                transform=scene.transform
                * Affine.translation(x1, y1),
                fill=0,
                dtype=np.uint8,
            )

            values = region_probability[
                region_mask == 1
            ]

            if values.size == 0:
                continue

            regions.append(
                SpillRegion(
                    geometry=mapping(wgs84_geometry),
                    area_m2=area_m2,
                    pixel_count=int(values.size),
                    mean_probability=float(values.mean()),
                    max_probability=float(values.max()),
                )
            )

        return regions
