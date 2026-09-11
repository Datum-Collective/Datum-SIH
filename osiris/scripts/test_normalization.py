from pathlib import Path
import sys

import numpy as np
import torch

sys.path.insert(0, str(Path("src").resolve()))

from models.unet import UNet
from data.preprocess import normalize_sar, match_channels
from inference.raster import load_raster
from inference.tiling import SceneTiler, stitch_predictions


IMAGE_PATH = Path("data/real_test/test/images/2018_09_26.tif")
MASK_PATH = Path("data/real_test/test/masks/2018_09_26.tif")
CHECKPOINT = Path("checkpoints/best.pt")

OUTPUT_DIR = Path("outputs/normalization_experiment")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TILE_SIZE = 256
OVERLAP = 64
BATCH_SIZE = 8

THRESHOLD = 0.5


def global_normalize(image, low, high):
    image = image.astype(np.float32)
    image = np.clip(image, low, high)
    image = (image - low) / (high - low + 1e-8)
    return image


def prepare_tile(tile, mode, global_low=None, global_high=None):
    tile = tile.astype(np.float32)

    if mode == "current":
        # Exactly the normalization used by the existing detector.
        tile = normalize_sar(tile)

    elif mode == "global":
        tile = global_normalize(
            tile,
            global_low,
            global_high,
        )

    elif mode == "fixed":
        # Fixed physical Sentinel-1 VV dB range.
        tile = global_normalize(
            tile,
            -35.0,
            0.0,
        )

    else:
        raise ValueError(f"Unknown normalization mode: {mode}")

    tile = match_channels(tile, 3)

    return tile


@torch.no_grad()
def run_inference(model, scene, mode, device, global_low=None, global_high=None):

    tiler = SceneTiler(
        tile_size=TILE_SIZE,
        overlap=OVERLAP,
    )

    tiles = list(tiler.iter_tiles(scene))

    predictions = []

    print(f"  Tiles: {len(tiles)}")
    print(f"  Batch size: {BATCH_SIZE}")

    for start in range(0, len(tiles), BATCH_SIZE):

        batch_tiles = tiles[start:start + BATCH_SIZE]

        batch = np.stack(
            [
                prepare_tile(
                    tile.image,
                    mode,
                    global_low,
                    global_high,
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
                f"  Processed {completed}/{len(tiles)} tiles"
            )

    probability = stitch_predictions(
        predictions=predictions,
        tiles=tiles,
        scene_shape=scene.shape[:2],
    )

    return probability


def calculate_metrics(probability, ground_truth):

    prediction = probability >= THRESHOLD

    tp = np.count_nonzero(prediction & ground_truth)
    fp = np.count_nonzero(prediction & ~ground_truth)
    fn = np.count_nonzero(~prediction & ground_truth)
    tn = np.count_nonzero(~prediction & ~ground_truth)

    dice = (
        (2 * tp) / (2 * tp + fp + fn)
        if (2 * tp + fp + fn)
        else 1.0
    )

    iou = (
        tp / (tp + fp + fn)
        if (tp + fp + fn)
        else 1.0
    )

    precision = (
        tp / (tp + fp)
        if (tp + fp)
        else 0.0
    )

    recall = (
        tp / (tp + fn)
        if (tp + fn)
        else 0.0
    )

    pred_area = prediction.sum() * 100.0 / 1_000_000
    gt_area = ground_truth.sum() * 100.0 / 1_000_000
    fp_area = fp * 100.0 / 1_000_000
    fn_area = fn * 100.0 / 1_000_000

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "dice": dice,
        "iou": iou,
        "precision": precision,
        "recall": recall,
        "pred_area": pred_area,
        "gt_area": gt_area,
        "fp_area": fp_area,
        "fn_area": fn_area,
    }


print("=" * 70)
print("OSIRIS NORMALIZATION EXPERIMENT")
print("=" * 70)

print()
print("Loading scene...")

scene = load_raster(IMAGE_PATH)

print("Image shape:", scene.data.shape)
print("Image dtype:", scene.data.dtype)

print()
print("Loading ground truth...")

truth = load_raster(MASK_PATH)

ground_truth = np.asarray(truth.data)

if ground_truth.ndim == 3:
    ground_truth = ground_truth[..., 0]

ground_truth = ground_truth > 0.5

print("Ground-truth pixels:", int(ground_truth.sum()))
print(
    "Ground-truth area:",
    f"{ground_truth.sum() * 100.0 / 1_000_000:.4f}",
    "km²",
)

print()
print("Loading model...")

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Device:", device)

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

print("Checkpoint epoch:", checkpoint.get("epoch"))
print("Checkpoint validation Dice:", checkpoint.get("val_dice"))

# ---------------------------------------------------------
# Calculate global scene statistics ONCE.
# ---------------------------------------------------------

scene_data = np.asarray(scene.data).astype(np.float32)

global_low, global_high = np.percentile(
    scene_data,
    [1, 99],
)

print()
print("Global scene percentiles:")
print("  P1 :", global_low)
print("  P99:", global_high)

print()
print("Fixed normalization:")
print("  Low : -35 dB")
print("  High:   0 dB")


results = {}


for mode in ["current", "global", "fixed"]:

    print()
    print("=" * 70)
    print("NORMALIZATION:", mode.upper())
    print("=" * 70)

    probability = run_inference(
        model=model,
        scene=scene.data,
        mode=mode,
        device=device,
        global_low=global_low,
        global_high=global_high,
    )

    metrics = calculate_metrics(
        probability,
        ground_truth,
    )

    results[mode] = metrics

    output_path = (
        OUTPUT_DIR
        / f"2018_09_26_probability_{mode}.npy"
    )

    np.save(
        output_path,
        probability,
    )

    print()
    print("RESULTS")
    print("-" * 50)
    print(f"TP             : {metrics['tp']:,}")
    print(f"FP             : {metrics['fp']:,}")
    print(f"FN             : {metrics['fn']:,}")
    print(f"TN             : {metrics['tn']:,}")
    print(f"Dice           : {metrics['dice']:.4f}")
    print(f"IoU            : {metrics['iou']:.4f}")
    print(f"Precision      : {metrics['precision']:.4f}")
    print(f"Recall         : {metrics['recall']:.4f}")
    print(f"Predicted area : {metrics['pred_area']:.4f} km²")
    print(f"GT area        : {metrics['gt_area']:.4f} km²")
    print(f"FP area        : {metrics['fp_area']:.4f} km²")
    print(f"FN area        : {metrics['fn_area']:.4f} km²")
    print()
    print("Saved:", output_path)


print()
print("=" * 70)
print("FINAL COMPARISON")
print("=" * 70)

print()
print(
    f"{'Method':<12}"
    f"{'Dice':>10}"
    f"{'IoU':>10}"
    f"{'Precision':>12}"
    f"{'Recall':>10}"
    f"{'Area km²':>14}"
)

print("-" * 70)

for mode in ["current", "global", "fixed"]:

    m = results[mode]

    print(
        f"{mode:<12}"
        f"{m['dice']:>10.4f}"
        f"{m['iou']:>10.4f}"
        f"{m['precision']:>12.4f}"
        f"{m['recall']:>10.4f}"
        f"{m['pred_area']:>14.4f}"
    )

print()
print("Experiment complete.")
print("Probability maps saved in:")
print(" ", OUTPUT_DIR)
