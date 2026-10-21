# FOURIER IMAGE LAB

## Overview

FOURIER IMAGE LAB is a browser-based interactive Fourier image lab, available in English and Traditional Chinese. See the [live website](https://s-yfan.github.io/Foruier-Image-Playground/) and [Documentation](https://s-yfan.github.io/Foruier-Image-Playground/documentation.html).

## Architecture & Implementation

The site uses HTML, CSS, and native JavaScript modules. `index.html` is Home. The four experiment pages (`phase-swap.html`, `spectrum.html`, `filtering.html`, `region-swap.html`) have separate UI modules and share image preprocessing and the FFT/IFFT core in `js/`. `js/site.js` supplies navigation and the footer.

Uploaded or sample images are decoded locally, center-cropped to a square, resized to 256 × 256, and composited onto white before RGB analysis. Geometry inputs are generated directly. Module Web Workers cache spectra and perform numerical calculations without blocking the main UI thread; returned pixel buffers are drawn on Canvas. Images are never uploaded.

```text
Image / geometry → pixel data → FFT → spectrum operations → IFFT → Canvas
```

```text
assets/sample-a.svg   # Mountain lake sample
assets/sample-b.svg   # Coastal lighthouse sample
Monkey.jpg           # Photograph sample
Cat.jpg              # Photograph sample
```

Home and Documentation use bundled KaTeX through `js/math.js`. English HTML supplies the templates; `content/zh-TW.json` and `scripts/build-locales.mjs` generate six checked-in `zh/` pages. `js/i18n.js` handles dynamic translations and corresponding language routes. Both languages share numerical modules and workers.

GitHub Pages serves the static files. Relative resource paths support the repository subpath; no deployment build or backend is required.

## Running Locally

Install Node.js 20 or newer; no npm packages are required. Serve over HTTP:

```sh
node scripts/serve.mjs
```

Open [localhost:8080](http://127.0.0.1:8080/). Run the existing automated tests:

```sh
node --test tests/*.test.mjs
```

After editing English templates or Chinese translations, regenerate and verify:

```sh
node scripts/build-locales.mjs
node scripts/build-locales.mjs --check
```

## Development Credits

The original Python prototypes and Fourier-transform experiment concepts were developed by Sheng-Yang Fan. The frontend was implemented using OpenAI Codex.

## License

This project is open source and licensed under the [MIT License](LICENSE).

Original project code and images are covered; third-party components retain their own licenses, including [KaTeX](assets/katex/LICENSE).
