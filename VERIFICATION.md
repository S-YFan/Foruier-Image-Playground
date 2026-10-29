# Verification & Testing

編號對照更新（2026-10-29）：**Experiment 002 — Different Color, Different Phase** 使用 [color-phase.html](color-phase.html)；**Experiment 005 — Spectrum / Translation** 使用 [spectrum.html](spectrum.html)。其餘仍為 001 — Magnitude / Phase Swap、003 — Gaussian Filtering、004 — Partial Phase Region Swap。首頁、說明文件與共用導覽均按 001–005 排列；中英文標題、測試入口與斷言使用相同編號。

本次重新編號後的本機驗證：**5/5 靜態／雙語測試、121/121 Edge Chromium 瀏覽器檢查、8/8 雙語版面檢查通過**。檢查涵蓋 110 項子路徑資源、14 個中英文頁面的標題與導覽編號、首頁及說明文件清單順序、語言切換與所有實驗操作。命令為 `node --test tests/localization.test.mjs tests/spectrum-static.test.mjs` 與本機 `.qa/color-phase-check.mjs`；瀏覽器結果保存在 `.qa/color-phase-final/report.json`。以上為提 PR 前的本機驗證紀錄；合併與發布狀態以 GitHub PR 為準。

下方歷史報告中的 Experiment 編號已換成目前編號，測試次數與日期仍為當次實測；「Phase 2」保留開發階段的意義，對應現在的 Experiment 005。`.qa/` 內的舊截圖、JSON 與基線副本保留當時畫面，不能作為目前編號的依據。

Phase 3 Finalization／品牌更新：2026-10-19（Asia/Taipei）。三頁統一為 **FOURIER IMAGE LAB**，主頁副標題為 **Interactive Experiments in Fourier Image Processing**。已核准的滑桿、兩區布局、運算 JS 與照片保持原樣。完整 **48/48 Node、20/20 Experiment 001、19/19 Experiment 005、15/15 Experiment 003 Chromium** 通過；包含三頁品牌、metadata、repository 子路徑、1040／390／320px 與六個導航方向。README 已整合最新遠端 main 的文件更新。發布經授權的 Commit／Push／PR／checks／Merge 流程進行，部署實測結果見 PR 與最終交付。詳細記錄見 [PHASE3A_REPORT.md](PHASE3A_REPORT.md)。下方各次「未 Commit／部署」為歷史狀態。

Experiment 003 兩區獨立參數更新：2026-10-19（Asia/Taipei）。第一區為 Original / LPF / HPF 與 Sigma (σ₁)，第二區為 Original / Sharpening 與獨立 Sigma (σ₂)／Alpha。更換來源只解碼與分析一次，兩個 Original 同步；參數更新只計算對應區段。**48/48 Node、20/20 Phase 1 Chromium、19/19 Phase 2 Chromium、15/15 Experiment 003 Chromium** 通過，涵蓋數值與顯示獨立性、精確 IFFT 呼叫計數、快取、decode／重繪次數、快速輸入與獨立錯誤恢復、三頁導航與窄螢幕布局。詳見 [最新實作紀錄](PHASE3A_REPORT.md)。未 Commit、Push、PR、Merge 或部署。下方為先前介面的歷史紀錄。

Experiment 003 介面微調更新：2026-10-19（Asia/Taipei）。公開命名、三頁導航、Sigma／Strength 控制項分組完成，未更動運算程式或照片。重新驗證 **47/47 Node、20/20 Phase 1 Chromium、19/19 Phase 2 Chromium、13/13 Experiment 003 Chromium** 通過；包含 repository 子路徑下六個方向的實際導航、三頁 1040／390／320px 導航布局，以及 alpha 僅影響 Sharpening、sigma 影響三種結果的像素檢查。詳見 [微調紀錄](PHASE3A_REPORT.md)。未 Commit、Push、PR、Merge 或部署。

Phase 3A 更新：2026-10-19（Asia/Taipei）。已新增獨立 Gaussian Filtering 頁面，使用真正的 RGB 頻域濾波與 IFFT，預設範例改為擁有者提供的 Monkey / Cat 照片。全部 **47/47 Node、20/20 Phase 1 Chromium、19/19 Phase 2 Chromium、12/12 Phase 3A Chromium** 測試通過。12 組 NumPy 交叉比對最大實部差異 `5.68e-13`，最大虛部殘差 `4.90e-13`。本次沒有 Commit、Push、PR、Merge 或部署。實作、檔案清單、sigma 慣例與驗證限制見 [PHASE3A_REPORT.md](PHASE3A_REPORT.md)。以下 Phase 1 / Phase 2 的日期與發布狀態均為歷史紀錄。

Phase 2 Refinement 更新：2026-10-17（Asia/Taipei）。本機 `feature/fourier-spectrum` 分支實測 **38/38 Node、20/20 Phase 1 Chromium、19/19 Phase 2 Chromium** 通過。包含原有 31 項 Node 與 7 項新增測試，兩組瀏覽器測試均在 `/fourier-phase-swap-playground/` 子路徑執行。202 組位移的 IFFT 最大實部誤差 `1.8474111129762605e-13`，8-bit 顯示像素差為 0。Phase 1 FFT、RGB 重建、Worker 和原有測試程式未更動，Playground 保持 refinement 開始時的原樣。

Final Release Review（2026-10-17）再次執行 **38/38 Node、20/20 Phase 1 Chromium、19/19 Phase 2 Chromium** 全部通過；未發現 Release Blocker。Phase 1 核心無 diff，滑桿引導已存在，Phase Change 零值與無效遮罩明確不同，Release 暫存清單排除 `.qa`、暫存檔與截圖。依使用者授權提交功能分支並建立 PR；Merge 及部署尚未執行。

Phase 2 修改清單、誤差數值、重複執行方式，以及實測／程式碼審查／未驗證範圍，見 [PHASE2_REPORT.md](PHASE2_REPORT.md)。

以下保留 Phase 1 原始驗證紀錄；其中日期與部署狀態描述的是當時的測試。

# Phase 1 Verification & Testing（歷史紀錄）

日期：2026-10-16（Asia/Taipei）。未加入 Phase 2 / Phase 3。

## 結論與實際執行範圍

本次實際執行 **18 項 Node 自動化測試與 20 項瀏覽器自動化測試，全部通過**。測試環境為 Windows、Node v24.19.0，以及 Codex 內建 Chromium（user agent: Chrome/155.0.0.0）。

原有 9 項測試在修正前也全部通過，但新增稀疏頻譜測試明確失敗；不能只用原來的 round-trip 測試推論所有相位交換都正確。

| 檢查 | 實際執行的證據 |
| --- | --- |
| 真正的 RGB 2D FFT / IFFT | 8×8 一般複數輸入對照獨立、直接求和的 2D DFT；不是拿同一套 FFT 當唯一 oracle |
| IFFT2(FFT2(A)) | 9 種 256×256 圖樣，逐 RGB 通道比對浮點值；另測 10 個真實解碼圖片檔案 |
| Magnitude A + Phase A | 比對裁切前浮點重建；再比對 8-bit 輸出逐像素完全一致 |
| normalization | DC 等於通道總和、單獨 DC 的反轉換、Parseval 能量、獨立 DFT / IFFT 對照 |
| 頻率索引與複數運算 | 偏移脈衝的相位斜坡、非零虛部輸入、兩個交換方向的獨立 DFT 對照 |
| 共軛對稱、Nyquist、零振幅 | 逐點檢查配對的振幅與相位、四個自共軛點、全黑／白／常數與稀疏頻譜 |
| 虛部殘差 | 9 種圖樣的 81 種有序配對，另測瀏覽器實際 Worker 重建 |
| RGB 獨立性 | 只改 G，R/B 頻譜及輸出不變；灰階輸出的三通道相等 |
| 裁切／縮放 | 寬圖、高圖、奇數多餘邊長；驗證全部 256² 像素，不排除邊緣 |
| clipping／無額外 normalization | 負值、超過 255、四捨五入、裁切比例、低對比圖樣保持原數值 |
| PNG / JPEG / WebP | 瀏覽器實際解碼三格式；實際頁面上傳事件後逐像素比對來源與兩個同圖結果 |
| 不同圖、黑白圖、灰階 | Node 圖樣矩陣；真實圖片解碼及 Worker；主頁範例自動載入（目前為猴子／貓）；黑／白上傳 |
| 快取與重算 | 實際 worker 程式在 Node worker_threads 中執行，以 FFT 呼叫計數確認重複 Swap 不做正向 FFT |
| 事件與資源清理 | 實際頁面 change / drop / click / 空選擇事件；損壞圖片；URL 和 postMessage 故障注入；9 個建立的 Blob URL 全數撤銷 |
| 靜態部署資源 | 本機 HTTP 狀態與 MIME、`.nojekyll`、遞迴檢查瀏覽器 module graph，在 repository 子路徑下解析不逸出 |

Node 圖樣為：黑、白、灰階、兩個不同的 seeded RGB 圖樣、對角漸層、量化 cosine、三通道不同 Nyquist 圖樣、偏移脈衝。81 配對是 9×9；不是 81 個獨立 test runner 項目。

## 最大數值誤差

以下均為本次測試集合的實測最大值。重建誤差使用原始 0–255 像素尺度，沒有先 clipping。

| 指標 | 最大值 |
| --- | ---: |
| 256² 圖樣 FFT → IFFT 實部誤差 | 1.2789769243681803e-13 |
| 256² 圖樣 Magnitude A + Phase A 實部誤差 | 2.4158453015843406e-13 |
| 同圖重建量化後 RGBA 像素差 | 0 |
| 81 種有序交換的 IFFT 虛部殘差 | 3.5460423145654597e-12 |
| 複數 FFT / IFFT 與直接 DFT 的絕對差 | 8.640199666842818e-12 |
| RGB swap 與直接 DFT / IFFT 的絕對差 | 1.4779288903810084e-12 |
| Parseval 相對能量誤差 | 2.514904040925391e-14 |
| 瀏覽器圖片解碼後 FFT → IFFT 實部誤差 | 1.1368683772161603e-13 |
| 瀏覽器圖片解碼後同圖振幅相位重建誤差 | 1.1368683772161603e-13 |
| 瀏覽器重建最大虛部殘差 | 3.1449365274995477e-13 |

頻域 FFT 係數的量級較像素值大，因此「複數 FFT 與 DFT 的絕對差」不能與像素誤差當成同一尺度直接比較。主要重建容許值是 1e-8。不同 JS 引擎的最後幾位可能不同。

## 發現與修正

### 1. 近零振幅的獨立相位計算破壞共軛對稱（實際重現）

原實作對每一個 FFT 係數各自取 `atan2`。兩個共軛位置即使只相差極小的浮點誤差，在接近零振幅時也可能給出不互為相反數的相位。將這些相位套到另一張圖的大振幅上，會放大成不可忽略的虛部。

修正前：用固定 RGB 圖樣的振幅加上量化 cosine 圖樣的相位，最大虛部殘差為 **239.33658624603004**；新增的對稱／配對測試有 3 項失敗。

修正：`js/fourier.js` 的 `analyzeRGB()` 先計算 `Fh[k]=(F[k]+conj(F[-k]))/2`，再從同一係數產生等振幅、反相位的共軛對。自共軛點保持實數；重建時其虛部強制為 0，排除 `sin(π)` 殘差。正向／反向 FFT 核心及正規化沒有更改。

同一組失敗案例修正後最大虛部為 **3.069599279188108e-13**。精確零振幅仍明確採相位 0；沒有另加刪除小係數的任意閾值。近零相位仍可能對捨入誤差敏感，但配對保持一致，這不是額外的亮度／對比 normalization。

### 2. 裁切邊緣混入區外色彩（實際重現）

原本一次呼叫 `drawImage` 同時裁切與縮放；高品質濾波在裁切邊界可能取到區外像素。純綠裁切區的寬圖測試失敗。早期只測中央像素的測試不足，已改成驗證全部邊緣像素。

修正：將共用解碼流程抽到 `js/image.js`，透過 `createImageBitmap` 先裁切，再以 high quality 縮放到 256²，最後畫到白底 Canvas，並關閉暫存 bitmap。奇數多餘邊長使用 floor，額外像素在右／下方被裁掉。寬圖、高圖與奇數邊界全部逐像素通過。[createImageBitmap API](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)

### 3. 非同步錯誤路徑的清理（程式碼審查發現，修正後故障注入驗證）

- `URL.createObjectURL` 原本在 try/finally 外；若拋錯，busy 不會恢復。移入 try，finally 僅撤銷成功建立的 URL。
- `worker.postMessage` 若同步拋錯，Promise 雖然拒絕，原本加入 pending Map 的項目不會移除。新增 catch 以刪除該項目並拒絕請求。
- 瀏覽器測試實際注入兩種例外，驗證按鈕恢復、顯示錯誤、結果保留與重試成功。pending Map 的刪除由程式碼審查確認；未宣稱做過 heap snapshot 量測。

### 4. 開發伺服器隨機埠顯示錯誤（實際重現）

自動化測試使用 `PORT=0` 讓系統分配空閒埠，原伺服器卻列印 `:0`，導致測試連線失敗。改為列印 `server.address().port`；HTTP 與靜態資源測試通過。預設 8080 的使用方式不變。

## 效能、記憶體與部署判斷的界線

**有實際測試：**每張載入圖片 3 次 FFT2；每次 Swap 6 次 IFFT2、0 次 FFT2；只換 A 就只做 A 的 3 次 FFT2。連續 10 次 Swap 結果完全相同，錯誤更新不破壞快取。瀏覽器測試中的 9 個 Blob URL 全數撤銷，並驗證 transfer 後來源 buffer detach。啟動時原有自我檢查另做一次 FFT2 / IFFT2，與上述圖片計數分開。

**僅程式碼審查／結構計算：**兩張圖的 magnitude / phase 常駐陣列為 `2×3×2×256²×8 = 6 MiB`；快取覆寫而非追加歷史，事件監聽在初始化註冊一次，結果 buffer 透過 transfer 交付。沒有做長時間 heap／RSS／GPU memory profiling，因此不將這些判斷寫成「已證明完全沒有記憶體洩漏」。原始大圖解碼仍會占用額外記憶體；25 MiB 上傳限制是壓縮檔大小，不是解碼記憶體上限。

**部署：**原始碼仍為靜態 HTML/CSS/JS，沒有 Node/Python 執行期依賴、CDN 或 build step。module、Worker、圖片與樣式的相對網址已測，適合原有 GitHub Pages 部署方式。沒有在本次測試中建立 repository、push 或遠端發布，不能宣稱遠端已通過驗證。

## 重複執行方式

全部 Node 測試（也可 `npm test`）：

```powershell
node --test tests/*.test.mjs
```

瀏覽器自動化測試：

```powershell
node scripts/serve.mjs
```

開啟 <http://127.0.0.1:8080/tests/browser.html>，會自動跑完全部 20 項，逐項列出結果與最大誤差；按「重新執行」可再跑。測試會載入同源 iframe 中的真正 `index.html`，不是替代 UI。測試素材已隨附，不需要 Pillow；只有重新生成素材時才使用 `tests/make-fixtures.py`。

本次原始記錄保留在本機 `.qa/verification-node.txt`、`.qa/verification-browser.json` 與 `.qa/verification-browser.jpg`；`.qa` 已被 Git 忽略。

## 尚未驗證／建議手動補測

- Firefox、Safari、iOS / Android 實體裝置，以及實體裝置上的記憶體峰值與長時間操作。
- 真正的 OS 檔案選擇器、觸控拖放、鍵盤與螢幕閱讀器。本次瀏覽器測試是自動送出 File / DataTransfer / DOM 事件，未重新操作 OS 對話框。
- EXIF 方向、特殊 ICC / 廣色域、動畫 WebP、多種半透明邊緣、極端解碼尺寸；本次測到的透明素材是均勻半透明 PNG。
- 實際 GitHub Pages 發布後，在遠端網址上重新執行 `tests/browser.html`，再使用自己的圖片操作。

這些大多可以在相應環境繼續自動化，但本次沒有那些環境或沒有執行該項測試，故不列為通過。
