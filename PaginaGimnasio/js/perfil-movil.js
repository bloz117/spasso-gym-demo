/* Mi Cuenta en celular:
   1) Dentro de Mi Cuenta el hamburguesa se cambia por una flecha "volver" (CSS + este botón).
   2) El nombre se muestra siempre completo (solo el primer nombre en el header) y
      su tamaño se ajusta al largo: corto = más grande, largo = más pequeño. */
(function () {
    'use strict';

    function primerNombre(txt) {
        const p = String(txt || '').trim().split(/\s+/)[0] || '';
        return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
    }

    // Clase de tamaño según cuántas letras tiene
    function claseTamano(n, limites) {
        for (let i = 0; i < limites.length; i++) if (n <= limites[i]) return 'nm-' + i;
        return 'nm-' + limites.length;
    }
    function aplicarTamano(el, texto, limites) {
        if (!el) return;
        el.className = el.className.replace(/\bnm-\d\b/g, '').trim();
        el.classList.add(claseTamano(String(texto || '').length, limites));
    }

    // --- Nombre en el header ("Hola, X" → solo el primer nombre) ---
    const LIM_HEADER = [5, 7, 9, 11];            // nm-0 … nm-4
    function ajustarHeader() {
        const link = document.getElementById('headerProfileLink');
        if (!link || link.hasAttribute('hidden')) return;
        const nombre = primerNombre(link.dataset.nombreCompleto || link.textContent.replace(/^Hola,\s*/i, ''));
        if (!nombre) return;
        if (link.textContent !== nombre) link.textContent = nombre;
        link.title = link.dataset.nombreCompleto || nombre;
        aplicarTamano(link, nombre, LIM_HEADER);
    }

    function enganchar() {
        const orig = window.actualizarBotonSesion;
        if (typeof orig === 'function' && !orig.__ajustado) {
            const nuevo = function (logueado, nombre) {
                const r = orig.apply(this, arguments);
                const link = document.getElementById('headerProfileLink');
                if (link) { if (logueado && nombre) link.dataset.nombreCompleto = nombre; ajustarHeader(); }
                return r;
            };
            nuevo.__ajustado = true;
            window.actualizarBotonSesion = nuevo;
        }
        ajustarHeader();
    }

    // --- Nombre completo en la tarjeta de Mi Cuenta ---
    const LIM_TARJETA = [14, 20, 26];
    function ajustarTarjeta() {
        const el = document.getElementById('profileMobName');
        if (el) aplicarTamano(el, el.textContent, LIM_TARJETA);
    }

    // --- Flecha volver ---
    function iniciar() {
        const back = document.getElementById('headerBackBtn');
        if (back) {
            back.addEventListener('click', function () {
                const chk = document.getElementById('navToggle'); if (chk) chk.checked = false;
                const x = document.querySelector('#profileModal .pagina-ubicacion-cerrar');
                if (x) x.click();
            });
        }
        // El hamburguesa debe estar cerrado al entrar a Mi Cuenta
        const pm = document.getElementById('profileModal');
        if (pm) new MutationObserver(function () {
            if (pm.classList.contains('is-open')) { const chk = document.getElementById('navToggle'); if (chk) chk.checked = false; ajustarTarjeta(); }
        }).observe(pm, { attributes: true, attributeFilter: ['class'] });

        const mn = document.getElementById('profileMobName');
        if (mn) new MutationObserver(ajustarTarjeta).observe(mn, { childList: true, characterData: true, subtree: true });
        const link = document.getElementById('headerProfileLink');
        if (link) new MutationObserver(function () {
            const n = primerNombre(link.textContent.replace(/^Hola,\s*/i, ''));
            if (link.textContent !== n && n) { if (!link.dataset.nombreCompleto) link.dataset.nombreCompleto = link.textContent.replace(/^Hola,\s*/i, ''); ajustarHeader(); }
        }).observe(link, { childList: true, characterData: true, subtree: true });

        enganchar(); ajustarTarjeta();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
