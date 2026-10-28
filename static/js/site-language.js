(() => {
  const switcher = document.querySelector('[data-language-switcher]');
  if (!switcher) return;
  const current = switcher.dataset.currentLanguage;
  const links = [...switcher.querySelectorAll('[data-language-link]')];
  const supported = value => value === 'ru' || value === 'en';
  const storageKey = 'site-language';
  const save = language => {
    try { localStorage.setItem(storageKey, language); } catch { /* Storage is optional. */ }
  };
  const withFragment = link => {
    const url = new URL(link.href);
    url.hash = location.hash;
    return url;
  };

  for (const link of links) {
    link.href = withFragment(link).href;
    link.addEventListener('click', () => save(link.dataset.languageLink));
  }
  // Keep the current question when switching after following an in-page link.
  window.addEventListener('hashchange', () => {
    for (const link of links) link.href = withFragment(link).href;
  });

  let saved;
  try {
    saved = localStorage.getItem(storageKey) || localStorage.getItem('collections-language');
  } catch { /* Browser privacy settings may disable storage. */ }
  const requested = new URL(location.href).searchParams.get('lang');
  // /en/ is itself an explicit language choice. Legacy Russian links can use
  // the saved preference, while ?lang=ru always allows a deliberate switch back.
  const preferred = supported(requested) ? requested
    : current === 'en' ? 'en'
    : supported(saved) ? saved : current;
  const target = links.find(link => link.dataset.languageLink === preferred);
  if (target) {
    save(preferred);
    if (preferred !== current) location.replace(withFragment(target).href);
  }
})();
