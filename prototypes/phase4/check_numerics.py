"""Lightweight checks: python prototypes/phase4/check_numerics.py.

Plain assertions only; no photographs, generated files, or plotting windows.
"""

import numpy as np
import partial_phase_swap as prototype


def check_masks(size):
    masks = {name: mask for _, name, _, mask in
             prototype.make_masks(size, orientation="both")}
    # Integer reference avoids fftfreq's floating-point stripe boundaries.
    bins = np.array([i if i <= (size - 1) // 2 else i - size for i in range(size)])
    row, column = np.meshgrid(bins, bins, indexing="ij")
    expected = {f"disk_{cutoff:.2f}": row**2 + column**2 <= (size * cutoff)**2
                for cutoff in prototype.DISK_CUTOFFS}
    positive = bins > 0
    negative = (bins < 0) & ((bins != -size // 2) if size % 2 == 0 else True)
    # Negative row/column bins are the upper/left side after fftshift.
    pair_a = np.outer(negative, negative) | np.outer(positive, positive)
    pair_b = np.outer(negative, positive) | np.outer(positive, negative)
    expected.update(quadrants_ul_lr=pair_a, quadrants_ur_ll=pair_b,
                    quadrants_both=pair_a | pair_b)
    for direction in ("vertical", "horizontal"):
        for width in prototype.STRIPE_WIDTHS:
            selected = np.array([(abs(int(k)) // width) % 2 == 0 for k in bins])
            expected[f"stripes_{direction}_{width}"] = np.broadcast_to(
                selected[None, :] if direction == "vertical" else selected[:, None],
                (size, size))
    partner = (-np.arange(size)) % size
    assert len(masks) == len(expected) == 13
    for name, mask in masks.items():
        assert mask.dtype == np.bool_ and mask.shape == (size, size), name
        assert np.array_equal(mask, expected[name]), (size, name, "bin selection")
        assert np.array_equal(mask, mask[np.ix_(partner, partner)]), (size, name, "symmetry")
    return masks


def main():
    assert __debug__, "Run without -O so assertions remain enabled."
    counts = {"disk_0.01": 317, "disk_0.05": 7845, "disk_0.15": 70681,
              "disk_0.30": 282697, "quadrants_ul_lr": 498002,
              "quadrants_ur_ll": 498002, "quadrants_both": 996004}
    for direction in ("vertical", "horizontal"):
        counts.update({f"stripes_{direction}_{width}": count
                       for width, count in ((5, 500000), (20, 519000), (50, 500000))})
    for name, mask in check_masks(1000).items():
        assert int(mask.sum()) == counts[name], (name, mask.sum())

    rng = np.random.default_rng(4)
    worst_imaginary = 0.0
    for size in (2, 3, 8, 9, 31, 32):
        masks = check_masks(size)  # includes odd/even quadrant and Nyquist policy
        image_a = rng.integers(0, 256, (size, size, 3), dtype=np.uint8)
        image_b = rng.integers(0, 256, (size, size, 3), dtype=np.uint8)
        magnitudes, phases_a, phases_b, _ = prototype.prepare_spectra(image_a, image_b)
        source = [np.fft.fft2(image_a[:, :, c]) for c in range(3)]
        donor = [np.fft.fft2(image_b[:, :, c]) for c in range(3)]
        masks.update(empty=np.zeros((size, size), dtype=bool),
                     full=np.ones((size, size), dtype=bool))
        for name, mask in masks.items():
            raw, checks = prototype.reconstruct(magnitudes, phases_a, phases_b, mask)
            assert np.issubdtype(raw.dtype, np.floating) and np.isfinite(raw).all()
            assert checks["mask_symmetric"] and checks["validation_passed"]
            assert checks["selected_fraction"] == float(mask.mean())
            energy = sum(float(np.sum(np.abs(f)**2)) for f in source)
            selected = sum(float(np.sum((np.abs(f)**2)[mask])) for f in source)
            assert np.isclose(checks["energy_fraction"], selected / energy,
                              rtol=1e-12, atol=1e-14)
            for c in range(3):
                # Re-FFT the returned image to detect abs(), clipping, or a
                # nontrivial imaginary component discarded during reconstruction.
                assert np.allclose(np.abs(np.fft.fft2(raw[:, :, c])), np.abs(source[c]),
                                   rtol=1e-12, atol=1e-8), (size, name, c)
            assert checks["max_imaginary_residual"] <= prototype.IMAGINARY_RTOL * max(
                1.0, float(np.max(np.abs(raw))))
            worst_imaginary = max(worst_imaginary, checks["max_imaginary_residual"])
            if name == "empty":
                assert np.allclose(raw, image_a, rtol=1e-12, atol=1e-9)
            elif name == "full":
                expected = np.stack([np.fft.ifft2(np.abs(a) * np.exp(1j * np.angle(b))).real
                                     for a, b in zip(source, donor)], axis=2)
                assert np.allclose(raw, expected, rtol=1e-12, atol=1e-9)

    # Exact-zero donors expose the phase=0 convention. Alternating columns add
    # a negative real Nyquist coefficient, whose phase must remain pi.
    size = 16
    columns = np.arange(size)
    plane = np.broadcast_to(np.where(columns < 8, 220.0, 20.0) + 10 * (columns % 2),
                            (size, size))
    image_a = np.stack((plane, 0.8 * plane, 0.6 * plane), axis=2)
    all_bins = np.ones((size, size), dtype=bool)
    results = []
    for alternating in (False, True):
        donor_plane = (np.broadcast_to(255.0 * (columns % 2), (size, size))
                       if alternating else np.full((size, size), 17.0))
        image_b = np.repeat(donor_plane[:, :, None], 3, axis=2)
        magnitudes, phases_a, phases_b, _ = prototype.prepare_spectra(image_a, image_b)
        expected = []
        for c in range(3):
            spectrum = np.abs(np.fft.fft2(image_a[:, :, c])).astype(np.complex128)
            zero_bins = np.ones((size, size), dtype=bool)
            zero_bins[0, 0] = False
            if alternating:
                spectrum[0, size // 2] *= -1
                zero_bins[0, size // 2] = False
                assert np.isclose(phases_b[c][0, size // 2], np.pi)
            assert np.all(phases_b[c][zero_bins] == 0.0)
            expected.append(np.fft.ifft2(spectrum).real)
        raw, checks = prototype.reconstruct(magnitudes, phases_a, phases_b, all_bins)
        assert np.allclose(raw, np.stack(expected, axis=2), rtol=1e-12, atol=1e-9)
        assert raw.min() < -50 and raw.max() > 255, "raw output was clipped or abs() applied"
        assert checks["clipped_channel_fraction"] > 0
        results.append(raw)
    assert not np.allclose(results[0], results[1]), "Nyquist phase must affect the image"

    zero = np.zeros_like(image_a)
    magnitudes, phases_a, phases_b, _ = prototype.prepare_spectra(zero, image_b)
    raw, checks = prototype.reconstruct(magnitudes, phases_a, phases_b, all_bins)
    assert np.array_equal(raw, zero) and checks["energy_fraction"] is None
    asymmetric = np.zeros_like(all_bins)
    asymmetric[1, 2] = True
    try:
        prototype.reconstruct(magnitudes, phases_a, phases_b, asymmetric)
    except ValueError:
        pass
    else:
        assert False, "asymmetric mask was accepted"

    print("PASS: 13 masks at N=1000 and N=2,3,8,9,31,32; exact bin selection and symmetry.")
    print("PASS: roundtrip, full/partial swaps, magnitude/energy, zero donors, Nyquist,")
    print("      unclipped signed output, undefined zero energy, and asymmetric-mask rejection.")
    print(f"Largest small-image imaginary residual: {worst_imaginary:.3e}")


if __name__ == "__main__":
    main()
