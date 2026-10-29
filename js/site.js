import { t, language, pageURL, siteRoot } from './i18n.js';

const developer = 'https://s-yfan.github.io/';
const repository = 'https://github.com/S-YFan/Foruier-Image-Playground';
const experiments = [
  ['phase-swap', '001', 'swapName'], ['color-phase', '002', 'colorPhaseName'],
  ['filtering', '003', 'filteringName'], ['region-swap', '004', 'regionName'],
  ['spectrum', '005', 'spectrumName'],
];
const current = document.body.dataset.page;
const isExperiment = experiments.some(([key]) => key === current);
const header = document.querySelector('[data-site-header]');
if (header) header.innerHTML = `
  <a class="skip-link" href="#main-content">${t('skip')}</a>
  <header class="site-header">
    <div class="topbar">
      <a class="brand" href="${pageURL('home')}" aria-label="${t('brandHome')}"><span class="brand-mark" aria-hidden="true">ƒ</span><span>FOURIER IMAGE LAB</span></a>
      <span class="local-badge"><span class="status-dot" aria-hidden="true"></span>${t('inBrowser')}</span>
    </div>
    <nav class="site-nav" aria-label="${t('mainNav')}">
      <a href="${pageURL('home')}"${current === 'home' ? ' aria-current="page"' : ''}>${t('home')}</a>
      <div class="nav-disclosure">
        <button class="experiments-toggle${isExperiment ? ' is-current' : ''}" type="button" aria-expanded="false" aria-controls="experiment-menu">${t('experiments')} <span aria-hidden="true">▾</span></button>
        <ul class="experiment-menu" id="experiment-menu" hidden>${experiments.map(([key, number, label]) => `<li><a data-experiment="${key}" href="${pageURL(key)}"${key === current ? ' aria-current="page"' : ''}><span class="nav-number">${number}</span> <span>${t(label)}</span><span class="menu-arrow" aria-hidden="true">↗</span></a></li>`).join('')}</ul>
      </div>
      <a href="${pageURL('documentation')}"${current === 'documentation' ? ' aria-current="page"' : ''}>${t('documentation')}</a>
      <a href="${developer}" target="_blank" rel="noopener noreferrer">${t('about')} <span aria-hidden="true">↗</span><span class="sr-only"> (${t('newTab')})</span></a>
      <div class="language-switch" role="group" aria-label="${t('language')}"><a data-language="en" lang="en" hreflang="en" href="${pageURL(current, 'en')}"${language === 'en' ? ' aria-current="true"' : ''}>EN</a><span aria-hidden="true">/</span><a data-language="zh-TW" lang="zh-TW" hreflang="zh-TW" href="${pageURL(current, 'zh-TW')}"${language === 'zh-TW' ? ' aria-current="true"' : ''}>繁中</a></div>
    </nav>
  </header>`;

const button = header?.querySelector('.experiments-toggle');
const menu = header?.querySelector('.experiment-menu');
if (button && menu) {
  const links = [...menu.querySelectorAll('a')];
  const setOpen = open => { menu.hidden = !open; button.setAttribute('aria-expanded', String(open)); };
  button.addEventListener('click', () => setOpen(menu.hidden));
  button.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true); links[event.key === 'ArrowDown' ? 0 : links.length - 1].focus();
    }
  });
  menu.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  menu.addEventListener('keydown', event => {
    const index = links.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links[next].focus();
    }
  });
  header.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); setOpen(false); button.focus(); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.nav-disclosure')) setOpen(false); });
  header.querySelector('.nav-disclosure').addEventListener('focusout', event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  });
}
function updateLanguageLinks() {
  header?.querySelectorAll('[data-language]').forEach(link => { link.href = pageURL(current, link.dataset.language) + location.hash; });
}
updateLanguageLinks();
window.addEventListener('hashchange', updateLanguageLinks);

const footer = document.querySelector('[data-site-footer]');
if (footer) footer.innerHTML = `
  <footer class="site-footer">
    <div><a class="footer-brand" href="${pageURL('home')}">FOURIER IMAGE LAB</a><p>${t('creditBefore')}<a href="${developer}" target="_blank" rel="noopener noreferrer" aria-label="Sheng-Yang Fan (${t('newTab')})">Sheng-Yang Fan</a>${t('creditAfter')}</p><p class="typeset-credit">${t('typeset')} · <a href="${new URL('assets/katex/LICENSE', siteRoot).href}">${t('katexLicense')}</a></p></div>
    <nav aria-label="${t('footer')}"><a href="${pageURL('documentation')}">${t('documentation')}</a><a href="${repository}" target="_blank" rel="noopener noreferrer">${t('github')} ↗</a><a href="${new URL('LICENSE', siteRoot).href}">${t('license')}</a></nav>
  </footer>`;
