# Phase 4 / Experiment 004 — Partial Phase Region Swap

Standalone Python research prototype for FOURIER IMAGE LAB. It reads local
`Monkey.jpg` (A) and `Cat.jpg` (B), fixes A's Fourier magnitude, and substitutes
B's phase only at selected frequency positions. It does not add Experiment 004
to the website.

## Run

From the repository root, with Python 3.10 or newer:

```powershell
python -m pip install numpy opencv-python matplotlib
python prototypes/phase4/partial_phase_swap.py
```

The first command is unnecessary if those packages are already installed.
The script saves all results, then displays Matplotlib figures. For saving
without opening windows, and for individual experiments:

```powershell
python prototypes/phase4/partial_phase_swap.py --no-show
python prototypes/phase4/partial_phase_swap.py --experiment disk --no-show
python prototypes/phase4/partial_phase_swap.py --experiment quadrants --no-show
python prototypes/phase4/partial_phase_swap.py --experiment stripes --orientation both --no-show
```

Defaults are 1000 × 1000, all three experiments, and vertical stripes. Edit
`IMAGE_SIZE`, `DISK_CUTOFFS`, `STRIPE_WIDTHS`, `EXPERIMENT`, and `ORIENTATION` near
the beginning of the script. Disk radii are normalized frequencies; stripe widths
are integer frequency bins, so changing the image size changes their relative
frequency coverage. `--size` overrides the default size.

Images are located relative to the repository, regardless of the current working
directory. Place `Monkey.jpg` and `Cat.jpg` in the repository root, or use
`--input-a PATH --input-b PATH`. Missing or unreadable inputs stop with a clear
error; no substitute images are used. The existing local input files are read in
place, without making additional asset copies.

## Outputs

The default destination is `.qa/phase4/`, which the repository already ignores.
Use `--output-dir PATH` for a different destination. Use a separate output folder
for a different run if you want to retain both sets of results; each run replaces
matching filenames and its CSV/JSON summary. Local figures contain the input
photos and should remain local experimental records.

- `disk_overview.png`: four cutoffs, each with both originals, mask, reconstruction.
- `quadrants_overview.png`: the three quadrant configurations in the same format.
- `stripes_vertical_overview.png`: widths 5, 20, 50 with originals and masks.
- `stripes_vertical_comparison.png`: those three reconstructions side by side.
- Equivalent `stripes_horizontal_*.png` figures when horizontal stripes are selected.
- One 1000 × 1000 reconstructed PNG per configuration at the default size.
- `validation.csv`: one row per configuration with numerical checks.
- `summary.json`: the same results, run settings, package versions, input file
  hashes, and tolerances for reproducibility.

Black mask pixels mean A's phase; white pixels mean B's phase. `fftshift` is
applied only to the mask display. All Fourier calculations use native FFT indices.

## Mathematical conventions

For each OpenCV BGR channel, the script computes `fft2`, `abs`, and `angle`, then:

```python
mixed_phase = np.where(mask, phase_b, phase_a)
mixed_spectrum = magnitude_a * np.exp(1j * mixed_phase)
inverse = np.fft.ifft2(mixed_spectrum)
channel = inverse.real
```

All three floating channels are merged before the single display conversion
`np.uint8(np.clip(img_combined, 0, 255))`. No absolute-value reconstruction,
per-image normalization, brightness offset, or channel-by-channel clipping is
used. Display images convert BGR to RGB for Matplotlib. Preprocessing directly
resizes each image to a square with OpenCV's linear interpolation, matching the
original Python workflow; it does not use the website's center-crop pipeline.
These are Fourier experiments on decoded 8-bit pixel values, without linear-light
conversion.

**Disk:** the radius is `sqrt((u/N)**2 + (v/N)**2)` in cycles per pixel, where `u`
and `v` are signed integer FFT bins. Axis Nyquist is 0.5; the square corner radius
is approximately 0.7071. A cutoff of 0.30 is a radius of 300 bins at N=1000.
Cutoffs are inclusive: 0.01, 0.05, 0.15, 0.30.

**Quadrants:** upper/lower refer to the shifted display with image-style vertical
coordinates (negative v at the top). UL+LR and UR+LL use matching and opposite
strict signs, respectively. Both coordinate axes and, for even sizes, the entire
Nyquist row/column retain A's phase in all three configurations. The third mask
is the union of the first two, not a full swap. This explicit boundary policy
avoids ambiguous Nyquist signs and preserves conjugate pairing.

**Stripes:** `M = (abs(u) // width) % 2 == 0` for vertical stripes; horizontal uses
`v`. The central band selects B, including DC. Nyquist positions follow the same
rule. Integer bins are obtained with `rint(fftfreq(N) * N)` before floor division,
avoiding floating-point errors at band boundaries. Widths are 5, 20, 50 bins.
At N=1000, widths 5 and 50 select 50% of positions; width 20 selects 51.9% because
the finite grid does not contain a whole number of its alternating band pairs.
Their selected energy fractions also differ. These are not exactly matched-count
comparisons.

**Hermitian symmetry and zero phase:** partner indices are `(-arange(N)) % N`
in each dimension. A visual 180-degree flip is not the correct even-size pairing.
Before magnitude/phase extraction, each input spectrum is averaged with its
conjugate partner to remove floating FFT roundoff. This makes the self-conjugate
DC/Nyquist coefficients real and avoids amplifying unpaired tiny donor noise.
The source magnitude correction is recorded and must remain within the stated
numerical tolerances relative to the original FFT. The mixed spectrum is never
averaged or otherwise filtered. Phase is defined as 0 at exactly zero source or
donor coefficients; there is no threshold-based phase fallback or phase blending.

## Numerical validation

Every configuration stops on a failed check:

1. Boolean mask equals its exact modularly inverted partner.
2. `abs(mixed_spectrum)` agrees with A's magnitude using `rtol=1e-12`, `atol=1e-9`.
3. Maximum imaginary residual is at most `1e-10 * max(1, max(abs(real)))` per channel,
   checked before extracting the real part.

The table records maximum absolute magnitude error and error scaled per bin by
`max(1, magnitude_a)`, maximum absolute imaginary residual, selected-position
fraction, selected A-energy fraction, raw range, and fraction of channel samples
clipped for display. Energy is summed over all three channels and includes DC.
For an all-zero A, its energy fraction is undefined (`null` in JSON).

Selected-position fraction counts where B's phase is chosen; a selected phase
need not differ from A's phase. Selected-energy fraction weights the same positions
by A's squared magnitude. Neither metric measures perceptual similarity.

Additional small numerical checks can be run without the photographs:

```powershell
python prototypes/phase4/check_numerics.py
```

Measured results and the distinction between observations and predictions are in
[REPORT.md](REPORT.md). The historical Python script and all website files remain
outside this prototype's implementation.
