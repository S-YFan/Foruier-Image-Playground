const assert = (condition, message = 'Assertion failed') => { if (!condition) throw new Error(message); };
const results = [], metrics = { viewports: [], pages: [], localLinks: [], formulas: {}, switches: [], navigation: [] };
const base = new URL('../', import.meta.url);
const personalURL = 'https://s-yfan.github.io/Personal-Website-for-ai-to-coding/';
const experiments = [['phase-swap.html', '001'], ['spectrum.html', '002'], ['filtering.html', '003'], ['region-swap.html', '004']];
const files = ['index.html', 'documentation.html', ...experiments.map(([file]) => file)];
const frame = document.getElementById('app');
async function waitFor(condition, label, timeout = 15000) {
  const deadline = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timeout: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
async function test(name, callback) {
  const li = document.createElement('li');
  try { await callback(); li.className = 'pass'; li.textContent = `PASS — ${name}`; results.push({ name, passed: true }); }
  catch (error) { li.className = 'fail'; li.textContent = `FAIL — ${name}: ${error.message}`; results.push({ name, passed: false, error: error.message }); }
  document.getElementById('results').append(li);
}
const nextLoad = () => new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
async function load(page) {
  const ready = nextLoad(); frame.src = new URL(page, base).href; await ready;
  await waitFor(() => frame.contentDocument?.querySelector('.site-nav') && frame.contentDocument?.querySelector('footer'), page);
  return frame.contentDocument;
}
async function follow(link, expected) {
  const ready = nextLoad(); link.click(); await ready;
  await waitFor(() => frame.contentWindow.location.href === expected && frame.contentDocument?.querySelector('.site-nav'), expected);
  return frame.contentDocument;
}
const pageURL = (file, zh) => new URL(`${zh ? 'zh/' : ''}${file === 'index.html' ? '' : file}`, base).href;
const settle = () => new Promise(resolve => frame.contentWindow.requestAnimationFrame(() => frame.contentWindow.requestAnimationFrame(resolve)));

for (const zh of [false, true]) {
  const prefix = zh ? 'zh/' : '';
  for (const file of files) await test(`完整語言與共用導覽：${prefix}${file}`, async () => {
    const doc = await load(prefix + file);
    assert(doc.documentElement.lang === (zh ? 'zh-TW' : 'en'), 'HTML language');
    const nav = doc.querySelector('.site-nav');
    for (const label of zh ? ['首頁', '實驗', '說明文件', '關於作者'] : ['Home', 'Experiments', 'Documentation', 'About']) assert(nav.textContent.includes(label), label);
    assert(doc.querySelector('.experiments-toggle').getAttribute('aria-expanded') === 'false', 'menu starts closed');
    assert(doc.querySelector('.experiment-menu').hidden, 'menu hidden');
    const links = [...doc.querySelectorAll('.experiment-menu a')];
    assert(links.length === 4, 'four experiments');
    for (const [target, number] of experiments) {
      const link = links.find(link => link.href === pageURL(target, zh));
      assert(link && link.textContent.includes(number), number);
    }
    if (experiments.some(([target]) => target === file)) assert(doc.querySelector('.experiment-menu [aria-current="page"]').href === pageURL(file, zh), 'current experiment');
    const about = nav.querySelector('a[target="_blank"]');
    const author = [...doc.querySelectorAll('footer a')].find(link => link.textContent.includes('Sheng-Yang Fan'));
    assert(about.href === personalURL && author.href === personalURL, 'verified author URL');
    assert(doc.querySelector('footer').textContent.includes(zh ? '本網站由 Sheng-Yang Fan 開發。' : 'This website is developed by Sheng-Yang Fan.'), 'author sentence');
    assert(nav.querySelector(`[data-language="${zh ? 'zh-TW' : 'en'}"]`).hasAttribute('aria-current'), 'current language');
    if (!zh) assert(!/[\u3400-\u9fff]/.test(doc.querySelector('main').textContent), 'English body is not mixed with Chinese');
    else assert(/[\u3400-\u9fff]/.test(doc.querySelector('main').textContent), 'Chinese body');
    metrics.pages.push(prefix + file);
  });

  for (const file of ['index.html', 'documentation.html']) await test(`公式、站內連結與四種寬度：${prefix}${file}`, async () => {
    const doc = await load(prefix + file);
    await waitFor(() => doc.querySelector('.katex'), 'KaTeX');
    const formulas = [...doc.querySelectorAll('[data-math]')];
    assert(formulas.every(formula => formula.querySelector('.katex') && !formula.querySelector('.katex-error')), 'all formulas render');
    if (file === 'index.html') assert(formulas.length === 1, 'one core formula on Home');
    else {
      assert(doc.querySelectorAll('.docs-toc ol li').length === 3, 'three scientific topics');
      assert(!doc.querySelector('main #credits,main #open-source,main #getting-started'), 'administrative information belongs in footer');
      assert(doc.querySelector('#introduction').textContent.includes('Signals and Systems'), 'textbook title');
      assert(doc.querySelector('#introduction a').hostname === 'www.pearson.com', 'publisher source');
    }
    metrics.formulas[prefix + file] = formulas.length;
    const seen = new Set();
    for (const link of doc.querySelectorAll('a[href]')) {
      const url = new URL(link.href);
      // The author's separate Pages site shares our production origin.
      if (url.origin !== base.origin || url.href === personalURL || seen.has(url.href)) continue;
      assert(url.pathname.startsWith(base.pathname), `repository prefix: ${url}`); seen.add(url.href);
      const response = await fetch(url); assert(response.ok, `${response.status}: ${url}`);
      if (url.hash && response.headers.get('content-type').includes('text/html')) {
        const linked = new DOMParser().parseFromString(await response.text(), 'text/html');
        assert(linked.getElementById(decodeURIComponent(url.hash.slice(1))), `anchor: ${url}`);
      }
      metrics.localLinks.push(url.href);
    }
    for (const width of [375, 390, 768, 1280]) {
      frame.style.width = `${width}px`; await settle();
      assert(doc.documentElement.scrollWidth <= width, `page overflow at ${width}: ${doc.documentElement.scrollWidth}`);
      for (const formula of formulas) {
        const box = formula.getBoundingClientRect();
        assert(box.left >= 0 && box.right <= width + 1, `formula outside ${width}`);
        if (formula.hasAttribute('data-display')) assert(formula.scrollWidth <= formula.clientWidth + 1, `formula requires horizontal scrolling at ${width}`);
      }
      const toggle = doc.querySelector('.experiments-toggle'); toggle.click();
      assert(toggle.getAttribute('aria-expanded') === 'true', 'menu opens');
      for (const link of doc.querySelectorAll('.site-nav > a,.language-switch a,.experiment-menu a')) {
        const box = link.getBoundingClientRect();
        assert(box.width > 0 && box.left >= 0 && box.right <= width + 1, `navigation outside ${width}`);
      }
      toggle.click(); metrics.viewports.push({ page: prefix + file, width, scrollWidth: doc.documentElement.scrollWidth });
    }
    frame.style.width = '1280px';
  });

  await test(`直接實驗導覽與關閉選單：${zh ? '繁中' : 'EN'}`, async () => {
    for (const [from, target] of [['index.html', 'region-swap.html'], ['phase-swap.html', 'filtering.html']]) {
      let doc = await load(prefix + from);
      doc.querySelector('.experiments-toggle').click();
      doc = await follow([...doc.querySelectorAll('.experiment-menu a')].find(link => link.href === pageURL(target, zh)), pageURL(target, zh));
      assert(doc.querySelector('.experiment-menu').hidden && doc.querySelector('.experiments-toggle').getAttribute('aria-expanded') === 'false', 'destination menu closed');
      assert(doc.querySelector('.experiment-menu [aria-current="page"]').href === pageURL(target, zh), 'direct destination current');
      metrics.navigation.push(`${prefix}${from} → ${prefix}${target}`);
    }
  });

  await test(`鍵盤方向鍵、Escape 與外部點擊：${zh ? '繁中' : 'EN'}`, async () => {
    const doc = await load(prefix + 'index.html'), win = frame.contentWindow;
    const toggle = doc.querySelector('.experiments-toggle'), links = [...doc.querySelectorAll('.experiment-menu a')];
    const key = (element, key) => element.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    toggle.focus(); key(toggle, 'ArrowDown'); assert(doc.activeElement === links[0], 'first link focused');
    key(links[0], 'ArrowDown'); assert(doc.activeElement === links[1], 'next link');
    key(links[1], 'End'); assert(doc.activeElement === links[3], 'last link');
    key(links[3], 'Home'); assert(doc.activeElement === links[0], 'first link');
    key(links[0], 'Escape'); assert(doc.activeElement === toggle && doc.querySelector('.experiment-menu').hidden, 'escape returns focus');
    toggle.click(); doc.querySelector('main').click(); assert(doc.querySelector('.experiment-menu').hidden, 'outside click closes');
  });
}

for (const file of files) await test(`保留對應頁面的雙向語言切換：${file}`, async () => {
  let doc = await load(file);
  const hash = file === 'documentation.html' ? '#mathematics' : '';
  if (hash) { frame.contentWindow.location.hash = hash; await settle(); }
  doc = await follow(doc.querySelector('[data-language="zh-TW"]'), pageURL(file, true) + hash);
  assert(doc.documentElement.lang === 'zh-TW', 'Chinese destination');
  doc = await follow(doc.querySelector('[data-language="en"]'), pageURL(file, false) + hash);
  assert(doc.documentElement.lang === 'en', 'English destination');
  metrics.switches.push(file);
});
await test('MIT LICENSE 可直接開啟並包含正確持有人與標準條文', async () => {
  const response = await fetch(new URL('LICENSE', base)); const text = await response.text();
  assert(response.ok && text.startsWith('MIT License') && /Copyright \(c\) \d{4} Sheng-Yang Fan/.test(text), 'MIT owner');
  assert(text.includes('Permission is hereby granted, free of charge') && text.includes('THE SOFTWARE IS PROVIDED "AS IS"'), 'MIT terms');
});
const passed = results.filter(result => result.passed).length;
document.getElementById('summary').textContent = `${passed}/${results.length} 通過，${results.length - passed} 失敗`;
document.getElementById('metrics').textContent = JSON.stringify({ browser: navigator.userAgent, metrics, results }, null, 2);
