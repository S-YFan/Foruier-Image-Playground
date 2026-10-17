# Fourier Phase Swap Playground

What makes an image recognizable — magnitude or phase?

這是 **Fourier Lab：RGB 相位交換與幾何頻譜實驗**。HTML、CSS、原生 JavaScript，無框架、無 CDN、無第三方執行期套件、無後端。所有使用者圖片都在瀏覽器記憶體內解碼、運算與顯示，不會上傳到伺服器。

開啟時會載入這個資料夾原有的 `Monkey.jpg` 和 `NSYSUlogo.jpg`，立即產生兩個結果。可以用上傳按鈕或拖放來更換任一圖片；圖片載入後自動計算，也可以按 **Swap phases** 再算一次。原始 Python 與圖片檔案均保留。

同站兩頁以 **Playground | Spectrum Lab** 導航互通：`index.html` 保留 Phase 1 上傳與 RGB Phase Swap；`spectrum.html` 是 **Phase 2 — Fourier Spectrum & Geometric Experiments**，提供四種幾何圖形、真正的 Magnitude / Phase 頻譜，以及 Square 與 Shifted Square 的數值比較。Phase 2 已通過最後 Release Review，透過 `feature/fourier-spectrum` 分支與以 `main` 為目標的 Pull Request 送交驗收。[修改與測試報告](PHASE2_REPORT.md)。

Refinement 預設進入 **Translation Experiment**：從 `(0,0)` 拖動 X / Y 滑桿，同時觀察 Original、Shifted 與 **Original Magnitude + Shifted Phase** 的真正 IFFT 重建；振幅不變，相位變化由固定尺度的 Phase Difference / Phase Change 輔助呈現。Square、Circle、Vertical Stripes 另提供邊長、半徑、可整除 256 的週期控制。

## 1. 本機執行

需要 Node.js 20 或更新版本；**不需要 `npm install`**。

在專案資料夾開啟終端機：

```powershell
node scripts/serve.mjs
```

使用瀏覽器開啟 <http://127.0.0.1:8080/>。停止伺服器時按 `Ctrl+C`。

也可使用 `npm start`。若 PowerShell 不允許執行 `npm.ps1`，用 `npm.cmd start`，或直接使用上述 `node` 指令即可。

不要直接雙擊 `index.html`：此專案使用 ES modules 與 module Web Worker，需要 HTTP / HTTPS。Node 只負責本機靜態檔案預覽，正式部署到 GitHub Pages 後完全不需要 Node 或 Python 伺服器。

若 8080 埠已被使用，可在 PowerShell 執行：

```powershell
$env:PORT = 8081
node scripts/serve.mjs
```

然後開啟 <http://127.0.0.1:8081/>。

## 2. 專案結構

```text
Foruier-Phase-Swap/
├── index.html                    # 頁面、上傳欄位、四張 Canvas
├── styles.css                    # 深色實驗室風格、響應式布局
├── spectrum.html                 # 獨立 Spectrum Lab 頁面
├── spectrum.css                  # 三欄頻譜、相位色環、平移比較
├── favicon.svg
├── js/
│   ├── app.js                    # UI、圖片上傳事件、Worker 通訊
│   ├── image.js                  # 真實圖片解碼、先裁切再縮放、白底合成
│   ├── fft.js                    # 自包含 radix-2 FFT 與 separable 2D FFT
│   ├── fourier.js                # RGB 頻譜、相位交換、重建、自我檢查
│   ├── worker.js                 # 背景計算、快取 A/B 頻譜
│   ├── spectrum.js               # 幾何像素、單通道分析、顯示副本與 Shift Theorem 比較
│   ├── spectrum-worker.js        # 共用核心、參數化實驗、固定基準與有界快取
│   ├── translation.js            # 循環位移、Phase Difference / Change、真正 IFFT 重建
│   └── spectrum-app.js           # Lab 事件、Canvas、圖例、Worker 通訊
├── scripts/
│   └── serve.mjs                 # 零套件依賴的本機預覽伺服器
├── tests/
│   ├── fourier.test.mjs          # 獨立 DFT 對照與基本數學測試
│   ├── verification.test.mjs     # 256² 圖樣矩陣、稀疏頻譜回歸測試
│   ├── worker.test.mjs           # Worker 實際 FFT 呼叫計數與快取測試
│   ├── worker-adapter.mjs        # Node worker_threads 測試橋接
│   ├── static.test.mjs           # HTTP、MIME、部署相對路徑檢查
│   ├── spectrum*.test.mjs        # Phase 2 數學、Worker、repository 子路徑測試
│   ├── spectrum-worker-adapter.mjs # Spectrum Worker 的 Node 測試橋接
│   ├── translation*.test.mjs     # 202 組位移、相位遮罩、參數與 IFFT 呼叫驗證
│   ├── spectrum-browser.html     # Phase 2 瀏覽器測試入口
│   ├── spectrum-browser.js       # Lab 真實 Canvas、事件、導航、響應式驗證
│   ├── browser.html             # 可重複執行的瀏覽器測試入口
│   ├── browser.js               # Canvas、真實解碼、Worker、UI 事件測試
│   ├── test-data.js              # 確定性的數值測試圖樣
│   ├── fixtures/                # 隨附 PNG、JPEG、WebP 測試檔案
│   └── make-fixtures.py          # 可選：重新生成測試檔案
├── package.json                 # 可選的 start / test 捷徑
├── .gitignore
├── .nojekyll                     # GitHub Pages 直接提供靜態檔案
├── README.md
├── VERIFICATION.md               # 驗證結果、修正原因與驗證限制
├── PHASE2_REPORT.md              # Phase 2 驗收報告與修改清單
├── Monkey.jpg                    # 原有範例圖片
├── NSYSUlogo.jpg                 # 原有範例圖片
└── Graph_Experiment_FT_IFT.py     # 原有 Python 實驗，網站不依賴它
```

正式網站需要 `index.html`、`spectrum.html`、`styles.css`、`spectrum.css`、`favicon.svg`、`js/`、兩張範例圖片與 `.nojekyll`。其他檔案是說明、開發與驗證用途。

## 3. 圖片前處理

- 接受 PNG、JPEG、WebP，每張上限 25 MiB（介面簡記為 MB）。
- 設原圖大小為 `W × H`，取 `s = min(W, H)`。
- 裁切來源矩形：`(floor((W-s)/2), floor((H-s)/2), s, s)`，即**置中裁切正方形**，不拉長變形。若多餘邊長為奇數，多的一個像素留在右側／下側被裁掉。
- 以 `createImageBitmap` 先裁切來源，再高品質縮放到 `256 × 256`，避免縮放濾波取樣到裁切區外的顏色。小圖會放大，大圖會縮小，繪製後關閉暫存 bitmap。[API 說明](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)
- 先填白色，再繪圖。透明與半透明像素先與白色合成，之後只處理 RGB；結果 alpha 固定為 255。
- 上方 Canvas 顯示的像素與送入 FFT 的像素相同；圖片下方標示原始尺寸。
- 預覽周圍的格紋只是方形圖片外側的背景，不參與運算。
- 以 Canvas 輸出的 0–255 sRGB 通道值運算，沒有進行線性光轉換。這是數位影像訊號實驗，不是物理光強的光學模擬。

相較原本 Python 的 `cv2.resize(..., (1000,1000))`，這裡尺寸較小且改用裁切策略，所以不應期待兩版逐像素相同。瀏覽器與 OpenCV 的色彩管理、解碼及縮放濾波也可能有些微差異。

## 4. FFT 函式庫與載入方式

此版本不使用外部 FFT 函式庫；完整 radix-2 Cooley–Tukey 實作位於 `js/fft.js`，透過原生 ES module 載入：

```javascript
import { FFT, fft2 } from './fft.js';

const fft = new FFT(256);
fft2(real, imag, fft);       // 原地 2D FFT
fft2(real, imag, fft, true); // 原地 2D IFFT
```

`real` 與 `imag` 是長度 `256 * 256` 的 `Float64Array`。同一個 `FFT` 實例重用 bit-reversal 索引與三角函數表。2D FFT 依序對所有列與所有欄進行 1D FFT，是真正的可分離 2D 傅立葉轉換。

網頁由 `<script type="module" src="./js/app.js">` 啟動，`app.js` 用 `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })` 載入背景執行緒。所有網址都是相對路徑，支援 GitHub Pages 的 repository 子路徑。

## 5. 數學與程式碼對照

對每個顏色通道獨立計算，`N = 256`：

```text
F[v,u] = Σ_y Σ_x I[y,x] exp(-i 2π (u x + v y) / N)
M[v,u] = hypot(Re(F[v,u]), Im(F[v,u]))
φ[v,u] = atan2(Im(F[v,u]), Re(F[v,u]))

G₁ = M_A · (cos(φ_B) + i sin(φ_B))
G₂ = M_B · (cos(φ_A) + i sin(φ_A))

I′[y,x] = (1/N²) Σ_v Σ_u G[v,u] exp(+i 2π (u x + v y) / N)
```

| 數學步驟 | 程式 |
| --- | --- |
| 每個 RGB 通道的 FFT、振幅與相位 | `fourier.js` → `analyzeRGB()` |
| `M × exp(iφ)` | `fourier.js` → `reconstructChannel()` 的實、虛部組合 |
| 2D IFFT | `fft.js` → `fft2(..., true)` |
| 三個通道合併與顯示數值處理 | `fourier.js` → `reconstructRGB()` |
| A 振幅 + B 相位、B 振幅 + A 相位 | `worker.js` 的 `swap` 分支 |

正向 FFT **不正規化**；反向每一維除以 N，因此完整 2D IFFT 除以 N² = 65,536，與 NumPy 預設的 backward normalization 一致。[NumPy FFT 文件](https://numpy.org/doc/stable/reference/routines.fft.html)

陣列索引固定為 `y * N + x`。頻域對應 `v * N + u`，DC 位於 `[0,0]`。Playground 計算**不執行 fftshift**。Phase 2 的 fftshift 僅作用於 Spectrum Lab 的顯示副本，不改動這裡的計算排列。

## 6. IFFT 與 0–255 的映射

只將 IFFT 的**實部**轉成顯示值：

```javascript
display = Math.round(Math.max(0, Math.min(255, realValue)));
```

- 不做 `abs(IFFT)`：負值應保留到顯示映射階段，不能翻成正值。
- 不做每張圖或每個通道的 min-max normalization，避免偷偷改變色彩、亮度與對比。
- 不直接轉成會溢位回繞的整數。先 clamp，再 round，最後存入 `Uint8ClampedArray`。
- 裁切會失去超出範圍的細節，也會改變顯示圖的頻譜。因此交換公式精確描述的是**裁切前**的浮點結果，不是最終 8-bit PNG 等顯示資料。
- 每張結果下方顯示超出 0–255 的 RGB **通道樣本比例**，分母為 `256 × 256 × 3`，不是「有裁切的像素比例」。小於 `1e-7` 的邊界浮點誤差不計入此統計。
- 將游標停在裁切比例上，可查看裁切前最小／最大值；展開「計算與顯示方式」可看最大虛部殘差。

這修正了原始 Python 中 `np.abs(np.fft.ifft2(...))` 與直接 `np.uint8(...)` 的顯示問題；原始檔案本身沒有修改。

## 7. 共軛對稱、零振幅與精度

實數圖片的頻譜滿足：

```text
F[(-v) mod N, (-u) mod N] = conjugate(F[v,u])
```

因此成對的振幅相等，相位互為相反數（mod 2π）。在取相位之前，本版先以 `Fh[k] = (F[k] + conjugate(F[-k])) / 2` 校正實數輸入的 FFT 配對捨入誤差，然後從同一個係數建立一對等振幅、反相位的資料。這是恢復 Hermitian 對稱，不是亮度或對比正規化。

這個步驟不可省略：原版對配對係數各自呼叫 `atan2`，在近零振幅位置可能把微小 FFT 誤差放大成不一致的相位；交換後的虛部殘差可大到數百。新增的稀疏頻譜回歸測試已覆蓋此問題。FFT 核心本身仍可處理一般複數資料；對稱校正只用在實數 RGB 輸入的 `analyzeRGB()`。

N 為偶數時，四個自共軛位置是 `(v,u) = (0,0), (0,N/2), (N/2,0), (N/2,N/2)`。它們的係數為實數，相位為 0 或 π；本版保留這些符號，沒有插值它們，組合頻譜時也將這四點的虛部設為 0，避免 `sin(π)` 的浮點殘差。**不是整條 Nyquist 列或欄的每一點都自共軛。**

某個頻率點的振幅恰為 0 時，相位沒有定義，本版明確約定為 0。若這個零點作為相位來源，而另一張圖在該點有能量，重建就取決於這個約定。接近零的頻率點相位可能對捨入誤差敏感；本版沒有任意閾值去刪掉小係數。這些情況可用全黑、常數色與脈衝圖測試。

相位插值、最短弧、零點跨越、π 分支與自共軛點的連續處理屬於 Phase 3，本版未加入滑桿。

## 8. 效能與快取

- 圖片解碼、縮放與 Canvas 顯示在主執行緒；FFT / IFFT 在 Web Worker。
- 更換 A 只重算 A 的 3 次正向 2D FFT；B 的頻譜繼續使用快取，反之亦然。
- 按 Swap 只做 6 次反向 2D FFT，不重算來源頻譜。
- 使用 Float64 運算；只在最後顯示時量化為 8-bit。
- Worker 內只快取兩張圖的三通道 magnitude / phase，約 6 MiB，不無限制累積歷史。
- 上傳與計算期間暫停操作，防止重複請求或不同版本的圖片與結果交錯。
- 圖片 object URL 使用後會撤銷，沒有 localStorage 或帳號資料。
- 畫面顯示的毫秒值是 Worker 內兩個結果的重建時間，不含圖片解碼、正向 FFT、傳輸及繪製。

## 9. 正確性驗證

```powershell
node --test tests/*.test.mjs
```

或執行 `npm test`。測試不需要 npm 套件或 Python。

Node 測試包含以下檢查，完整結果與限制見 [VERIFICATION.md](VERIFICATION.md)：

1. FFT 尺寸與形狀檢查。
2. 複數 2D FFT / IFFT 對照獨立、直接求和的 DFT（驗證符號、索引、尺度）。
3. 256×256 FFT → IFFT round-trip。
4. 常數圖的 DC 與偏移脈衝的相位斜坡。
5. RGB 同圖交換應逐位元重建原始 8-bit 像素。
6. 兩個交換方向、三個顏色通道皆對照獨立 DFT / IFFT。
7. 共軛對稱、Nyquist 與兩方向重建的虛部殘差。
8. 全黑、常數圖與零振幅相位約定。
9. 負值、超過 255、rounding 與 clipping，不取絕對值或拉伸對比。

另涵蓋近零振幅相位的回歸測試、9 種 256² 圖樣的 81 種有序交換、Parseval 能量、RGB 通道隔離、Worker 真實 FFT 呼叫次數、快取替換與靜態部署資源檢查。Phase 1 原有 **18 項保留**；Phase 2 初版 13 項與 Refinement 新增 7 項也通過，Node 共 **38/38 通過**。

瀏覽器自動化測試需要啟動 `node scripts/serve.mjs`，然後開啟 <http://127.0.0.1:8080/tests/browser.html>。頁面會自動執行 **20 項**真實圖片解碼、Canvas、Web Worker 與實際頁面事件測試，並顯示每項結果與數值指標。Windows Chromium 本次 **20/20 通過**。測試檔案已隨附；不需要安裝 Python 或 Pillow，除非要自行重新生成測試素材。

Phase 2 瀏覽器測試入口是 <http://127.0.0.1:8080/tests/spectrum-browser.html>：四種實驗與參數的 Canvas 逐像素比對、循環圖例與相位遮罩、七張平移圖與真正 IFFT、連續輸入只提交最新結果、1040 / 390 / 320px 布局、錯誤恢復、兩頁導航與實際資源路徑，Chromium **19/19 通過**。本次兩組瀏覽器測試也都在 `/fourier-phase-swap-playground/` 子路徑下實際執行。

256² 測試圖樣的 FFT round-trip 最大實部誤差約 `1.28e-13`，同圖振幅相位重建約 `2.42e-13`，81 種交換的最大虛部殘差約 `3.55e-12`。相同圖片重建到 8-bit 後的最大像素差為 **0**。這些是測試樣本的實測值，不是對任意輸入的誤差上界。網頁每次啟動也會執行原有的 round-trip 自我檢查（容許值 `1e-8`），若失敗會停止計算。

手動測試建議：

- 第一次載入應同時看到猴子、校徽與兩個交換結果。
- 兩個欄位上傳同一張圖片，兩個結果應與裁切後的原圖相同，裁切比例為 0%。
- 分別上傳 PNG、JPEG、WebP，以及帶透明度或長寬比懸殊的圖片。
- 取消檔案選擇、選擇錯誤格式或損壞檔案，不應破壞原有結果。
- 按 Swap 可重新運算；更換任一圖也會自動運算。
- 桌面雙欄、手機單欄，鍵盤可以聚焦上傳與 Swap。

## 10. Spectrum Lab 的數學與顯示

- Square：白底、中央黑色方形，邊長預設 64，可選 16…160（偶數）。Circle：半徑預設 40，可選 8…96，中心在像素網格的 (127.5,127.5)。Vertical Stripes：週期預設 32，可選 8 / 16 / 32 / 64 / 128，黑白各半。
- Shifted Square / Translation Experiment：固定 64×64 基準，從 `(0,0)` 開始，以 `circularShift(originalPixels,256,dx,dy)` 逐像素循環平移。X / Y 各 −96…+96、步長 1，沒有重新畫圖、插值或裁切。舊 `createPreset()` 無參數時仍保留初版 `(32,24)` 方便回歸測試，UI 明確傳入滑桿位移。
- `analyzeGray()` 直接呼叫既有 `fft2()`；保留未正規化的 Float64 實部、虛部、振幅及 `atan2` 相位，DC 索引仍為 0。Lab 是單通道分析，沒有 RGB 相位平均。
- 振幅顯示為 `round(255 * log1p(|F|) / log1p(scale))`，全零圖顯示黑色。一般幾何實驗各圖獨立映射；Translation 的兩圖共用固定 Original 尺度，方便直接比較。不能用不同幾何參數的亮度比較絕對能量。
- 相位用 HSV 色環：−π / +π 為紅、0 為青。`|F| ≤ max|F| × 1e-10` 的點只在畫面上改為中性色；不刪除或改寫原始係數。零振幅相位儲存為 0 僅是約定，畫面不將它當成有效相位。
- `fftshift()` 回傳顯示副本；Magnitude 與 Phase 的 DC 都移到中心 (128,128)，FFT / IFFT 與快取從未重排。
- Translation 比較全部 65,536 個原始頻率點的最大振幅差，以及 `G = F exp[-i2π(uΔx+vΔy)/256]` 的最大複數係數誤差。
- 相位差採 `arg(G·conj(F))`；Phase Change 採 `2|sin(Δφ/2)|`，固定尺度 0…2，暗色為 0、暖白為 2，灰色為無定義。兩圖共用雙側有效振幅遮罩；不以每次 min-max 拉伸，遮罩不影響係數或重建。
- 重建直接重用 Phase 1 的 `analyzeRGB()` 共軛配對與第一灰階通道，再呼叫 `reconstructChannel(originalMagnitude,shiftedPhase,fft)`。使用全部頻率與原有自共軛點、零點和 clamp / round 規則。202 組位移最大浮點重建誤差 `1.85e-13`，8-bit 像素差為 0。
- Worker 保留固定 Translation 基準與最後一組幾何參數，不累積歷史位移；舊四 Preset 的有界快取也保留供回歸測試。UI 至多一個運算中請求加上最新目標狀態，以 revision 排除舊回應，滑桿在運算期間仍可操作。輸出 buffer 是新建顯示資料，transfer 不會移走原始頻譜。

## 11. 分支、預覽與驗收

既有 [Repository](https://github.com/S-YFan/fourier-phase-swap-playground) 與 [Phase 1 正式站](https://s-yfan.github.io/fourier-phase-swap-playground/) 沿用使用者提供的專案資訊。Phase 2 從 `main`（`3741cf8`）建立 `feature/fourier-spectrum`；Release Review 通過後依使用者授權 Commit、Push 此功能分支並建立以 `main` 為目標的 PR。Merge 與正式部署留待使用者最後確認，尚未執行。

本機一般預覽：<http://127.0.0.1:8080/spectrum.html>。要重現 repository 子路徑驗證，可用：

```powershell
$env:BASE_PATH = '/fourier-phase-swap-playground/'
node scripts/serve.mjs
```

開啟 <http://127.0.0.1:8080/fourier-phase-swap-playground/spectrum.html>，兩組測試入口也加上相同前綴。`BASE_PATH` 僅供本機伺服器模擬部署，正式 GitHub Pages 不需要此環境變數、Node、CDN 或 build step。完整測試結果與未驗證範圍見 [PHASE2_REPORT.md](PHASE2_REPORT.md)。

Phase 3 的相位插值、下載、頻率編輯、3D 與 RGB Channel Mixer 均未納入本次範圍。
