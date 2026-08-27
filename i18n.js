/* ---------------------------------------------------------------
   Two languages, one set of pages.

   Every translatable string lives on the element that shows it, as a
   pair of data attributes, so there is no dictionary to keep in step
   with the markup and nothing to load before the page can be read:

     <h2 data-da="Erfaring" data-en="Experience">Erfaring</h2>

   Markup inside a string uses the -html form instead, and the handful
   of attributes that carry text have their own:

     data-da-html / data-en-html
     data-da-alt, data-da-aria-label, data-da-title, data-da-placeholder

   The page ships with Danish in the document, so it reads correctly
   before this file runs and if it never runs at all.

   Which language a visitor gets: whatever they chose last, or failing
   that their browser's. Someone arriving with an English browser lands
   in English without touching anything, which is the point - the switch
   is there to override a wrong guess, not to be a required first step.
   --------------------------------------------------------------- */
(function () {
  'use strict';

  var LANGS = ['da', 'en'];
  var KEY = 'om-lang';
  var ATTRS = ['alt', 'aria-label', 'title', 'placeholder', 'content'];

  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return LANGS.indexOf(v) >= 0 ? v : null;
    } catch (e) { return null; }
  }
  function remember(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function fromBrowser() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var t = String(list[i]).toLowerCase();
      if (t.indexOf('da') === 0) return 'da';
      if (t.indexOf('en') === 0) return 'en';
    }
    // Anything else in the world: English is the likelier of the two.
    return 'en';
  }

  var lang = stored() || fromBrowser();

  function apply(root) {
    root = root || document;
    var els = root.querySelectorAll('[data-da],[data-en],[data-da-html],[data-en-html]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var html = el.getAttribute('data-' + lang + '-html');
      if (html !== null) { el.innerHTML = html; continue; }
      var txt = el.getAttribute('data-' + lang);
      if (txt !== null) el.textContent = txt;
    }
    for (var a = 0; a < ATTRS.length; a++) {
      var name = ATTRS[a];
      var withAttr = root.querySelectorAll('[data-da-' + name + '],[data-en-' + name + ']');
      for (var j = 0; j < withAttr.length; j++) {
        var v = withAttr[j].getAttribute('data-' + lang + '-' + name);
        if (v !== null) withAttr[j].setAttribute(name, v);
      }
    }
    document.documentElement.setAttribute('lang', lang);
  }

  function paintSwitch() {
    var hosts = document.querySelectorAll('[data-lang-switch]');
    for (var i = 0; i < hosts.length; i++) {
      var btns = hosts[i].querySelectorAll('[data-lang]');
      for (var j = 0; j < btns.length; j++) {
        var on = btns[j].getAttribute('data-lang') === lang;
        btns[j].classList.toggle('is-on', on);
        btns[j].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
  }

  // The switch has to be legible to someone who cannot read either the
  // page or the word for "language", so it is a globe and two ISO codes
  // rather than a word or a flag. Flags are the usual mistake: they name
  // countries, not languages, and there is no flag for English that does
  // not pick a side.
  var GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="9"></circle>' +
    '<path d="M3 12h18"></path>' +
    '<path d="M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9z"></path>' +
    '</svg>';

  function build() {
    var hosts = document.querySelectorAll('[data-lang-switch]');
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      if (host.getAttribute('data-lang-built')) continue;
      host.setAttribute('data-lang-built', '1');
      host.classList.add('langsw');
      host.setAttribute('role', 'group');
      host.setAttribute('aria-label', 'Language / Sprog');
      host.innerHTML = GLOBE +
        '<button type="button" class="langsw-btn" data-lang="da" lang="da" title="Dansk">DA</button>' +
        '<span class="langsw-sep" aria-hidden="true"></span>' +
        '<button type="button" class="langsw-btn" data-lang="en" lang="en" title="English">EN</button>';
      host.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-lang]') : null;
        if (!b) return;
        set(b.getAttribute('data-lang'));
      });
    }
    paintSwitch();
  }

  function set(next) {
    if (LANGS.indexOf(next) < 0 || next === lang) return;
    lang = next;
    remember(lang);
    apply();
    paintSwitch();
    // Anything that draws its own strings - the map's mode bar, its
    // legend, its captions - listens for this and redraws.
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
  }

  var STYLE = [
    '.langsw{display:inline-flex;align-items:center;gap:.34rem;padding:.22rem .5rem;',
    'border:1px solid currentColor;border-radius:999px;opacity:.72;',
    'line-height:1;vertical-align:middle;}',
    '.langsw:hover{opacity:1;}',
    '.langsw svg{width:1em;height:1em;flex:none;opacity:.85;}',
    '.langsw-btn{appearance:none;background:none;border:0;padding:.1rem .12rem;margin:0;',
    'font:inherit;font-size:.78em;letter-spacing:.06em;color:inherit;opacity:.55;',
    'cursor:pointer;border-radius:4px;}',
    '.langsw-btn:hover{opacity:.9;}',
    '.langsw-btn.is-on{opacity:1;font-weight:600;text-decoration:underline;',
    'text-underline-offset:3px;}',
    '.langsw-btn:focus-visible{outline:2px solid currentColor;outline-offset:2px;}',
    '.langsw-sep{width:1px;height:.8em;background:currentColor;opacity:.35;}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('langsw-style')) return;
    var s = document.createElement('style');
    s.id = 'langsw-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function init() {
    injectStyle();
    apply();
    build();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.I18N = {
    get lang() { return lang; },
    set: set,
    apply: apply
  };
})();
