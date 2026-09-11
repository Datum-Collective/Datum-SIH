from pathlib import Path

import numpy as np
from PIL import Image
import rasterio


TRAIN_DIR = Path("data/images/train")
REAL_DIR = Path("data/real_test/test/images")


def stats(name, values):
    values = np.asarray(values, dtype=np.float32)
    values = values[np.isfinite(values)]

    print()
    print(name)
    print("-" * 60)
    print(f"min  : {np.min(values):.6f}")
    print(f"p1   : {np.percentile(values, 1):.6f}")
    print(f"p5   : {np.percentile(values, 5):.6f}")
    print(f"p25  : {np.percentile(values, 25):.6f}")
    print(f"p50  : {np.percentile(values, 50):.6f}")
    print(f"p75  : {np.percentile(values, 75):.6f}")
    print(f"p95  : {np.percentile(values, 95):.6f}")
    print(f"p99  : {np.percentile(values, 99):.6f}")
    print(f"max  : {np.max(values):.6f}")
    print(f"mean : {np.mean(values):.6f}")
    print(f"std  : {np.std(values):.6f}")


def main():

    print("=" * 80)
    print("OSIRIS — TRAINING VS REAL SENTINEL-1 DOMAIN GAP")
    print("=" * 80)

    # ------------------------------------------------------------------
    # TRAINING DATA
    # ------------------------------------------------------------------

    train_files = sorted(TRAIN_DIR.glob("*.png"))

    print()
    print(f"Training images found: {len(train_files)}")

    # Sample rather than loading all ~1 GB of PNG data.
    sample_files = train_files[::max(1, len(train_files) // 100)]

    training_values = []
    channel_differences = []
    channel_correlations = []

    for path in sample_files:

        image = np.asarray(
            Image.open(path).convert("RGB"),
            dtype=np.float32,
        )

        training_values.append(
            image.reshape(-1)
        )

        c0 = image[..., 0]
        c1 = image[..., 1]
        c2 = image[..., 2]

        channel_differences.append(
            [
                np.mean(np.abs(c0 - c1)),
                np.mean(np.abs(c1 - c2)),
                np.mean(np.abs(c0 - c2)),
            ]
        )

        channel_correlations.append(
            [
                np.corrcoef(c0.ravel(), c1.ravel())[0, 1],
                np.corrcoef(c1.ravel(), c2.ravel())[0, 1],
                np.corrcoef(c0.ravel(), c2.ravel())[0, 1],
            ]
        )

    training_values = np.concatenate(training_values)

    stats(
        "TRAINING PNG PIXEL DISTRIBUTION",
        training_values,
    )

    channel_differences = np.asarray(
        channel_differences
    )

    channel_correlations = np.asarray(
        channel_correlations
    )

    print()
    print("TRAINING RGB CHANNEL DIFFERENCES")
    print("-" * 60)
    print(
        "Mean |R-G|:",
        channel_differences[:, 0].mean(),
    )
    print(
        "Mean |G-B|:",
        channel_differences[:, 1].mean(),
    )
    print(
        "Mean |R-B|:",
        channel_differences[:, 2].mean(),
    )

    print()
    print("TRAINING RGB CHANNEL CORRELATIONS")
    print("-" * 60)
    print(
        "R/G:",
        channel_correlations[:, 0].mean(),
    )
    print(
        "G/B:",
        channel_correlations[:, 1].mean(),
    )
    print(
        "R/B:",
        channel_correlations[:, 2].mean(),
    )

    # ------------------------------------------------------------------
    # REAL SENTINEL-1
    # ------------------------------------------------------------------

    real_files = sorted(REAL_DIR.glob("*.tif"))

    print()
    print("=" * 80)
    print("REAL SENTINEL-1 SCENES")
    print("=" * 80)

    for path in real_files:

        with rasterio.open(path) as src:
            image = src.read(1).astype(
                np.float32
            )

        finite = image[np.isfinite(image)]

        p1 = np.percentile(finite, 1)
        p99 = np.percentile(finite, 99)

        normalized = np.clip(
            (image - p1) / (p99 - p1 + 1e-8),
            0.0,
            1.0,
        )

        print()
        print(path.name)
        print("-" * 60)

        stats(
            "RAW Sigma0_VV_dB",
            finite,
        )

        stats(
            "GLOBAL P1/P99 NORMALIZED",
            normalized,
        )

    # ------------------------------------------------------------------
    # TRAINING PREPROCESSING REFERENCE
    # ------------------------------------------------------------------

    print()
    print("=" * 80)
    print("REFERENCE: TRAINING INPUT AFTER NORMALIZATION")
    print("=" * 80)

    training_normalized = training_values / 255.0

    stats(
        "TRAINING 0–1 INPUT",
        training_normalized,
    )

    print()
    print("Interpretation:")
    print()
    print("The training model receives PNG-derived 0–1 imagery.")
    print("Real Sentinel-1 receives percentile-normalized VV imagery.")
    print()
    print("If the distributions differ substantially, this is evidence")
    print("of domain shift rather than a tiling/stitching failure.")


if __name__ == "__main__":
    main()
