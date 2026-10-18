/* Quotelund concept site runtime.
   Renders each page from its template and state, and patches the DOM in place
   so animations, focus and scroll position survive every update. */
(function () {
  'use strict';

  var comp = null, vals = {}, root = null, tpl = '', queued = false, hadDialog = false;

  function DCLogic() { this.props = {}; this.state = null; }
  DCLogic.prototype.setState = function (patch) {
    var prev = this.state || {};
    var next = typeof patch === 'function' ? patch(prev) : patch;
    this.state = Object.assign({}, prev, next);
    schedule();
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };
  window.DCLogic = DCLogic;

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; render(); });
  }

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function expand(t, v) {
    var ifRe = /<sc-if value="\{\{\s*(\w+)\s*\}\}"[^>]*>((?:(?!<sc-if)[\s\S])*?)<\/sc-if>/g;
    var prev;
    do { prev = t; t = t.replace(ifRe, function (m, k, inner) { return v[k] ? inner : ''; }); } while (t !== prev);
    t = t.replace(/\son(Click|Change)="\{\{\s*([\w.]+)\s*\}\}"/g, function (m, ev, k) {
      return ' data-on-' + ev.toLowerCase() + '="' + k + '"';
    });
    t = t.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (m, k) {
      if (k === 'true' || k === 'false') return k;
      var x = v[k];
      if (x === undefined || x === null || typeof x === 'function') return '';
      return esc(x);
    });
    t = t.replace(/\s(checked|disabled)="(true|false)"/g, function (m, a, b) { return b === 'true' ? ' ' + a : ''; });
    t = t.replace(/\shint-[\w-]+="[^"]*"/g, '');
    return t;
  }

  function syncAttrs(from, to) {
    var isDetails = from.tagName === 'DETAILS', i, a;
    for (i = from.attributes.length - 1; i >= 0; i--) {
      a = from.attributes[i];
      if (isDetails && a.name === 'open') continue;
      if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
    }
    for (i = 0; i < to.attributes.length; i++) {
      a = to.attributes[i];
      if (isDetails && a.name === 'open') continue;
      if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
    }
  }

  function morph(from, to) {
    syncAttrs(from, to);
    if (from.tagName === 'INPUT') {
      if (from.type === 'radio') from.checked = to.hasAttribute('checked');
      else if (from.type !== 'checkbox' && document.activeElement !== from && to.hasAttribute('value')) {
        from.value = to.getAttribute('value');
      }
      return;
    }
    if (from.tagName === 'TEXTAREA') return;
    morphChildren(from, to);
  }

  function morphChildren(from, to) {
    var a = Array.prototype.slice.call(from.childNodes);
    var b = Array.prototype.slice.call(to.childNodes);
    for (var i = 0; i < b.length; i++) {
      var n = b[i], o = a[i];
      if (!o) { from.appendChild(n); continue; }
      if (o.nodeType !== n.nodeType || (o.nodeType === 1 && o.tagName !== n.tagName)) { from.replaceChild(n, o); continue; }
      if (o.nodeType !== 1) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; continue; }
      morph(o, n);
    }
    for (var j = b.length; j < a.length; j++) from.removeChild(a[j]);
  }

  function render(first) {
    vals = comp.renderVals() || {};
    var html = expand(tpl, vals);
    if (first) { root.innerHTML = html; }
    else {
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      morphChildren(root, tmp);
    }
    var dialog = root.querySelector('[role="dialog"]');
    if (dialog && !hadDialog) {
      var f = dialog.querySelector('input, textarea, button:not(.dclose)');
      if (f) f.focus();
    }
    hadDialog = !!dialog;
  }

  function fn(name) { var f = vals[name]; return typeof f === 'function' ? f : null; }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-on-click]');
    if (!el || !root || !root.contains(el)) return;
    var f = fn(el.getAttribute('data-on-click'));
    if (f) f(e);
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest && e.target.closest('[data-on-change]');
    if (!el || !root || !root.contains(el)) return;
    var f = fn(el.getAttribute('data-on-change'));
    if (f) f(e);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (vals.demoOpen && fn('closeDemo')) fn('closeDemo')();
    else if (vals.menuOpen && fn('closeMenu')) fn('closeMenu')();
  });

  window.DCRuntime = {
    mount: function (Component) {
      comp = new Component();
      root = document.getElementById('app');
      tpl = document.getElementById('tpl').textContent;
      render(true);
    }
  };
})();
