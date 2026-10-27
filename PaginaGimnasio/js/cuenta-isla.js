/* Menú de cuenta tipo "isla dinámica".
   Dentro de Mi cuenta, tocar el nombre del header abre un panel animado con
   nombre, correo, Ayuda y Cerrar sesión. Fuera de Mi cuenta el nombre sigue
   abriendo Mi cuenta como siempre (lo maneja funciones.js). */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    let abierta = false;

    function datos() {
        let u = null;
        try { u = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (e) { /* sin datos */ }
        const link = $('headerProfileLink');
        const nombre = (u && u.name) || (link && link.dataset.nombreCompleto) || ($('profileName') && $('profileName').textContent) || 'Mi cuenta';
        const correo = (u && u.email) || ($('profileEmail') && $('profileEmail').textContent) || '';
        return { nombre: nombre, correo: correo };
    }

    function vista(cual) {
        const menu = $('acctIslMenu'), ayuda = $('acctIslAyudaVista');
        if (!menu || !ayuda) return;
        menu.hidden = cual !== 'menu';
        ayuda.hidden = cual !== 'ayuda';
    }

    function abrir() {
        const isl = $('acctIsl'); if (!isl) return;
        const d = datos();
        $('acctIslNombre').textContent = d.nombre;
        $('acctIslCorreo').textContent = d.correo;
        vista('menu');
        const hd = document.querySelector('body > header, header');
        const card = isl.querySelector('.acct-isl__card');
        if (hd && card) card.style.top = Math.round(hd.getBoundingClientRect().bottom + 8) + 'px';
        isl.hidden = false;
        void isl.offsetWidth;                 // reflow para que arranque la animación
        isl.classList.add('is-open');
        abierta = true;
        const link = $('headerProfileLink'); if (link) link.setAttribute('aria-expanded', 'true');
    }

    function cerrar() {
        const isl = $('acctIsl'); if (!isl || !abierta) return;
        abierta = false;
        isl.classList.remove('is-open');
        const link = $('headerProfileLink'); if (link) link.setAttribute('aria-expanded', 'false');
        setTimeout(function () { if (!abierta) isl.hidden = true; }, 320);
    }

    function enMiCuenta() {
        const pm = $('profileModal');
        return !!(pm && pm.classList.contains('is-open'));
    }

    // En captura: si estamos en Mi cuenta, el nombre abre la isla (no reabre el perfil).
    document.addEventListener('click', function (e) {
        const link = e.target.closest && e.target.closest('#headerProfileLink');
        if (!link || !enMiCuenta()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (abierta) cerrar(); else abrir();
    }, true);

    document.addEventListener('click', function (e) {
        if (!abierta) return;
        if (e.target.closest('[data-isl-cerrar]')) cerrar();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });

    function iniciar() {
        const ay = $('acctIslAyuda'), vo = $('acctIslVolver'), sa = $('acctIslSalir');
        if (ay) ay.addEventListener('click', function () { vista('ayuda'); });
        if (vo) vo.addEventListener('click', function () { vista('menu'); });
        if (sa) sa.addEventListener('click', function () {
            cerrar();
            const b = $('loginBtn');
            if (b) setTimeout(function () { b.click(); }, 180);
        });
        // Si Mi cuenta se cierra (flecha volver) o se cierra la sesión, la isla se cierra
        const pm = $('profileModal');
        if (pm) new MutationObserver(function () { if (!enMiCuenta()) cerrar(); })
            .observe(pm, { attributes: true, attributeFilter: ['class'] });
        const link = $('headerProfileLink');
        if (link) {
            link.setAttribute('aria-haspopup', 'dialog');
            link.setAttribute('aria-expanded', 'false');
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
