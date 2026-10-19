"""Phase 4 / Experiment 004: standalone Partial Phase Region Swap prototype.

Run from any directory: python prototypes/phase4/partial_phase_swap.py --no-show
Only NumPy, OpenCV, and Matplotlib are required. No website files are used.
"""

import argparse
import csv
import hashlib
import json
from pathlib import Path

import cv2
import matplotlib
import numpy as np


# Experiment parameters: edit these together for comparable runs.
REPO_ROOT = Path(__file__).resolve().parents[2]
IMAGE_A = REPO_ROOT / "Monkey.jpg"
IMAGE_B = REPO_ROOT / "Cat.jpg"
IMAGE_SIZE = 1000
EXPERIMENT = "all"  # all, disk, quadrants, stripes
ORIENTATION = "vertical"  # vertical, horizontal, both (stripes only)
DISK_CUTOFFS = (0.01, 0.05, 0.15, 0.30)
STRIPE_WIDTHS = (5, 20, 50)  # integer frequency bins, NOT spatial pixels
OUTPUT_DIR = REPO_ROOT / ".qa" / "phase4"  # already ignored by this repository
FIGURE_DPI = 160
MAGNITUDE_RTOL = 1e-12
MAGNITUDE_ATOL = 1e-9
IMAGINARY_RTOL = 1e-10  # relative to max(1, max absolute real reconstruction)


def make_masks(size, experiment="all", orientation="vertical"):
    """Return (group, filename, label, binary mask) in native FFT ordering."""
    if size < 2:
        raise ValueError("Image size must be at least 2.")
    if experiment not in ("all", "disk", "quadrants", "stripes"):
        raise ValueError(f"Unknown experiment: {experiment}")
    if orientation not in ("vertical", "horizontal", "both"):
        raise ValueError(f"Unknown stripe orientation: {orientation}")
    # Round first: fftfreq(N)*N can be just below an integer, which would put
    # stripe boundaries into the wrong band when floor division is applied.
    bins = np.rint(np.fft.fftfreq(size) * size).astype(np.int64)
    u, v = np.meshgrid(bins, bins)
    masks = []

    if experiment in ("all", "disk"):
        # Normalized radius = sqrt((u/N)^2 + (v/N)^2), in cycles/pixel.
        # DC = 0, axial Nyquist = 0.5, corner Nyquist = sqrt(0.5).
        # Thus cutoff 0.30 means a radius of 300 bins when N = 1000.
        radius = np.hypot(u / size, v / size)
        for cutoff in DISK_CUTOFFS:
            if not np.isfinite(cutoff) or cutoff < 0:
                raise ValueError("Disk cutoffs must be finite and nonnegative.")
            masks.append(("disk", f"disk_{cutoff:.2f}",
                          f"Low-frequency disk | radius <= {cutoff:.2f}",
                          radius <= cutoff))

    if experiment in ("all", "quadrants"):
        # imshow(origin='upper'): negative v is the upper half after fftshift.
        # Keep coordinate axes AND even-N Nyquist row/column on A's phase.
        # A Nyquist coordinate maps to itself, not to a positive counterpart;
        # excluding these lines avoids the strict-sign quadrant ambiguity.
        interior = (u != 0) & (v != 0)
        if size % 2 == 0:
            interior &= (np.abs(u) != size // 2) & (np.abs(v) != size // 2)
        same_sign = (u < 0) == (v < 0)
        masks.extend([
            ("quadrants", "quadrants_ul_lr", "Upper left + lower right",
             interior & same_sign),
            ("quadrants", "quadrants_ur_ll", "Upper right + lower left",
             interior & ~same_sign),
            ("quadrants", "quadrants_both", "Both pairs | boundary lines stay A",
             interior),
        ])

    if experiment in ("all", "stripes"):
        directions = ("vertical", "horizontal") if orientation == "both" else (orientation,)
        for direction in directions:
            coordinate = u if direction == "vertical" else v
            for width in STRIPE_WIDTHS:
                if not isinstance(width, int) or width <= 0:
                    raise ValueError("Stripe widths must be positive integer bins.")
                mask = (np.abs(coordinate) // width) % 2 == 0
                masks.append((f"stripes_{direction}", f"stripes_{direction}_{width}",
                              f"{direction.capitalize()} stripes | width {width} bins", mask))
    return masks


def prepare_spectra(image_a, image_b):
    """Split BGR inputs and compute each channel's FFT, magnitude, and phase."""
    size = image_a.shape[0]
    partner = (-np.arange(size)) % size
    magnitudes_a, phases_a, phases_b = [], [], []
    correction_max = 0.0
    for channel_a, channel_b in zip(cv2.split(image_a), cv2.split(image_b)):
        f_a = np.fft.fft2(channel_a)
        f_b = np.fft.fft2(channel_b)
        original_magnitude_a = np.abs(f_a)
        # Remove only floating FFT roundoff in conjugate pairs. This also
        # makes self-conjugate DC/Nyquist coefficients explicitly real.
        # Exact-zero donor phases are assigned 0 consistently in both bins.
        # There is no near-zero threshold or data-dependent spectrum filter.
        f_a = (f_a + np.conj(f_a[np.ix_(partner, partner)])) / 2
        f_b = (f_b + np.conj(f_b[np.ix_(partner, partner)])) / 2
        magnitude_a = np.abs(f_a)
        correction_max = max(correction_max,
                             float(np.max(np.abs(magnitude_a - original_magnitude_a))))
        if not np.allclose(magnitude_a, original_magnitude_a,
                           rtol=MAGNITUDE_RTOL, atol=MAGNITUDE_ATOL):
            raise RuntimeError("Source FFT symmetry correction exceeded numerical precision.")
        magnitudes_a.append(magnitude_a)
        phases_a.append(np.where(magnitude_a == 0, 0.0, np.angle(f_a)))
        phases_b.append(np.where(np.abs(f_b) == 0, 0.0, np.angle(f_b)))
    return magnitudes_a, phases_a, phases_b, correction_max


def reconstruct(magnitudes_a, phases_a, phases_b, mask):
    """Return the UNCLIPPED floating BGR reconstruction and numerical checks."""
    partner = (-np.arange(mask.shape[0])) % mask.shape[0]
    symmetric = mask.dtype == np.bool_ and np.array_equal(
        mask, mask[np.ix_(partner, partner)])
    if not symmetric:
        raise ValueError("Mask must be binary and obey M[k,l] = M[-k mod N,-l mod N].")

    channels = []
    max_imaginary = 0.0
    max_magnitude_error = 0.0
    max_scaled_magnitude_error = 0.0
    selected_energy = 0.0
    total_energy = 0.0
    for magnitude_a, phase_a, phase_b in zip(magnitudes_a, phases_a, phases_b):
        mixed_phase = np.where(mask, phase_b, phase_a)
        mixed_spectrum = magnitude_a * np.exp(1j * mixed_phase)
        magnitude_error = np.abs(np.abs(mixed_spectrum) - magnitude_a)
        magnitude_ok = np.allclose(np.abs(mixed_spectrum), magnitude_a,
                                   rtol=MAGNITUDE_RTOL, atol=MAGNITUDE_ATOL)
        if not magnitude_ok:
            raise RuntimeError("Mixed magnitude differs from Image A's magnitude.")
        max_magnitude_error = max(max_magnitude_error, float(magnitude_error.max()))
        max_scaled_magnitude_error = max(max_scaled_magnitude_error, float(
            np.max(magnitude_error / np.maximum(1.0, magnitude_a))))

        inverse = np.fft.ifft2(mixed_spectrum)
        residual = float(np.max(np.abs(inverse.imag)))
        scale = max(1.0, float(np.max(np.abs(inverse.real))))
        if residual > IMAGINARY_RTOL * scale:
            raise RuntimeError(f"Non-negligible imaginary residual: {residual:.3e}.")
        max_imaginary = max(max_imaginary, residual)
        channels.append(inverse.real)  # Never abs(IFFT); retain negative values.
        energy = magnitude_a ** 2
        selected_energy += float(energy[mask].sum())
        total_energy += float(energy.sum())

    img_combined = cv2.merge(channels)
    checks = {
        "mask_symmetric": bool(symmetric),
        "selected_fraction": float(mask.mean()),
        # null means undefined for an all-zero A, not a measured zero fraction.
        "energy_fraction": selected_energy / total_energy if total_energy else None,
        "max_imaginary_residual": max_imaginary,
        "max_magnitude_error": max_magnitude_error,
        "max_scaled_magnitude_error": max_scaled_magnitude_error,
        "raw_min": float(img_combined.min()),
        "raw_max": float(img_combined.max()),
        "clipped_channel_fraction": float(np.mean((img_combined < 0) | (img_combined > 255))),
        "validation_passed": True,
    }
    return img_combined, checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--experiment", choices=("all", "disk", "quadrants", "stripes"),
                        default=EXPERIMENT)
    parser.add_argument("--orientation", choices=("vertical", "horizontal", "both"),
                        default=ORIENTATION)
    parser.add_argument("--input-a", type=Path, default=IMAGE_A)
    parser.add_argument("--input-b", type=Path, default=IMAGE_B)
    parser.add_argument("--size", type=int, default=IMAGE_SIZE)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--no-show", action="store_true", help="Save figures without GUI windows.")
    args = parser.parse_args()
    if args.no_show:
        matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    masks = make_masks(args.size, args.experiment, args.orientation)
    images = []
    for name, path in (("A (Monkey)", args.input_a), ("B (Cat)", args.input_b)):
        if not path.is_file():
            raise FileNotFoundError(
                f"Image {name} is missing: {path.resolve()}\n"
                f"Place Monkey.jpg and Cat.jpg in {REPO_ROOT}, "
                "or provide --input-a and --input-b. No substitute images are used.")
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError(f"OpenCV could not decode Image {name}: {path.resolve()}")
        # Match the original prototype: directly resize, without center cropping.
        images.append(cv2.resize(image, (args.size, args.size), interpolation=cv2.INTER_LINEAR))
    image_a, image_b = images
    originals_rgb = [cv2.cvtColor(image, cv2.COLOR_BGR2RGB) for image in images]
    magnitudes_a, phases_a, phases_b, correction = prepare_spectra(image_a, image_b)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    records, groups = [], {}
    print("M=0: A / Monkey phase; M=1: B / Cat phase; magnitude always from A.")
    print("Position fraction and A-energy fraction are different quantities.")
    for group, name, label, mask in masks:
        raw_bgr, checks = reconstruct(magnitudes_a, phases_a, phases_b, mask)
        # Clip ONLY after all three floating channels have been merged.
        display_bgr = np.uint8(np.clip(raw_bgr, 0, 255))
        display_rgb = cv2.cvtColor(display_bgr, cv2.COLOR_BGR2RGB)
        record = {"configuration": name, **checks}
        records.append(record)
        groups.setdefault(group, []).append((label, mask, display_rgb, checks))
        output_path = args.output_dir / f"{name}.png"
        if not cv2.imwrite(str(output_path), display_bgr):
            raise OSError(f"Could not save reconstructed image: {output_path}")
        energy_text = "undefined" if checks["energy_fraction"] is None else f'{checks["energy_fraction"]:.6%}'
        print(f'{name}: positions={checks["selected_fraction"]:.4%}, '
              f'energy={energy_text}, imag={checks["max_imaginary_residual"]:.3e}, '
              f'magnitude error={checks["max_magnitude_error"]:.3e}, PASS')

    figure_files = []
    for group, rows in groups.items():
        fig, axes = plt.subplots(len(rows), 4, figsize=(16, 4 * len(rows)), squeeze=False,
                                 layout="constrained")
        fig.suptitle(f"Phase 4 / Experiment 004 | {group.replace('_', ' ')}\n"
                     "A magnitude fixed | black mask = A phase | white mask = B phase",
                     fontsize=15)
        for row_axes, (label, mask, output, checks) in zip(axes, rows):
            for axis, original, title in zip(row_axes[:2], originals_rgb,
                                            ("Image A | Monkey", "Image B | Cat")):
                axis.imshow(original, interpolation="nearest")
                axis.set_title(title)
            row_axes[2].imshow(np.fft.fftshift(mask), cmap="gray", vmin=0, vmax=1,
                               origin="upper", interpolation="nearest")
            row_axes[2].set_title(label, fontsize=10)
            row_axes[3].imshow(output, interpolation="nearest")
            energy = checks["energy_fraction"]
            energy_text = "undefined" if energy is None else f"{energy:.2%}"
            row_axes[3].set_title(f'Positions {checks["selected_fraction"]:.2%} | '
                                  f'A energy {energy_text}', fontsize=10)
            for axis in row_axes:
                axis.set_axis_off()
        filename = f"{group}_overview.png"
        fig.savefig(args.output_dir / filename, dpi=FIGURE_DPI)
        figure_files.append(filename)
        if args.no_show:
            plt.close(fig)

        if group.startswith("stripes_"):
            fig, axes = plt.subplots(1, len(rows), figsize=(5 * len(rows), 5.6),
                                     squeeze=False, layout="constrained")
            fig.suptitle(f"Periodic phase stripes | {group.removeprefix('stripes_')}\n"
                         "Same A magnitude and display scale | widths in frequency bins")
            for axis, (label, _, output, _) in zip(axes[0], rows):
                axis.imshow(output, interpolation="nearest")
                axis.set_title(label, fontsize=11)
                axis.set_axis_off()
            filename = f"{group}_comparison.png"
            fig.savefig(args.output_dir / filename, dpi=FIGURE_DPI)
            figure_files.append(filename)
            if args.no_show:
                plt.close(fig)

    with (args.output_dir / "validation.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)
    summary = {
        "phase": 4, "experiment": "Partial Phase Region Swap", "size": args.size,
        "selection": args.experiment, "orientation": args.orientation,
        "disk_cutoffs": list(DISK_CUTOFFS), "stripe_widths": list(STRIPE_WIDTHS),
        "disk_radius_convention": "cycles/pixel; axial Nyquist = 0.5",
        "quadrant_boundary_policy": "retain A on DC axes and even-size Nyquist lines",
        "inputs": [{"path": str(path.resolve()), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                   for path in (args.input_a, args.input_b)],
        "versions": {"numpy": np.__version__, "opencv": cv2.__version__,
                     "matplotlib": matplotlib.__version__},
        "source_magnitude_symmetry_correction_max": correction,
        "tolerances": {"magnitude_rtol": MAGNITUDE_RTOL, "magnitude_atol": MAGNITUDE_ATOL,
                       "imaginary_rtol": IMAGINARY_RTOL},
        "figures": figure_files, "results": records,
    }
    (args.output_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Saved figures, reconstructed PNGs, validation.csv, and summary.json to {args.output_dir.resolve()}")
    if not args.no_show:
        plt.show()


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, cv2.error) as error:
        raise SystemExit(f"Phase 4 prototype: {error}") from error
