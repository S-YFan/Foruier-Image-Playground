# FOURIER IMAGE LAB

**Interactive Experiments in Fourier Image Processing**

Interactive Fourier experiments exploring image reconstruction, spectra, and frequency filtering.

**FOURIER IMAGE LAB** 是使用 HTML、CSS 與原生 JavaScript 建立的互動式數位影像實驗網站，包含 RGB Fourier Phase Swap、Spectrum Lab、Gaussian Filtering 與 Partial Phase Region Swap。

不使用前端框架、CDN、第三方執行期套件或後端服務。所有使用者圖片都在瀏覽器記憶體內解碼、運算與顯示，不會上傳至伺服器。

## Live Website

**[Open FOURIER IMAGE LAB](https://s-yfan.github.io/fourier-phase-swap-playground/)**

| Experiment | Description | Link |
|---|---|---|
| Experiment 001 — RGB Fourier Phase Swap | RGB Fourier Magnitude / Phase Swap | [Open Experiment 001](https://s-yfan.github.io/fourier-phase-swap-playground/) |
| Experiment 002 — Spectrum Lab | Fourier Spectrum & Geometric Experiments | [Open Spectrum Lab](https://s-yfan.github.io/fourier-phase-swap-playground/spectrum.html) |
| Experiment 003 — Gaussian Filtering | Gaussian LPF / HPF and independent Sharpening | [Open Gaussian Filtering](https://s-yfan.github.io/fourier-phase-swap-playground/filtering.html) |
| Experiment 004 — Partial Phase Region Swap | Keep A magnitude; replace phase inside selected frequency regions | [Open Partial Phase Region Swap](https://s-yfan.github.io/fourier-phase-swap-playground/region-swap.html) |

Experiment 004 在本次 review branch 中可本機操作；正式網址需待 PR 合併與 GitHub Pages 發布後才可使用。

四個頁面共享已驗證的 FFT / IFFT 數學核心，並透過網站上方的導航互通。Repository 名稱與 GitHub Pages URL 保持不變。新增頁面須在變更部署後才會出現在正式網站。

---

## 1. Experiments

### Experiment 001 — RGB Fourier Phase Swap

上傳兩張圖片 A、B，分別對 RGB 三個通道執行二維 Fourier Transform：

\[
F_A(u,v)=M_A(u,v)e^{i\phi_A(u,v)}
\]

\[
F_B(u,v)=M_B(u,v)e^{i\phi_B(u,v)}
\]

接著交換兩張圖片的 Fourier Phase：

\[
I_{AB}=\mathcal F^{-1}
\left[M_Ae^{i\phi_B}\right]
\]

\[
I_{BA}=\mathcal F^{-1}
\left[M_Be^{i\phi_A}\right]
\]

觀察 Magnitude 與 Phase 對重建影像結構的不同貢獻。

**Features**

- 保留四張網站範例：`assets/sample-a.svg`（Mountain lake／山景）、`assets/sample-b.svg`（Coastal lighthouse／燈塔）、`Monkey.jpg`、`Cat.jpg`。A、B 各自可選任一張，預設為山景與燈塔，開啟後自動產生兩個交換結果。
- 支援 PNG、JPEG、WebP 上傳與拖放。
- 更換任一圖片後自動重新計算。
- 可使用 **Swap phases** 再次執行交換。
- 顯示重建運算時間、數值裁切比例與相關計算資訊。
- 兩個方向的結果皆由真正的 RGB FFT / IFFT 計算產生。

### Experiment 002 — Spectrum Lab

獨立的實驗頁面，讓使用者透過簡單幾何圖形，觀察空間域與 Fourier Magnitude / Phase Spectrum 之間的關係。

目前包含四種實驗：

| Experiment | Adjustable Parameters | Main Observation |
|---|---|---|
| Square | Side length | 空間尺寸與頻譜主瓣寬度 |
| Circle | Radius | 空間與頻域的近似旋轉對稱性 |
| Vertical Stripes | Spatial period | 空間週期與離散頻率峰值 |
| Translation / Shifted Square | Horizontal / Vertical shift | Magnitude 不變與 Phase 對位置重建的影響 |

所有圖形皆以 256 × 256 的確定性像素資料產生，頻譜由真正的二維 FFT 計算，不使用預先繪製的模擬頻譜。

#### Translation Experiment — Phase Determines Position

這是 Spectrum Lab 的主要實驗。

從中央的 Original Square 開始，使用 X / Y Slider 將同一份原始像素進行整數循環平移。

根據 Fourier Shift Theorem：

\[
G(u,v)=F(u,v)
\exp\left[
-i\frac{2\pi}{N}(u\Delta x+v\Delta y)
\right]
\]

因此：

\[
|G(u,v)|=|F(u,v)|
\]

空間位置改變，但 Fourier Magnitude 保持不變，Phase 則產生與位移對應的變化。

實驗會同步展示 Original、Shifted，以及由下式真正執行 IFFT 得到的 Reconstructed Square：

\[
I_{\mathrm{reconstructed}}
=
\mathcal F^{-1}
\left[
|F_{\mathrm{original}}|
e^{i\phi_{\mathrm{shifted}}}
\right].
\]

**Same magnitude. Different phase. Different position.**

為了輔助觀察，頁面亦提供：

- Original / Shifted Magnitude Comparison。
- Maximum Magnitude Difference。
- Phase Difference：

\[
\Delta\phi=
\arg\left[G F^*\right]
\]

- Phase Change：

\[
D_\phi=
2\left|\sin\frac{\Delta\phi}{2}\right|,
\qquad 0\le D_\phi\le2.
\]

Phase Change 使用固定 0–2 顯示尺度，不隨每次操作重新進行 min-max normalization。零振幅與近零振幅造成的無效相位使用獨立中性色遮罩，避免將「相位未定義」誤認為「相位沒有改變」。

這些視覺化只處理顯示資料，不會修改原始 Fourier 係數或重建結果。

---

### Experiment 003 — Gaussian Filtering

兩區共用同一張山景、燈塔、Monkey.jpg、Cat.jpg 範例或上傳圖片，所有結果來自真正的 RGB Fourier filtering 與 IFFT。

| Section | Controls | Comparison |
|---|---|---|
| 01 — Gaussian Low / High Pass | Sigma (σ₁)，僅影響 LPF / HPF | Original / Gaussian LPF / Gaussian HPF |
| 02 — Gaussian Sharpening | 獨立 Sigma (σ₂) 與 Alpha (α)，僅影響 Sharpening | Original / Gaussian Sharpening |

兩個 Sigma 預設皆為 30，範圍 1…200、步長 1；Alpha 預設為 1.0，範圍 0…3、步長 0.1。初始化後兩個 Sigma 保持獨立狀態。

- `G(σ) = exp[−(u²+v²)/(2σ²)]`；`H_LPF = G(σ₁)`、`H_HPF = 1−G(σ₁)`、`H_Sharp = 1+α[1−G(σ₂)]`。
- Sigma 使用 1000 × 1000 參考圖的 frequency-bin units；實際 N × N FFT 的 Sigma 是 `σ × N/1000`。256²、預設 30 時為 7.68 bins。Mask 使用原生 signed discrete bins，DC 位於 `[0,0]`，保留 conjugate symmetry。
- 原始數值保留 Float64 實部／虛部。LPF／Sharpening 顯示為 `round(clamp(real,0,255))`；HPF 僅於顯示副本加 128，零響應顯示為灰色。不取絕對值或逐圖 normalization；Sharpening 不加 128。
- 更換來源只解碼一次並計算 3 次通道 FFT2，同一份像素繪製兩個 Original。改 σ₁ 只做 LPF／HPF 的 6 次通道 IFFT2；改 σ₂／Alpha 只做 Sharpening 的 3 次，重用來源頻譜 cache。
- 最多一個濾波請求運算中，每區保留一份最新參數；來源與區段各自的 revision 排除過期回應。參數變更不重繪另一區或重新解碼。
- 保留來源原始尺寸資訊與比例，FFT 前採共同的置中正方形裁切流程。使用週期邊界與 sRGB 像素尺度；顯示 clamp 可能裁掉極值與過衝。

實作與驗證細節見 [PHASE3A_REPORT.md](PHASE3A_REPORT.md)。

### Experiment 004 — Partial Phase Region Swap

上傳圖片 A、B，或各自從山景、燈塔、Monkey.jpg、Cat.jpg 四張範例中選擇；固定 A 的 Fourier Magnitude，只在二值遮罩 `M=1` 的頻率位置改用 B 的 Phase：

```text
mixedPhase = M ? phaseB : phaseA
mixedSpectrum = magnitudeA × exp(i × mixedPhase)
result = real(IFFT(mixedSpectrum))
```

| Mask | Controls | Selection |
|---|---|---|
| Low-frequency Disk | Normalized radius 0.01 / 0.05 / 0.15 / 0.30 | Radius ≤ cutoff, including DC |
| Opposite Quadrants | UL + LR / UR + LL / Both pairs | Opposite quadrant pairs; axes and Nyquist boundary lines keep A phase |
| Periodic Stripes | Vertical / Horizontal; width 5 / 20 / 50 | Alternating bands using `floor(abs(bin)/width) % 2 == 0` |

- 沿用網站共用的置中正方形裁切與 256 × 256 RGB 流程。Stripe width 使用實際 256 點 FFT 的整數頻率 bins，不套用 Gaussian Filtering 的 1000 點參考縮放。Disk radius 使用 cycles/pixel；0.30 在此為 76.8 bins。
- 遮罩以 `fftshift` 顯示，黑色為 A Phase、白色為 B Phase；計算維持原生 FFT 索引。每個遮罩都滿足 `M[u,v] = M[-u mod N,-v mod N]`。
- 分別顯示選取位置比例與 A 頻譜能量比例；能量包含 DC，A 完全為零時比例未定義。這兩個數字不代表感知相似度。
- 重建保留有正負號的浮點實部，顯示副本才 clamp 至 0–255 並截斷小數，與 Python 的 `np.uint8(np.clip(...))` 一致；不取 IFFT 絕對值、不加入亮度偏移，也不做逐圖 normalization。只在精確零振幅頻率以 Phase 0 作為數值約定。

獨立的 [Python reference](prototypes/phase4/README.md) 與 [數值驗證](prototypes/phase4/check_numerics.py) 仍可在本機執行。Python 預設為 1000 × 1000、直接縮放圖片；因此與網站的 256 × 256 置中裁切結果不應逐像素對比。依目前的圖片保留決定，`Monkey.jpg` / `Cat.jpg` 與兩張 SVG 一起作為網站範例保留，同時仍可供本機 Python 使用。

## 2. Run Locally

需要 **Node.js 20 或更新版本**，但不需要安裝 npm 套件。

在專案資料夾開啟終端機：

```powershell
node scripts/serve.mjs
```

然後在瀏覽器開啟：

| Page | Local URL |
|---|---|
| Playground | http://127.0.0.1:8080/ |
| Spectrum Lab | http://127.0.0.1:8080/spectrum.html |
| Gaussian Filtering | http://127.0.0.1:8080/filtering.html |
| Partial Phase Region Swap | http://127.0.0.1:8080/region-swap.html |

停止伺服器時按 `Ctrl+C`。

也可以使用：

```powershell
npm start
```

若 Windows PowerShell 不允許執行 `npm.ps1`，可改用 `npm.cmd start`，或直接使用前面的 `node` 指令。

若 8080 埠已被使用：

```powershell
$env:PORT = 8081
node scripts/serve.mjs
```

**Note:** 請不要直接雙擊這些 HTML 頁面。專案使用原生 ES Modules 與 Module Web Workers，應透過 HTTP / HTTPS 開啟。

Node.js 只用於本機靜態預覽。GitHub Pages 正式網站不需要 Node.js、Python、後端伺服器或額外的 Build Step。

---

## 3. Project Structure

```text
fourier-phase-swap-playground/
├── index.html                  # Playground
├── spectrum.html               # Spectrum Lab
├── filtering.html              # Gaussian Filtering
├── region-swap.html            # Partial Phase Region Swap
├── styles.css                  # Shared layout and visual style
├── spectrum.css                # Spectrum Lab styles
├── filtering.css               # Approved two-section filtering layout
├── region-swap.css             # Partial region mask controls and comparison
├── favicon.svg
│
├── assets/
│   ├── sample-a.svg            # Public Mountain lake illustration
│   └── sample-b.svg            # Public Coastal lighthouse illustration
│
├── js/
│   ├── app.js                  # Playground UI and events
│   ├── image.js                # Image decoding and preprocessing
│   ├── samples.js              # Shared four-image sample catalog
│   ├── fft.js                  # Radix-2 FFT and separable 2D FFT
│   ├── fourier.js              # RGB analysis and reconstruction
│   ├── worker.js               # Playground Web Worker
│   ├── spectrum.js             # Geometry and spectrum analysis
│   ├── spectrum-worker.js      # Spectrum Lab Web Worker
│   ├── translation.js          # Translation experiment
│   ├── spectrum-app.js         # Spectrum Lab UI and events
│   ├── filtering.js            # Gaussian numerical reconstruction and display copies
│   ├── filtering-worker.js     # Shared source cache and selected IFFT outputs
│   ├── filtering-app.js        # Independent section states and synchronized Originals
│   ├── region-swap.js          # Symmetric masks and A-magnitude reconstruction
│   ├── region-swap-worker.js   # Cached source spectra and partial swaps
│   └── region-swap-app.js      # Image sources, mask controls and comparison UI
│
├── scripts/
│   └── serve.mjs               # Local static HTTP server
│
├── tests/
│   ├── fourier.test.mjs
│   ├── verification.test.mjs
│   ├── worker.test.mjs
│   ├── worker-adapter.mjs
│   ├── static.test.mjs
│   ├── spectrum.test.mjs
│   ├── spectrum-worker.test.mjs
│   ├── spectrum-worker-adapter.mjs
│   ├── spectrum-static.test.mjs
│   ├── translation.test.mjs
│   ├── translation-worker.test.mjs
│   ├── browser.html
│   ├── browser.js
│   ├── spectrum-browser.html
│   ├── spectrum-browser.js
│   ├── filtering*.test.mjs
│   ├── filtering-worker-adapter.mjs
│   ├── filtering-browser.html
│   ├── filtering-browser.js
│   ├── region-swap*.test.mjs
│   ├── test-data.js
│   ├── fixtures/
│   └── make-fixtures.py
│
├── Monkey.jpg                  # Original website sample and Python input
├── Cat.jpg                     # Original website sample and Python input
├── prototypes/phase4/          # Standalone local Python reference and numerical checks
├── Graph_Experiment_FT_IFT.py
├── package.json
├── .gitignore
├── .nojekyll
├── README.md
├── VERIFICATION.md
├── PHASE2_REPORT.md
└── PHASE3A_REPORT.md
```

`Graph_Experiment_FT_IFT.py` 保留歷史 Python 計算流程，正式網站不依賴它。網站保留山景、燈塔、Monkey / Cat 四張範例，三個處理照片的實驗頁面都可選擇；也可上傳自己的圖片。

---

## 4. Image Preprocessing

Playground、Gaussian Filtering 與 Partial Phase Region Swap 的圖片處理規則如下：

- 接受 PNG、JPEG、WebP，每張圖片大小上限為 25 MiB。
- 先對原始圖片進行置中正方形裁切，再縮放至 256 × 256。
- 不直接將非正方形圖片拉長或壓扁。
- 裁切前先確定來源範圍，避免縮放濾波取樣到裁切區外的顏色。
- 透明與半透明像素先與白色背景合成，之後只處理 RGB。
- 上方 Canvas 顯示的像素與送入 FFT 的像素相同。
- 圖片在瀏覽器中完成處理，不會傳送至遠端伺服器。

對原圖尺寸 \(W\times H\)，定義：

\[
s=\min(W,H)
\]

裁切區域為：

\[
\left(
\left\lfloor\frac{W-s}{2}\right\rfloor,
\left\lfloor\frac{H-s}{2}\right\rfloor,
s,s
\right).
\]

這是針對數位影像像素值的 Fourier 實驗。FFT 使用 Canvas 輸出的 0–255 sRGB 通道值，沒有進行線性光轉換，不應將結果直接解讀為物理光強的光學模擬。

---

## 5. FFT Implementation

本專案使用自行實作的 Radix-2 Cooley–Tukey FFT，不依賴外部 FFT 函式庫。

主要程式位於 `js/fft.js`：

```javascript
import { FFT, fft2 } from './fft.js';

const fft = new FFT(256);

fft2(real, imag, fft);       // Forward 2D FFT
fft2(real, imag, fft, true); // Inverse 2D FFT
```

`real` 與 `imag` 為長度 \(256^2\) 的 `Float64Array`。

二維 FFT 使用 Separable Transform，依序對所有列及所有欄執行一維 FFT。

Forward FFT 不進行正規化；Inverse FFT 每一維除以 \(N\)，因此完整二維 IFFT 的正規化係數為：

\[
\frac{1}{N^2}=\frac{1}{65536}.
\]

與 NumPy 預設的 backward normalization convention 一致。

### Mathematical Convention

對每個 RGB 通道獨立計算：

\[
F(u,v)=
\sum_{y=0}^{N-1}
\sum_{x=0}^{N-1}
I(x,y)
e^{-i2\pi(ux+vy)/N}
\]

其中：

\[
M(u,v)=|F(u,v)|,
\qquad
\phi(u,v)=\operatorname{atan2}
(\operatorname{Im}F,\operatorname{Re}F).
\]

反向轉換：

\[
I'(x,y)=
\frac{1}{N^2}
\sum_{v=0}^{N-1}
\sum_{u=0}^{N-1}
G(u,v)e^{i2\pi(ux+vy)/N}.
\]

頻域原始索引為 `v * N + u`，DC 位於 `[0,0]`。

`fftshift()` 僅用於 Spectrum Lab 與 Phase Region Swap 遮罩的視覺化副本，不會改動 FFT / IFFT 的原始索引排列。

---

## 6. Reconstruction and Numerical Handling

### Hermitian Symmetry

對實數影像，Fourier 頻譜必須滿足：

\[
F(-u,-v)=F^*(u,v).
\]

因此，交換 Magnitude / Phase 後也必須保留共軛對稱，才能得到合理的實數 IFFT 重建結果。

在建立 Magnitude / Phase 前，Playground 與 Partial Phase Region Swap 使用：

\[
F_h[k]=
\frac{F[k]+\operatorname{conj}(F[-k])}{2}
\]

校正實數輸入在浮點 FFT 中產生的微小共軛配對誤差。

此處的 \(-k\) 依各頻率維度的 modulo \(N\) 索引計算。

對於 \(N=256\)，四個自共軛頻率點為：

\[
(0,0),\ (0,128),\ (128,0),\ (128,128).
\]

這些係數應為實數，重建時會保留相應的實數規則。

零振幅頻率點的 Phase 沒有數學定義，程式將其儲存為 0 作為明確的數值約定。這不代表該頻率具有物理上可辨識的零相位。

更多相關說明見 [VERIFICATION.md](VERIFICATION.md)。

### Display Mapping

IFFT 的浮點結果不使用絕對值，也不進行每張圖片獨立的 min-max normalization。Gaussian HPF 的 display-only `+128` 規則見 Experiment 003；以下為 Playground 的顯示規則。

僅將實部映射至 8-bit 顯示範圍：

```javascript
display = Math.round(
  Math.max(0, Math.min(255, realValue))
);
```

先 Clamp，再 Round，最後轉為顯示像素。

超出 0–255 範圍的數值會造成裁切，因此 Fourier 交換公式精確描述的是量化前的浮點重建結果，不是最後顯示的 8-bit 圖片。

Playground 另外顯示 RGB 通道樣本的裁切比例及相關數值資訊。

---

## 7. Performance

- 圖片解碼、縮放及 Canvas 顯示由主執行緒處理。
- FFT / IFFT 在 Web Worker 中執行，避免長時間阻塞 UI。
- 更換圖片 A 時，僅重新計算 A 的三個 RGB 頻譜；B 的頻譜可繼續使用快取，反之亦然。
- 重複執行 Phase Swap 不需要重新計算未改變的來源頻譜。
- 使用 Float64 進行數值計算，只在最後顯示時量化。
- Worker 快取有明確限制，不會無限制保留歷史圖片。
- Spectrum Lab 會保留 Translation 的固定基準與最後一組幾何參數。
- 連續拖動 Slider 時，採用最新目標狀態更新，避免舊 Worker 回應覆蓋新結果。
- 使用者上傳圖片所建立的 Object URL 在使用後會撤銷；不使用帳號、資料庫或 localStorage 保存圖片。

Playground 顯示的毫秒數為 Worker 內兩個交換結果的重建時間，不包含圖片解碼、正向 FFT、資料傳輸與 Canvas 繪製。

---

## 8. Testing and Verification

本專案除了檢查頁面是否正常顯示，也使用獨立 DFT 對照、數學性質、數值回歸測試及真實瀏覽器操作驗證 FFT / IFFT。

### Node Tests

執行：

```powershell
node --test tests/*.test.mjs
```

或：

```powershell
npm test
```

目前共 **56 項 Node 測試**，涵蓋：

- FFT / IFFT 與獨立 DFT 的對照。
- Forward / Inverse normalization。
- Round-trip reconstruction。
- RGB 通道隔離。
- Hermitian symmetry、自共軛頻率與零振幅處理。
- 負值、Clamping 與 Rounding。
- Worker 計算次數及快取。
- 四種幾何圖形與頻譜驗證。
- Fourier Shift Theorem。
- Phase Difference / Change 的週期性、遮罩與顯示尺度。
- 202 組 Translation 位移與真正 IFFT Reconstruction。
- 靜態檔案及 GitHub Pages repository 子路徑。
- Gaussian 獨立 DFT 對照、兩區參數獨立性、HPF 顯示副本、精確 IFFT 呼叫計數與公開範例參照。
- Partial Phase Region Swap 遮罩對稱、A Magnitude 保留、實數 IFFT 與選取能量比例。

### Browser Tests

公開測試入口：

| Test Suite | Result | Link |
|---|---:|---|
| Phase 1 Browser Tests | 20 / 20 | [Run Tests](https://s-yfan.github.io/fourier-phase-swap-playground/tests/browser.html) |
| Phase 2 Browser Tests | 19 / 19 | [Run Tests](https://s-yfan.github.io/fourier-phase-swap-playground/tests/spectrum-browser.html) |
| Experiment 003 Browser Tests | 15 / 15 | [Run Tests](https://s-yfan.github.io/fourier-phase-swap-playground/tests/filtering-browser.html) |
| Experiment 004 Browser Tests（本次本機驗證） | 8 / 8 | [Test page](tests/region-swap-browser.html) |

本機預覽時也可以使用：

```text
http://127.0.0.1:8080/tests/browser.html
http://127.0.0.1:8080/tests/spectrum-browser.html
http://127.0.0.1:8080/tests/filtering-browser.html
http://127.0.0.1:8080/tests/region-swap-browser.html
```

Phase 4 integration 的本機 Chromium 驗證已通過全部 56 項 Node 檢查與四組瀏覽器檢查（20 / 19 / 15 / 8）。包含所有遮罩、兩種條紋方向、圖片替換與錯誤恢復、連續參數更新，以及 320px / 390px 手機版面。仍沿用 256 × 256 FFT；尚未驗證 Firefox、Safari 或實體手機。

### Release Verification — 2026-10-17

Phase 2 已 Merge 至 `main` 並成功發布至 GitHub Pages。

發布後直接在正式網站執行 Chromium 驗收：

| Verification | Result |
|---|---:|
| Phase 1 public browser tests | 20 / 20 |
| Phase 2 public browser tests | 19 / 19 |
| Phase 1 round-trip maximum error | \(1.137\times10^{-13}\) |
| Phase 2 maximum magnitude difference | \(4.657\times10^{-10}\) |
| Phase 2 maximum reconstruction error | \(1.563\times10^{-13}\) |
| Phase 2 reconstructed 8-bit pixel difference | 0 |
| 390px / 320px responsive layout | Passed |

另已於正式網站手動驗證四種幾何實驗、Translation Slider、IFFT Reconstruction、數值展開及雙頁導航。

以上誤差是指定測試樣本的實測結果，不代表任意輸入的數學誤差上界。

**Verification limitations:** 已完成 Windows Chromium 驗證；Firefox、Safari、實體 iOS / Android、輔助科技及長時間記憶體測試尚未全面涵蓋。

完整實作與驗證資訊：

- [VERIFICATION.md](VERIFICATION.md)
- [PHASE2_REPORT.md](PHASE2_REPORT.md)
- [PHASE3A_REPORT.md](PHASE3A_REPORT.md)

---

## 9. GitHub Pages Deployment

本專案是純靜態網站，可直接部署至 GitHub Pages。

正式網站：

https://s-yfan.github.io/fourier-phase-swap-playground/

所有主要資源均使用相對路徑，可在 repository 子路徑下正常載入。

若希望於本機模擬 GitHub Pages 的 repository 子路徑，可在 PowerShell 執行：

```powershell
$env:BASE_PATH = '/fourier-phase-swap-playground/'
node scripts/serve.mjs
```

接著開啟：

```text
http://127.0.0.1:8080/fourier-phase-swap-playground/
```

`BASE_PATH` 僅供本機預覽使用，GitHub Pages 正式部署不需要設定此環境變數。

---

## 10. Future Ideas

Experiment 001、002、003、004 的實作已包含在此 repository。以下為尚未實作的候選方向，開發順序與最終功能範圍尚未確定。

### Phase Interpolation

探索兩組 Fourier Phase 之間的插值與影像重建，並處理相位週期性、零振幅及共軛對稱限制。

### UI/UX Refinement — Phase Another

改善既有 Playground 的操作與視覺比較體驗，包括：

- Magnitude / Phase 來源關係標示。
- Source / Reconstruction 快速比較。
- A/B Swap。
- 圖片放大檢視。
- 行動裝置比較布局。
- 具有明確實驗目的的範例圖片組合。

上述構想均不屬於目前已發布版本的功能。

---

## 11. Project Notes

這個專案的目的不是只展示一張經過 Fourier Transform 的圖片，而是讓使用者透過真正的數值運算，觀察 Magnitude 與 Phase 如何共同影響影像重建。

Magnitude 與 Phase 都是完整頻譜不可缺少的資訊，但兩者並不一定具有相同的視覺可讀性。

尤其對 Phase 而言，單純觀察一張二維 Phase Spectrum，不一定能直觀辨識它所編碼的空間結構；透過 Phase Swap 與 IFFT Reconstruction，反而更容易觀察其對最終影像的影響。

**FOURIER IMAGE LAB — Interactive Experiments in Fourier Image Processing**
