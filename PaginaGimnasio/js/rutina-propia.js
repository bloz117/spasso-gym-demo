/**
 * rutina-propia.js - "Crear mi rutina": los miembros con experiencia arman su
 * propia rutina semanal con los ejercicios de la biblioteca (series,
 * repeticiones y descanso). Se guarda en este dispositivo (por cuenta) y se
 * muestra en "Mi rutina" con los mismos botones GO que la del entrenador.
 * Formato igual al del entrenador: { dias:[{dia, ejercicios:[{id,nombre,series,repeticiones,descanso}]}] }
 */
(function () {
    'use strict';

    var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    var PAGINA = 40;
    var st = null;      // estado del editor abierto
    var root = null;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function toast(msg, tipo) {
        var t = document.createElement('div');
        t.className = 'trn-toast trn-toast--' + (tipo || 'ok');
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function () { t.classList.add('is-in'); }, 10);
        setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 300); }, 2600);
    }

    // ---------- almacenamiento (por cuenta, en este dispositivo) ----------
    function quien() {
        try {
            var tk = (window.getPortalToken && window.getPortalToken()) || '';
            var p = JSON.parse(atob(tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return String(p.id_socio || p.sub || p.username || 'anon');
        } catch (e) { return 'anon'; }
    }
    function clave() { return 'spassoRutinaPropia:' + quien(); }
    var mem = {};
    function obtener() {
        try {
            var r = JSON.parse(localStorage.getItem(clave()) || 'null');
            if (r && r.dias && r.dias.some(function (d) { return d.ejercicios && d.ejercicios.length; })) return r;
            return null;
        } catch (e) { return mem[clave()] || null; }
    }
    function guardar(r) {
        mem[clave()] = r;
        try { localStorage.setItem(clave(), JSON.stringify(r)); } catch (e) {}
    }
    function borrar() {
        delete mem[clave()];
        try { localStorage.removeItem(clave()); } catch (e) {}
    }

    // ---------- biblioteca ----------
    function generoSesion() {
        try { var u = JSON.parse(localStorage.getItem('currentUser') || 'null'); return u && u.genero ? u.genero : ''; }
        catch (e) { return ''; }
    }
    function libs() {
        var H = window.EJERCICIOS_DATA || [], M = window.EJERCICIOS_DATA_MUJER || [];
        return { H: H, M: M };
    }
    function bibliotecaActual() {
        var L = libs();
        return st.lib === 'M' && L.M.length ? L.M : L.H.length ? L.H : L.M;
    }
    function porId(id) {
        var L = libs(), a = L.H.concat(L.M);
        for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
        return null;
    }

    // ---------- diálogos propios (en lugar de los del navegador) ----------
    function dialogo(html, alAbrir) {
        var f = document.createElement('div');
        f.className = 'rp__dlg-fondo';
        f.innerHTML = '<div class="rp__dlg" role="dialog" aria-modal="true">' + html + '</div>';
        document.body.appendChild(f);
        function cerrarD() { f.remove(); }
        f.addEventListener('click', function (ev) { if (ev.target === f) cerrarD(); });
        if (alAbrir) alAbrir(f, cerrarD);
        return cerrarD;
    }
    function confirmar(icono, titulo, texto, okTxt, peligro, siAcepta) {
        dialogo('<div class="rp__dlg-ico' + (peligro ? ' peligro' : '') + '"><i class="fas ' + icono + '"></i></div>' +
            '<h4>' + esc(titulo) + '</h4><p>' + esc(texto) + '</p>' +
            '<div class="rp__dlg-bt"><button type="button" class="rp__dlg-no">Cancelar</button>' +
            '<button type="button" class="rp__dlg-si' + (peligro ? ' peligro' : '') + '">' + esc(okTxt) + '</button></div>',
            function (f, cerrarD) {
                f.querySelector('.rp__dlg-no').onclick = cerrarD;
                f.querySelector('.rp__dlg-si').onclick = function () { cerrarD(); siAcepta(); };
            });
    }

    // ---------- editor ----------
    function clonar(o) { return JSON.parse(JSON.stringify(o)); }
    function vacia() {
        return { nombre: 'Mi rutina', dias: DIAS.map(function (d) { return { dia: d, ejercicios: [] }; }) };
    }
    function diaObj(nombre) {
        for (var i = 0; i < st.rutina.dias.length; i++) if (st.rutina.dias[i].dia === nombre) return st.rutina.dias[i];
        var n = { dia: nombre, ejercicios: [] }; st.rutina.dias.push(n); return n;
    }
    function segTxt(d) { var n = parseInt(String(d), 10); return isNaN(n) ? 60 : n; }

    function abrir() {
        if (!window.getPortalToken || !window.getPortalToken()) { toast('Inicia sesión para crear tu rutina', 'err'); return; }
        var L = libs();
        var g = generoSesion();
        st = {
            rutina: obtener() ? clonar(obtener()) : vacia(),
            dia: DIAS[(new Date().getDay() + 6) % 7],
            lib: (g === 'femenino' && L.M.length) ? 'M' : 'H',
            selectorLib: !g && L.H.length && L.M.length,
            parte: 'Todos', q: '', visibles: PAGINA, picker: false, sucio: false
        };
        // normaliza los 7 días
        var map = {};
        st.rutina.dias.forEach(function (d) { map[d.dia] = d; });
        st.rutina.dias = DIAS.map(function (d) { return map[d] || { dia: d, ejercicios: [] }; });

        if (root) root.remove();
        root = document.createElement('div');
        root.className = 'rp';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Crear mi rutina');
        document.body.appendChild(root);
        document.documentElement.classList.add('rp-abierto');
        pintar();
    }

    function cerrar(forzar) {
        if (!root) return;
        if (st && st.sucio && !forzar) {
            confirmar('fa-triangle-exclamation', '¿Salir sin guardar?', 'Tienes cambios en tu rutina que todavía no guardaste.', 'Salir sin guardar', true, function () { cerrar(true); });
            return;
        }
        root.remove(); root = null; st = null;
        document.documentElement.classList.remove('rp-abierto');
    }

    function esDesk() { return window.matchMedia('(min-width: 1025px) and (hover: hover)').matches; }

    function pintar() {
        if (!root) return;
        var desk = esDesk();
        root.classList.toggle('rp--desk', desk);
        cerrarRueda();
        var antes = root.querySelector('.rp__main'), yMain = antes ? antes.scrollTop : 0;
        var antesRes = document.getElementById('rpRes'), yRes = antesRes ? antesRes.scrollTop : 0;
        var tot = st.rutina.dias.reduce(function (a, d) { return a + d.ejercicios.length; }, 0);
        var tabs = DIAS.map(function (d) {
            var n = diaObj(d).ejercicios.length;
            return '<button type="button" class="rp__dia' + (d === st.dia ? ' active' : '') + (n ? ' tiene' : '') + '" data-dia="' + d + '">' +
                '<span>' + d.slice(0, 3) + '</span>' + (n ? '<b>' + n + '</b>' : '') + '</button>';
        }).join('');
        var lista = diaObj(st.dia).ejercicios;
        var cuerpo = lista.length ? lista.map(tarjeta).join('') :
            '<div class="rp__vacio"><i class="fas fa-dumbbell"></i><strong>Sin ejercicios el ' + esc(st.dia) + '</strong>' +
            '<p>Toca “Añadir ejercicio” para elegirlos. Si no entrenas este día, déjalo vacío.</p></div>';

        root.innerHTML =
            '<div class="rp__top">' +
                '<button type="button" class="rp__x" data-a="cerrar" aria-label="Cerrar"><i class="fas fa-arrow-left"></i></button>' +
                '<div class="rp__tit"><strong>Crear mi rutina</strong><small>' + tot + ' ejercicio' + (tot === 1 ? '' : 's') + ' en la semana</small></div>' +
                '<button type="button" class="rp__ok" data-a="guardar"' + (tot ? '' : ' disabled') + '><i class="fas fa-check"></i> Guardar</button>' +
            '</div>' +
            (desk
                ? '<div class="rp__cols">' +
                    '<div class="rp__dias" role="tablist">' + tabs + '</div>' +
                    '<section class="rp__izq"><div class="rp__izq-cab"><h4 class="rp__h">' + esc(st.dia) + ' <small>' + lista.length + ' ejercicio' + (lista.length === 1 ? '' : 's') + '</small></h4>' +
                        (lista.length ? '<button type="button" class="rp__copiar" data-a="copiar"><i class="far fa-copy"></i> Copiar a otros días</button>' : '') + '</div>' +
                        '<div class="rp__main">' + cuerpo + '</div></section>' +
                    htmlPicker(true) +
                  '</div>'
                : '<div class="rp__dias" role="tablist">' + tabs + '</div>' +
                  '<div class="rp__main"><h4 class="rp__h">' + esc(st.dia) + '</h4>' + cuerpo + '</div>' +
                  '<div class="rp__pie">' +
                    '<button type="button" class="rp__add" data-a="picker"><i class="fas fa-plus"></i> Añadir ejercicio</button>' +
                    (lista.length ? '<button type="button" class="rp__copiar" data-a="copiar" title="Copiar este día a otros días"><i class="far fa-copy"></i></button>' : '') +
                  '</div>' +
                  (st.picker ? htmlPicker() : '')
            );
        enlazar();
        var m = root.querySelector('.rp__main'); if (m) m.scrollTop = yMain;
        if (st.picker || desk) { pintarResultados(); var r2 = document.getElementById('rpRes'); if (r2) r2.scrollTop = yRes; }
    }

    function tarjeta(e, i) {
        var ref = porId(e.id);
        var img = ref ? '<img loading="lazy" src="' + esc(ref.imagen) + '" alt="">' : '<span class="rp__ph"><i class="fas fa-dumbbell"></i></span>';
        function ctr(campo, v, etq) {
            return '<div class="rp__ctr"><small>' + etq + '</small>' +
                '<button type="button" class="rp__val" data-a="val" data-c="' + campo + '" data-i="' + i + '" aria-label="Cambiar ' + etq + '">' +
                '<b>' + esc(v) + '</b><i class="fas fa-sort"></i></button></div>';
        }
        return '<article class="rp__ej">' +
            '<div class="rp__ej-cab">' + img + '<strong>' + esc(e.nombre) + '</strong>' +
            '<div class="rp__ej-acc">' +
                '<button type="button" data-a="sube" data-i="' + i + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '><i class="fas fa-chevron-up"></i></button>' +
                '<button type="button" data-a="baja" data-i="' + i + '" aria-label="Bajar"><i class="fas fa-chevron-down"></i></button>' +
                '<button type="button" data-a="quita" data-i="' + i + '" aria-label="Quitar" class="rp__del"><i class="fas fa-trash"></i></button>' +
            '</div></div>' +
            '<div class="rp__ctrs">' + ctr('series', e.series, 'Series') + ctr('repeticiones', e.repeticiones, 'Repeticiones') +
            ctr('descanso', segTxt(e.descanso) + 's', 'Descanso') + '</div></article>';
    }

    // ---------- selector de ejercicios ----------
    function partes() {
        var set = {}, out = ['Todos'];
        bibliotecaActual().forEach(function (e) { if (e.parte_es && !set[e.parte_es]) { set[e.parte_es] = 1; out.push(e.parte_es); } });
        return out;
    }
    function htmlPicker(inline) {
        var L = libs();
        var chips = partes().map(function (p) {
            return '<button type="button" class="rp__chip' + (p === st.parte ? ' active' : '') + '" data-parte="' + esc(p) + '">' + esc(p) + '</button>';
        }).join('');
        var sel = st.selectorLib ? '<div class="rp__lib"><button type="button" class="rp__chip' + (st.lib === 'H' ? ' active' : '') + '" data-lib="H">Hombres</button>' +
            '<button type="button" class="rp__chip' + (st.lib === 'M' ? ' active' : '') + '" data-lib="M">Mujeres</button></div>' : '';
        return '<div class="rp__picker' + (inline ? ' rp__picker--inline' : '') + '" aria-label="Elegir ejercicios">' +
            '<div class="rp__pk-top">' + (inline ? '<strong class="rp__pk-tit"><i class="fas fa-list-check"></i> Biblioteca de ejercicios</strong>' : '<button type="button" class="rp__x" data-a="cerrarPicker" aria-label="Volver"><i class="fas fa-arrow-left"></i></button>') +
            '<div class="rp__pk-buscar"><i class="fas fa-search"></i><input id="rpBuscar" type="search" placeholder="Buscar ejercicio…" autocomplete="off" value="' + esc(st.q) + '"></div>' +
            (inline ? '' : '<button type="button" class="rp__ok" data-a="cerrarPicker">Listo</button>') + '</div>' +
            sel + '<div class="rp__chips">' + chips + '</div>' +
            '<div class="rp__res" id="rpRes"></div></div>';
    }
    function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function pintarResultados() {
        var cont = document.getElementById('rpRes'); if (!cont) return;
        var q = norm(st.q);
        var lista = bibliotecaActual().filter(function (e) {
            if (st.parte !== 'Todos' && e.parte_es !== st.parte) return false;
            return !q || norm(e.nombre).indexOf(q) !== -1 || norm(e.objetivo_es).indexOf(q) !== -1;
        });
        var ya = {};
        diaObj(st.dia).ejercicios.forEach(function (e) { ya[e.id] = (ya[e.id] || 0) + 1; });
        var vis = lista.slice(0, st.visibles);
        cont.innerHTML = vis.map(function (e) {
            var n = ya[e.id] || 0;
            return '<div class="rp__item"><img loading="lazy" src="' + esc(e.imagen) + '" alt="">' +
                '<div class="rp__item-info"><strong>' + esc(e.nombre) + '</strong><small>' + esc(e.objetivo_es || e.parte_es || '') + '</small></div>' +
                '<button type="button" class="rp__item-add' + (n ? ' hecho' : '') + '" data-add="' + esc(e.id) + '" aria-label="Añadir">' +
                (n ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>') + '</button></div>';
        }).join('') || '<p class="rp__nada">No encontramos ejercicios con ese filtro.</p>';
        if (lista.length > vis.length) cont.innerHTML += '<button type="button" class="rp__mas" data-a="verMas">Ver más (' + (lista.length - vis.length) + ')</button>';
    }

    // ---------- eventos ----------
    var ALTO = 40;
    function opciones(campo) {
        var o = [], i;
        if (campo === 'series') for (i = 1; i <= 10; i++) o.push(i);
        else if (campo === 'repeticiones') for (i = 1; i <= 50; i++) o.push(i);
        else for (i = 0; i <= 300; i += 15) o.push(i);
        return o;
    }
    function valorActual(campo, e) {
        return campo === 'series' ? (parseInt(e.series, 10) || 3)
            : campo === 'repeticiones' ? (parseInt(e.repeticiones, 10) || 12) : segTxt(e.descanso);
    }
    function fijar(campo, e, v) {
        if (campo === 'series') e.series = v;
        else if (campo === 'repeticiones') e.repeticiones = String(v);
        else e.descanso = v + ' s';
        st.sucio = true;
    }
    function textoVal(campo, v) { return campo === 'descanso' ? v + 's' : String(v); }

    function cerrarRueda() {
        var w = document.getElementById('rpRueda'); if (w) w.remove();
    }
    // Ventana flotante pequeña con una rueda para subir/bajar el valor (sin volver a pintar la lista)
    function abrirRueda(btn, campo, i) {
        cerrarRueda();
        var e = diaObj(st.dia).ejercicios[i]; if (!e) return;
        var ops = opciones(campo), actual = valorActual(campo, e);
        var idx = Math.max(0, ops.indexOf(actual)); if (idx < 0) idx = 0;
        var tit = campo === 'series' ? 'Series' : campo === 'repeticiones' ? 'Repeticiones' : 'Descanso';
        var w = document.createElement('div');
        w.id = 'rpRueda'; w.className = 'rp__rueda-fondo';
        w.innerHTML = '<div class="rp__rueda" role="dialog" aria-label="' + tit + '"><div class="rp__rueda-tit">' + tit + '</div>' +
            '<div class="rp__rueda-caja"><div class="rp__rueda-sel"></div><div class="rp__rueda-lista">' +
            ops.map(function (v) { return '<div class="rp__rueda-it" data-v="' + v + '">' + textoVal(campo, v) + '</div>'; }).join('') +
            '</div></div><button type="button" class="rp__rueda-ok">Listo</button></div>';
        root.appendChild(w);
        var card = w.firstChild, lista = w.querySelector('.rp__rueda-lista');
        // posición junto al valor tocado
        var r = btn.getBoundingClientRect(), rr = root.getBoundingClientRect();
        var ancho = 130, alto = card.offsetHeight || 290;
        var x = Math.min(Math.max(8, r.left + r.width / 2 - ancho / 2 - rr.left), rr.width - ancho - 8);
        var y = r.top - rr.top - alto - 8; if (y < 8) y = Math.min(r.bottom - rr.top + 8, rr.height - alto - 8);
        card.style.left = x + 'px'; card.style.top = Math.max(8, y) + 'px'; card.style.width = ancho + 'px';
        lista.scrollTop = idx * ALTO;
        var out = btn.querySelector('b'), t = null, ult = idx;
        function marcar(n) {
            var its = lista.children;
            for (var k = 0; k < its.length; k++) its[k].classList.toggle('on', k === n);
        }
        marcar(idx);
        lista.addEventListener('scroll', function () {
            var n = Math.min(ops.length - 1, Math.max(0, Math.round(lista.scrollTop / ALTO)));
            if (n !== ult) {
                ult = n; marcar(n);
                fijar(campo, e, ops[n]);
                if (out) out.textContent = textoVal(campo, ops[n]);
            }
        }, { passive: true });
        lista.addEventListener('click', function (ev) {
            var it = ev.target.closest('.rp__rueda-it'); if (!it) return;
            var n = ops.indexOf(parseInt(it.getAttribute('data-v'), 10));
            lista.scrollTo({ top: n * ALTO, behavior: 'smooth' });
        });
        w.addEventListener('click', function (ev) {
            if (ev.target === w || ev.target.classList.contains('rp__rueda-ok')) { ev.stopPropagation(); cerrarRueda(); }
        });
    }
    function enlazar() {
        root.onclick = function (ev) {
            if (ev.target.closest('#rpRueda')) return;
            var b = ev.target.closest('button'); if (!b) return;
            var a = b.getAttribute('data-a');
            var lista = diaObj(st.dia).ejercicios, i = parseInt(b.getAttribute('data-i'), 10);
            if (b.hasAttribute('data-dia')) { st.dia = b.getAttribute('data-dia'); pintar(); return; }
            if (b.hasAttribute('data-parte')) { st.parte = b.getAttribute('data-parte'); st.visibles = PAGINA; pintar(); return; }
            if (b.hasAttribute('data-lib')) { st.lib = b.getAttribute('data-lib'); st.parte = 'Todos'; st.visibles = PAGINA; pintar(); return; }
            if (b.hasAttribute('data-add')) {
                var id = b.getAttribute('data-add'), ref = porId(id), pos = -1;
                for (var k = lista.length - 1; k >= 0; k--) if (lista[k].id === id) { pos = k; break; }
                if (pos >= 0) { lista.splice(pos, 1); toast('Quitado'); }
                else if (ref) { lista.push({ id: ref.id, nombre: ref.nombre, series: 3, repeticiones: '12', descanso: '60 s' }); toast('Añadido'); }
                st.sucio = true;
                if (esDesk()) { pintar(); return; }   // en escritorio la rutina del día está a la vista: se actualiza
                var cont = document.getElementById('rpRes'), y = cont ? cont.scrollTop : 0;
                pintarResultados(); if (cont) cont.scrollTop = y;
                return;
            }
            switch (a) {
                case 'cerrar': cerrar(); break;
                case 'guardar': guardarYSalir(); break;
                case 'picker': st.picker = true; st.visibles = PAGINA; pintar(); break;
                case 'cerrarPicker': st.picker = false; pintar(); break;
                case 'verMas': st.visibles += PAGINA; pintarResultados(); break;
                case 'val': abrirRueda(b, b.getAttribute('data-c'), i); break;
                case 'sube': if (i > 0) { var x = lista[i]; lista[i] = lista[i - 1]; lista[i - 1] = x; st.sucio = true; pintar(); } break;
                case 'baja': if (i < lista.length - 1) { var y2 = lista[i]; lista[i] = lista[i + 1]; lista[i + 1] = y2; st.sucio = true; pintar(); } break;
                case 'quita': lista.splice(i, 1); st.sucio = true; pintar(); break;
                case 'copiar': copiarA(); break;
            }
        };
        var inp = document.getElementById('rpBuscar');
        if (inp) inp.oninput = function () { st.q = inp.value; st.visibles = PAGINA; pintarResultados(); };
    }

    function copiarA() {
        var chips = DIAS.filter(function (d) { return d !== st.dia; }).map(function (d) {
            return '<button type="button" class="rp__chip" data-d="' + d + '">' + d + '</button>';
        }).join('');
        dialogo('<div class="rp__dlg-ico"><i class="far fa-copy"></i></div><h4>Copiar el ' + esc(st.dia) + '</h4>' +
            '<p>Elige a qué días quieres copiar estos ejercicios.</p><div class="rp__dlg-dias">' + chips + '</div>' +
            '<div class="rp__dlg-bt"><button type="button" class="rp__dlg-no">Cancelar</button>' +
            '<button type="button" class="rp__dlg-si" disabled>Copiar</button></div>',
            function (f, cerrarD) {
                var si = f.querySelector('.rp__dlg-si');
                f.querySelectorAll('.rp__chip').forEach(function (c) {
                    c.onclick = function () { c.classList.toggle('active'); si.disabled = !f.querySelector('.rp__chip.active'); };
                });
                f.querySelector('.rp__dlg-no').onclick = cerrarD;
                si.onclick = function () {
                    var n = 0;
                    f.querySelectorAll('.rp__chip.active').forEach(function (c) {
                        diaObj(c.getAttribute('data-d')).ejercicios = clonar(diaObj(st.dia).ejercicios); n++;
                    });
                    cerrarD();
                    if (n) { st.sucio = true; toast('Copiado a ' + n + ' día' + (n === 1 ? '' : 's')); pintar(); }
                };
            });
    }

    function guardarYSalir() {
        var r = clonar(st.rutina);
        r.dias = r.dias.filter(function (d) { return d.ejercicios.length; });
        if (!r.dias.length) { toast('Agrega al menos un ejercicio', 'err'); return; }
        r.actualizada = new Date().toISOString();
        guardar(r);
        cerrar(true);
        toast('Tu rutina quedó guardada');
        var b = document.querySelector('.profile-bottomnav__item[data-panel="rutinas"], .profile-nav__item[data-panel="rutinas"]');
        if (b) b.click();
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && root) { if (document.getElementById('rpRueda')) { cerrarRueda(); return; } if (st.picker) { st.picker = false; pintar(); } else cerrar(); }
    });
    document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rutina-propia]');
        if (!b) return;
        var acc = b.getAttribute('data-rutina-propia');
        if (acc === 'borrar') {
            confirmar('fa-trash', '¿Borrar tu rutina?', 'Se eliminará tu rutina personal de este dispositivo.', 'Borrar', true, function () { borrar(); if (window.recargarMiRutina) window.recargarMiRutina(); });
        } else abrir();
    });

    window.RutinaPropia = { abrir: abrir, obtener: obtener, borrar: borrar };
})();
