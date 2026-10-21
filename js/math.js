// Shared local KaTeX renderer. Equations remain readable as source if JS fails.
document.querySelectorAll('[data-math]').forEach(element => {
  if (!window.katex) return;
  window.katex.render(element.textContent.trim(), element, {
    displayMode: element.hasAttribute('data-display'),
    throwOnError: false,
    strict: 'error',
    trust: false,
    output: 'htmlAndMathml',
  });
});
