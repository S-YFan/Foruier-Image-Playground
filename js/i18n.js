// UI copy only. Numerical modules and workers are shared by both languages.
export const language = typeof document !== 'undefined' && document.documentElement.lang === 'zh-TW' ? 'zh-TW' : 'en';
export const isChinese = language === 'zh-TW';
export const siteRoot = new URL('../', import.meta.url);
export const pages = { home: 'index.html', documentation: 'documentation.html', 'phase-swap': 'phase-swap.html', spectrum: 'spectrum.html', filtering: 'filtering.html', 'region-swap': 'region-swap.html' };
export function pageURL(page, lang = language) {
  const file = pages[page] ?? pages.home;
  return new URL(`${lang === 'zh-TW' ? 'zh/' : ''}${page === 'home' ? '' : file}`, siteRoot).href;
}
export const messages = {
  home: ['Home', '首頁'], experiments: ['Experiments', '實驗'], documentation: ['Documentation', '說明文件'], about: ['About', '關於作者'],
  swapName: ['Magnitude / Phase Swap', '振幅／相位交換'], spectrumName: ['Spectrum / Translation', '頻譜／平移'], filteringName: ['Gaussian Filtering', '高斯濾波'], regionName: ['Partial Phase Region Swap', '局部相位區域交換'],
  skip: ['Skip to content', '跳至主要內容'], brandHome: ['FOURIER IMAGE LAB home', 'FOURIER IMAGE LAB 首頁'], inBrowser: ['IN YOUR BROWSER', '在瀏覽器內運算'], mainNav: ['Main navigation', '主要導覽'], footer: ['Footer', '頁尾'], language: ['Language', '語言'], newTab: ['opens in a new tab', '另開分頁'], github: ['GitHub Repository', 'GitHub 專案'], license: ['MIT License', 'MIT 授權'],
  creditBefore: ['This website is developed by ', '本網站由 '], creditAfter: ['.', ' 開發。'], typeset: ['Typeset with KaTeX', '公式排版：KaTeX'], katexLicense: ['KaTeX license', 'KaTeX 授權'],
  mountain: ['Mountain lake', '山景湖泊'], lighthouse: ['Coastal lighthouse', '海岸燈塔'],
  workerUnavailable: ['The calculation worker is unavailable. Please reload the page.', '運算程序無法使用，請重新整理頁面。'],
  workerStart: ['Unable to start background calculations. Open over HTTP / HTTPS and reload.', '無法啟動背景運算，請透過 HTTP／HTTPS 開啟並重新整理。'],
  workerSpectrum: ['Unable to load the spectrum worker. Use an HTTP preview or reload.', '無法載入頻譜運算程序，請透過 HTTP 預覽開啟或重新整理。'],
  timeout: ['Calculation timed out. Please try again or reload.', '計算逾時，請重試或重新整理。'],
  operationError: ['The operation failed. Please try again or reload.', '操作失敗，請重試或重新整理。'],
  decodeError: ['Unable to decode this image. Choose a valid PNG, JPEG, or WebP file.', '影像無法解碼，請選擇有效的 PNG、JPEG 或 WebP 檔案。'],
  emptyImage: ['This image has no valid dimensions.', '這張影像沒有有效的尺寸。'],
  chooseFormat: ['Choose a PNG, JPEG, or WebP image.', '請選擇 PNG、JPEG 或 WebP 影像。'],
  tooLarge: ['The image exceeds 25 MiB. Reduce its size before uploading.', '影像超過 25 MiB，請先縮小檔案再上傳。'],
  waitingReconstruction: ['Waiting for reconstruction', '等待重建'], residualWaiting: ['Imaginary residuals will appear after reconstruction.', '虛部殘差將在重建後顯示。'],
  needSwapInputs: ['Load Image A and Image B; swapping starts automatically when both are ready.', '請載入影像 A 與影像 B，兩張皆就緒後會自動交換。'],
  swapping: ['Swapping phase across three color channels and running IFFT…', '正在交換三個色彩通道的相位並執行 IFFT…'],
  clipped: ['Clipped {percent}%', '裁切 {percent}%'], range: ['Before clipping: {min} to {max}', '裁切前範圍：{min} 至 {max}'],
  residual: ['Maximum imaginary residual: {value} (original 0–255 pixel scale).', '本次最大虛部殘差：{value}（原始 0–255 像素尺度）。'],
  highResidual: ['Reconstruction complete, but the imaginary residual is high. See calculation notes.', '重建完成，但虛部殘差偏高，請查看計算說明。'],
  swapComplete: ['Swap complete. Changing either image automatically recalculates the results.', '交換完成。更換任一影像會自動重新計算。'],
  loadingSlot: ['Loading Image {slot} and computing RGB spectra…', '正在載入影像 {slot} 並計算 RGB 頻譜…'],
  loadingName: ['Loading {name} and computing RGB spectra…', '正在載入 {name} 並計算 RGB 頻譜…'],
  check: ['FFT → IFFT self-check {result}: max real error {real}; max imaginary residual {imag}.', 'FFT → IFFT 自我檢查{result}：最大實部誤差 {real}；最大虛部殘差 {imag}。'],
  passed: ['passed', '通過'], failed: ['failed', '失敗'], checkFailed: ['FFT numerical check failed; calculations have stopped.', 'FFT 數值檢查未通過，已停止運算。'],
  loadingSamples: ['Loading the two sample images…', '正在載入兩張範例影像…'],
  period: ['{pixels} px · {cycles} cycles', '{pixels} px · {cycles} 個週期'],
  phaseMask: ['{bins} / 65,536 valid frequency bins; shared display threshold {threshold}.', '{bins}／65,536 個有效頻率格；共用顯示閾值 {threshold}。'],
  translationNumerics: ['Relative magnitude difference {magnitude} · shift theorem complex error {coefficient} · max IFFT imaginary part {imag}', '振幅相對差 {magnitude} · 平移定理複數誤差 {coefficient} · IFFT 最大虛部 {imag}'],
  shiftReady: ['Shift ({x}, {y}) px · all seven images and measurements updated', '位移（{x}，{y}）px · 七張影像與數值已同步更新'],
  squareName: ['Square · {side} × {side} px', '方形 · {side} × {side} px'], squareNote: ['As the square grows, watch the main lobe narrow. Horizontal and vertical edges create directionality in the spectrum.', '觀察方形變大時，主瓣如何變窄。水平與垂直邊界對應頻域中的方向性。'],
  circleName: ['Circle · radius {radius} px', '圓形 · 半徑 {radius} px'], circleNote: ['Increase the radius and observe the ring spacing. The pixel grid makes rotational symmetry approximate.', '增加半徑，觀察環紋間距如何改變。像素網格使旋轉對稱性呈近似。'],
  stripesName: ['Vertical stripes · period {period} px', '垂直條紋 · 週期 {period} px'], stripesNote: ['{cycles} periods across the image; fundamental peaks at ±{cycles} bins on the horizontal axis, with odd harmonics.', '影像包含 {cycles} 個週期；基頻峰值位於水平軸 ±{cycles} 個頻率格，並含奇次諧波。'],
  geometryMask: ['Display threshold {threshold}; {bins} bins shown in neutral gray.', '顯示閾值 {threshold}；{bins} 個頻率格以中性灰色顯示。'],
  geometryReady: ['{name} · source image and both spectra updated', '{name} · 原圖與兩張頻譜已同步更新'], updating: ['Updating the experiment…', '正在更新實驗…'],
  filtering: ['Computing RGB IFFT for {group}…', '正在計算{group}的 RGB IFFT…'], passGroup: ['LPF / HPF', '低通／高通'], sharpenGroup: ['sharpening', '銳化'],
  filterReady: ['Reconstruction complete. Parameters in the two sections are independent.', '重建完成。兩個區段的參數可獨立調整。'],
  numericalWaiting: ['Numerical checks update after each reconstruction.', '數值檢查隨每次重建更新。'],
  diskLabel: ['Low-frequency disk · r ≤ {radius}', '低頻圓盤 · r ≤ {radius}'], quadrantsLabel: ['Quadrants · {pair}', '成對象限 · {pair}'],
  ulLr: ['upper left + lower right', '左上 + 右下'], urLl: ['upper right + lower left', '右上 + 左下'], bothPairs: ['both pairs', '兩組皆選'],
  stripesLabel: ['{orientation} stripes · {width} bins', '{orientation}條紋 · {width} 個頻率格'], vertical: ['Vertical', '垂直'], horizontal: ['Horizontal', '水平'],
  reconstructing: ['Selecting phase and computing RGB IFFT…', '正在選取相位並計算 RGB IFFT…'], energyUndefined: ['Undefined (A energy is zero)', '未定義（A 能量為零）'], displayClipped: ['Display clipped {percent}%', '顯示裁切 {percent}%'],
  regionCheck: ['Conjugate mask check passed; max imaginary residual {imag}; max magnitude error {magnitude}; max error scaled by max(1, |F_A|) per bin {scaled}.', '共軛遮罩檢查通過；最大虛部殘差 {imag}；最大振幅誤差 {magnitude}；依每格 max(1, |F_A|) 縮放的最大振幅誤差 {scaled}。'],
  regionReady: ['Reconstruction complete. Change the mask or either image to update automatically.', '重建完成。調整遮罩或更換影像會自動更新。'], needRegionInputs: ['Load Image A and Image B; reconstruction starts automatically when both are ready.', '請載入影像 A 與影像 B，兩張皆就緒後會自動重建。'],
  homeSpectrum: ['Monkey.jpg · red channel · 256 × 256 · DC centered · log magnitude · phase: −π to π; near-zero magnitude masked gray.', 'Monkey.jpg · 紅色通道 · 256 × 256 · 直流成分置中 · 對數振幅 · 相位：−π 至 π；近零振幅以灰色遮罩標示。'],
  homeFailure: ['The spectrum example could not load. Open an experiment below to explore images and their frequencies.', '頻譜範例無法載入。可開啟下方實驗，繼續探索影像與頻率。'],
};
export function t(key, values = {}) {
  if (!Object.hasOwn(messages, key)) throw new Error(`Unknown UI message: ${key}`);
  return messages[key][isChinese ? 1 : 0].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}
export function sampleName(sample) {
  return sample.name === 'Mountain lake' ? t('mountain') : sample.name === 'Coastal lighthouse' ? t('lighthouse') : sample.name;
}
// Image decoding and worker errors cross UI boundaries; localize their messages
// here so the numerical modules do not depend on the document's language.
export function errorMessage(message) {
  if (message === '圖片無法解碼，請選擇有效的 PNG、JPEG 或 WebP 檔案。') return t('decodeError');
  if (message === '這張圖片沒有有效的尺寸。') return t('emptyImage');
  return isChinese && !/[\u3400-\u9fff]/.test(message) ? t('operationError') : message;
}
