from pathlib import Path
import sys

import numpy as np
import torch
import rasterio

sys.path.insert(0, str(Path("src").resolve()))

from models.unet import UNet
from data.preprocess import match_channels
from inference.raster import load_raster
from inference.tiling import SceneTiler, stitch_predictions


IMAGE_DIR = Path("data/real_test/test/images")
MASK_DIR = Path("data/real_test/test/masks")
CHECKPOINT = Path("checkpoints/best.pt")

OUTPUT_DIR = Path("outputs/all_real_scenes")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TILE_SIZE = 256
OVERLAP = 64
BATCH_SIZE = 8

THRESHOLDS = [
    0.50,
    0.60,
    0.70,
    0.80,
    0.85,
    0.90,
    0.92,
    0.94,
    0.95,
    0.96,
    0.97,
    0.98,
    0.99,
]


def global_normalize(image, low, high):
    image = image.astype(np.float32)
    image = np.clip(image, low, high)
    image = (image - low) / (high - low + 1e-8)
    return image


def prepare_tile(tile, low, high):
    tile = global_normalize(tile, low, high)
    tile = match_channels(tile, 3)
    return tile


@torch.no_grad()
def run_inference(model, scene, low, high, device):

    tiler = SceneTiler(
        tile_size=TILE_SIZE,
        overlap=OVERLAP,
    )

    tiles = list(tiler.iter_tiles(scene))

    predictions = []

    for start in range(0, len(tiles), BATCH_SIZE):

        batch_tiles = tiles[start:start + BATCH_SIZE]

        batch = np.stack(
            [
                prepare_tile(
                    tile.image,
                    low,
                    high,
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
            .to(device)
        )

        use_amp = device.type == "cuda"

        with torch.autocast(
            device_type=device.type,
            enabled=use_amp,
        ):
            logits = model(tensor)

        probabilities = (
            torch.sigmoid(logits.float())
            .squeeze(1)
            .cpu()
            .numpy()
            .astype(np.float32)
        )

        predictions.extend(probabilities)

        completed = min(
            start + BATCH_SIZE,
            len(tiles),
        )

        if completed % 64 == 0 or completed == len(tiles):
            print(
                f"    {completed}/{len(tiles)} tiles"
            )

    return stitch_predictions(
        predictions=predictions,
        tiles=tiles,
        scene_shape=scene.shape[:2],
    )


def calculate_metrics(probability, ground_truth, threshold):

    prediction = probability >= threshold

    tp = np.count_nonzero(
        prediction & ground_truth
    )

    fp = np.count_nonzero(
        prediction & ~ground_truth
    )

    fn = np.count_nonzero(
        ~prediction & ground_truth
    )

    tn = np.count_nonzero(
        ~prediction & ~ground_truth
    )

    dice_denominator = 2 * tp + fp + fn
    iou_denominator = tp + fp + fn

    dice = (
        2 * tp / dice_denominator
        if dice_denominator
        else 0.0
    )

    iou = (
        tp / iou_denominator
        if iou_denominator
        else 0.0
    )

    precision = (
        tp / (tp + fp)
        if tp + fp
        else 0.0
    )

    recall = (
        tp / (tp + fn)
        if tp + fn
        else 0.0
    )

    predicted_area = (
        prediction.sum() * 100.0 / 1_000_000
    )

    gt_area = (
        ground_truth.sum() * 100.0 / 1_000_000
    )

    return {
        "threshold": threshold,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "dice": dice,
        "iou": iou,
        "precision": precision,
        "recall": recall,
        "predicted_area": predicted_area,
        "gt_area": gt_area,
    }


print("=" * 80)
print("OSIRIS — ALL REAL SENTINEL-1 SCENES")
print("=" * 80)

images = sorted(IMAGE_DIR.glob("*.tif"))

print()
print("Found images:", len(images))

if not images:
    raise RuntimeError("No Sentinel-1 images found.")

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Device:", device)

print()
print("Loading model...")

model = UNet(
    in_channels=3,
    base_channels=32,
    depth=4,
).to(device)

checkpoint = torch.load(
    CHECKPOINT,
    map_location=device,
    weights_only=False,
)

model.load_state_dict(checkpoint["model"])
model.eval()

all_results = []


for scene_number, image_path in enumerate(images, 1):

    mask_path = MASK_DIR / image_path.name

    if not mask_path.exists():
        print()
        print("WARNING: Missing mask:", mask_path)
        continue

    print()
    print("=" * 80)
    print(
        f"SCENE {scene_number}/{len(images)}: "
        f"{image_path.name}"
    )
    print("=" * 80)

    scene = load_raster(image_path)
    truth = load_raster(mask_path)

    ground_truth = np.asarray(truth.data)

    if ground_truth.ndim == 3:
        ground_truth = ground_truth[..., 0]

    ground_truth = ground_truth > 0.5

    if scene.data.shape[:2] != ground_truth.shape:
        raise ValueError(
            f"Shape mismatch for {image_path.name}: "
            f"{scene.data.shape} vs {ground_truth.shape}"
        )

    # Global normalization statistics for THIS scene.
    scene_data = np.asarray(
        scene.data
    ).astype(np.float32)

    low, high = np.percentile(
        scene_data,
        [1, 99],
    )

    print("Shape:", scene.data.shape)
    print("Global P1 :", low)
    print("Global P99:", high)
    print(
        "Ground-truth pixels:",
        int(ground_truth.sum())
    )

    print()
    print("Running tiled inference...")

    probability = run_inference(
        model=model,
        scene=scene.data,
        low=low,
        high=high,
        device=device,
    )

    probability_path = (
        OUTPUT_DIR
        / f"{image_path.stem}_probability.npy"
    )

    np.save(
        probability_path,
        probability,
    )

    print("Saved:", probability_path)

    scene_results = []

    for threshold in THRESHOLDS:

        metrics = calculate_metrics(
            probability,
            ground_truth,
            threshold,
        )

        metrics["scene"] = image_path.stem

        scene_results.append(metrics)
        all_results.append(metrics)

    best = max(
        scene_results,
        key=lambda x: x["dice"]
    )

    print()
    print("BEST THRESHOLD FOR THIS SCENE")
    print("-" * 50)
    print(
        "Threshold :",
        f"{best['threshold']:.2f}"
    )
    print(
        "Dice      :",
        f"{best['dice']:.4f}"
    )
    print(
        "IoU       :",
        f"{best['iou']:.4f}"
    )
    print(
        "Precision :",
        f"{best['precision']:.4f}"
    )
    print(
        "Recall    :",
        f"{best['recall']:.4f}"
    )
    print(
        "Pred area :",
        f"{best['predicted_area']:.4f}",
        "km²"
    )
    print(
        "GT area   :",
        f"{best['gt_area']:.4f}",
        "km²"
    )


# ---------------------------------------------------------
# Save complete CSV-style results.
# ---------------------------------------------------------

results_path = (
    OUTPUT_DIR
    / "all_threshold_results.csv"
)

with results_path.open("w") as f:

    f.write(
        "scene,threshold,dice,iou,precision,"
        "recall,predicted_area_km2,gt_area_km2,"
        "tp,fp,fn,tn\n"
    )

    for r in all_results:

        f.write(
            f"{r['scene']},"
            f"{r['threshold']:.2f},"
            f"{r['dice']:.6f},"
            f"{r['iou']:.6f},"
            f"{r['precision']:.6f},"
            f"{r['recall']:.6f},"
            f"{r['predicted_area']:.6f},"
            f"{r['gt_area']:.6f},"
            f"{r['tp']},"
            f"{r['fp']},"
            f"{r['fn']},"
            f"{r['tn']}\n"
        )


# ---------------------------------------------------------
# Find best threshold based on MEAN Dice across scenes.
# ---------------------------------------------------------

mean_by_threshold = []

for threshold in THRESHOLDS:

    values = [
        r["dice"]
        for r in all_results
        if r["threshold"] == threshold
    ]

    if not values:
        continue

    mean_by_threshold.append(
        (
            threshold,
            float(np.mean(values)),
            float(np.median(values)),
        )
    )

best_mean = max(
    mean_by_threshold,
    key=lambda x: x[1]
)

best_median = max(
    mean_by_threshold,
    key=lambda x: x[2]
)


print()
print("=" * 100)
print("CROSS-SCENE THRESHOLD COMPARISON")
print("=" * 100)

print()
print(
    f"{'Threshold':>10}"
    f"{'Mean Dice':>12}"
    f"{'Median Dice':>14}"
)

print("-" * 40)

for threshold, mean_dice, median_dice in mean_by_threshold:

    print(
        f"{threshold:>10.2f}"
        f"{mean_dice:>12.4f}"
        f"{median_dice:>14.4f}"
    )


print()
print("=" * 80)
print("BEST CROSS-SCENE THRESHOLDS")
print("=" * 80)

print()
print(
    "Best mean Dice threshold:",
    f"{best_mean[0]:.2f}"
)

print(
    "Mean Dice:",
    f"{best_mean[1]:.4f}"
)

print(
    "Median Dice:",
    f"{best_mean[2]:.4f}"
)

print()
print(
    "Best median Dice threshold:",
    f"{best_median[0]:.2f}"
)

print(
    "Mean Dice:",
    f"{best_median[1]:.4f}"
)

print(
    "Median Dice:",
    f"{best_median[2]:.4f}"
)

print()
print("Complete results saved to:")
print(results_path)

print()
print("Experiment complete.")
