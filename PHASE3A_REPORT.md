# Phase 3A — Gaussian Frequency Filtering

編號對照更新（2026-10-29）：本文的 Experiment 編號已對齊目前網站：**002 — Different Color, Different Phase**、**005 — Spectrum / Translation**；完整清單見 [README](README.md#architecture--implementation)。Phase 1／Phase 2／Phase 3A 是歷史開發階段，原始日期與測試數據保留。

日期：2026-10-19（Asia/Taipei）。狀態：**Phase 3 與 FOURIER IMAGE LAB 品牌更新已完成實作與驗證；發布狀態以 Pull Request 與 GitHub Pages 驗證紀錄為準**。

## Phase 3 發布與 FOURIER IMAGE LAB（2026-10-19）

- 三頁 header、footer、瀏覽器 title、application-name 與 description metadata 統一使用 **FOURIER IMAGE LAB**；主頁 heading 使用新品牌及副標題 **Interactive Experiments in Fourier Image Processing**。
- 本節涉及的實驗依目前編號為 **001 — RGB Fourier Phase Swap**、**003 — Gaussian Filtering**、**005 — Spectrum Lab**。Repository、GitHub Pages URL、檔名與路由不變。
- 保留最新核准的 Section 01 Original / LPF / HPF、Section 02 Original / Sharpening，以及三個滑桿的 markup、樣式與位置。品牌更新期間未更動任何運算 JS、`filtering.css`、Monkey 或 Cat 照片，並以 SHA-256 比對確認。
- README 以遠端 main 的最新文件整理為基礎，整合 Phase 3 實驗、三頁連結、照片、測試入口與新品牌；保留原有 Phase 1／Phase 2 內容。package description 與測試入口標題同步更新。
- 完整驗證 **48/48 Node、20/20 Experiment 001 Chromium、19/19 Experiment 005 Chromium、15/15 Experiment 003 Chromium** 通過。涵蓋 1040／390／320px、六個方向實際導航、三頁品牌 metadata、兩區參數獨立性與共用來源。
- 發布流程依擁有者授權，經 final diff 審查、Commit、Push、以 main 為目標的 PR、GitHub checks 後合併；正式站部署與驗證結果以 PR／最終交付紀錄為準。沒有新增後續實驗。

以下保留歷次實作與介面調整的歷史紀錄，其「未 Commit／部署」描述為當時狀態。

## Experiment 003 兩區獨立參數與 Original 比較（2026-10-19）

本節為最新介面與參數狀態；後續各節保留前次介面及原始實作的歷史紀錄。

- **Section 01 — Gaussian Low / High Pass**：獨立 Sigma (σ₁)，寬螢幕按 **Original | Gaussian LPF | Gaussian HPF** 三欄排列；窄螢幕改為直列。此區沒有 Alpha 控制項。
- **Section 02 — Gaussian Sharpening**：獨立 Sigma (σ₂) 與 Alpha (α)，按 **Original | Gaussian Sharpening** 雙欄比較。兩個 Sigma 預設皆為 30、範圍 1…200、步長 1；Alpha 預設 1.0、範圍 0…3、步長 0.1，初始化後各自保留狀態。
- `H_LPF = G(σ₁)`、`H_HPF = 1−G(σ₁)`、`H_Sharp = 1+α[1−G(σ₂)]`。`filterRGB()` 新增可選 `filters`，只建立與 IFFT 所要求的輸出；預設仍支援三種操作以保留數學回歸測試。Worker 新增 `pass`／`sharpen` request group，兩者共用同一份 RGB 頻譜快取。
- 調整 σ₁ 只重建 LPF／HPF，共 6 次通道 IFFT2；調整 σ₂ 或 Alpha 只重建 Sharpening，共 3 次。上述操作皆不解碼圖片、不重算正向 FFT、不重繪另一區的結果或 Original。
- 更換照片僅解碼一次、送出一次來源分析請求（3 次通道 FFT2）。同一份顯示像素直接繪製到兩個 Original，兩區結果皆更新；Sigma 與 Alpha 保留各自的目前值。沒有新增第二個上傳或解碼流程。
- UI 最多一個濾波請求運算中，每區各保留一份最新參數，輪流處理有變更的區段。來源 revision 與區段 revision 分開，另一區的輸入不會使進行中的有效重建失效。一區暫時傳送失敗時，另一區仍可更新，錯誤不會被其成功訊息清掉，失敗區可獨立重試。
- 沿用原有 Float64 數值重建、RGB 通道順序與顯示副本規則：HPF 僅於顯示加 128；LPF／Sharpening 直接 clamp。FFT/IFFT 核心、Phase 1／Phase 2 程式、三頁導航及 Monkey／Cat 照片未更動。

本次修改：`filtering.html`、`filtering.css`、`js/filtering.js`、`js/filtering-worker.js`、`js/filtering-app.js`、`tests/filtering.test.mjs`、`tests/filtering-worker.test.mjs`、`tests/filtering-browser.js`，並同步 README、VERIFICATION 與本報告。

驗證結果：**48/48 Node、20/20 Phase 1 Chromium、19/19 Phase 2 Chromium、15/15 Experiment 003 Chromium** 全部通過。新增獨立 DFT 數值對照與精確 FFT/IFFT 呼叫計數；瀏覽器另追蹤 request group、圖片 decode 與 Canvas 繪製次數，確認互不重算與 Original 共用來源。123 次連續參數輸入只提交 3 次濾波請求，並保留兩組不同的最新 Sigma；雙區同步操作各只計算一次。所有顯示像素與對應數值核心的差異為 0。

三頁之間六個方向的導航、公開編號、repository 子路徑資源及 1040／390／320px 版面皆通過；1040px 明確檢查第一區三圖同列且按指定順序、第二區雙圖同列。原始紀錄保存於忽略目錄 `.qa/experiment003-split-*`。未 Commit、Push、建立 PR、Merge 或部署。

## Experiment 003 UI 與導航微調（2026-10-19）

本節為 Phase 3A 完成後的介面微調；下方保留最初實作紀錄。

- 公開名稱統一為 **EXPERIMENT 003 — Gaussian Filtering**，移除介面的 `003A`、`PHASE 3A`。三頁的瀏覽器標題、導航與頁尾使用一致的 Experiment 編號（目前為 001／003／005）；Spectrum Lab 補上直接前往 Gaussian Filtering 的連結。
- 控制項改為有 legend 的兩組 fieldset：**Gaussian Frequency Width — Sigma (σ)** 明示適用於 LPF、HPF、Sharpening；**Sharpening Only — Strength (α)** 明示 LPF、HPF 不受影響。Strength 與 Sharpening 標題共用既有暖色，Canvas 也連結到該控制項說明。範圍與預設值不變。
- 共用導航保留深色風格與折行；窄螢幕隱藏裝飾性分隔線，避免換行時出現獨立斜線。
- 修改 `index.html`、`spectrum.html`、`filtering.html`、`styles.css`、`filtering.css`；擴充 `tests/spectrum-static.test.mjs`、`tests/spectrum-browser.js`、`tests/filtering-browser.js`，同步 README 與驗證紀錄。沒有更動任何 `js/` 模組或照片。
- 修改前先重跑 Gaussian 數學測試（7/7 通過），確認 alpha 僅影響 Sharpening。完整回歸 **47/47 Node、20/20 Phase 1 Chromium、19/19 Phase 2 Chromium、13/13 Experiment 003 Chromium** 全部通過。
- 擴充測試逐像素確認 alpha = 0 與 alpha = 3 時 LPF／HPF 均保持一致；sigma 從 1 到 200 時三種結果皆更新。實際點擊三頁間所有六個方向，在 `/fourier-phase-swap-playground/` 子路徑驗證連結、頁面初始化、公開編號及目前頁面狀態；三頁分別於 1040／390／320px 驗證所有導航連結可見且無水平溢出。
- 本次記錄保存於忽略目錄 `.qa/experiment003-refinement-*`。未 Commit、Push、建立 PR、Merge 或部署；跨瀏覽器與實體裝置限制同下方原始報告。

## 實作結果

新增獨立 `filtering.html`，沿用 Fourier Lab 的深色科學實驗介面。使用者可選 Monkey / Cat，或上傳 PNG / JPEG / WebP，同時比較 Original、Gaussian LPF、Gaussian HPF 與 Gaussian Sharpening。桌面四欄，較窄螢幕 2 × 2，比較圖片不必切換頁籤。sigma 範圍 1…200、步長 1、預設 30；alpha 範圍 0…3、步長 0.1、預設 1.0。

Playground 新增 Gaussian Filtering 入口，預設 Image A / B 更新為 Monkey / Cat；共用導航允許折行以避免窄螢幕溢出。Spectrum Lab 的 HTML、專用 CSS、所有 Phase 2 運算／UI 模組保持原樣。既有 `fft.js`、`fourier.js`、`image.js`、Phase 1 `worker.js` 亦無修改。沒有新增套件或 build step。

## Gaussian 實作與 sigma 慣例

`js/filtering.js` 重用 `analyzeRGB()` 產生的三通道 magnitude / phase 與既有 `reconstructChannel()`。每個通道分別乘上以下實數 transfer function，再各自執行 IFFT：

```text
H_LPF   = exp[−(u² + v²)/(2 sigma²)]
H_HPF   = 1 − H_LPF
H_Sharp = 1 + alpha × H_HPF
F_out   = H × F
I_out   = IFFT(F_out)
```

sigma 使用 **1000 × 1000 參考影像的 frequency-bin units**。對實際 `N × N` FFT，`sigmaBins = sigma × N/1000`；目前 256²、預設 sigma = 30 時為 7.68 bins。程式將實際 signed discrete bins 乘上 `1000/N` 後代入公式，因此相同 sigma 保有相同的相對截止頻率。

FFT 原生順序的 DC 位於 `[0,0]`；每一維的座標為 `k < N/2 ? k : k−N`。此排列等價於先在中央座標建立 Gaussian mask，再做 NumPy `ifftshift`。程式未硬編碼 1000² mask，也未重排來源 FFT。實數、偶對稱 transfer function 保留來源的 conjugate symmetry；既有重建函式亦保留 self-conjugate bins 的實數性。

三個輸出各有 R/G/B 的 `Float64Array real / imag`，共 9 次真正的 IFFT2；沒有用空間域加減來替代任何輸出的 IFFT，也沒有 CSS blur、absolute-value IFFT 或逐圖 normalization。

## 數值與顯示分離

| 操作 | 原始數值 | 最後顯示 |
| --- | --- | --- |
| LPF | `Re(IFFT(H_LPF × F))` | `round(clamp(real,0,255))` |
| HPF | `Re(IFFT(H_HPF × F))`，DC 為 0，可正可負 | `round(clamp(real+128,0,255))` |
| Sharpening | `Re(IFFT(H_Sharp × F))`，等於原圖加 alpha 倍高頻響應 | `round(clamp(real,0,255))` |

HPF 的灰色 128 表示零響應，亮／暗分別表示正／負響應。`+128` 僅用於新建的顯示 buffer，不改寫原始數值。Sharpening 保留原圖，不加 128；alpha = 0 時重建原圖。三種顯示都不取絕對值，也不依各圖最大值調整對比。

## Worker 與互動

- 專用 Worker 僅保留目前一張圖片的 RGB 頻譜，約 3 MiB。載入／更換來源做 3 次 FFT2；調整參數只使用快取與 9 次 IFFT2。
- 發送新建的 RGBA buffer 時使用 transfer，來源頻譜不會 detach。錯誤的圖片更新保留上一份有效快取。
- 至多一個濾波請求運算中，滑桿持續可操作，後續只保留最新參數。revision 會排除過期回應，避免前一張圖片結果顯示在新來源旁。
- 上傳沿用 25 MiB 限制與共同解碼／裁切流程；Blob URL 在成功或失敗後均撤銷。暫時 postMessage 失敗可由下一次操作恢復；Worker 啟動／執行失敗會顯示錯誤並停用操作。
- 圖片解碼期間調整滑桿後，即使解碼失敗，也會使用上一份有效來源與最新參數恢復一致的結果。

## 照片替換

兩張照片均已存在於使用者工作目錄，不需另索取或下載：

| 資產 | 原始尺寸 | 狀態 |
| --- | --- | --- |
| `Monkey.jpg` | 2592 × 3467 | 使用者已替換的新照片，保留原檔 |
| `Cat.jpg` | 2268 × 3064 | 使用者提供的新照片，保留原檔 |

保留開始時已有的照片修改與舊 logo 刪除。Playground、Gaussian 頁面、README 與 Python 範例的有效圖片配對均為 Monkey / Cat；舊 logo 不再作為預設範例。原專案沒有獨立的 preload 設定或待更新的預載清單。

原始照片尺寸與比例不變。FFT 前處理沿用「先置中裁切正方形，再縮放到 256²」；不把直幅照片拉成正方形。畫面標示原始尺寸及裁切規則。Python 僅改第二張照片檔名，歷史運算流程保留。

## 修改與新增檔案

| 類別 | 檔案 | 用途 |
| --- | --- | --- |
| 新增 | `filtering.html`、`filtering.css` | 獨立濾波實驗與響應式比較介面 |
| 新增 | `js/filtering.js` | Gaussian mask、Float64 數值輸出、獨立顯示映射 |
| 新增 | `js/filtering-worker.js` | 頻譜快取、真正 RGB IFFT、buffer transfer |
| 新增 | `js/filtering-app.js` | 來源選擇／上傳、參數、revision 與錯誤恢復 |
| 新增 | `tests/filtering.test.mjs` | 獨立 DFT、mask、RGB、alpha 與顯示映射 |
| 新增 | `tests/filtering-worker.test.mjs`、`tests/filtering-worker-adapter.mjs` | 真實 Worker、FFT/IFFT 計數、快取與錯誤恢復 |
| 新增 | `tests/filtering-static.test.mjs` | 照片檔案與有效範例參照 |
| 新增 | `tests/filtering-browser.html`、`tests/filtering-browser.js` | 12 項真實瀏覽器測試 |
| 修改 | `js/app.js`、`Graph_Experiment_FT_IFT.py` | 第二張範例改用 Cat |
| 修改 | `index.html`、`styles.css` | 濾波頁面入口與導航折行 |
| 修改 | `tests/browser.js`、`tests/static.test.mjs` | Monkey / Cat 預設配對與 HTTP 圖片資源驗證 |
| 修改／新增 | `README.md`、`VERIFICATION.md`、`PHASE3A_REPORT.md` | 操作、數學、資產、測試與交付說明 |
| 使用者預先變更 | `Monkey.jpg`、`Cat.jpg`、舊 logo 刪除 | 保留並整合使用者提供的照片 |

## 測試結果

環境：Windows、Node v24.19.0、Chromium 155、Python 3.12 / NumPy 2.2.6。Python / NumPy 僅用於這次額外交叉比對，網站與 Node 測試套件均不依賴它們。

| 測試 | 結果 |
| --- | --- |
| 完整 Node：`node --test tests/*.test.mjs` | **47/47 通過**（既有 38 項 + 新增 9 項） |
| Phase 1：`tests/browser.html` | **20/20 通過** |
| Phase 2：`tests/spectrum-browser.html` | **19/19 通過** |
| Phase 3A：`tests/filtering-browser.html` | **12/12 通過** |
| NumPy `fft2` / `ifftshift` / `ifft2`，12 組尺寸／參數 | 全部通過；最大實部差異 **5.68e-13**，最大虛部殘差 **4.90e-13** |
| 新增模組與瀏覽器測試的 JavaScript 語法、Git whitespace 檢查 | 通過（接受專案既有 CRLF 行尾） |

Node 新增驗證涵蓋 LPF 隨 sigma 降低而抑制高頻、HPF 移除 DC／低頻、固定 HPF 映射且不改寫數值、alpha = 0、alpha 高頻線性貢獻、RGB 順序與通道隔離、conjugate symmetry／Nyquist 與有效頻譜尺寸、錯誤參數、Worker transfer／快取／錯誤恢復，以及照片參照。

獨立 tiny DFT / centered mask / IFFT 最大差異為 `4.51e-12`。8²／64²／256² alpha = 0 的最大實部差異為 `1.14e-13`，8-bit 顯示像素差為 **0**；同組測試最大虛部殘差 `4.11e-13`。NumPy 交叉比對涵蓋 8²／64²／256²，以及 `(sigma,alpha)` 為 `(1,0)`、`(30,1)`、`(100,2.5)`、`(200,3)`，逐 RGB 通道比較三種數值輸出。

全部瀏覽器套件都在 `/fourier-phase-swap-playground/` repository 子路徑執行，涵蓋真實圖片解碼、Canvas、module Worker 與實際 UI 事件。Phase 3A 顯示像素與核心結果差異 **0**；82 次連續參數輸入僅提交 **2 次**濾波請求並顯示最新目標。另驗證來源／參數同時更新、三種格式、長寬圖與透明圖、黑白常數圖、格式／大小／損壞檔案、取消選擇、postMessage 故障與恢復、1040／390／320px 無水平溢出。10 個 Blob URL 全部撤銷。

原始瀏覽器 JSON、NumPy 比對程式／結果與畫面保存在本機忽略目錄 `.qa/phase3a-*`；可重複執行的 Node 與瀏覽器測試位於 `tests/`。未新增任何遠端部署或發布動作。

## 重跑方式與限制

```powershell
node --test tests/*.test.mjs
node scripts/serve.mjs
```

預覽：`http://127.0.0.1:8080/filtering.html`。瀏覽器測試：`http://127.0.0.1:8080/tests/filtering-browser.html`。模擬 repository 子路徑時，在啟動前設定 `$env:BASE_PATH = '/fourier-phase-swap-playground/'`。

- FFT 仍採既有的 256²、週期邊界與 sRGB 0–255 數值。照片兩邊不連續可能產生邊緣響應；顯示 clamp 可能裁掉 HPF 極值與 Sharpening 過衝。
- 未驗證 Firefox、Safari、實體手機、特殊 ICC／EXIF、螢幕閱讀器與長時間記憶體使用。手機寬度測試是在 Chromium iframe 內進行。
- 未使用 OS 檔案選擇器；上傳測試使用真實 File / DataTransfer / DOM 事件。未執行正式 GitHub Pages 的遠端驗證。
- 本報告記錄的是 Phase 3A 當時的實作範圍；Ideal LPF / HPF 與 Phase Interpolation 目前仍未實作。
- Phase Region Swap 已於後續完成為 **Experiment 004 — Partial Phase Region Swap**，見[實驗頁](region-swap.html)與[說明文件](documentation.html#experiments)。
