# Phase 4 / Experiment 004 — Prototype results

Run date: 2026-10-19. These are measurements from the available local Monkey/Cat
photographs, not predictions or results from substitute images.

## Scope and reproduction

Inspection of the local repository found Experiment 001, Spectrum Lab, and
Gaussian Filtering implementations, plus the original RGB Python script. This
prototype adds a separate Python experiment; it does not infer the deployment
status of those local files. No website source, navigation, GitHub Pages settings,
historical Python script, or input photographs were edited. No merge, push, or
deployment was performed. The two input photographs were already tracked in this
checkout; the prototype reads them in place and creates no new website assets.

The complete comparison run was:

```powershell
python prototypes/phase4/partial_phase_swap.py --no-show --orientation both
python prototypes/phase4/check_numerics.py
```

Both inputs were directly resized to 1000 × 1000 using OpenCV linear
interpolation. Channels were processed independently in BGR order and converted
to RGB for Matplotlib. NumPy 2.2.6, OpenCV 4.12.0, Matplotlib 3.9.0 were used.
Input hashes, run settings, tolerances, and full numeric precision are saved in
[summary.json](../../.qa/phase4/summary.json); per-configuration measurements are in
[validation.csv](../../.qa/phase4/validation.csv). These generated records and
figures are local, ignored files. Regenerate them with the command above when
using another checkout.

## Measured validation

All 13 configurations passed exact modular mask symmetry, per-bin magnitude
agreement, and the imaginary-residual check before real-part extraction.

| Check across the 13 configurations | Largest measured value |
|---|---:|
| Maximum absolute imaginary residual | 9.095 × 10⁻¹⁴ |
| Maximum absolute mixed-magnitude error | 1.863 × 10⁻⁹ |
| Magnitude error divided per bin by max(1, A magnitude) | 3.964 × 10⁻¹⁶ |
| Input A magnitude change from FFT roundoff symmetry correction | 7.451 × 10⁻⁹ |

Magnitude agreement uses `rtol=1e-12`, `atol=1e-9` together, not an absolute-only
1e-9 bound. The source symmetry correction was separately checked against the
uncorrected FFT magnitude under the same tolerances. It changes no magnitude at
meaningful precision. No projection is applied to the mixed spectrum.

The standalone numerical check also exercises small odd/even grids, integer
stripe boundaries, explicit DC/Nyquist behavior, empty/full masks, an independent
re-FFT of the returned real image, constant/alternating donors with exactly zero
coefficients, preservation of negative and above-255 reconstruction samples, and
undefined energy for an all-zero source. The missing-input command was checked:
it stops and names the missing path and expected image location.

## Position counts versus selected energy

Energy is the sum of A's squared Fourier magnitude over all three channels,
including DC. A selected position uses B's phase; selection does not imply that
the two phases differ at that position. Energy fraction is not the fraction of
visual information transferred.

| Configuration | Selected positions | Selected A energy |
|---|---:|---:|
| Disk 0.01 | 0.0317% | 95.4239% |
| Disk 0.05 | 0.7845% | 98.2074% |
| Disk 0.15 | 7.0681% | 99.2828% |
| Disk 0.30 | 28.2697% | 99.7357% |
| Upper left + lower right | 49.8002% | 5.3188% |
| Upper right + lower left | 49.8002% | 4.1458% |
| Both quadrant pairs | 99.6004% | 9.4645% |
| Vertical stripes, width 5 | 50.0000% | 97.3698% |
| Vertical stripes, width 20 | 51.9000% | 98.8475% |
| Vertical stripes, width 50 | 50.0000% | 99.3658% |
| Horizontal stripes, width 5 | 50.0000% | 95.9441% |
| Horizontal stripes, width 20 | 51.9000% | 98.4361% |
| Horizontal stripes, width 50 | 50.0000% | 99.0694% |

The disk radius is in cycles/pixel, with axial Nyquist at 0.5. All quadrants
exclude coordinate axes and even-size Nyquist lines. Only 0.3996% of positions lie
on those retained boundary lines, but they contain 90.5355% of A's total energy
in this image. DC and the strong axial content therefore make the quadrant
energy figures very different from the disk and stripe figures. A future
non-DC-energy diagnostic would help interpret structural changes, while retaining
the requested total-energy metric.

Width 20 does not divide the finite grid into an equal number of selected and
unselected bands: its position fraction is 51.9%, not 50%. Consequently, the
stripe comparison changes band geometry, central-band extent, selected energy,
and slightly the selected count together. It is not a pure matched-energy or
matched-count test of periodicity alone.

## Observations from the generated figures

**Low-frequency disks:** at radius 0.01, the monkey, car wheel, and rail remain
recognizable, with broad colored overlays. At 0.05 the cat's outline begins to
emerge among the monkey image's texture. At 0.15 and 0.30 the cat's head, body,
and paw contours are much clearer; residual monkey-scene texture remains.
The change between 0.15 and 0.30 appears smaller than between 0.01 and 0.05 in
these displays. This is a visual observation from one image pair, not a general
perceptual threshold.

[Open disk originals, masks, and reconstructions](../../.qa/phase4/disk_overview.png).

**Quadrant pairs:** each pair gives a different directional, streaked mixture
with substantial recognizable monkey-scene structure. Combining both pairs
makes the cat more recognizable, but the car wheel and other A-scene components
remain visible. Even 99.6004% selected positions does not equal a full phase
swap: axes and Nyquist lines still use A. The large retained boundary energy is
consistent with the substantial residual A structure, without proving a simple
causal mapping between energy percentage and recognition.

[Open quadrant originals, masks, and reconstructions](../../.qa/phase4/quadrants_overview.png).

**Periodic stripes:** the cat's body and paws are visible at all three widths,
with Monkey-scene components superimposed. Width 5 has conspicuous ghosted
overlays and displaced-looking edges; widths 20 and 50 give a more coherent cat
outline in this pair. Changing orientation changes the directional artifacts:
vertical-mask results have visible lateral overlays, while horizontal-mask
results show stronger horizontal bands and vertically superimposed structure.
The photographs do not demonstrate clean, equally spaced copies of a whole
object. No displacement spacing, repeat period, or quantitative recognition
score was measured, so those stronger claims are not established.

[Open vertical comparison](../../.qa/phase4/stripes_vertical_comparison.png) ·
[Open horizontal comparison](../../.qa/phase4/stripes_horizontal_comparison.png) ·
[Open vertical masks and originals](../../.qa/phase4/stripes_vertical_overview.png) ·
[Open horizontal masks and originals](../../.qa/phase4/stripes_horizontal_overview.png).

All observations refer to the same final clip-to-0–255 display rule. Raw
reconstructions contain negative values and overshoots; approximately 1.25–1.92%
of channel samples were clipped across these configurations. The displayed PNGs
therefore do not themselves preserve the exact Fourier magnitude. Validation
uses the floating spectrum before clipping; neither normalization nor extra
contrast adjustment was used to improve the figures.

## Theory and next comparisons

The following is a mathematical interpretation, not an additional measured
result. With `I_full` reconstructed from all of B's phase and A's magnitude,
the binary-mask identity gives

`I_mix = I_A + ifft2(M) circular-convolved with (I_full - I_A)`.

A vertical frequency mask depends only on horizontal frequency, so its spatial
kernel acts along x; the horizontal mask acts along y. A banded mask can have
oscillatory sidelobes and thus motivate a ghosting/repetition hypothesis. Finite
grid boundaries, band parity, the even absolute-frequency convention, and the
images themselves determine the actual response. A formula such as `N/(2*width)`
should not be reported as a measured replica spacing for these photographs.

For an eventual Experiment 004, retain:

1. **Periodic stripes as the main experiment:** width control, vertical/horizontal
   choice, visible mask, and both selected-position and selected-energy metrics.
   The three tested widths provide useful initial comparisons, subject to their
   unequal counts and energy. Keep the grid size and frequency units explicit.
2. **Low-frequency disk as the explanatory baseline:** a simple cutoff control
   makes the emergence of B's larger structures easy to inspect in this pair.
3. **Quadrant pairs as a secondary comparison:** they expose directional effects
   and the consequences of retained axes. Display the boundary policy explicitly.

Most useful additional geometries to investigate next, without implementing them
here, are an **annulus** to separate middle-frequency phase from low-frequency
phase, a **high-frequency complement to the disk** as a controlled radial comparison, and
a **diagonal strip** to compare a single directional region with periodic bands.
Matched selections near 25% of positions would make geometry comparisons more
controlled; count conjugate pairs and document rounding on the discrete grid.
Report selected energy as a separate quantity and keep the DC/axes policy
consistent. Equal counts still do not give equal energy or perceptual effect.

Random islands and many additional mask types are lower priority until these
controlled comparisons are understood. Progressive Phase Blend remains a
separate experiment and is not implemented here.
