# Fourier Phase Swap Playground

What makes an image recognizable — magnitude or phase?

這是 **Phase 1：可直接運作的 RGB 相位交換實驗**。HTML、CSS、原生 JavaScript，無框架、無 CDN、無第三方執行期套件、無後端。所有使用者圖片都在瀏覽器記憶體內解碼、運算與顯示，不會上傳到伺服器。

開啟時會載入這個資料夾原有的 `Monkey.jpg` 和 `NSYSUlogo.jpg`，立即產生兩個結果。可以用上傳按鈕或拖放來更換任一圖片；圖片載入後自動計算，也可以按 **Swap phases** 再算一次。原始 Python 與圖片檔案均保留。

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
├── favicon.svg
├── js/
│   ├── app.js                    # UI、圖片上傳事件、Worker 通訊
│   ├── image.js                  # 真實圖片解碼、先裁切再縮放、白底合成
│   ├── fft.js                    # 自包含 radix-2 FFT 與 separable 2D FFT
│   ├── fourier.js                # RGB 頻譜、相位交換、重建、自我檢查
│   └── worker.js                 # 背景計算、快取 A/B 頻譜
├── scripts/
│   └── serve.mjs                 # 零套件依賴的本機預覽伺服器
├── tests/
│   ├── fourier.test.mjs          # 獨立 DFT 對照與基本數學測試
│   ├── verification.test.mjs     # 256² 圖樣矩陣、稀疏頻譜回歸測試
│   ├── worker.test.mjs           # Worker 實際 FFT 呼叫計數與快取測試
│   ├── worker-adapter.mjs        # Node worker_threads 測試橋接
│   ├── static.test.mjs           # HTTP、MIME、部署相對路徑檢查
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
├── Monkey.jpg                    # 原有範例圖片
├── NSYSUlogo.jpg                 # 原有範例圖片
└── Graph_Experiment_FT_IFT.py     # 原有 Python 實驗，網站不依賴它
```

正式網站需要 `index.html`、`styles.css`、`favicon.svg`、`js/`、兩張範例圖片與 `.nojekyll`。其他檔案是說明、開發與驗證用途。

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

陣列索引固定為 `y * N + x`。頻域對應 `v * N + u`，DC 位於 `[0,0]`。這一版沒有頻譜視覺化，也**不執行 fftshift**。日後 Phase 2 的 fftshift 只用在顯示副本，不應改動這裡的計算排列。

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

另涵蓋近零振幅相位的回歸測試、9 種 256² 圖樣的 81 種有序交換、Parseval 能量、RGB 通道隔離、Worker 真實 FFT 呼叫次數、快取替換與靜態部署資源檢查。Node 共 **18/18 通過**。

瀏覽器自動化測試需要啟動 `node scripts/serve.mjs`，然後開啟 <http://127.0.0.1:8080/tests/browser.html>。頁面會自動執行 **20 項**真實圖片解碼、Canvas、Web Worker 與實際頁面事件測試，並顯示每項結果與數值指標。Windows Chromium 本次 **20/20 通過**。測試檔案已隨附；不需要安裝 Python 或 Pillow，除非要自行重新生成測試素材。

256² 測試圖樣的 FFT round-trip 最大實部誤差約 `1.28e-13`，同圖振幅相位重建約 `2.42e-13`，81 種交換的最大虛部殘差約 `3.55e-12`。相同圖片重建到 8-bit 後的最大像素差為 **0**。這些是測試樣本的實測值，不是對任意輸入的誤差上界。網頁每次啟動也會執行原有的 round-trip 自我檢查（容許值 `1e-8`），若失敗會停止計算。

手動測試建議：

- 第一次載入應同時看到猴子、校徽與兩個交換結果。
- 兩個欄位上傳同一張圖片，兩個結果應與裁切後的原圖相同，裁切比例為 0%。
- 分別上傳 PNG、JPEG、WebP，以及帶透明度或長寬比懸殊的圖片。
- 取消檔案選擇、選擇錯誤格式或損壞檔案，不應破壞原有結果。
- 按 Swap 可重新運算；更換任一圖也會自動運算。
- 桌面雙欄、手機單欄，鍵盤可以聚焦上傳與 Swap。

## 10. 建立 GitHub Repository 並免費部署

本交付尚未建立遠端 repository，也尚未發布網址。GitHub Free 的 Pages 可使用 public repository；下列是免建置工具的部署方式。[GitHub 官方說明](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

1. 在 GitHub 選擇 **New repository**。
2. 名稱可用 `fourier-phase-swap-playground`，選 **Public**。
3. 若使用下列本機 Git 指令，不要讓 GitHub 預先加入 README、license 或 `.gitignore`，以便推送這個已完整建立的資料夾。
4. 在專案資料夾執行（將 `YOUR_USERNAME` 換成你的 GitHub 帳號）：

```powershell
git init -b main
git add index.html styles.css favicon.svg js scripts tests package.json README.md VERIFICATION.md .gitignore .nojekyll Monkey.jpg NSYSUlogo.jpg Graph_Experiment_FT_IFT.py
git commit -m "Build RGB Fourier phase swap playground"
git remote add origin https://github.com/YOUR_USERNAME/fourier-phase-swap-playground.git
git push -u origin main
```

5. 到 repository 的 **Settings → Pages**。
6. 在 **Build and deployment → Source** 選 **Deploy from a branch**。
7. Branch 選 **main**，資料夾選 **/(root)**，按 **Save**。
8. 等待部署成功，使用 Pages 頁面的 **Visit site**。一般網址為 `https://YOUR_USERNAME.github.io/fourier-phase-swap-playground/`。

此設定直接使用根目錄的 `index.html` 與 `.nojekyll`；不需要 Vite、Actions 自訂 YAML、npm build 或付費服務。設定與部署狀態以 GitHub 的 Pages 頁面為準。[發布來源設定文件](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

日後更新只需要 commit / push 到 main，Pages 會重新發布。若看到 404，檢查選到的 branch / folder、根目錄的 `index.html`、檔名大小寫與 repository 的 Actions 部署結果。

## 11. 後續階段

- **Phase 2**：可展開的 magnitude / phase 頻譜、log 顯示、顯示用 fftshift、相位色環與更完整的科學說明。
- **Phase 3**：維持共軛對稱的相位插值、零振幅與自共軛點規則、下載、重設。

本次以 Phase 1 完整可運作為交付範圍，沒有加入尚未實作的按鈕或模擬頻譜。
