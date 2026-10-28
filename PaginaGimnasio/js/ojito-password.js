/* Ojito para ver/ocultar la contraseña en TODOS los campos type="password".
   Se aplica solo a los campos existentes y a los que se creen después (modales, uiPrompt, etc.).
   Para excluir un campo: data-sin-ojo="1". */
(function () {
  'use strict';
  if (window.__ojitoPassword) return;
  window.__ojitoPassword = true;

  var css = '.pw-ojo-wrap{position:relative;display:block;width:100%}' +
    '.pw-ojo-wrap>input{width:100%;box-sizing:border-box;padding-right:2.8rem !important}' +
    '.pw-ojo-wrap .pw-ojo-btn{all:unset;box-sizing:border-box;position:absolute;right:.45rem;top:50%;transform:translateY(-50%);width:2.1rem;height:2.1rem;' +
    'display:flex;align-items:center;justify-content:center;border-radius:50%;color:#6E6E73;opacity:.85;cursor:pointer;-webkit-tap-highlight-color:transparent;z-index:2}' +
    '.pw-ojo-wrap .pw-ojo-btn:hover,.pw-ojo-wrap .pw-ojo-btn:focus-visible{opacity:1;outline:none;transform:translateY(-50%);box-shadow:none}' +
    '.pw-ojo-wrap .pw-ojo-btn:active{transform:translateY(-50%);box-shadow:none}' +
    '.login-card .pw-ojo-btn{color:#6E6E73}' +
    '.pw-ojo-btn svg{width:1.2rem;height:1.2rem;pointer-events:none}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var OJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var OJO_TACHADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

  function envolver(inp) {
    if (!inp || inp.dataset.ojo || inp.dataset.sinOjo || !inp.parentNode) return;
    inp.dataset.ojo = '1';
    var wrap = document.createElement('span');
    wrap.className = 'pw-ojo-wrap';
    var cs = getComputedStyle(inp); wrap.style.margin = cs.marginTop + ' ' + cs.marginRight + ' ' + cs.marginBottom + ' ' + cs.marginLeft; inp.style.margin = '0';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pw-ojo-btn';
    b.setAttribute('aria-label', 'Mostrar contraseña');
    b.setAttribute('aria-pressed', 'false');
    b.tabIndex = -1;
    b.innerHTML = OJO;
    // El ojito toma el color real del texto del campo (así se ve en fondos claros y oscuros)
    try { var col = getComputedStyle(inp).color; var bg = getComputedStyle(inp).backgroundColor; if (col && !inp.closest('.login-card') && !/rgba\(0, 0, 0, 0\)/.test(col)) b.style.color = col; } catch (_) {}
    // mousedown/touchstart evitan que el campo pierda el foco (y que se cierre el teclado)
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var ver = inp.type === 'password';
      inp.type = ver ? 'text' : 'password';
      b.innerHTML = ver ? OJO_TACHADO : OJO;
      b.setAttribute('aria-pressed', ver ? 'true' : 'false');
      b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
      try { inp.focus({ preventScroll: true }); } catch (_) { inp.focus(); }
    });
    wrap.appendChild(b);
  }

  function barrer(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (raiz.matches && raiz.matches('input[type="password"]')) envolver(raiz);
    var l = raiz.querySelectorAll('input[type="password"]');
    for (var i = 0; i < l.length; i++) envolver(l[i]);
  }

  function iniciar() {
    barrer(document);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var n = muts[i].addedNodes;
        for (var j = 0; j < n.length; j++) if (n[j].nodeType === 1) barrer(n[j]);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
