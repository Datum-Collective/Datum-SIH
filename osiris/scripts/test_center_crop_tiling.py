from pathlib import Path

import cv2
import numpy as np
import torch
import rasterio

from models.unet import UNet
from data.preprocess import normalize_sar, match_channels
from utils import get_device


CHECKPOINT = "checkpoints/best.pt"

IMAGE = "data/real_test/test/images/2018_12_19_f_.tif"
MASK = "data/real_test/test/masks/2018_12_19_f_.tif"

TILE_SIZE = 256
CROP = 64
STRIDE = TILE_SIZE - 2 * CROP

THRESHOLD = 0.99


def positions(length):
    values = list(range(0, max(length - TILE_SIZE, 0) + 1, STRIDE))

    final = length - TILE_SIZE

    if not values or values[-1] != final:
        values.append(final)

    return sorted(set(values))


def main():

    device = get_device()

    print("=" * 80)
    print("OSIRIS — CENTER-CROP TILING EXPERIMENT")
    print("=" * 80)

    print(f"Device: {device}")
    print(f"Tile size: {TILE_SIZE}")
    print(f"Border discarded: {CROP}px")
    print(f"Trusted center: {TILE_SIZE - 2 * CROP}px")
    print(f"Stride: {STRIDE}px")

    with rasterio.open(IMAGE) as src:
        scene = src.read(1).astype(np.float32)

    with rasterio.open(MASK) as src:
        gt = src.read(1)

    height, width = scene.shape

    print(f"Scene shape: {scene.shape}")

    # Global normalization, same as our successful experiment.
    p1 = np.percentile(scene, 1)
    p99 = np.percentile(scene, 99)

    print(f"Global P1 : {p1}")
    print(f"Global P99: {p99}")

    normalized = np.clip(
        (scene - p1) / (p99 - p1 + 1e-8),
        0.0,
        1.0,
    )

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

    probability = np.zeros((height, width), dtype=np.float32)
    weight = np.zeros((height, width), dtype=np.float32)

    xs = positions(width)
    ys = positions(height)

    total = len(xs) * len(ys)

    print(f"X positions: {len(xs)}")
    print(f"Y positions: {len(ys)}")
    print(f"Total tiles: {total}")
    print()

    count = 0

    for y in ys:

        for x in xs:

            tile = normalized[
                y:y + TILE_SIZE,
                x:x + TILE_SIZE,
            ]

            if tile.shape != (TILE_SIZE, TILE_SIZE):
                padded = np.pad(
                    tile,
                    (
                        (0, TILE_SIZE - tile.shape[0]),
                        (0, TILE_SIZE - tile.shape[1]),
                    ),
                    mode="reflect",
                )

                tile = padded

            tile = match_channels(tile[..., None], 3)

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

            # Only trust the center of the prediction.
            y0 = CROP
            y1 = TILE_SIZE - CROP
            x0 = CROP
            x1 = TILE_SIZE - CROP

            trusted = pred[y0:y1, x0:x1]

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

            if count % 25 == 0 or count == total:
                print(
                    f"    {count}/{total} tiles",
                    flush=True,
                )

    probability /= np.maximum(weight, 1e-8)

    # Evaluate.
    pred_mask = probability >= THRESHOLD
    gt_mask = gt > 0

    tp = np.logical_and(pred_mask, gt_mask).sum()
    fp = np.logical_and(pred_mask, ~gt_mask).sum()
    fn = np.logical_and(~pred_mask, gt_mask).sum()

    dice = (2 * tp) / max(
        2 * tp + fp + fn,
        1,
    )

    iou = tp / max(
        tp + fp + fn,
        1,
    )

    precision = tp / max(
        tp + fp,
        1,
    )

    recall = tp / max(
        tp + fn,
        1,
    )

    print()
    print("=" * 80)
    print("RESULT")
    print("=" * 80)

    print(f"Threshold : {THRESHOLD}")
    print(f"Dice      : {dice:.4f}")
    print(f"IoU       : {iou:.4f}")
    print(f"Precision : {precision:.4f}")
    print(f"Recall    : {recall:.4f}")

    pixel_area_km2 = 0.01 / 1_000_000

    pred_area = pred_mask.sum() * pixel_area_km2
    gt_area = gt_mask.sum() * pixel_area_km2
    fp_area = fp * pixel_area_km2

    print(f"Pred area : {pred_area:.4f} km²")
    print(f"GT area   : {gt_area:.4f} km²")
    print(f"FP area   : {fp_area:.4f} km²")

    output = Path(
        "outputs/center_crop_tiling_2018_12_19_f_.npy"
    )

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    np.save(output, probability)

    print()
    print(f"Saved probability map: {output}")


if __name__ == "__main__":
    main()
