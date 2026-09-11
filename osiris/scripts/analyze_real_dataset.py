from pathlib import Path

import cv2
import numpy as np
import rasterio


IMAGE_DIR = Path("data/real_test/test/images")
MASK_DIR = Path("data/real_test/test/masks")


def main():

    print("=" * 100)
    print("OSIRIS — REAL SENTINEL-1 DATASET ANALYSIS")
    print("=" * 100)

    all_oil_pixels = 0
    all_pixels = 0

    for image_path in sorted(IMAGE_DIR.glob("*.tif")):

        mask_path = MASK_DIR / image_path.name

        with rasterio.open(image_path) as image_src:
            image = image_src.read(1)
            transform = image_src.transform
            crs = image_src.crs
            bounds = image_src.bounds
            resolution_x = abs(transform.a)
            resolution_y = abs(transform.e)

        with rasterio.open(mask_path) as mask_src:
            mask = mask_src.read(1)

        mask = mask > 0

        height, width = mask.shape

        total_pixels = mask.size
        oil_pixels = int(mask.sum())
        ocean_pixels = total_pixels - oil_pixels

        oil_percentage = (
            100.0 * oil_pixels / total_pixels
        )

        pixel_area_m2 = (
            resolution_x *
            resolution_y
        )

        total_area_km2 = (
            total_pixels *
            pixel_area_m2 /
            1_000_000
        )

        oil_area_km2 = (
            oil_pixels *
            pixel_area_m2 /
            1_000_000
        )

        # Connected components in the GT mask.
        num_labels, labels, stats, centroids = (
            cv2.connectedComponentsWithStats(
                mask.astype(np.uint8),
                connectivity=8,
            )
        )

        component_areas = (
            stats[1:, cv2.CC_STAT_AREA]
            if num_labels > 1
            else np.array([], dtype=np.int32)
        )

        component_areas = np.sort(
            component_areas
        )[::-1]

        largest_component = (
            int(component_areas[0])
            if component_areas.size
            else 0
        )

        # Number of components above useful size thresholds.
        n_10 = int(
            np.sum(component_areas >= 10)
        )

        n_100 = int(
            np.sum(component_areas >= 100)
        )

        n_1000 = int(
            np.sum(component_areas >= 1000)
        )

        # Does oil touch any scene edge?
        touches_top = bool(mask[0, :].any())
        touches_bottom = bool(mask[-1, :].any())
        touches_left = bool(mask[:, 0].any())
        touches_right = bool(mask[:, -1].any())

        touches_edge = (
            touches_top
            or touches_bottom
            or touches_left
            or touches_right
        )

        all_oil_pixels += oil_pixels
        all_pixels += total_pixels

        print()
        print("=" * 100)
        print(f"SCENE: {image_path.name}")
        print("=" * 100)

        print(f"Shape              : {height} x {width}")
        print(
            f"Resolution         : "
            f"{resolution_x:.2f} m x "
            f"{resolution_y:.2f} m"
        )
        print(f"CRS                : {crs}")
        print()
        print(
            f"Total pixels       : {total_pixels:,}"
        )
        print(
            f"Oil pixels         : {oil_pixels:,}"
        )
        print(
            f"Non-oil pixels     : {ocean_pixels:,}"
        )
        print(
            f"Oil percentage     : {oil_percentage:.4f}%"
        )
        print()
        print(
            f"Scene area         : "
            f"{total_area_km2:.4f} km²"
        )
        print(
            f"Oil area           : "
            f"{oil_area_km2:.4f} km²"
        )
        print()
        print(
            f"GT components      : "
            f"{len(component_areas):,}"
        )
        print(
            f"Components >=10px  : "
            f"{n_10:,}"
        )
        print(
            f"Components >=100px : "
            f"{n_100:,}"
        )
        print(
            f"Components >=1000px: "
            f"{n_1000:,}"
        )
        print(
            f"Largest component  : "
            f"{largest_component:,} px"
        )
        print(
            f"Oil touches edge   : "
            f"{touches_edge}"
        )

        if component_areas.size:

            print()
            print("Largest GT components:")

            for index, area in enumerate(
                component_areas[:10],
                start=1,
            ):

                area_km2 = (
                    area *
                    pixel_area_m2 /
                    1_000_000
                )

                print(
                    f"  {index:2d}. "
                    f"{area:10,} px"
                    f"  ({area_km2:.4f} km²)"
                )

    print()
    print("=" * 100)
    print("DATASET TOTAL")
    print("=" * 100)

    print(
        f"Total pixels : {all_pixels:,}"
    )

    print(
        f"Oil pixels   : {all_oil_pixels:,}"
    )

    print(
        f"Oil fraction : "
        f"{100.0 * all_oil_pixels / all_pixels:.4f}%"
    )


if __name__ == "__main__":
    main()
