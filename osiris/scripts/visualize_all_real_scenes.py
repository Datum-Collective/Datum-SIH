from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
import rasterio


IMAGE_DIR = Path("data/real_test/test/images")
MASK_DIR = Path("data/real_test/test/masks")
PROB_DIR = Path("outputs/all_real_scenes")

OUTPUT_DIR = Path("outputs/all_real_scenes/diagnostics")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

THRESHOLD = 0.99


def stretch(image):
    low, high = np.percentile(
        image,
        [1, 99],
    )

    image = np.clip(
        image,
        low,
        high,
    )

    return (image - low) / (high - low + 1e-8)


for image_path in sorted(IMAGE_DIR.glob("*.tif")):

    name = image_path.stem

    mask_path = MASK_DIR / image_path.name

    probability_path = (
        PROB_DIR
        / f"{name}_probability.npy"
    )

    if not mask_path.exists():
        print("Missing mask:", mask_path)
        continue

    if not probability_path.exists():
        print(
            "Missing probability:",
            probability_path,
        )
        continue

    print("Processing:", name)

    with rasterio.open(image_path) as src:
        image = src.read(1)

    with rasterio.open(mask_path) as src:
        ground_truth = src.read(1)

    probability = np.load(
        probability_path
    )

    ground_truth = ground_truth > 0.5
    prediction = probability >= THRESHOLD

    # Error classes:
    # 0 = correct background
    # 1 = false positive
    # 2 = false negative
    # 3 = true positive

    error = np.zeros(
        prediction.shape,
        dtype=np.uint8,
    )

    error[
        prediction & ~ground_truth
    ] = 1

    error[
        ~prediction & ground_truth
    ] = 2

    error[
        prediction & ground_truth
    ] = 3

    fig, axes = plt.subplots(
        2,
        2,
        figsize=(14, 10),
    )

    ax = axes[0, 0]

    ax.imshow(
        stretch(image),
        cmap="gray",
    )

    ax.set_title(
        f"{name} — SAR"
    )

    ax.axis("off")


    ax = axes[0, 1]

    ax.imshow(
        stretch(image),
        cmap="gray",
    )

    ax.imshow(
        ground_truth,
        alpha=0.45,
        cmap="Reds",
    )

    ax.set_title(
        "Ground Truth"
    )

    ax.axis("off")


    ax = axes[1, 0]

    ax.imshow(
        stretch(image),
        cmap="gray",
    )

    ax.imshow(
        prediction,
        alpha=0.45,
        cmap="Reds",
    )

    ax.set_title(
        "Prediction @ 0.99"
    )

    ax.axis("off")


    ax = axes[1, 1]

    ax.imshow(
        error,
        cmap="viridis",
        vmin=0,
        vmax=3,
    )

    ax.set_title(
        "Error Map"
    )

    ax.axis("off")


    fig.suptitle(
        f"OSIRIS Real Sentinel-1 Diagnostic — {name}",
        fontsize=16,
    )

    fig.tight_layout()

    output_path = (
        OUTPUT_DIR
        / f"{name}_diagnostic.png"
    )

    fig.savefig(
        output_path,
        dpi=150,
        bbox_inches="tight",
    )

    plt.close(fig)

    print("  Saved:", output_path)


print()
print("Done.")
print("Diagnostics:", OUTPUT_DIR)
