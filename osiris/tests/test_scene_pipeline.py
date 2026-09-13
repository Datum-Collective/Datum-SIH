from pathlib import Path

import numpy as np

from src.inference.raster import load_raster
from src.inference.scene import SceneInference
from src.inference.extraction import SpillExtractor


class FakeDetector:
    """
    Simulates OSIRIS tile inference.

    Every tile receives a synthetic high-probability
    spill in its center.
    """

    def predict_batch(self, batch):
        output = np.zeros(
            (batch.shape[0], 256, 256),
            dtype=np.float32,
        )

        output[
            :,
            80:176,
            80:176,
        ] = 0.9

        return output


scene = load_raster(
    Path("/tmp/osiris_geotest.tif")
)

detector = FakeDetector()

scene_inference = SceneInference(
    detector=detector,
    tile_size=256,
    overlap=64,
    batch_size=8,
)

prediction = scene_inference.predict(
    scene.data
)

print("Scene shape:", scene.data.shape)
print("Probability shape:", prediction.probability.shape)
print("Tile count:", len(prediction.tiles))

assert prediction.probability.shape == (
    scene.height,
    scene.width,
)

assert len(prediction.tiles) == 12

extractor = SpillExtractor(
    threshold=0.5,
    min_region_pixels=32,
    morph_open_ksize=1,
    morph_close_ksize=1,
)

regions = extractor.extract(
    prediction.probability,
    scene,
)

print("Extracted regions:", len(regions))

for i, region in enumerate(regions, 1):
    print(f"\nRegion {i}")
    print("  Pixels:", region.pixel_count)
    print("  Area m²:", region.area_m2)
    print("  Mean probability:", region.mean_probability)
    print("  Max probability:", region.max_probability)
    print("  Geometry:", region.geometry["type"])

assert len(regions) > 0

for region in regions:
    assert region.area_m2 > 0
    assert region.pixel_count >= 32
    assert region.geometry["type"] in {
        "Polygon",
        "MultiPolygon",
    }

print("\nFull scene pipeline test passed.")
