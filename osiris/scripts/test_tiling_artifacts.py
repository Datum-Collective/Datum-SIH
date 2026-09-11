from pathlib import Path
import sys

import numpy as np
import torch

sys.path.insert(0, str(Path("src").resolve()))

from models.unet import UNet
from inference.raster import load_raster
from inference.tiling import SceneTiler, stitch_predictions
from data.preprocess import match_channels


IMAGE = Path(
    "data/real_test/test/images/2018_12_19_f_.tif"
)

CHECKPOINT = Path(
    "checkpoints/best.pt"
)

OUTPUT_DIR = Path(
    "outputs/tiling_experiment"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

BATCH_SIZE = 8


def normalize_scene(image, low, high):

    image = image.astype(np.float32)

    image = np.clip(
        image,
        low,
        high,
    )

    image = (
        image - low
    ) / (
        high - low + 1e-8
    )

    return image


@torch.no_grad()
def run(model, scene, low, high, overlap):

    tiler = SceneTiler(
        tile_size=256,
        overlap=overlap,
    )

    tiles = list(
        tiler.iter_tiles(scene)
    )

    print(
        f"overlap={overlap}: "
        f"{len(tiles)} tiles"
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
                np.ascontiguousarray(batch)
            )
            .permute(0, 3, 1, 2)
            .float()
            .to(DEVICE)
        )

        use_amp = DEVICE.type == "cuda"

        with torch.autocast(
            device_type=DEVICE.type,
            enabled=use_amp,
        ):

            logits = model(tensor)

        probabilities = (
            torch.sigmoid(
                logits.float()
            )
            .squeeze(1)
            .cpu()
            .numpy()
            .astype(np.float32)
        )

        predictions.extend(
            probabilities
        )

    return stitch_predictions(
        predictions=predictions,
        tiles=tiles,
        scene_shape=scene.shape[:2],
    )


print("=" * 80)
print("OSIRIS — TILING ARTIFACT EXPERIMENT")
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

for overlap in [0, 64, 128]:

    probability = run(
        model,
        image,
        low,
        high,
        overlap,
    )

    output = (
        OUTPUT_DIR
        / f"2018_12_19_f_overlap_{overlap}.npy"
    )

    np.save(
        output,
        probability,
    )

    print(
        "Saved:",
        output,
    )

print()
print("Experiment complete.")
