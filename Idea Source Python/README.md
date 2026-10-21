# Original Python Ideas

The five Python idea files in this folder were originally written by
**Sheng-Yang Fan (S-YFan)**. They are the original source of the Fourier image
processing ideas and experiments behind FOURIER IMAGE LAB, and are kept as
direct, standalone experiments.

**Codex** was responsible for translating these Python experiments into
JavaScript implementations so that the website can compute and display their
results interactively in real time, directly in the browser. The original
Python ideas and authorship belong to Sheng-Yang Fan; Codex's contribution is
the JavaScript implementation and web integration.

| Script | Experiment |
| --- | --- |
| [Graph_Experiment_FT_IFT.py](Graph_Experiment_FT_IFT.py) | A's RGB Fourier magnitude with B's phase, followed by IFFT |
| [Graph_Experiment_FT_LPF_HPF.py](Graph_Experiment_FT_LPF_HPF.py) | Gaussian low-pass, high-pass, and sharpening on A |
| [Graph_Experiment_FT_phase swap_directly.py](Graph_Experiment_FT_phase%20swap_directly.py) | Phase substitution in conjugate-paired quadrants |
| [Graph_Experiment_FT_phase swap_filter.py](Graph_Experiment_FT_phase%20swap_filter.py) | Phase substitution inside a low-frequency disk |
| [Graph_Experiment_FT_phase swap_strip.py](Graph_Experiment_FT_phase%20swap_strip.py) | Phase substitution in periodic frequency stripes |

Install the Python dependencies, then run a script **from the repository root**
so it can read the existing `Monkey.jpg` and `Cat.jpg`:

```sh
python -m pip install -r "Idea Source Python/requirements.txt"
python "Idea Source Python/Graph_Experiment_FT_IFT.py"
python "Idea Source Python/Graph_Experiment_FT_LPF_HPF.py"
python "Idea Source Python/Graph_Experiment_FT_phase swap_directly.py"
python "Idea Source Python/Graph_Experiment_FT_phase swap_filter.py"
python "Idea Source Python/Graph_Experiment_FT_phase swap_strip.py"
```

Each script opens a Matplotlib figure. The filtering script displays sharpening;
its LPF and HPF results are also calculated as `img_LPF_rgb` and `img_HPF_rgb`.
The Python experiments resize directly to 1000 × 1000; the website center-crops
and resizes to 256 × 256, so their displayed pixels need not match.

The partial swaps preserve A's magnitude and choose A's or B's phase with binary,
conjugate-symmetric masks. The disk cutoff is in cycles per pixel (`radius < 0.04`
by default), and stripe width is in frequency bins. The original quadrant mask
includes some coordinate-axis and Nyquist positions; the website keeps those
boundaries on A's phase. Both masks preserve conjugate symmetry.

IFFT results use their signed real values, then clip to 0–255 before display.
The HPF preview adds 128 for display only. Sharpening uses
`1 + alpha * (1 - H_LPF)` before IFFT.
