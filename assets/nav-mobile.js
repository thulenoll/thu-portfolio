/* Mobile burger navigation — shared across all pages.
   Reads the existing .topbar-meta links so each page stays correct,
   and styles itself with the site's design tokens (cream paper, hairlines,
   mono caps, periwinkle accent). No drop shadows, no emoji. */
(function () {
  function init() {
    var topbar = document.querySelector('.topbar');
    var inner = document.querySelector('.topbar-inner');
    var meta = document.querySelector('.topbar-meta');
    if (!topbar || !inner || !meta) return;
    if (document.querySelector('.nav-burger')) return; // already initialised

    // --- styles (injected once) ---
    var css = '' +
      '.nav-burger{display:none;position:relative;width:28px;height:20px;padding:0;border:0;background:none;cursor:pointer;color:var(--ink,#3A2E26);z-index:120;-webkit-tap-highlight-color:transparent;}' +
      '.nav-burger span{position:absolute;left:0;right:0;height:1.5px;background:currentColor;border-radius:2px;transition:transform .3s var(--ease,cubic-bezier(0.16,1,0.3,1)),opacity .2s ease;}' +
      '.nav-burger span:nth-child(1){top:2px;}' +
      '.nav-burger span:nth-child(2){top:9px;}' +
      '.nav-burger span:nth-child(3){top:16px;}' +
      '.nav-burger[aria-expanded="true"] span:nth-child(1){transform:translateY(7px) rotate(45deg);}' +
      '.nav-burger[aria-expanded="true"] span:nth-child(2){opacity:0;}' +
      '.nav-burger[aria-expanded="true"] span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}' +
      '.mobile-nav{display:none;overflow:hidden;max-height:0;background:var(--bg,#FAEFE3);border-top:1px solid var(--line,#E8D5BE);transition:max-height .35s var(--ease,cubic-bezier(0.16,1,0.3,1));}' +
      '.mobile-nav.is-open{max-height:60vh;}' +
      '.mobile-nav-list{display:flex;flex-direction:column;padding-top:var(--s-2,8px);padding-bottom:var(--s-4,16px);}' +
      '.mobile-nav-list a{font-family:var(--font-mono,monospace);font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:var(--ink-soft,#574A41);text-decoration:none;padding:var(--s-4,16px) 0;border-bottom:1px solid var(--line,#E8D5BE);transition:color .2s var(--ease,ease);}' +
      '.mobile-nav-list a:last-child{border-bottom:0;}' +
      '.mobile-nav-list a:active,.mobile-nav-list a:hover{color:var(--accent,#5468A5);}' +
      '@media (max-width:900px){.nav-burger{display:block;}.mobile-nav{display:block;}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // --- burger button ---
    var burger = document.createElement('button');
    burger.className = 'nav-burger';
    burger.setAttribute('aria-label', 'Menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span></span><span></span><span></span>';
    inner.appendChild(burger);

    // --- mobile menu panel (clones the existing nav links) ---
    var panel = document.createElement('nav');
    panel.className = 'mobile-nav';
    panel.setAttribute('aria-label', 'Mobile');
    var list = document.createElement('div');
    list.className = 'mobile-nav-list container';
    meta.querySelectorAll('a').forEach(function (a) {
      var link = document.createElement('a');
      link.href = a.getAttribute('href');
      if (a.target) link.target = a.target;
      if (a.rel) link.rel = a.rel;
      link.textContent = a.textContent.trim();
      list.appendChild(link);
    });
    panel.appendChild(list);
    topbar.appendChild(panel);

    function close() {
      panel.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
    function toggle() {
      var open = panel.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    burger.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    list.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('is-open') && !topbar.contains(e.target)) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
