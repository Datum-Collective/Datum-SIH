from __future__ import annotations

from pathlib import Path

import numpy as np
import torch

# Allow imports of OSIRIS modules when this file is imported directly.
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

from models.unet import UNet
from data.preprocess import match_channels, normalize_sar
from utils import get_device


class OSIRISDetector:
    """
    GPU-backed OSIRIS inference wrapper.

    Input:
        H x W x C NumPy image

    Output:
        H x W NumPy array containing oil-spill probabilities in [0, 1].

    The model itself always operates on 256x256 tiles.
    """

    def __init__(
        self,
        checkpoint: str | Path | None = None,
        in_channels: int = 3,
        base_channels: int = 32,
        depth: int = 4,
        device: str | None = None,
    ):
        self.device = (
            torch.device(device)
            if device is not None
            else get_device()
        )

        self.model = UNet(
            in_channels=in_channels,
            base_channels=base_channels,
            depth=depth,
        ).to(self.device)

        if checkpoint is not None:
            self.load_checkpoint(checkpoint)

        self.model.eval()

    def load_checkpoint(self, checkpoint: str | Path) -> None:
        """
        Load an OSIRIS training checkpoint.
        """
        checkpoint = Path(checkpoint)

        if not checkpoint.exists():
            raise FileNotFoundError(
                f"OSIRIS checkpoint not found: {checkpoint}"
            )

        checkpoint_data = torch.load(
            checkpoint,
            map_location=self.device,
            weights_only=False,
        )

        self.model.load_state_dict(checkpoint_data["model"])
        self.model.eval()

    @torch.no_grad()
    def predict_tile(
        self,
        image: np.ndarray,
    ) -> np.ndarray:
        """
        Run OSIRIS on one 256x256 tile.

        Parameters
        ----------
        image:
            H x W x C NumPy array.

        Returns
        -------
        np.ndarray
            H x W probability map.
        """
        if image.ndim == 2:
            image = image[..., None]

        image = normalize_sar(image)
        image = match_channels(image, 3)

        if image.shape[:2] != (256, 256):
            raise ValueError(
                "OSIRIS tiles must be exactly 256x256. "
                f"Received {image.shape[:2]}."
            )

        tensor = torch.from_numpy(
            np.ascontiguousarray(image)
        ).permute(2, 0, 1).float().unsqueeze(0)

        tensor = tensor.to(self.device, non_blocking=True)

        use_amp = self.device.type == "cuda"

        with torch.autocast(
            device_type=self.device.type,
            enabled=use_amp,
        ):
            logits = self.model(tensor)

        probability = torch.sigmoid(logits.float())

        return (
            probability
            .squeeze(0)
            .squeeze(0)
            .cpu()
            .numpy()
            .astype(np.float32)
        )

    @torch.no_grad()
    def predict_batch(
        self,
        images: np.ndarray,
    ) -> np.ndarray:
        """
        Run OSIRIS on a batch of 256x256 tiles.

        Parameters
        ----------
        images:
            N x H x W x C NumPy array.

        Returns
        -------
        np.ndarray
            N x H x W probability maps.
        """
        if images.ndim == 3:
            images = images[..., None]

        if images.shape[1:3] != (256, 256):
            raise ValueError(
                "OSIRIS tiles must be exactly 256x256. "
                f"Received {images.shape[1:3]}."
            )

        processed = []

        for image in images:
            image = normalize_sar(image)
            image = match_channels(image, 3)
            processed.append(image)

        batch = np.stack(processed, axis=0)

        tensor = torch.from_numpy(
            np.ascontiguousarray(batch)
        ).permute(0, 3, 1, 2).float()

        tensor = tensor.to(self.device, non_blocking=True)

        use_amp = self.device.type == "cuda"

        with torch.autocast(
            device_type=self.device.type,
            enabled=use_amp,
        ):
            logits = self.model(tensor)

        probabilities = torch.sigmoid(logits.float())

        return (
            probabilities
            .squeeze(1)
            .cpu()
            .numpy()
            .astype(np.float32)
        )
