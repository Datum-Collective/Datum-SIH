from pathlib import Path

import cv2
import numpy as np
import torch
import rasterio

from src.models.unet import UNet
from src.data.preprocess import match_channels
from src.utils import get_device


CHECKPOINT = "checkpoints/best.pt"

IMAGE_DIR = Path("data/real_test/test/images")
MASK_DIR = Path("data/real_test/test/masks")

TRAIN_DIR = Path("data/images/train")

TILE_SIZE = 256
CROP = 64
STRIDE = TILE_SIZE - 2 * CROP

THRESHOLD = 0.99


def positions(length):
    values = list(
        range(
            0,
            max(length - TILE_SIZE, 0) + 1,
            STRIDE,
        )
    )

    final = length - TILE_SIZE

    if not values or values[-1] != final:
        values.append(final)

    return sorted(set(values))


def build_training_reference():

    print("Building training intensity reference...")

    values = []

    files = sorted(TRAIN_DIR.glob("*.png"))

    if not files:
        raise RuntimeError(
            f"No training PNGs found in {TRAIN_DIR}"
        )

    # Sample pixels rather than loading all 6455 images
    # into memory at once.
    rng = np.random.default_rng(42)

    for index, path in enumerate(files):

        image = cv2.imread(
            str(path),
            cv2.IMREAD_GRAYSCALE,
        )

        if image is None:
            raise RuntimeError(
                f"Could not read {path}"
            )

        flat = image.reshape(-1)

        # Sample up to 4096 pixels per image.
        if flat.size > 4096:
            indices = rng.choice(
                flat.size,
                size=4096,
                replace=False,
            )
            flat = flat[indices]

        values.append(flat)

        if (index + 1) % 500 == 0:
            print(
                f"    {index + 1}/{len(files)} images",
                flush=True,
            )

    values = np.concatenate(values).astype(
        np.float32
    )

    # Convert exactly like the model sees training PNGs.
    values /= 255.0

    print()
    print("Training reference statistics:")
    print(f"  p1  = {np.percentile(values, 1):.6f}")
    print(f"  p5  = {np.percentile(values, 5):.6f}")
    print(f"  p25 = {np.percentile(values, 25):.6f}")
    print(f"  p50 = {np.percentile(values, 50):.6f}")
    print(f"  p75 = {np.percentile(values, 75):.6f}")
    print(f"  p95 = {np.percentile(values, 95):.6f}")
    print(f"  p99 = {np.percentile(values, 99):.6f}")
    print()

    return values


def histogram_match(source, reference):

    source_flat = source.reshape(-1)

    order = np.argsort(source_flat)

    sorted_source = source_flat[order]

    source_quantiles = (
        np.arange(sorted_source.size)
        / max(sorted_source.size - 1, 1)
    )

    reference_sorted = np.sort(reference)

    reference_quantiles = (
        np.arange(reference_sorted.size)
        / max(reference_sorted.size - 1, 1)
    )

    matched_sorted = np.interp(
        source_quantiles,
        reference_quantiles,
        reference_sorted,
    )

    matched_flat = np.empty_like(
        source_flat,
        dtype=np.float32,
    )

    matched_flat[order] = matched_sorted

    return matched_flat.reshape(source.shape)


def run_scene(
    model,
    device,
    image_path,
    reference,
):

    stem = image_path.stem
    mask_path = MASK_DIR / image_path.name

    print()
    print("=" * 80)
    print(f"SCENE: {stem}")
    print("=" * 80)

    with rasterio.open(image_path) as src:
        scene = src.read(1).astype(np.float32)

    with rasterio.open(mask_path) as src:
        gt = src.read(1)

    height, width = scene.shape

    print(f"Shape: {scene.shape}")

    # --------------------------------------------------
    # Global Sentinel-1 normalization
    # --------------------------------------------------

    p1 = np.percentile(scene, 1)
    p99 = np.percentile(scene, 99)

    normalized = np.clip(
        (scene - p1) /
        (p99 - p1 + 1e-8),
        0.0,
        1.0,
    ).astype(np.float32)

    print(
        f"Sentinel P1/P99: "
        f"{p1:.4f} / {p99:.4f}"
    )

    # --------------------------------------------------
    # Histogram adaptation
    # --------------------------------------------------

    adapted = histogram_match(
        normalized,
        reference,
    )

    adapted = np.clip(
        adapted,
        0.0,
        1.0,
    ).astype(np.float32)

    print("Adapted statistics:")
    print(
        f"  p25 = {np.percentile(adapted, 25):.4f}"
    )
    print(
        f"  p50 = {np.percentile(adapted, 50):.4f}"
    )
    print(
        f"  p75 = {np.percentile(adapted, 75):.4f}"
    )

    # --------------------------------------------------
    # Center-crop inference
    # --------------------------------------------------

    probability = np.zeros(
        (height, width),
        dtype=np.float32,
    )

    weight = np.zeros(
        (height, width),
        dtype=np.float32,
    )

    xs = positions(width)
    ys = positions(height)

    total = len(xs) * len(ys)

    print(f"Tiles: {total}")

    count = 0

    for y in ys:

        for x in xs:

            tile = adapted[
                y:y + TILE_SIZE,
                x:x + TILE_SIZE,
            ]

            if tile.shape != (
                TILE_SIZE,
                TILE_SIZE,
            ):
                tile = np.pad(
                    tile,
                    (
                        (
                            0,
                            TILE_SIZE - tile.shape[0],
                        ),
                        (
                            0,
                            TILE_SIZE - tile.shape[1],
                        ),
                    ),
                    mode="reflect",
                )

            tile = match_channels(
                tile[..., None],
                3,
            )

            tensor = (
                torch.from_numpy(
                    np.ascontiguousarray(tile)
                )
                .permute(2, 0, 1)
                .float()
                .unsqueeze(0)
                .to(device)
            )

            with torch.no_grad():

                with torch.autocast(
                    device_type=device.type,
                    enabled=device.type == "cuda",
                ):
                    logits = model(tensor)

                pred = torch.sigmoid(
                    logits.float()
                )[0, 0].cpu().numpy()

            # --------------------------------------------------
            # Keep only trusted center
            # --------------------------------------------------

            y0 = CROP
            y1 = TILE_SIZE - CROP

            x0 = CROP
            x1 = TILE_SIZE - CROP

            trusted = pred[
                y0:y1,
                x0:x1,
            ]

            scene_y0 = y + CROP
            scene_y1 = min(
                y + TILE_SIZE - CROP,
                height,
            )

            scene_x0 = x + CROP
            scene_x1 = min(
                x + TILE_SIZE - CROP,
                width,
            )

            trusted = trusted[
                :scene_y1 - scene_y0,
                :scene_x1 - scene_x0,
            ]

            probability[
                scene_y0:scene_y1,
                scene_x0:scene_x1,
            ] += trusted

            weight[
                scene_y0:scene_y1,
                scene_x0:scene_x1,
            ] += 1.0

            count += 1

            if count % 50 == 0 or count == total:
                print(
                    f"    {count}/{total}",
                    flush=True,
                )

    probability /= np.maximum(
        weight,
        1e-8,
    )

    # --------------------------------------------------
    # Metrics
    # --------------------------------------------------

    pred_mask = probability >= THRESHOLD
    gt_mask = gt > 0

    tp = np.logical_and(
        pred_mask,
        gt_mask,
    ).sum()

    fp = np.logical_and(
        pred_mask,
        ~gt_mask,
    ).sum()

    fn = np.logical_and(
        ~pred_mask,
        gt_mask,
    ).sum()

    dice = (
        2 * tp /
        max(2 * tp + fp + fn, 1)
    )

    iou = (
        tp /
        max(tp + fp + fn, 1)
    )

    precision = (
        tp /
        max(tp + fp, 1)
    )

    recall = (
        tp /
        max(tp + fn, 1)
    )

    pixel_area_km2 = 0.01 / 1_000_000

    pred_area = (
        pred_mask.sum()
        * pixel_area_km2
    )

    gt_area = (
        gt_mask.sum()
        * pixel_area_km2
    )

    fp_area = (
        fp * pixel_area_km2
    )

    print()
    print("RESULT")
    print("-" * 80)
    print(f"Dice      : {dice:.4f}")
    print(f"IoU       : {iou:.4f}")
    print(f"Precision : {precision:.4f}")
    print(f"Recall    : {recall:.4f}")
    print(f"Pred area : {pred_area:.4f} km²")
    print(f"GT area   : {gt_area:.4f} km²")
    print(f"FP area   : {fp_area:.4f} km²")

    output_dir = Path(
        "outputs/histogram_adaptation"
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    output = (
        output_dir /
        f"{stem}_probability.npy"
    )

    np.save(
        output,
        probability,
    )

    print(f"Saved: {output}")

    return {
        "scene": stem,
        "dice": dice,
        "iou": iou,
        "precision": precision,
        "recall": recall,
        "pred_area": pred_area,
        "gt_area": gt_area,
        "fp_area": fp_area,
    }


def main():

    device = get_device()

    print("=" * 80)
    print("OSIRIS — HISTOGRAM DOMAIN ADAPTATION TEST")
    print("=" * 80)
    print(f"Device: {device}")

    reference = build_training_reference()

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

    model.load_state_dict(
        checkpoint["model"]
    )

    model.eval()

    results = []

    for image_path in sorted(
        IMAGE_DIR.glob("*.tif")
    ):

        result = run_scene(
            model=model,
            device=device,
            image_path=image_path,
            reference=reference,
        )

        results.append(result)

    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)

    print(
        f"{'Scene':<24}"
        f"{'Dice':>8}"
        f"{'IoU':>8}"
        f"{'Prec':>8}"
        f"{'Recall':>8}"
    )

    print("-" * 80)

    for result in results:

        print(
            f"{result['scene']:<24}"
            f"{result['dice']:>8.4f}"
            f"{result['iou']:>8.4f}"
            f"{result['precision']:>8.4f}"
            f"{result['recall']:>8.4f}"
        )


if __name__ == "__main__":
    main()
