from __future__ import annotations

from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np


class Sentinel1VVSigma0Calibration:
    """
    Sentinel-1 GRD VV calibration using the sigmaNought LUT
    contained in the product annotation/calibration XML.

    The calibration XML provides sigmaNought lookup values at
    sparse (azimuth line, range pixel) calibration points.

    For each image pixel we:
        1. interpolate the LUT in range
        2. interpolate between azimuth calibration vectors
        3. convert the measurement DN to sigma0
        4. convert sigma0 to dB
    """

    def __init__(self, calibration_xml: str | Path):
        self.path = Path(calibration_xml)

        if not self.path.exists():
            raise FileNotFoundError(self.path)

        self.lines: np.ndarray
        self.pixels: np.ndarray
        self.sigma_nought: np.ndarray

        self._load()

    def _load(self) -> None:
        root = ET.parse(self.path).getroot()

        vectors = root.findall(".//calibrationVector")

        if not vectors:
            raise ValueError(
                "No calibrationVector elements found."
            )

        lines = []
        pixels = []
        sigma_nought = []

        for vector in vectors:
            line = vector.findtext("line")
            pixel_node = vector.find("pixel")
            sigma_node = vector.find("sigmaNought")

            if line is None:
                raise ValueError(
                    "Calibration vector missing <line>."
                )

            if pixel_node is None:
                raise ValueError(
                    "Calibration vector missing <pixel>."
                )

            if sigma_node is None:
                raise ValueError(
                    "Calibration vector missing <sigmaNought>."
                )

            pixel_values = np.fromstring(
                pixel_node.text or "",
                sep=" ",
                dtype=np.float64,
            )

            sigma_values = np.fromstring(
                sigma_node.text or "",
                sep=" ",
                dtype=np.float64,
            )

            if len(pixel_values) != len(sigma_values):
                raise ValueError(
                    "Pixel and sigmaNought LUT lengths differ."
                )

            lines.append(float(line))
            pixels.append(pixel_values)
            sigma_nought.append(sigma_values)

        self.lines = np.asarray(lines, dtype=np.float64)
        self.pixels = np.asarray(pixels, dtype=np.float64)
        self.sigma_nought = np.asarray(
            sigma_nought,
            dtype=np.float64,
        )

        # Ensure azimuth vectors are ordered.
        order = np.argsort(self.lines)

        self.lines = self.lines[order]
        self.pixels = self.pixels[order]
        self.sigma_nought = self.sigma_nought[order]

        if self.pixels.ndim != 2:
            raise ValueError(
                "Unexpected calibration pixel array shape."
            )

        if self.sigma_nought.ndim != 2:
            raise ValueError(
                "Unexpected sigmaNought array shape."
            )

        if self.pixels.shape != self.sigma_nought.shape:
            raise ValueError(
                "Calibration LUT shape mismatch."
            )

    def calibration_factor(
        self,
        y_start: int,
        y_stop: int,
        x_start: int,
        x_stop: int,
    ) -> np.ndarray:
        """
        Return sigmaNought calibration factors for a raster window.

        Output shape:
            (y_stop-y_start, x_stop-x_start)
        """

        height = y_stop - y_start
        width = x_stop - x_start

        if height <= 0 or width <= 0:
            raise ValueError(
                "Invalid raster window."
            )

        ys = np.arange(
            y_start,
            y_stop,
            dtype=np.float64,
        )

        xs = np.arange(
            x_start,
            x_stop,
            dtype=np.float64,
        )

        # First interpolate each calibration vector along range.
        range_lut = np.empty(
            (len(self.lines), width),
            dtype=np.float64,
        )

        for i in range(len(self.lines)):
            range_lut[i] = np.interp(
                xs,
                self.pixels[i],
                self.sigma_nought[i],
            )

        # Then interpolate those values in azimuth.
        result = np.empty(
            (height, width),
            dtype=np.float64,
        )

        for x in range(width):
            result[:, x] = np.interp(
                ys,
                self.lines,
                range_lut[:, x],
            )

        return result

    def dn_to_sigma0(
        self,
        dn: np.ndarray,
        y_start: int,
        x_start: int,
    ) -> np.ndarray:
        """
        Convert a measurement window to sigma0 linear units.

        Sentinel-1 GRD calibration uses the sigmaNought LUT
        associated with the measurement pixels.

        Zero/nodata measurement pixels remain zero.
        """

        dn = np.asarray(
            dn,
            dtype=np.float64,
        )

        y_stop = y_start + dn.shape[0]
        x_stop = x_start + dn.shape[1]

        factor = self.calibration_factor(
            y_start,
            y_stop,
            x_start,
            x_stop,
        )

        sigma0 = np.zeros_like(
            dn,
            dtype=np.float64,
        )

        valid = (
            np.isfinite(dn)
            & (dn > 0)
            & np.isfinite(factor)
            & (factor > 0)
        )

        sigma0[valid] = (
            dn[valid] ** 2
        ) / (factor[valid] ** 2)

        return sigma0

    def dn_to_db(
        self,
        dn: np.ndarray,
        y_start: int,
        x_start: int,
    ) -> np.ndarray:
        """
        Convert a measurement window to Sigma0 VV dB.
        """

        sigma0 = self.dn_to_sigma0(
            dn,
            y_start,
            x_start,
        )

        db = np.full_like(
            sigma0,
            np.nan,
            dtype=np.float64,
        )

        valid = (
            np.isfinite(sigma0)
            & (sigma0 > 0)
        )

        db[valid] = (
            10.0 * np.log10(
                sigma0[valid]
            )
        )

        return db


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Inspect Sentinel-1 VV sigmaNought calibration."
    )

    parser.add_argument(
        "--xml",
        required=True,
    )

    args = parser.parse_args()

    calibration = Sentinel1VVSigma0Calibration(
        args.xml
    )

    print(
        f"Calibration XML : {calibration.path}"
    )
    print(
        f"Vectors         : {len(calibration.lines)}"
    )
    print(
        f"Range samples   : {calibration.pixels.shape[1]}"
    )
    print(
        f"Image line range: "
        f"{calibration.lines[0]:.0f} -> "
        f"{calibration.lines[-1]:.0f}"
    )
    print(
        f"Pixel range     : "
        f"{calibration.pixels[0, 0]:.0f} -> "
        f"{calibration.pixels[0, -1]:.0f}"
    )
    print(
        f"sigmaNought min : "
        f"{calibration.sigma_nought.min():.6g}"
    )
    print(
        f"sigmaNought max : "
        f"{calibration.sigma_nought.max():.6g}"
    )


if __name__ == "__main__":
    main()
