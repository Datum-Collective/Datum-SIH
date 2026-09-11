from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
import rasterio


IMAGE_PATH = Path("data/real_test/test/images/2018_09_26.tif")
MASK_PATH = Path("data/real_test/test/masks/2018_09_26.tif")
PROBABILITY_PATH = Path("outputs/2018_09_26_probability.npy")
OUTPUT_PATH = Path("outputs/2018_09_26_diagnostic.png")

THRESHOLD = 0.5


def normalize_for_display(image):
    """
    Robustly stretch Sentinel-1 VV dB values for visualization.
    """
    image = image.astype(np.float32)

    lo, hi = np.percentile(image, [1, 99])

    image = np.clip(image, lo, hi)
    image = (image - lo) / (hi - lo + 1e-8)

    return image


print("Loading SAR image...")
with rasterio.open(IMAGE_PATH) as src:
    image = src.read(1)

print("Loading ground-truth mask...")
with rasterio.open(MASK_PATH) as src:
    ground_truth = src.read(1)

print("Loading saved probability map...")
probability = np.load(PROBABILITY_PATH)

if image.shape != ground_truth.shape:
    raise ValueError(
        f"Image/mask shape mismatch: {image.shape} vs {ground_truth.shape}"
    )

if image.shape != probability.shape:
    raise ValueError(
        f"Image/probability shape mismatch: {image.shape} vs {probability.shape}"
    )

ground_truth = ground_truth > 0.5
prediction = probability >= THRESHOLD

print("Image shape:", image.shape)
print("Ground-truth pixels:", int(ground_truth.sum()))
print("Predicted pixels:", int(prediction.sum()))

# Confusion classes
true_positive = prediction & ground_truth
false_positive = prediction & ~ground_truth
false_negative = ~prediction & ground_truth

display_image = normalize_for_display(image)

fig, axes = plt.subplots(2, 2, figsize=(16, 10))

# ---------------------------------------------------------
# 1. SAR
# ---------------------------------------------------------
axes[0, 0].imshow(display_image, cmap="gray")
axes[0, 0].set_title("Sentinel-1 VV SAR")
axes[0, 0].axis("off")

# ---------------------------------------------------------
# 2. Ground truth
# ---------------------------------------------------------
axes[0, 1].imshow(display_image, cmap="gray")
axes[0, 1].imshow(
    np.ma.masked_where(~ground_truth, ground_truth),
    cmap="Reds",
    alpha=0.65,
)
axes[0, 1].set_title("Ground Truth")
axes[0, 1].axis("off")

# ---------------------------------------------------------
# 3. Prediction
# ---------------------------------------------------------
axes[1, 0].imshow(display_image, cmap="gray")
axes[1, 0].imshow(
    np.ma.masked_where(~prediction, prediction),
    cmap="Reds",
    alpha=0.65,
)
axes[1, 0].set_title(f"OSIRIS Prediction (threshold={THRESHOLD})")
axes[1, 0].axis("off")

# ---------------------------------------------------------
# 4. Error map
#
# Green  = true positive
# Red    = false positive
# Blue   = false negative
# ---------------------------------------------------------
error = np.zeros((*image.shape, 3), dtype=np.float32)

error[true_positive] = [0.0, 1.0, 0.0]
error[false_positive] = [1.0, 0.0, 0.0]
error[false_negative] = [0.0, 0.3, 1.0]

axes[1, 1].imshow(display_image, cmap="gray")
axes[1, 1].imshow(error, alpha=0.65)

axes[1, 1].set_title(
    "Error Map: Green=TP  Red=FP  Blue=FN"
)
axes[1, 1].axis("off")

fig.suptitle(
    "OSIRIS Real Sentinel-1 Evaluation — 2018-09-26",
    fontsize=18,
)

plt.tight_layout()

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
plt.savefig(
    OUTPUT_PATH,
    dpi=150,
    bbox_inches="tight",
)

plt.close()

print()
print("Saved diagnostic visualization:")
print(" ", OUTPUT_PATH)
