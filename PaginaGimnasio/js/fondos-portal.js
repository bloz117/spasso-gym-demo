/* Selector de fondo del portal público: Claro, Claro tenue, Liso oscuro y
   En movimiento. Lo elige cada visitante (se guarda en su navegador). Solo
   cambia fondos/colores del tema: no toca las fotos de la página. */
(function () {
    'use strict';
    var FONDOS = {
        'claro-tenue': 'Claro tenue',
        'liso': 'Liso oscuro',
        'movimiento': 'En movimiento'
    };
    var raiz = document.documentElement;

    function aplicar(fondo, guardar) {
        if (fondo === 'claro') fondo = 'claro-tenue';
        if (!FONDOS[fondo]) fondo = 'movimiento';
        raiz.setAttribute('data-fondo', fondo);
        if (guardar) {
            try { localStorage.setItem('fondoPortal', fondo); } catch (e) {}
        }
        var nombre = document.getElementById('fondoNombreActual');
        if (nombre) nombre.textContent = FONDOS[fondo];
        var muestra = document.getElementById('fondoSwatchActual');
        if (muestra) muestra.className = 'fondo-swatch fondo-swatch--' + fondo;
        document.querySelectorAll('#fondoSelectorMenu .fondo-opt').forEach(function (op) {
            op.setAttribute('aria-selected', op.getAttribute('data-fondo') === fondo ? 'true' : 'false');
        });
    }

    function cerrar() {
        var menu = document.getElementById('fondoSelectorMenu');
        var btn = document.getElementById('fondoSelectorBtn');
        if (menu) menu.classList.remove('abierto');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function alternar(e) {
        e.stopPropagation();
        var menu = document.getElementById('fondoSelectorMenu');
        var btn = document.getElementById('fondoSelectorBtn');
        var abrir = !menu.classList.contains('abierto');
        menu.classList.toggle('abierto', abrir);
        btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    }

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('fondoSelectorBtn');
        if (!btn) return;
        aplicar(raiz.getAttribute('data-fondo'), false);
        btn.addEventListener('click', alternar);
        document.querySelectorAll('#fondoSelectorMenu .fondo-opt').forEach(function (op) {
            function elegir() { aplicar(op.getAttribute('data-fondo'), true); cerrar(); }
            op.addEventListener('click', elegir);
            op.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); }
            });
        });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#fondoSelector')) cerrar();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
    });
})();
