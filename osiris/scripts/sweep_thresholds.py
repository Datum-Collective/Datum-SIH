from pathlib import Path

import numpy as np
import rasterio


PROBABILITY_PATH = Path(
    "outputs/normalization_experiment/"
    "2018_09_26_probability_global.npy"
)

MASK_PATH = Path(
    "data/real_test/test/masks/2018_09_26.tif"
)

OUTPUT_PATH = Path(
    "outputs/normalization_experiment/"
    "threshold_sweep_2018_09_26.txt"
)


print("=" * 80)
print("OSIRIS THRESHOLD SWEEP — GLOBAL NORMALIZATION")
print("=" * 80)

print()
print("Loading probability map...")
probability = np.load(PROBABILITY_PATH)

print("Probability shape:", probability.shape)
print(
    "Probability range:",
    float(probability.min()),
    "to",
    float(probability.max())
)

print()
print("Loading ground truth...")

with rasterio.open(MASK_PATH) as src:
    ground_truth = src.read(1)

ground_truth = ground_truth > 0.5

if probability.shape != ground_truth.shape:
    raise ValueError(
        f"Shape mismatch: "
        f"{probability.shape} vs {ground_truth.shape}"
    )

print("Ground-truth pixels:", int(ground_truth.sum()))

thresholds = [
    0.10,
    0.20,
    0.30,
    0.40,
    0.50,
    0.60,
    0.65,
    0.70,
    0.75,
    0.80,
    0.85,
    0.88,
    0.90,
    0.92,
    0.94,
    0.95,
    0.96,
    0.97,
    0.98,
    0.99,
]

results = []


for threshold in thresholds:

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

    precision_denominator = tp + fp

    recall_denominator = tp + fn

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
        tp / precision_denominator
        if precision_denominator
        else 0.0
    )

    recall = (
        tp / recall_denominator
        if recall_denominator
        else 0.0
    )

    predicted_pixels = int(prediction.sum())

    predicted_area_km2 = (
        predicted_pixels * 100.0 / 1_000_000
    )

    fp_area_km2 = (
        fp * 100.0 / 1_000_000
    )

    fn_area_km2 = (
        fn * 100.0 / 1_000_000
    )

    results.append({
        "threshold": threshold,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "dice": dice,
        "iou": iou,
        "precision": precision,
        "recall": recall,
        "area": predicted_area_km2,
        "fp_area": fp_area_km2,
        "fn_area": fn_area_km2,
    })


print()
print("=" * 100)
print("ALL THRESHOLDS")
print("=" * 100)

print(
    f"{'Threshold':>10}"
    f"{'Dice':>10}"
    f"{'IoU':>10}"
    f"{'Precision':>12}"
    f"{'Recall':>10}"
    f"{'Area km²':>14}"
    f"{'FP km²':>14}"
)

print("-" * 100)

for r in results:

    print(
        f"{r['threshold']:>10.2f}"
        f"{r['dice']:>10.4f}"
        f"{r['iou']:>10.4f}"
        f"{r['precision']:>12.4f}"
        f"{r['recall']:>10.4f}"
        f"{r['area']:>14.4f}"
        f"{r['fp_area']:>14.4f}"
    )


# ---------------------------------------------------------
# Find best thresholds.
# ---------------------------------------------------------

best_dice = max(
    results,
    key=lambda r: r["dice"]
)

best_iou = max(
    results,
    key=lambda r: r["iou"]
)

best_f1 = max(
    results,
    key=lambda r: (
        2 * r["precision"] * r["recall"]
        / (r["precision"] + r["recall"])
        if r["precision"] + r["recall"] > 0
        else 0
    )
)


print()
print("=" * 80)
print("BEST RESULTS")
print("=" * 80)

print()
print("BEST DICE")
print("-" * 40)
print("Threshold :", best_dice["threshold"])
print("Dice      :", f"{best_dice['dice']:.4f}")
print("IoU       :", f"{best_dice['iou']:.4f}")
print("Precision :", f"{best_dice['precision']:.4f}")
print("Recall    :", f"{best_dice['recall']:.4f}")
print("Area      :", f"{best_dice['area']:.4f}", "km²")
print("FP area   :", f"{best_dice['fp_area']:.4f}", "km²")
print("FN area   :", f"{best_dice['fn_area']:.4f}", "km²")

print()
print("BEST IoU")
print("-" * 40)
print("Threshold :", best_iou["threshold"])
print("Dice      :", f"{best_iou['dice']:.4f}")
print("IoU       :", f"{best_iou['iou']:.4f}")
print("Precision :", f"{best_iou['precision']:.4f}")
print("Recall    :", f"{best_iou['recall']:.4f}")
print("Area      :", f"{best_iou['area']:.4f}", "km²")

print()
print("BEST F1")
print("-" * 40)
print("Threshold :", best_f1["threshold"])
print("Dice      :", f"{best_f1['dice']:.4f}")
print("IoU       :", f"{best_f1['iou']:.4f}")
print("Precision :", f"{best_f1['precision']:.4f}")
print("Recall    :", f"{best_f1['recall']:.4f}")
print("Area      :", f"{best_f1['area']:.4f}", "km²")

print()
print("Ground-truth area: 42.5005 km²")
print()
print("Sweep complete.")
