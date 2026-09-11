from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
import rasterio


IMAGE = Path(
    "data/real_test/test/images/2018_12_19_f_.tif"
)

OUTPUT_DIR = Path(
    "outputs/weighted_stitch_experiment"
)


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

standard = np.load(
    OUTPUT_DIR / "standard.npy"
)

weighted = np.load(
    OUTPUT_DIR / "weighted.npy"
)


fig, axes = plt.subplots(
    1,
    2,
    figsize=(16, 7),
)


axes[0].imshow(
    stretch(image),
    cmap="gray",
)

axes[0].imshow(
    standard >= 0.99,
    alpha=0.45,
    cmap="Reds",
)

axes[0].set_title(
    "Current Equal-Weight Stitching"
)

axes[0].axis("off")


axes[1].imshow(
    stretch(image),
    cmap="gray",
)

axes[1].imshow(
    weighted >= 0.99,
    alpha=0.45,
    cmap="Reds",
)

axes[1].set_title(
    "Gaussian Center-Weighted Stitching"
)

axes[1].axis("off")


fig.suptitle(
    "OSIRIS Tile Boundary Artifact Test",
    fontsize=16,
)

fig.tight_layout()

output = (
    OUTPUT_DIR
    / "weighted_vs_standard.png"
)

fig.savefig(
    output,
    dpi=150,
    bbox_inches="tight",
)

plt.close(fig)

print("Saved:", output)
