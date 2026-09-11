from pathlib import Path
import sys

import numpy as np
import torch

sys.path.insert(0, str(Path("src").resolve()))

from models.unet import UNet
from data.preprocess import match_channels
from inference.raster import load_raster
from inference.tiling import (
    SceneTiler,
    stitch_predictions,
    stitch_predictions_weighted,
)


IMAGE = Path(
    "data/real_test/test/images/2018_12_19_f_.tif"
)

CHECKPOINT = Path(
    "checkpoints/best.pt"
)

OUTPUT_DIR = Path(
    "outputs/weighted_stitch_experiment"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available()
    else "cpu"
)

TILE_SIZE = 256
OVERLAP = 64
BATCH_SIZE = 8


def normalize_scene(
    image,
    low,
    high,
):

    image = image.astype(
        np.float32
    )

    image = np.clip(
        image,
        low,
        high,
    )

    return (
        image - low
    ) / (
        high - low + 1e-8
    )


@torch.no_grad()
def run_inference(
    model,
    scene,
    low,
    high,
):

    tiler = SceneTiler(
        tile_size=TILE_SIZE,
        overlap=OVERLAP,
    )

    tiles = list(
        tiler.iter_tiles(scene)
    )

    predictions = []

    for start in range(
        0,
        len(tiles),
        BATCH_SIZE,
    ):

        batch_tiles = tiles[
            start:start + BATCH_SIZE
        ]

        batch = np.stack(
            [
                match_channels(
                    normalize_scene(
                        tile.image,
                        low,
                        high,
                    ),
                    3,
                )
                for tile in batch_tiles
            ],
            axis=0,
        )

        tensor = (
            torch.from_numpy(
                np.ascontiguousarray(
                    batch
                )
            )
            .permute(0, 3, 1, 2)
            .float()
            .to(DEVICE)
        )

        with torch.autocast(
            device_type=DEVICE.type,
            enabled=DEVICE.type == "cuda",
        ):

            logits = model(tensor)

        probability = (
            torch.sigmoid(
                logits.float()
            )
            .squeeze(1)
            .cpu()
            .numpy()
            .astype(np.float32)
        )

        predictions.extend(
            probability
        )

    return (
        tiles,
        predictions,
    )


print("=" * 80)
print("OSIRIS — WEIGHTED STITCHING EXPERIMENT")
print("=" * 80)

scene = load_raster(IMAGE)

image = np.asarray(
    scene.data
).astype(np.float32)

low, high = np.percentile(
    image,
    [1, 99],
)

print()
print("Scene:", IMAGE.name)
print("Shape:", image.shape)
print("P1:", low)
print("P99:", high)
print("Device:", DEVICE)

print()
print("Loading model...")

model = UNet(
    in_channels=3,
    base_channels=32,
    depth=4,
).to(DEVICE)

checkpoint = torch.load(
    CHECKPOINT,
    map_location=DEVICE,
    weights_only=False,
)

model.load_state_dict(
    checkpoint["model"]
)

model.eval()

print()
print("Running inference...")

tiles, predictions = run_inference(
    model,
    image,
    low,
    high,
)

print(
    "Tiles:",
    len(tiles),
)

print()
print("Stitching with current method...")

standard = stitch_predictions(
    predictions=predictions,
    tiles=tiles,
    scene_shape=image.shape[:2],
)

print("Stitching with weighted method...")

weighted = stitch_predictions_weighted(
    predictions=predictions,
    tiles=tiles,
    scene_shape=image.shape[:2],
)

standard_path = (
    OUTPUT_DIR
    / "standard.npy"
)

weighted_path = (
    OUTPUT_DIR
    / "weighted.npy"
)

np.save(
    standard_path,
    standard,
)

np.save(
    weighted_path,
    weighted,
)

print()
print("Saved:")
print(standard_path)
print(weighted_path)

print()
print("Probability statistics")

for name, probability in [
    ("standard", standard),
    ("weighted", weighted),
]:

    mask = probability >= 0.99

    print()
    print(name)

    print(
        "  mean:",
        float(probability.mean()),
    )

    print(
        "  max:",
        float(probability.max()),
    )

    print(
        "  pixels >= 0.99:",
        int(mask.sum()),
    )

print()
print("Experiment complete.")
