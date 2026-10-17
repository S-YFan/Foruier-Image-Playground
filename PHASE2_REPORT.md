# Phase 2 — Fourier Spectrum & Geometric Experiments

## Final Release Review（2026-10-17）

**結論：未發現 Release Blocker。** 依使用者授權將完整 Phase 2 提交至 `feature/fourier-spectrum`，並以 `main` 為目標建立 Pull Request。Merge 與正式部署仍由使用者最後確認；本次維持既有視覺設計及互動功能。

- 核對本機與遠端 `main` 皆為 `3741cf89f16f9dd8fd275587202d001ef609e3d3`，遠端原先沒有 `feature/fourier-spectrum`，也沒有此分支的未關閉 PR。
- Git diff 確認 `js/fft.js`、`js/fourier.js`、`js/app.js`、`js/worker.js`、`js/image.js` 沒有變更。Playground 的變更僅為先前已核准的雙頁導航與其樣式。
- Phase Change 的有效零值為 RGB `(12,19,16)`，無效／近零相位遮罩為 `(70,76,72)`；UI 有明確文字與獨立圖例，自動化測試也驗證兩者不同。
- 初始 Translation 已有「拖動滑桿，看重建如何跟著移動」的簡短引導，故未添加重複說明。
- 暫存前 Git index 為空；`.qa/`、暫存檔及本地截圖受忽略規則排除。Release 採明確檔案清單暫存，並核對不含 `.qa`、測試輸出或暫存檔。
- 最後重跑：**Node 38/38、Phase 1 Chromium 20/20、Phase 2 Chromium 19/19，全部通過**。兩組 Chromium 均在 repository 子路徑執行，沒有對遠端正式站執行或宣稱發布後測試。
- 202 組位移的最大振幅絕對差仍為 `4.656612873077393e-10`，最大 IFFT 重建實部誤差 `1.8474111129762605e-13`，量化後像素差 **0**。容許值與數學定義未變。

本次實際測試紀錄保留於本機 `.qa/release-node.txt`、`.qa/release-phase1-browser.json`、`.qa/release-phase2-browser.json`，不隨 Commit 上傳。仍需注意：Firefox、Safari、實體手機、輔助科技、長時間記憶體與正式發布後的遠端驗證尚未執行；這些為既有驗證範圍限制，沒有新增功能或設計變更。

## Refinement 驗收報告（2026-10-17，Release Review 前紀錄）

狀態：**Translation Experiment、幾何參數與版面整理完成，本機待驗收；沒有 Commit / Push / PR / Merge / 部署。** 沿用 `feature/fourier-spectrum`，沒有重建專案或重設工作目錄。修改前的未提交版本保存在本機 `.qa/refinement-baseline/`，下方初版報告保留為歷史紀錄。

### 本次實驗設計

預設進入第四種 Preset **Translation Experiment / Shifted Square**，位移從 `(0,0)` 開始。兩個滑桿提供 `−96…+96`、步長 1 的 X / Y 平移；基準固定為中央 64×64 Square。Shifted 像素直接由該原始陣列循環平移產生，即使位於範圍端點也保留全部 4096 個黑色像素，沒有重新繪製、插值或裁切。

頁面先呈現並排的 Original、Shifted、Reconstructed 三張圖，重建卡片以綠框突出，並以 **Same magnitude. Different phase. Different position.** 作為主要結論。移除原先需要另外展開的比較流程；原始振幅差、相位變化與重建隨滑桿自動同步。桌面主圖三欄、頻譜兩欄；手機逐張直排。

兩張 Magnitude 採用同一個、固定於 Original 的 `log1p(max|F|)` 顯示尺度。Maximum Magnitude Difference 仍逐一比較原始未正規化係數，沒有比較顯示圖片。

Phase Difference 使用 `atan2(Im(G·conj(F)), Re(G·conj(F)))`，以固定 −π…π 色環顯示；Phase Change 使用 `D=2|sin(Δφ/2)|`，固定 0…2 映射為暗色至暖白。**每次更新都不做 min-max normalization**。兩圖共用遮罩：僅當兩圖振幅皆大於 `max(max|F|,max|G|)×1e-10` 才視為有效。灰色表示無定義或不穩定，與有效頻率的暗色 0 不同。遮罩只作用於顯示；包含遮罩點的所有係數仍參與重建。

Reconstructed Square 經真正 `IFFT2(|F_original| exp(iφ_shifted))` 計算。直接呼叫未修改的 Phase 1 `analyzeRGB()` 取得共軛配對與零點約定，使用灰階的第一通道，再呼叫未修改的 `reconstructChannel()`。保留自共軛點的實數規則；顯示採相同 `round(clamp(real,0,255))`。浮點誤差在量化前量測，另顯示量化後的像素差；未直接複製 Shifted buffer。

其他三個實驗只顯示各自必要控制：Square 邊長 16…160（步長 2，保持對稱置中）、Circle 半徑 8…96（步長 1）、Vertical Stripes 週期 8 / 16 / 32 / 64 / 128（全數整除 256）。切換實驗保留各自參數；Translation 的基準方形固定，不受另一個 Square 實驗的尺寸影響。維持四種 Preset，未增加本次排除的工具。

### 實際執行結果

環境仍為 Windows、Node v24.19.0、Chromium Chrome/155.0.0.0。兩組 Chromium 測試均在 `/fourier-phase-swap-playground/` repository 子路徑執行。

| 測試組 | 本次實測 |
| --- | ---: |
| Phase 1 原有 Node（未修改） | 18 / 18 |
| Phase 2 初版 Node（數學／Worker／HTTP 覆蓋保留） | 13 / 13 |
| Refinement 新增 Node | 7 / 7 |
| 全部 Node | **38 / 38** |
| Phase 1 原有 Chromium（未修改） | **20 / 20** |
| Phase 2 Chromium（原有檢查依新 UI 更新並擴充） | **19 / 19** |

位移測試有 **202 組樣本**：X、Y 兩軸的每個合法整數值都至少被涵蓋一次，加上零、單軸正負 1、四個極端角落及原先 `(32,24)`。並非窮舉全部 37,249 個 X/Y 配對。每個樣本逐點驗證像素平移、全部複數頻率係數、有效相位差的單位圓距離、D∈[0,2]，以及量化前後的 IFFT 重建。

| 指標 | Node 202 組樣本的最大誤差 | Chromium 滑桿樣本的最大誤差 |
| --- | ---: | ---: |
| 原始振幅絕對差 | `4.656612873077393e-10` | `4.656612873077393e-10` |
| 振幅相對差 | `2.972204907754668e-17` | — |
| Shift Theorem 複數係數誤差 | `8.394828241933113e-10` | `8.394828241933113e-10` |
| 有效相位差與理論值的單位圓距離 | `1.5539348315733935e-13` | — |
| IFFT 實部與 Shifted 像素差（量化前） | `1.8474111129762605e-13` | `1.5631940186722204e-13` |
| IFFT 最大虛部殘差 | `2.5623947408348613e-13` | `2.4502622153477205e-13` |
| 重建後 8-bit RGBA 與 Shifted 的差 | **0** | **0** |

振幅與複數係數的絕對容許值維持 `<1e-7`，振幅相對誤差 `<1e-12`；重建實部／虛部 `<1e-8`。沒有為了通過測試改動 FFT 定義或放寬門檻。

擴大位移測試時，原有比較函式在大位移、高頻率的直接三角函數計算出現額外的角度捨入誤差。本次僅將 Lab 理論比較中的整數相位先按 N 取餘數，再計算 sin / cos（完全相同的週期指數），消除不必要的大角度誤差。原始 FFT 和所有 Phase 1 檔案保持不變。

### 瀏覽器、非同步與顯示驗證

- 四種實驗及尺寸／半徑／週期參數實際送出 input 事件，逐像素比對來源及頻譜；X / Y 更新後七張 Canvas 全數逐像素比對真正 FFT / IFFT 結果與原始誤差數值。
- 零位移有效頻率的 D 為 0；色環兩端一致；D 色階的端點固定；單側近零振幅也會同時遮罩兩種相位變化圖，原始係數保持不變。
- UI 維持至多一個運算中請求，加上一份最新目標狀態。實測刻意將第一個 Worker 請求延遲 120ms，連續輸入 **79 次**，只送出 **2 次** Worker 請求、僅提交最後 **7 張** Canvas；舊回應沒有繪圖。另測運算中切換實驗及參數，最後選擇優先。
- 注入 `postMessage` 例外後，原圖保留、滑桿可用，重試成功。實際 Worker 測到每個 Translation 回應有 512 次反向 1D transform，即 1 次完整 IFFT2；transfer 後 Original 快取仍可重用。
- 1040px 時空間域三圖同排、兩張頻譜同排；主圖寬至少 260px，相位變化圖至少 320px。390 / 320px 時直排，重建圖寬至少 240px，四種實驗均無水平溢出。內容寬 375 / 305px，差值是桌面 Chromium scrollbar；此為窄 viewport 模擬，不是實體手機。
- 另以實際瀏覽器鍵盤操作 X / Y 滑桿到 `(+19,−19)`，檢視 Original 固定、Shifted 與 IFFT 重建同位置；當次浮點重建誤差 `1.421e-13`、8-bit 像素差 0。桌面重建卡片與相位變化圖已實際截圖檢視。
- 子路徑 HTTP 檢查通過 **17 項資源**的兩頁、CSS、ES module / Worker graph。實際導航到 Playground 等待預設交換完成，再返回 Lab；Phase 1 的全部 20 項真實圖片／Worker／事件測試也重新通過。

### 本次修改與維持範圍

`js/spectrum.js` 擴充參數、相位差、固定色階與核心重建接點；新增 `js/translation.js` 組織固定基準、平移與顯示資料；`js/spectrum-worker.js` 增加 experiment 訊息，保留初版 preset / compare 協定供回歸測試。互動運算不快取所有歷史位移，僅保留固定 Translation 基準及最後一組幾何參數；舊四 Preset 的有界快取仍保留。

`js/spectrum-app.js`、`spectrum.html`、`spectrum.css` 更新為單一實驗流程；更新 Phase 2 瀏覽器測試與 Worker 計數橋接，新增 `tests/translation.test.mjs`、`tests/translation-worker.test.mjs`。README 與本報告同步更新。

**本次 SHA-256 核對相同：**`index.html`、`styles.css`、`js/fft.js`、`js/fourier.js`、`js/app.js`、`js/worker.js`、`js/image.js`。Playground 保持 refinement 開始時的原樣。Phase 1 測試與初版 Phase 2 Node 數學／Worker／HTTP 測試的斷言保留；原先比較開關的瀏覽器流程改由實驗切換與持續更新覆蓋，沒有保留已移除按鈕的空殼 UI。

**實測**包括上述測試、真實 Canvas 比對與窄 viewport；**程式碼審查**確認有界快取、係數不受遮罩影響、無額外 Preset 或後端。沒有執行長時間 heap / GPU profiling，不能宣稱零記憶體洩漏。Firefox、Safari、實體手機、觸控與螢幕閱讀器，以及尚未部署的遠端 Phase 2 仍未驗證。現有測試範圍內沒有未解決的失敗項目。

### 本機開啟與重複執行

目前本機預覽：<http://127.0.0.1:8080/fourier-phase-swap-playground/spectrum.html>。重新啟動時：

```powershell
# 在未設定 BASE_PATH 的終端機跑全部測試
node --test tests/*.test.mjs
# 模擬 GitHub Pages 子路徑
$env:BASE_PATH = '/fourier-phase-swap-playground/'
node scripts/serve.mjs
```

Chromium 測試入口為上述前綴下的 `tests/browser.html` 與 `tests/spectrum-browser.html`。頁面載入後直接操作 Horizontal / Vertical Shift，從 `(0,0)` 觀察重建跟著移動；再切換其他三個實驗調整單一參數。

本次紀錄：`.qa/refinement-node.txt`、`.qa/refinement-browser.json`、`.qa/refinement-phase1-browser.json`、`.qa/refinement-*.png`。`.qa` 仍被 Git 忽略，測試程式本身隨專案交付。

---

## 以下為初版 Phase 2 驗收紀錄（Refinement 前）

驗收日期：2026-10-17（Asia/Taipei）。狀態：**本機實作與驗證完成，等待使用者驗收**。

## 交付與 Git 狀態

- 從乾淨的本機 `main`（`3741cf8`，Phase 1 release）建立 `feature/fourier-spectrum`。當時本機 `main` 與既有 `origin/main` tracking ref 一致；本次沒有 fetch，未宣稱查驗遠端最新狀態。
- 所有修改留在此分支工作目錄供檢查，未自行 commit、push、建立 Pull Request、merge 或發布。既有正式站維持 Phase 1。
- `index.html` 僅新增簡潔導航，原有上傳、RGB 交換、科學說明與數值結果保留。
- `spectrum.html` 是完整可執行的獨立實驗頁，包含四種幾何圖形、原圖、Magnitude / Phase、循環相位圖例、顯示規則，以及 Square／Shifted Square 數值比較。

## 修改清單

| 檔案 | 內容 |
| --- | --- |
| `spectrum.html`、`spectrum.css` | 深色 Lab、三欄頻譜、手機直排、相位圖例、比較區塊 |
| `js/spectrum.js` | 確定性二值像素、整數循環平移、單通道分析、log 與 cyclic HSV 顯示、顯示副本 fftshift、複數 Shift Theorem 比對 |
| `js/spectrum-worker.js` | 共用既有 FFT，最多四個 Preset 快取；顯示 buffer 獨立產生與 transfer |
| `js/spectrum-app.js` | Preset 事件、Worker 通訊、Canvas、數值、比較開關、錯誤與忙碌狀態 |
| `index.html`、`styles.css` | 兩頁共用的 Playground / Spectrum Lab 導航 |
| `scripts/serve.mjs` | 可選 `BASE_PATH`，實際模擬 repository 子路徑；預設 `/` 保持可用 |
| `tests/spectrum.test.mjs` | 四種圖形、有限值、顯示正確性、原始資料不變、DFT oracle、平移定理、條紋諧波、色環與閾值 |
| `tests/spectrum-worker.test.mjs`、`tests/spectrum-worker-adapter.mjs` | 執行真正 Worker，計數共享 FFT、快取與 transfer 後重複顯示 |
| `tests/spectrum-static.test.mjs` | repository 子路徑的兩頁、導航、CSS、完整 module / Worker graph 實際 HTTP 測試 |
| `tests/spectrum-browser.html`、`tests/spectrum-browser.js` | 真實頁面、四種 Preset 逐像素、比較、錯誤重試、導航、桌面與窄螢幕測試 |
| `README.md`、`VERIFICATION.md`、`PHASE2_REPORT.md` | 使用與維護說明、完整驗收紀錄 |

**未更動：**`js/fft.js`、`js/fourier.js`、`js/worker.js`、`js/app.js`、`js/image.js`、所有 Phase 1 原有測試、範例圖片與 Python 實驗檔。以 Git diff 核對。

## 數學與顯示決策

四張圖皆 256×256、白底黑色、像素值為 0 或 255。Square 是中央 64×64 方形；Circle 半徑 40、中心 (127.5,127.5)，由像素中心取樣；Vertical Stripes 週期 32（可整除 256）、黑白各 16 像素。

Shifted Square 唯一來源是 Square 原始陣列：向右 32、向下 24 的循環平移。黑色像素由 `[96,160)×[96,160)` 移到 `[128,192)×[120,184)`，沒有邊界裁切。逐像素反向平移可還原，黑色像素數皆為 4096。

Lab 直接使用原有 `FFT` / `fft2`，正向不縮放；無第二套 Fourier 演算法。分析保留未重排的 Float64 real / imag / magnitude / phase，DC 索引為 0。單通道灰階，不做 RGB 相位平均。Phase 1 的 Hermitian 校正、零點約定與重建規則完全保留。

Magnitude 顯示使用 `round(255·log1p(|F|)/log1p(max|F|))`；全零頻譜顯示黑色。每圖獨立正規化，介面明示僅供視覺化、不能跨圖比較絕對能量。

Phase 使用循環 HSV 色環，−π 和 +π 同為紅色、0 為青色。`|F| ≤ max|F| × 1e-10` 的點在畫面上以 RGB (70,76,72) 遮罩；包含精確零和近零點。介面顯示相對閾值、該圖絕對閾值與遮罩數；也提醒未遮罩小振幅仍可能不穩定。遮罩與 fftshift 都只影響顯示副本，未改係數或 Phase 1 結果。

比較逐一計算全部 65,536 個頻率點的 `max ||G|−|F||`，以及 `G−F·exp[-i2π(32u+24v)/256]` 的最大複數模長誤差。原始數值比較包含畫面遮罩的點；相位角的測試僅在有效振幅處以 sin / cos 比較 mod 2π。

## 實際執行的測試

環境：Windows、Node v24.19.0、Codex 內建 Chromium Chrome/155.0.0.0。

| 測試組 | 實測結果 |
| --- | ---: |
| Phase 1 原有 Node 測試 | 18 / 18 |
| Phase 2 新增 Node 測試 | 13 / 13 |
| 全部 Node 測試 | **31 / 31** |
| Phase 1 原有 Chromium 測試（未修改測試程式） | **20 / 20** |
| Phase 2 新增 Chromium 測試 | **12 / 12** |

Node 除了 round-trip，也以獨立直接求和 DFT 驗證每種圖形的 DC、軸上、混合頻率與 Nyquist 係數。平移定理逐點驗證複數係數；錯誤的位移符號會產生大誤差，測試明確排除只比較振幅的假陽性。條紋驗證峰值位於水平軸的 ±8 bins 與奇次諧波，其他 bins 僅容許浮點誤差。

顯示測試逐點確認 log 映射、循環相位 RGB、零點中性色、alpha=255、DC 居中，以及輸入像素和四組原始頻譜陣列完全不變。Worker 測試記錄：每個新 Preset 512 次 1D transform（1 次 2D FFT），四個共 2048 次；重新選擇與比較不增加 FFT 次數。Transfer 後仍可重複取得完全相同顯示資料；錯誤 Preset 不破壞快取。

HTTP 測試實際在 `/fourier-phase-swap-playground/` 掛載並讀取 16 項兩頁與 module graph 資源；不只是靜態解析網址。兩組瀏覽器測試均使用這個前綴執行。Phase 2 會實際點擊導航、等待 Playground 預設兩張圖片完成交換，再返回 Lab。

瀏覽器切換四種圖形後，比對每張原圖、Magnitude、Phase Canvas 的全部 RGBA 像素。比較區的四個 Canvas 也逐像素比對原始分析得到的顯示資料，頁面顯示的數值差異與計算一致。另實測比較開關、忙碌時快速點擊、防止資料交錯、注入 `postMessage` 例外後保留圖像並成功重試。

布局實測 iframe 1040px 時三張主圖同排、兩個比較組同排；390px 和 320px 時直排。兩種手機寬度皆沒有水平溢出（內容寬分別 375、305px，差值為桌面 Chromium 的垂直 scrollbar）。這是窄 viewport 模擬，不是實體手機驗證。

## 實測數值

| 指標 | 最大誤差 |
| --- | ---: |
| Square / Shifted Square 原始振幅最大絕對差 | `2.3283064365386963e-10` |
| 上述差異 / max Square magnitude | `1.486102453877334e-17` |
| Shift Theorem 複數係數最大誤差 | `1.172461816332604e-8` |
| Phase 1 解碼圖 FFT round-trip | `1.1368683772161603e-13` |
| Phase 1 同圖顯示 RGBA 差 | `0` |
| Phase 1 瀏覽器重建最大虛部 | `3.1449365274995477e-13` |

Shift Theorem 的自動化容許值為原始係數絕對誤差 `< 1e-7`、振幅相對誤差 `< 1e-12`；不是將係數或輸入先縮放成 0–1。此例 DC 為 15,667,200，頻域誤差尺度不能直接與空間像素誤差等同。

## 實測、審查與尚未驗證的界線

- **實測：**以上 31 項 Node 與 32 項 Chromium、相對路徑 HTTP、逐像素 Canvas、Worker 呼叫計數、1040 / 390 / 320px 布局、錯誤恢復。另以實際瀏覽器檢視桌面主圖與比較區。
- **程式碼審查：**Phase 1 數學與測試檔案未變；Lab 無 CDN、框架、外部素材、後端或持久化；cache 由四個合法 ID 限制。未做長時間 heap / GPU profiling，不能宣稱完全沒有記憶體洩漏。
- **未驗證：**Firefox、Safari、實體 iOS / Android、螢幕閱讀器、觸控、長時間記憶體峰值；Phase 2 正式 GitHub Pages 遠端環境（尚未發布）。Circle 的連續旋轉對稱只能近似呈現於離散像素網格。
- **已知未解決問題：**目前測試範圍內無失敗項目；上述未驗證環境仍保留驗收界線。未加入本階段排除的插值、下載、頻率編輯、3D 或帳號功能。

初次在沙箱內執行 HTTP 測試受到 localhost 連線權限限制；核准沙箱外本機測試後，完整測試通過。這是執行環境問題，未變更 FFT 定義或放寬容許值來通過測試。

## 重複執行與本機驗收

```powershell
node --test tests/*.test.mjs
$env:BASE_PATH = '/fourier-phase-swap-playground/'
node scripts/serve.mjs
```

開啟下列本機網址：

- Lab：<http://127.0.0.1:8080/fourier-phase-swap-playground/spectrum.html>
- Playground：<http://127.0.0.1:8080/fourier-phase-swap-playground/index.html>
- Phase 1 測試：<http://127.0.0.1:8080/fourier-phase-swap-playground/tests/browser.html>
- Phase 2 測試：<http://127.0.0.1:8080/fourier-phase-swap-playground/tests/spectrum-browser.html>

若要使用預設根目錄模式，先在同一 PowerShell 用 `Remove-Item Env:BASE_PATH -ErrorAction SilentlyContinue` 移除環境變數，再啟動伺服器。執行 Node 測試時也使用未設定 `BASE_PATH` 的終端機，保留原有根路徑測試環境。

本機原始紀錄位於被 Git 忽略的 `.qa/phase2-node.txt`、`.qa/phase2-browser.json`、`.qa/phase2-phase1-browser.json` 及 `.qa/phase2-spectrum-*.png`。測試程式隨專案交付，無須安裝套件。
