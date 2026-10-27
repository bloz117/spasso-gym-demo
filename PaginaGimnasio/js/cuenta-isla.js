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
        const card = isl.querySelector('.acct-isl__pos');
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


    /* ---------- Tour interactivo ---------- */
    const PASOS = [
        { panel: 'resumen', t: 'Resumen', p: 'Aquí ves tu plan, los días que te quedan, tu casillero y tu asistencia del mes con la racha de días seguidos.' },
        { panel: 'perfil', t: 'Perfil', p: 'Tus datos personales, tu membresía y la opción para cambiar tu contraseña.' },
        { panel: 'ejercicios', t: 'Ejercicios', p: 'Videos de cada ejercicio por músculo. Con "Crear mi rutina" armas tu propia rutina.' },
        { panel: 'rutinas', t: 'Mi rutina', p: 'La rutina que te asignó tu entrenador o la que creaste tú. Puedes cambiar entre las dos.' },
        { panel: 'promociones', t: 'Promociones', p: 'Las ofertas vigentes del gimnasio. Cuando haya una nueva, la verás aquí.' }
    ];
    let paso = 0, enTour = false;

    function objetivo(panel) {
        const nav = document.querySelector('.profile-bottomnav');
        const movil = nav && getComputedStyle(nav).display !== 'none';
        return document.querySelector((movil ? '.profile-bottomnav__item' : '.profile-nav__item') + '[data-panel="' + panel + '"]');
    }

    function pintarPaso() {
        const d = PASOS[paso], el = objetivo(d.panel);
        if (!el) return cerrarTour();
        el.click();                                  // muestra la sección explicada
        const r = el.getBoundingClientRect(), sp = $('acctTourSpot'), card = $('acctTourCard');
        sp.style.left = (r.left - 4) + 'px'; sp.style.top = (r.top - 4) + 'px';
        sp.style.width = (r.width + 8) + 'px'; sp.style.height = (r.height + 8) + 'px';
        const ult = paso === PASOS.length - 1;
        card.innerHTML = '<button class="acct-tour__x" data-t="x" aria-label="Cerrar">&times;</button>' +
            '<div class="acct-tour__paso">Paso ' + (paso + 1) + ' de ' + PASOS.length + '</div>' +
            '<h4>' + d.t + '</h4><p>' + d.p + '</p>' +
            '<div class="acct-tour__fila"><div class="acct-tour__pts">' + PASOS.map(function (_, i) { return '<i class="' + (i === paso ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
            (paso > 0 ? '<button class="acct-tour__b" data-t="ant">Atrás</button>' : '') +
            '<button class="acct-tour__b acct-tour__b--sig" data-t="sig">' + (ult ? '¡Listo!' : 'Siguiente') + '</button></div>';
        card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
        // Tarjeta arriba del objetivo si es la barra inferior; al costado si es el menú lateral
        const arriba = r.top > window.innerHeight / 2;
        card.style.top = arriba ? 'auto' : (r.bottom + 14) + 'px';
        card.style.bottom = arriba ? (window.innerHeight - r.top + 62) + 'px' : 'auto';
    }

    function iniciarTour() {
        if (!enMiCuenta()) return;
        cerrar();
        enTour = true; paso = 0;
        const t = $('acctTour'); t.hidden = false;
        setTimeout(pintarPaso, 250);
    }
    function cerrarTour() {
        enTour = false;
        const t = $('acctTour'); if (t) t.hidden = true;
        const first = objetivo('resumen'); if (first) first.click();
    }
    document.addEventListener('click', function (e) {
        if (!enTour) return;
        const b = e.target.closest && e.target.closest('[data-t]');
        if (!b) return;
        const k = b.getAttribute('data-t');
        if (k === 'x') cerrarTour();
        else if (k === 'ant') { paso = Math.max(0, paso - 1); pintarPaso(); }
        else if (paso >= PASOS.length - 1) cerrarTour();
        else { paso++; pintarPaso(); }
    });
    window.addEventListener('resize', function () { if (enTour) pintarPaso(); });

    function iniciar() {
        const tb = $('acctIslTour'); if (tb) tb.addEventListener('click', iniciarTour);
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
        if (pm) new MutationObserver(function () { if (!enMiCuenta()) { cerrar(); if (enTour) cerrarTour(); } })
            .observe(pm, { attributes: true, attributeFilter: ['class'] });
        const link = $('headerProfileLink');
        if (link) {
            link.setAttribute('aria-haspopup', 'dialog');
            link.setAttribute('aria-expanded', 'false');
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
