from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
import rasterio


IMAGE = Path(
    "data/real_test/test/images/2018_12_19_f_.tif"
)

OUTPUT_DIR = Path(
    "outputs/tiling_experiment"
)

PROBABILITY_FILES = [
    (
        0,
        OUTPUT_DIR
        / "2018_12_19_f_overlap_0.npy"
    ),
    (
        64,
        OUTPUT_DIR
        / "2018_12_19_f_overlap_64.npy"
    ),
    (
        128,
        OUTPUT_DIR
        / "2018_12_19_f_overlap_128.npy"
    ),
]


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

    return (
        image - low
    ) / (
        high - low + 1e-8
    )


with rasterio.open(IMAGE) as src:
    image = src.read(1)

fig, axes = plt.subplots(
    1,
    3,
    figsize=(18, 7),
)

for ax, (overlap, path) in zip(
    axes,
    PROBABILITY_FILES,
):

    probability = np.load(path)

    ax.imshow(
        stretch(image),
        cmap="gray",
    )

    ax.imshow(
        probability >= 0.99,
        alpha=0.45,
        cmap="Reds",
    )

    ax.set_title(
        f"Overlap = {overlap}"
    )

    ax.axis("off")

fig.suptitle(
    "OSIRIS Tiling Artifact Test — 2018_12_19_f_",
    fontsize=16,
)

fig.tight_layout()

output = (
    OUTPUT_DIR
    / "tiling_comparison.png"
)

fig.savefig(
    output,
    dpi=150,
    bbox_inches="tight",
)

plt.close(fig)

print("Saved:", output)
