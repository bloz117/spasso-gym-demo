/**
 * entrenador-portal.js - Interfaz de ENTRENADOR del portal público
 * + bloque "Mi rutina" que ve el socio en su perfil.
 *
 * Flujo: las cuentas de Entrenador se crean en Recepción y solo entran por
 * el portal. Al iniciar sesión (funciones.js llama a abrirPanelEntrenador)
 * se abre este panel a pantalla completa con la lista de socios cuyo plan
 * incluye rutina; el entrenador arma la rutina semanal con ejercicios de la
 * biblioteca (window.EJERCICIOS_DATA) y la guarda como borrador o la publica.
 * Usa portalFetch (portal-client.js) con el token del entrenador.
 */
(function () {
    'use strict';

    var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    var estado = { socios: [], idSocio: null, socio: null, rutina: null, dia: 'Lunes', publicada: false, sucio: false, filtro: '' };
    var panel = null;

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
        setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 300); }, 3200);
    }

    // Bibliotecas: hombres = window.EJERCICIOS_DATA; mujeres = window.EJERCICIOS_DATA_MUJER
    // (archivo opcional con las mismas columnas y ids distintos, ej. "m-0001").
    function bibliotecaPara(genero) {
        var m = window.EJERCICIOS_DATA_MUJER || [];
        if (genero === 'femenino' && m.length) return m;
        return window.EJERCICIOS_DATA || [];
    }
    function ejercicio(id) {
        var libs = [window.EJERCICIOS_DATA || [], window.EJERCICIOS_DATA_MUJER || []];
        for (var l = 0; l < libs.length; l++) {
            for (var i = 0; i < libs[l].length; i++) if (libs[l][i].id === id) return libs[l][i];
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Estructura del panel
    // ------------------------------------------------------------------
    function construir() {
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'trainerPanel';
        panel.className = 'trn';
        panel.innerHTML =
            '<header class="trn__top">' +
                '<button type="button" class="trn__burger" id="trnMenuBtn" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span><span></span></button>' +
                '<div class="trn__tit"><strong id="trnTitulo">Mis socios</strong><small id="trnSubtitulo"></small></div>' +
                '<button type="button" class="trn__yo" id="trnYo" aria-label="Mi cuenta de entrenador"><span id="trnYoIni">E</span></button>' +
                '<div class="trn__brand"><i class="fas fa-dumbbell"></i><div><strong>Panel de Entrenador</strong><span id="trnUsuario"></span></div></div>' +
                '<button class="trn__btn trn__btn--ghost" id="trnSalir"><i class="fas fa-right-from-bracket"></i> Cerrar sesión</button>' +
            '</header>' +
            '<div class="trn__body">' +
                '<aside class="trn__lista" id="trnLista">' +
                    '<div class="trn__lista-tit"><h2>Mis socios</h2><span id="trnCount"></span></div>' +
                    '<div class="trn__buscar"><i class="fas fa-search"></i><input id="trnBuscar" type="text" placeholder="Buscar socio..." autocomplete="off"></div>' +
                    '<div class="trn__socios" id="trnSocios"></div>' +
                '</aside>' +
                '<main class="trn__editor" id="trnEditor"></main>' +
            '</div>' +
            '<div class="trn__scrim" id="trnScrim"></div>' +
            '<div class="trn__drawer" id="trnDrawer" role="dialog" aria-label="Menú del entrenador">' +
                '<div class="trn__dr-head">' +
                    '<span class="trn__dr-av" id="trnDrIni">E</span>' +
                    '<div class="trn__dr-quien"><small>Sesión iniciada como</small><strong id="trnDrNombre">Entrenador</strong></div>' +
                    '<button type="button" class="trn__dr-x" id="trnDrCerrar" aria-label="Cerrar menú"><i class="fas fa-xmark"></i></button>' +
                '</div>' +
                '<div class="trn__dr-tit"><span>Mis socios</span><em id="trnDrCount"></em></div>' +
                '<div class="trn__dr-lista" id="trnDrSocios"></div>' +
                '<button type="button" class="perfil-logout trn__dr-salir" id="trnDrSalir"><i class="fas fa-right-from-bracket"></i> Cerrar sesión</button>' +
            '</div>' +
            '<div class="trn__picker" id="trnPicker" hidden></div>' +
            '<datalist id="trnDescansos"><option value="30 s"><option value="45 s"><option value="60 s"><option value="90 s"><option value="2 min"></datalist>';
        document.body.appendChild(panel);

        panel.querySelector('#trnSalir').addEventListener('click', function () {
            if (estado.sucio && !confirm('Tienes cambios sin guardar. ¿Cerrar sesión de todos modos?')) return;
            if (window.cerrarSesionCompleta) window.cerrarSesionCompleta(); else cerrar();
        });
        panel.querySelector('#trnMenuBtn').addEventListener('click', function () { menu(!panel.classList.contains('trn--menu')); });
        panel.querySelector('#trnScrim').addEventListener('click', function () { menu(false); });
        panel.querySelector('#trnDrSalir').addEventListener('click', function () { menu(false); panel.querySelector('#trnSalir').click(); });
        panel.querySelector('#trnYo').addEventListener('click', function () { menu(true); });
        panel.querySelector('#trnDrCerrar').addEventListener('click', function () { menu(false); });
        panel.querySelector('#trnDrSocios').addEventListener('click', function (e) {
            var it = e.target.closest('[data-id]');
            if (!it) return;
            menu(false);
            elegirSocio(parseInt(it.getAttribute('data-id'), 10));
        });
        panel.querySelector('#trnBuscar').addEventListener('input', function (e) {
            estado.filtro = e.target.value.toLowerCase();
            pintarSocios();
        });
    }

    function menu(abierto) {
        panel.classList.toggle('trn--menu', abierto);
        var b = panel.querySelector('#trnMenuBtn');
        b.setAttribute('aria-expanded', abierto ? 'true' : 'false');
        b.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    }

    function setTab(tab) {
        estado.tab = tab;
        var ed = panel.querySelector('#trnEditor');
        ed.querySelectorAll('#trnTabs button').forEach(function (x) { x.classList.toggle('is-active', x.getAttribute('data-tab') === tab); });
        var sc = ed.querySelector('#trnEdScroll');
        if (sc) { sc.setAttribute('data-tab', tab); sc.scrollTop = 0; }
    }

    function irA(destino) {
        menu(false);
        if (destino === 'socios' || !estado.idSocio || !panel.querySelector('#trnEdScroll')) {
            panel.classList.remove('trn--editando');
        } else {
            setTab(destino);
            panel.classList.add('trn--editando');
        }
        actualizarMenu();
    }

    function nombreEntrenador() {
        var n = (estado.entrenador || '').trim();
        if (!n) return 'Entrenador';
        return 'Entrenador ' + n.charAt(0).toUpperCase() + n.slice(1);
    }

    function pintarMenuSocios() {
        var c = panel.querySelector('#trnDrSocios');
        if (!c) return;
        if (!estado.socios.length) { c.innerHTML = '<p class="trn__nota">Aún no tienes socios asignados.</p>'; return; }
        c.innerHTML = estado.socios.map(function (s) {
            return '<button type="button" class="trn__dr-socio' + (s.id_socio === estado.idSocio ? ' is-active' : '') + '" data-id="' + s.id_socio + '">' +
                '<span class="trn__avatar">' + esc((s.nombre || '?').charAt(0).toUpperCase()) + '</span>' +
                '<span class="trn__dr-info"><strong>' + esc(s.nombre) + '</strong><small>' + esc(s.plan || '') + '</small></span>' +
                (s.id_socio === estado.idSocio ? '<i class="fas fa-circle-check"></i>' : (s.tiene_datos ? '' : '<i class="fas fa-circle-minus trn__dr-off" title="Sin datos"></i>')) +
            '</button>';
        }).join('');
    }

    function actualizarMenu() {
        if (!panel) return;
        var tengo = !!(estado.idSocio && estado.socio && panel.querySelector('#trnEdScroll'));
        var editando = panel.classList.contains('trn--editando') && tengo;
        var n = estado.socios.length;
        var q = function (s) { return panel.querySelector(s); };
        var quien = nombreEntrenador();
        q('#trnDrNombre').textContent = quien;
        q('#trnDrIni').textContent = (estado.entrenador || 'E').charAt(0).toUpperCase();
        q('#trnYoIni').textContent = (estado.entrenador || 'E').charAt(0).toUpperCase();
        q('#trnDrCount').textContent = n || '';
        panel.querySelectorAll('.trn__dr-socio').forEach(function (b) {
            b.classList.toggle('is-active', parseInt(b.getAttribute('data-id'), 10) === estado.idSocio && editando);
        });
        if (editando) {
            q('#trnTitulo').textContent = estado.socio.nombre;
            q('#trnSubtitulo').textContent = quien;
        } else {
            q('#trnTitulo').textContent = 'Mis socios';
            q('#trnSubtitulo').textContent = quien + (n ? ' · ' + n + (n === 1 ? ' socio' : ' socios') : '');
        }
    }

    function abrir(nombre) {
        construir();
        estado.entrenador = nombre || '';
        panel.querySelector('#trnUsuario').textContent = nombre || '';
        menu(false);
        panel.classList.add('is-open');
        document.documentElement.style.overflowY = 'hidden';
        document.body.style.overflowY = 'hidden';
        estado.idSocio = null;
        panel.classList.remove('trn--editando');
        pintarVacio();
        actualizarMenu();
        cargarSocios();
    }

    function cerrar() {
        if (!panel) return;
        panel.classList.remove('is-open', 'trn--editando', 'trn--menu');
        document.documentElement.style.overflowY = '';
        document.body.style.overflowY = 'auto';
        estado.idSocio = null;
        estado.sucio = false;
    }

    // ------------------------------------------------------------------
    // Lista de socios
    // ------------------------------------------------------------------
    function cargarSocios() {
        var cont = panel.querySelector('#trnSocios');
        cont.innerHTML = '<p class="trn__nota">Cargando socios...</p>';
        portalFetch('/api/entrenador/socios').then(function (lista) {
            estado.socios = lista || [];
            pintarSocios();
        }).catch(function (e) {
            cont.innerHTML = '<p class="trn__nota trn__nota--err">' + esc(e.message) + '</p>';
        });
    }

    function pintarSocios() {
        var cont = panel.querySelector('#trnSocios');
        var cEl = panel.querySelector('#trnCount');
        if (cEl) cEl.textContent = estado.socios.length;
        pintarMenuSocios();
        actualizarMenu();
        var lista = estado.socios.filter(function (s) {
            return !estado.filtro || (s.nombre || '').toLowerCase().indexOf(estado.filtro) !== -1;
        });
        if (!lista.length) {
            cont.innerHTML = '<p class="trn__nota">' + (estado.socios.length
                ? 'Sin resultados.'
                : 'Recepción aún no te asignó socios. Solo aparecen socios con un plan que incluye rutina de entrenador.') + '</p>';
            return;
        }
        cont.innerHTML = lista.map(function (s) {
            var etiqueta = s.publicada ? ['Publicada', 'ok'] : (s.tiene_rutina ? ['Borrador', 'warn'] : ['Sin rutina', 'off']);
            return '<button class="trn__socio' + (s.id_socio === estado.idSocio ? ' is-active' : '') + '" data-id="' + s.id_socio + '">' +
                '<span class="trn__avatar">' + esc((s.nombre || '?').charAt(0).toUpperCase()) + '</span>' +
                '<span class="trn__socio-info"><strong>' + esc(s.nombre) + '</strong><small>' + esc(s.plan || '') + '</small>' +
                    '<small class="trn__dato ' + (s.tiene_datos ? 'ok' : 'off') + '"><i class="fas fa-' + (s.tiene_datos ? 'circle-check' : 'circle-minus') + '"></i> ' + (s.tiene_datos ? 'Datos recibidos' : 'Sin datos') + '</small></span>' +
                '<span class="trn__chip trn__chip--' + etiqueta[1] + '">' + etiqueta[0] + '</span>' +
            '</button>';
        }).join('');
        cont.querySelectorAll('.trn__socio').forEach(function (b) {
            b.addEventListener('click', function () { elegirSocio(parseInt(b.getAttribute('data-id'), 10)); });
        });
    }

    function pintarVacio() {
        panel.querySelector('#trnEditor').innerHTML =
            '<div class="trn__vacio"><i class="fas fa-clipboard-list"></i><h3>Elige un socio</h3>' +
            '<p>Selecciona a alguien de la lista para armar o actualizar su rutina semanal.</p></div>';
    }

    function elegirSocio(id) {
        if (estado.sucio && id !== estado.idSocio && !confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return;
        if (id === estado.idSocio && estado.sucio && panel.querySelector('#trnEdScroll')) { panel.classList.add('trn--editando'); actualizarMenu(); return; }
        estado.idSocio = id;
        estado.sucio = false;
        pintarSocios();
        panel.classList.add('trn--editando');
        var ed = panel.querySelector('#trnEditor');
        ed.innerHTML = '<p class="trn__nota">Cargando rutina...</p>';
        portalFetch('/api/entrenador/socios/' + id + '/rutina').then(function (r) {
            estado.socio = r.socio;
            estado.rutina = r.rutina || { nombre: 'Rutina semanal', notas: '', dias: [] };
            estado.publicada = !!r.publicada;
            estado.perfil = r.perfil || null;
            estado.iaMsg = null; estado.extraIA = ''; estado.tab = null;
            asegurarDias();
            estado.dia = DIAS.filter(function (d) { return diaObj(d).ejercicios.length; })[0] || 'Lunes';
            pintarEditor();
        }).catch(function (e) {
            ed.innerHTML = '<p class="trn__nota trn__nota--err">' + esc(e.message) + '</p>';
        });
    }

    // ------------------------------------------------------------------
    // Editor de rutina
    // ------------------------------------------------------------------
    function asegurarDias() {
        var mapa = {};
        (estado.rutina.dias || []).forEach(function (d) { mapa[d.dia] = d; });
        estado.rutina.dias = DIAS.map(function (n) { return mapa[n] || { dia: n, ejercicios: [] }; });
    }
    function diaObj(nombre) {
        return estado.rutina.dias.filter(function (d) { return d.dia === nombre; })[0];
    }
    function marcarSucio() {
        estado.sucio = true;
        var b = panel.querySelector('#trnEstado');
        if (b) { b.textContent = 'Cambios sin guardar'; b.className = 'trn__chip trn__chip--warn'; }
    }

    function totalEjercicios() {
        return DIAS.reduce(function (n, d) { return n + diaObj(d).ejercicios.length; }, 0);
    }
    function actualizarTabs() {
        var n = panel.querySelector('#trnTabN');
        if (n) { var t = totalEjercicios(); n.textContent = t || ''; n.hidden = !t; }
    }

    function pintarEditor() {
        var ed = panel.querySelector('#trnEditor');
        var chip = estado.publicada ? ['Publicada', 'ok'] : ['Borrador', 'warn'];
        var p = estado.perfil;
        if (!estado.tab) estado.tab = totalEjercicios() ? 'rutina' : 'perfil';
        ed.innerHTML =
            '<div class="trn__ed-head">' +
                '<button class="trn__btn trn__btn--ghost trn__volver" id="trnVolver" aria-label="Volver"><i class="fas fa-chevron-left"></i> <span>Socios</span></button>' +
                '<span class="trn__avatar trn__avatar--lg">' + esc((estado.socio.nombre || '?').charAt(0).toUpperCase()) + '</span>' +
                '<div class="trn__ed-titulo"><h2>' + esc(estado.socio.nombre) + '</h2><span>' + esc(estado.socio.plan || '') + '</span></div>' +
                '<span id="trnEstado" class="trn__chip trn__chip--' + chip[1] + '">' + chip[0] + '</span>' +
            '</div>' +
            '<div class="trn__tabs" id="trnTabs" role="tablist">' +
                '<button type="button" role="tab" data-tab="perfil" class="' + (estado.tab === 'perfil' ? 'is-active' : '') + '"><i class="fas fa-user-check"></i> Perfil e IA' +
                    (p ? '' : ' <i class="fas fa-circle trn__punto"></i>') + '</button>' +
                '<button type="button" role="tab" data-tab="rutina" class="' + (estado.tab === 'rutina' ? 'is-active' : '') + '"><i class="fas fa-calendar-week"></i> Rutina <b id="trnTabN" hidden></b></button>' +
            '</div>' +
            '<div class="trn__ed-scroll" id="trnEdScroll" data-tab="' + estado.tab + '">' +
                // 1 · Datos del socio
                '<section class="trn__card trn__sec--perfil">' +
                    '<div class="trn__card-head"><h3><i class="fas fa-user-check"></i> Datos del socio</h3>' +
                        (p ? '<span class="trn__tag trn__tag--ok"><i class="fas fa-circle-check"></i> Recibidos' + (p.actualizado ? ' · ' + fechaCorta(p.actualizado) : '') + '</span>'
                           : '<span class="trn__tag trn__tag--off"><i class="fas fa-clock"></i> Pendiente</span>') +
                    '</div>' + htmlPerfil(p) +
                '</section>' +
                // 2 · Asistente IA
                '<section class="trn__card trn__ia trn__sec--perfil' + (p ? '' : ' is-locked') + '">' +
                    '<div class="trn__ia-ico"><i class="fas fa-' + (p ? 'wand-magic-sparkles' : 'lock') + '"></i></div>' +
                    '<div class="trn__ia-txt">' +
                        '<h3>Asistente de rutinas con IA</h3>' +
                        '<p>' + (p ? 'Arma una propuesta con los datos del socio y los ejercicios del gimnasio. Después la corriges y la publicas.'
                                    : 'Se activa cuando el socio envíe sus datos (estatura, peso, objetivo...). Pídele que los complete en <b>Mi rutina → Añadir mis datos</b>.') + '</p>' +
                        (p ? '<input id="trnExtra" class="trn__extra" maxlength="200" placeholder="Indicaciones extra (opcional)" value="' + esc(estado.extraIA || '') + '">' : '') +
                        '<small id="trnIAEstado" class="trn__ia-estado' + (estado.iaMsg ? ' is-' + estado.iaMsg.tipo : '') + '">' + (estado.iaMsg ? estado.iaMsg.texto : '') + '</small>' +
                    '</div>' +
                    '<button class="trn__btn trn__btn--ia" id="trnGenerar"' + (p ? '' : ' disabled') + '><i class="fas fa-wand-magic-sparkles"></i> Generar rutina</button>' +
                '</section>' +
                // 3 · Rutina
                '<section class="trn__card trn__rut trn__sec--rutina">' +
                    '<div class="trn__card-head"><h3><i class="fas fa-calendar-week"></i> Rutina semanal</h3>' +
                        (p ? '<button type="button" class="trn__btn trn__ia-mini" id="trnGenerar2"><i class="fas fa-wand-magic-sparkles"></i> Generar con IA</button>' : '') +
                    '</div>' +
                    '<div class="trn__campos">' +
                        '<label>Nombre<input id="trnNombre" maxlength="80" value="' + esc(estado.rutina.nombre) + '"></label>' +
                    '</div>' +
                    '<div class="trn__dias" id="trnDias"></div>' +
                    '<div class="trn__ejs" id="trnEjs"></div>' +
                '</section>' +
            '</div>' +
            '<div class="trn__acciones">' +
                '<button class="trn__btn trn__btn--ghost" id="trnAgregar"><i class="fas fa-plus"></i> <span class="t-l">Agregar ejercicio</span><span class="t-s">Agregar</span></button>' +
                '<span class="trn__espacio"></span>' +
                '<button class="trn__btn trn__btn--ghost" id="trnBorrador"><i class="fas fa-floppy-disk"></i> <span class="t-l">Guardar borrador</span><span class="t-s">Borrador</span></button>' +
                '<button class="trn__btn trn__btn--primary" id="trnPublicar"><i class="fas fa-paper-plane"></i> Publicar</button>' +
            '</div>';

        ed.querySelector('#trnVolver').addEventListener('click', function () {
            panel.classList.remove('trn--editando'); actualizarMenu();
        });
        ed.querySelectorAll('#trnTabs button').forEach(function (b) {
            b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); actualizarMenu(); });
        });
        ed.querySelector('#trnNombre').addEventListener('input', function (e) { estado.rutina.nombre = e.target.value; marcarSucio(); });
        ed.querySelector('#trnAgregar').addEventListener('click', abrirSelector);
        ed.querySelector('#trnGenerar').addEventListener('click', generarRutinaInteligente);
        var g2 = ed.querySelector('#trnGenerar2');
        if (g2) g2.addEventListener('click', generarRutinaInteligente);
        ed.querySelector('#trnBorrador').addEventListener('click', function () { guardar(false); });
        ed.querySelector('#trnPublicar').addEventListener('click', function () { guardar(true); });
        pintarDias();
        pintarEjercicios();
        actualizarMenu();
    }

    function fechaCorta(iso) {
        try { return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }); } catch (e) { return ''; }
    }

    function pintarNotaGenero() {
        var n = panel.querySelector('#trnGeneroNota');
        if (!n) return;
        var g = estado.socio.genero;
        if (!g) n.textContent = 'Recepción no registró el género de este socio: elígelo aquí.';
        else if (g === 'femenino' && !(window.EJERCICIOS_DATA_MUJER && window.EJERCICIOS_DATA_MUJER.length))
            n.textContent = 'Aún no hay biblioteca femenina cargada; se usan los ejercicios generales.';
        else n.textContent = 'Detectado desde el registro en recepción.';
    }
    function cambiarGenero(g) {
        if (g === estado.socio.genero) return;
        portalFetch('/api/entrenador/socios/' + estado.idSocio + '/genero', { method: 'PUT', body: JSON.stringify({ genero: g }) })
            .then(function () {
                estado.socio.genero = g;
                panel.querySelectorAll('#trnGenero button').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-g') === g); });
                pintarNotaGenero();
                toast('Ejercicios para ' + (g === 'femenino' ? 'mujer' : 'hombre'));
            }).catch(function (e) { toast(e.message || 'No se pudo cambiar', 'err'); });
    }

    function pintarDias() {
        actualizarTabs();
        actualizarMenu();
        var cont = panel.querySelector('#trnDias');
        cont.innerHTML = DIAS.map(function (d) {
            var n = diaObj(d).ejercicios.length;
            return '<button class="trn__dia' + (d === estado.dia ? ' is-active' : '') + '" data-dia="' + d + '">' +
                esc(d.slice(0, 3)) + (n ? '<b>' + n + '</b>' : '') + '</button>';
        }).join('');
        cont.querySelectorAll('.trn__dia').forEach(function (b) {
            b.addEventListener('click', function () {
                estado.dia = b.getAttribute('data-dia');
                pintarDias();
                pintarEjercicios();
            });
        });
    }

    function resumenEj(e) {
        return (e.series || '-') + ' × ' + (e.repeticiones || '-') + (e.descanso ? ' · ' + e.descanso : '');
    }

    function pintarEjercicios() {
        var cont = panel.querySelector('#trnEjs');
        var lista = diaObj(estado.dia).ejercicios;
        if (!lista.length) {
            cont.innerHTML = '<div class="trn__dia-vacio"><i class="fas fa-bed"></i><p>' + esc(estado.dia) + ' sin ejercicios (descanso). Usa “Agregar ejercicio”.</p></div>';
            return;
        }
        cont.innerHTML = lista.map(function (e, i) {
            var ref = ejercicio(e.id);
            var img = ref ? '<img src="' + esc(ref.imagen) + '" alt="" loading="lazy">' : '<i class="fas fa-dumbbell"></i>';
            return '<div class="trn__ej" data-i="' + i + '">' +
                '<div class="trn__ej-img">' + img + '</div>' +
                '<div class="trn__ej-main">' +
                    '<div class="trn__ej-nombre"><strong>' + esc(e.nombre) + '</strong>' +
                        '<span class="trn__ej-tools">' +
                            '<button data-acc="sube" title="Subir"' + (i === 0 ? ' disabled' : '') + '><i class="fas fa-arrow-up"></i></button>' +
                            '<button data-acc="baja" title="Bajar"' + (i === lista.length - 1 ? ' disabled' : '') + '><i class="fas fa-arrow-down"></i></button>' +
                            '<button data-acc="quita" title="Quitar"><i class="fas fa-trash"></i></button>' +
                        '</span></div>' +
                    '<div class="trn__ej-res">' + resumenEj(e) + '</div>' +
                    '<div class="trn__ej-campos">' +
                        '<div class="trn__campo"><span>Series</span><div class="trn__step">' +
                            '<button type="button" data-step="-1" aria-label="Menos series"><i class="fas fa-minus"></i></button>' +
                            '<input data-c="series" type="number" inputmode="numeric" min="1" max="99" value="' + esc(e.series) + '">' +
                            '<button type="button" data-step="1" aria-label="Más series"><i class="fas fa-plus"></i></button></div></div>' +
                        '<label class="trn__campo"><span>Repeticiones</span><input data-c="repeticiones" maxlength="20" placeholder="10 o 8-12" value="' + esc(e.repeticiones) + '"></label>' +
                        '<label class="trn__campo"><span>Descanso</span><input data-c="descanso" list="trnDescansos" maxlength="20" placeholder="60 s" value="' + esc(e.descanso) + '"></label>' +
                        '<label class="trn__campo trn__ej-nota"><span>Nota (opcional)</span><input data-c="nota" maxlength="200" placeholder="Ej: controla la bajada" value="' + esc(e.nota) + '"></label>' +
                    '</div>' +
                '</div></div>';
        }).join('');
        cont.querySelectorAll('.trn__ej').forEach(function (el) {
            var i = parseInt(el.getAttribute('data-i'), 10);
            el.querySelectorAll('input[data-c]').forEach(function (inp) {
                inp.addEventListener('input', function () { lista[i][inp.getAttribute('data-c')] = inp.value; marcarSucio(); var rs = el.querySelector('.trn__ej-res'); if (rs) rs.textContent = resumenEj(lista[i]); });
            });
            el.querySelectorAll('button[data-step]').forEach(function (b) {
                b.addEventListener('click', function () {
                    var inp = el.querySelector('input[data-c="series"]');
                    var v = Math.max(1, Math.min(99, (parseInt(inp.value, 10) || 1) + parseInt(b.getAttribute('data-step'), 10)));
                    inp.value = v; lista[i].series = v; marcarSucio(); var rs2 = el.querySelector('.trn__ej-res'); if (rs2) rs2.textContent = resumenEj(lista[i]);
                });
            });
            ['.trn__ej-img', '.trn__ej-nombre strong', '.trn__ej-res'].forEach(function (sel) {
                var t = el.querySelector(sel);
                if (t) t.addEventListener('click', function () { el.classList.toggle('is-open'); });
            });
            el.querySelectorAll('button[data-acc]').forEach(function (b) {
                b.addEventListener('click', function () {
                    var acc = b.getAttribute('data-acc');
                    if (acc === 'quita') lista.splice(i, 1);
                    else {
                        var j = acc === 'sube' ? i - 1 : i + 1;
                        var tmp = lista[i]; lista[i] = lista[j]; lista[j] = tmp;
                    }
                    marcarSucio(); pintarDias(); pintarEjercicios();
                });
            });
        });
    }

    // ------------------------------------------------------------------
    // Selector de ejercicios (biblioteca)
    // ------------------------------------------------------------------
    function abrirSelector() {
        var datos = bibliotecaPara(estado.socio && estado.socio.genero);
        if (!datos.length) { toast('La biblioteca de ejercicios no está disponible', 'err'); return; }
        var sel = panel.querySelector('#trnPicker');
        var partes = ['Todos'];
        datos.forEach(function (e) { if (e.parte_es && partes.indexOf(e.parte_es) === -1) partes.push(e.parte_es); });
        var parteActual = 'Todos';
        sel.hidden = false;
        sel.innerHTML =
            '<div class="trn__pk-card" role="dialog" aria-modal="true">' +
                '<div class="trn__pk-head">' +
                    '<div><h3>Agregar ejercicios</h3><span>para el <b>' + esc(estado.dia) + '</b> · toca para añadir</span></div>' +
                    '<button class="trn__pk-x" id="trnPkCerrar" aria-label="Cerrar"><i class="fas fa-xmark"></i></button>' +
                '</div>' +
                '<div class="trn__pk-filtros">' +
                    '<div class="trn__buscar"><i class="fas fa-search"></i><input id="trnPkBuscar" type="text" placeholder="Buscar ejercicio (ej. press, sentadilla)" autocomplete="off"></div>' +
                    '<div class="trn__pk-partes" id="trnPkPartes">' + partes.map(function (p) {
                        return '<button data-p="' + esc(p) + '"' + (p === 'Todos' ? ' class="is-active"' : '') + '>' + esc(p) + '</button>';
                    }).join('') + '</div>' +
                '</div>' +
                '<div class="trn__pk-grid" id="trnPkGrid"></div>' +
                '<div class="trn__pk-pie"><span id="trnPkCuenta"></span>' +
                    '<button class="trn__btn trn__btn--primary" id="trnPkListo"><i class="fas fa-check"></i> Listo</button></div>' +
            '</div>';
        document.addEventListener('keydown', escCerrarSelector);

        var grid = sel.querySelector('#trnPkGrid');
        var buscar = sel.querySelector('#trnPkBuscar');
        function filtrar() {
            var t = buscar.value.trim().toLowerCase();
            var res = datos.filter(function (e) {
                return (parteActual === 'Todos' || e.parte_es === parteActual) &&
                    (!t || e.nombre.toLowerCase().indexOf(t) !== -1);
            });
            var total = res.length;
            res = res.slice(0, 60);
            var yaDia = diaObj(estado.dia).ejercicios;
            grid.innerHTML = res.map(function (e) {
                var n = yaDia.filter(function (x) { return x.id === e.id; }).length;
                return '<button class="trn__pk-item' + (n ? ' is-added' : '') + '" data-id="' + esc(e.id) + '">' +
                    '<span class="trn__pk-img"><img loading="lazy" src="' + esc(e.imagen) + '" alt="">' +
                    (n ? '<b class="trn__pk-badge"><i class="fas fa-check"></i> ' + (n > 1 ? n : '') + '</b>' : '') + '</span>' +
                    '<span class="trn__pk-nom">' + esc(e.nombre) + '</span><small>' + esc(e.objetivo_es || e.parte_es || '') + '</small></button>';
            }).join('') + (total > 60 ? '<p class="trn__nota">Mostrando 60 de ' + total + '. Afina la búsqueda.</p>' : '') +
                (!total ? '<p class="trn__nota">Sin resultados.</p>' : '');
            var c = sel.querySelector('#trnPkCuenta');
            if (c) c.textContent = yaDia.length ? yaDia.length + ' ejercicio(s) en ' + estado.dia : 'Aún sin ejercicios';
        }
        filtrar();
        buscar.addEventListener('input', filtrar);
        sel.querySelector('#trnPkPartes').addEventListener('click', function (ev) {
            var b = ev.target.closest('button[data-p]');
            if (!b) return;
            parteActual = b.getAttribute('data-p');
            sel.querySelectorAll('#trnPkPartes button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
            filtrar();
        });
        grid.addEventListener('click', function (ev) {
            var b = ev.target.closest('.trn__pk-item');
            if (!b) return;
            var ref = ejercicio(b.getAttribute('data-id'));
            if (!ref) return;
            diaObj(estado.dia).ejercicios.push({ id: ref.id, nombre: ref.nombre, series: 3, repeticiones: '10', descanso: '', nota: '' });
            marcarSucio(); pintarDias(); pintarEjercicios();
            var y = grid.scrollTop;
            filtrar();
            grid.scrollTop = y;
            toast('Agregado: ' + ref.nombre);
        });
        sel.querySelector('#trnPkCerrar').addEventListener('click', cerrarSelector);
        sel.querySelector('#trnPkListo').addEventListener('click', cerrarSelector);
        sel.addEventListener('click', function (ev) { if (ev.target === sel) cerrarSelector(); });
        if (window.matchMedia('(min-width: 861px)').matches) buscar.focus();
    }
    function escCerrarSelector(e) { if (e.key === 'Escape') cerrarSelector(); }
    function cerrarSelector() {
        document.removeEventListener('keydown', escCerrarSelector);
        if (!panel) return;
        var sel = panel.querySelector('#trnPicker');
        sel.hidden = true;
        sel.innerHTML = '';
    }

    // ------------------------------------------------------------------
    // Guardar / publicar
    // ------------------------------------------------------------------
    function guardar(publicar) {
        if (publicar && !estado.rutina.dias.some(function (d) { return d.ejercicios.length; })) {
            toast('Agrega al menos un ejercicio antes de publicar', 'err');
            return;
        }
        var id = estado.idSocio;
        return portalFetch('/api/entrenador/socios/' + id + '/rutina', {
            method: 'PUT',
            body: JSON.stringify({ rutina: estado.rutina, publicada: publicar })
        }).then(function (r) {
            estado.sucio = false;
            estado.publicada = !!r.publicada;
            var b = panel.querySelector('#trnEstado');
            if (b) {
                b.textContent = estado.publicada ? 'Publicada' : 'Borrador';
                b.className = 'trn__chip trn__chip--' + (estado.publicada ? 'ok' : 'warn');
            }
            toast(r.mensaje || 'Guardado');
            cargarSocios();
            return true;
        }).catch(function (e) { toast(e.message || 'No se pudo guardar', 'err'); return false; });
    }

    // ------------------------------------------------------------------
    // "Mi rutina" para el socio (panel Rutinas del perfil)
    // ------------------------------------------------------------------
    function bloqueSocio() {
        var panelRut = document.querySelector('.profile-panel[data-panel="rutinas"]');
        if (!panelRut) return null;
        var el = document.getElementById('miRutinaEntrenador');
        if (!el) {
            el = document.createElement('section');
            el.id = 'miRutinaEntrenador';
            el.className = 'mirutina';
            var h3 = panelRut.querySelector('h3');
            if (h3) h3.insertAdjacentElement('afterend', el); else panelRut.prepend(el);
        }
        return el;
    }

    function cargarMiRutina() {
        if (typeof getPortalToken !== 'function' || !getPortalToken()) return;
        var el = bloqueSocio();
        if (!el) return;
        refrescarPerfilSocio();
        portalFetch('/api/portal/me/rutina-entrenador').then(function (r) {
            if (!r.incluida) {
                el.innerHTML = '<div class="mirutina__aviso"><i class="fas fa-lock"></i><div><strong>Sin entrenador asignado</strong>' +
                    '<p>Aún no tienes un entrenador asignado. Consulta en recepción para recibir una rutina personalizada.</p></div></div>';
                return;
            }
            if (!r.rutina) {
                el.innerHTML = '<div class="mirutina__aviso"><i class="fas fa-hourglass-half"></i><div><strong>Tu rutina está en preparación</strong>' +
                    '<p>Tu entrenador aún no publicó tu rutina semanal. Aparecerá aquí en cuanto la publique.</p></div></div>';
                return;
            }
            window.__rutinaSocio = r.rutina;
            el.innerHTML = renderRutinaSocio(r.rutina, r.actualizada);
            el.querySelectorAll('.mirutina__tab').forEach(function (t) {
                t.addEventListener('click', function () {
                    var d = t.getAttribute('data-dia');
                    el.querySelectorAll('.mirutina__tab').forEach(function (x) { x.classList.toggle('active', x === t); });
                    el.querySelectorAll('.mirutina__dia').forEach(function (p) { p.hidden = p.getAttribute('data-dia') !== d; });
                });
            });
            el.querySelectorAll('.mirutina__go').forEach(function (b) {
                b.addEventListener('click', function () {
                    if (window.RutinaGo) window.RutinaGo.abrir(parseInt(b.getAttribute('data-i'), 10));
                });
            });
            if (window.RutinaGo) window.RutinaGo.refrescar();
            el.querySelectorAll('.mirutina__ej[data-id]').forEach(function (b) {
                b.addEventListener('click', function () {
                    var ref = ejercicio(b.getAttribute('data-id'));
                    if (ref) abrirDetalle(ref);
                });
            });
        }).catch(function () { el.innerHTML = ''; });
    }

    // Descanso en segundos (el entrenador lo escribe como "60 s", "90", "1:30", "2 min"); vacío = 60
    function segDescanso(t) {
        var x = String(t || '').toLowerCase().trim();
        var m;
        if ((m = x.match(/(\d+)\s*:\s*(\d{1,2})/))) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        if ((m = x.match(/(\d+(?:[.,]\d+)?)\s*(?:min|m\b)/))) return Math.round(parseFloat(m[1].replace(',', '.')) * 60);
        if ((m = x.match(/(\d+)/))) return parseInt(m[1], 10);
        return 60;
    }
    window.segDescansoRutina = segDescanso;
    window.ejercicioPorId = ejercicio;

    var DIAS_SEM = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    function renderRutinaSocio(rut, actualizada) {
        var porDia = {};
        var diasConf = {};
        (rut.dias || []).forEach(function (d) { porDia[d.dia] = d.ejercicios || []; diasConf[d.dia] = true; });
        var fecha = actualizada ? new Date(actualizada).toLocaleDateString('es-CL') : '';
        var hoy = DIAS_SEM[(new Date().getDay() + 6) % 7];
        var head = '<div class="mirutina__head"><div><span class="mirutina__tag"><i class="fas fa-user-check"></i> Tu entrenador</span>' +
            '<h4>' + esc(rut.nombre || 'Mi rutina') + '</h4>' +
            '</div>' +
            (fecha ? '<small>Actualizada ' + esc(fecha) + '</small>' : '') + '</div>';
        var tabs = '<div class="mirutina__tabs" role="tablist">' + DIAS_SEM.map(function (d) {
            var n = (porDia[d] || []).length;
            return '<button type="button" role="tab" class="mirutina__tab' + (d === hoy ? ' active' : '') + (n ? ' tiene' : '') + '" data-dia="' + d + '">' +
                '<span>' + d.slice(0, 3) + '</span><i></i></button>';
        }).join('') + '</div>' +
            '<div class="mirutina__leyenda"><span><b style="border-color:#22c55e"></b>Con rutina</span></div>';
        var paneles = DIAS_SEM.map(function (d) {
            var ejs = porDia[d] || [];
            var cuerpo = ejs.length ? ejs.map(function (e, i) {
                var ref = ejercicio(e.id);
                var seg = segDescanso(e.descanso);
                var fila = '<button type="button" class="mirutina__ej" data-id="' + esc(e.id) + '">' +
                    (ref ? '<img loading="lazy" src="' + esc(ref.imagen) + '" alt="">' : '<span class="mirutina__ph"><i class="fas fa-dumbbell"></i></span>') +
                    '<span class="mirutina__ej-info"><strong>' + esc(e.nombre) + '</strong>' +
                    '<small>' + esc(e.series) + '×' + esc(e.repeticiones) + ' · ' + seg + 's</small>' +
                    '</span></button>';
                if (d !== hoy) return fila;
                return '<div class="mirutina__fila">' + fila +
                    '<button type="button" class="mirutina__go" data-i="' + i + '" aria-label="Empezar ' + esc(e.nombre) + '"><i class="fas fa-play"></i><span>GO</span></button></div>';
            }).join('') : '<div class="mirutina__descanso"><i class="fas fa-bed"></i><strong>Día de descanso</strong>' +
                '<p>Tu entrenador no asignó ejercicios para este día.</p></div>';
            return '<div class="mirutina__dia" data-dia="' + d + '"' + (d === hoy ? '' : ' hidden') + '><h5>' + d + (d === hoy ? ' · hoy' : '') + '</h5>' + cuerpo + '</div>';
        }).join('');
        return head + tabs + '<div class="mirutina__paneles">' + paneles + '</div>';
    }

    function abrirDetalle(ref) {
        // Reproductor compartido (js/ejercicio-video.js): video en bucle, sin pasos.
        if (ref && window.EjVideo) window.EjVideo.abrir(ref);
    }

    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-panel="rutinas"], [data-ir-panel="rutinas"]')) setTimeout(cargarMiRutina, 0);
    });


    // ------------------------------------------------------------------
    // Datos físicos (los llena el socio) + generador de rutina inteligente
    // ------------------------------------------------------------------
    var ACT = { sedentario: 'Sedentario', ligero: 'Poco activo', activo: 'Activo', muy_activo: 'Muy activo' };
    var OBJ = { bajar_grasa: 'Bajar grasa', ganar_musculo: 'Ganar músculo', tonificar: 'Tonificar', resistencia: 'Resistencia', salud: 'Salud general' };

    function imc(p) {
        if (!p || !p.estatura_cm || !p.peso_kg) return null;
        var m = p.estatura_cm / 100;
        return Math.round((p.peso_kg / (m * m)) * 10) / 10;
    }
    function imcTexto(v) {
        return v < 18.5 ? 'bajo peso' : v < 25 ? 'normal' : v < 30 ? 'sobrepeso' : 'obesidad';
    }

    function htmlPerfil(p) {
        if (!p) {
            return '<div class="trn__perfil-vacio"><i class="fas fa-hourglass-half"></i>' +
                '<div><b>Este socio aún no envió sus datos</b><span>Sin estatura, peso y objetivo no se puede generar una rutina con IA. Aun así puedes armarla a mano.</span></div></div>';
        }
        var v = imc(p), t = [];
        if (p.estatura_cm) t.push(['fa-ruler-vertical', 'Estatura', p.estatura_cm + ' cm']);
        if (p.peso_kg) t.push(['fa-weight-scale', 'Peso actual', p.peso_kg + ' kg']);
        if (p.peso_inicial_kg && p.peso_kg && p.peso_inicial_kg !== p.peso_kg) t.push(['fa-flag-checkered', 'Peso inicial', p.peso_inicial_kg + ' kg']);
        if (v != null) t.push(['fa-calculator', 'IMC', v + ' · ' + imcTexto(v)]);
        if (p.actividad) t.push(['fa-person-running', 'Actividad', ACT[p.actividad] || p.actividad]);
        if (p.objetivo) t.push(['fa-bullseye', 'Objetivo', OBJ[p.objetivo] || p.objetivo]);
        if (p.dias_semana) t.push(['fa-calendar-days', 'Días por semana', p.dias_semana]);
        var html = '<div class="trn__stats">' + t.map(function (c) {
            return '<div class="trn__stat"><i class="fas ' + c[0] + '"></i><div><small>' + c[1] + '</small><b>' + esc(c[2]) + '</b></div></div>';
        }).join('') + '</div>';
        if (p.lesiones) html += '<div class="trn__perfil-les"><i class="fas fa-triangle-exclamation"></i><span><b>Lesiones / limitaciones:</b> ' + esc(p.lesiones) + '</span></div>';
        return html;
    }

    // Generador por reglas (sin API): usa SOLO ejercicios de la biblioteca del gimnasio.
    function semilla(n) { var s = n || 1; return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

    var EQUIPO_OK = ['Peso corporal', 'Mancuerna', 'Barra', 'Barra Z', 'Máquina de palanca', 'Polea', 'Máquina Smith', 'Kettlebell', 'Banda elástica', 'Con peso', 'Asistido', 'Gimnasio'];
    var LES_ESP = ['deadlift', 'good morning', 'bent over', 'bent-over', 'hyperextension', 'clean', 'snatch', 'peso muerto', 'remo', 'hiperextensi', 'lumbar'];
    var LES_MUN = ['wrist', 'push-up', 'push up', 'handstand', 'front squat', 'muñeca', 'flexiones', 'curl'];
    var LESION_PALABRAS = {
        rodilla: ['jump', 'lunge', 'squat', 'sentadilla', 'zancada', 'pistol', 'box', 'plyo', 'burpee', 'leg extension', 'rodilla', 'prensa', 'búlgara', 'extensión de pierna', 'salto'],
        hombro: ['overhead', 'military', 'arnold', 'upright', 'behind', 'snatch', 'push press', 'handstand', 'dip', 'hombro', 'press militar', 'remo al mentón', 'fondos'],
        espalda: LES_ESP, lumbar: LES_ESP,
        'muñeca': LES_MUN,
        muneca: LES_MUN,
        codo: ['skull', 'close grip', 'dip', 'tricep extension', 'preacher', 'codo', 'predicador', 'press jm', 'francés', 'fondos', 'jalón de tríceps', 'extensión de tríceps'],
        cuello: ['neck', 'shrug', 'behind', 'cuello', 'encogimiento', 'trapecio']
    };

    function palabrasProhibidas(lesiones) {
        var t = String(lesiones || '').toLowerCase(), out = [];
        Object.keys(LESION_PALABRAS).forEach(function (k) { if (t.indexOf(k) !== -1) out = out.concat(LESION_PALABRAS[k]); });
        return out;
    }

    function divisionSemanal(dias, nivel, mujer) {
        var FB1 = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Abdomen'];
        var FB2 = ['Piernas', 'Espalda', 'Pecho', 'Brazos', 'Abdomen'];
        var FB3 = ['Espalda', 'Pecho', 'Piernas', 'Hombros', 'Brazos'];
        var UP = ['Pecho', 'Espalda', 'Hombros', 'Brazos'];
        var LOW = ['Piernas', 'Piernas', 'Piernas', 'Abdomen'];
        var PUSH = ['Pecho', 'Hombros', 'Brazos'], PULL = ['Espalda', 'Brazos', 'Abdomen'];
        if (mujer) {
            // Biblioteca de mujeres: más glúteo y pierna, sin pestaña Cardio.
            FB1 = ['Glúteos', 'Espalda', 'Piernas', 'Pecho', 'Abdomen'];
            FB2 = ['Piernas', 'Glúteos', 'Espalda', 'Hombros', 'Abdomen'];
            FB3 = ['Glúteos', 'Espalda', 'Pecho', 'Piernas', 'Brazos'];
            LOW = ['Glúteos', 'Glúteos', 'Piernas', 'Piernas', 'Abdomen'];
            PUSH = ['Pecho', 'Hombros', 'Brazos']; PULL = ['Espalda', 'Brazos', 'Abdomen'];
        }
        var mapa = {
            1: { dias: ['Lunes'], sesiones: [['Cuerpo completo', FB1]] },
            2: { dias: ['Lunes', 'Jueves'], sesiones: [['Cuerpo completo A', FB1], ['Cuerpo completo B', FB2]] },
            3: nivel === 'principiante'
                ? { dias: ['Lunes', 'Miércoles', 'Viernes'], sesiones: [['Cuerpo completo A', FB1], ['Cuerpo completo B', FB2], ['Cuerpo completo C', FB3]] }
                : { dias: ['Lunes', 'Miércoles', 'Viernes'], sesiones: [['Empuje', PUSH], ['Tirón', PULL], ['Pierna', LOW]] },
            4: { dias: ['Lunes', 'Martes', 'Jueves', 'Viernes'], sesiones: [['Torso A', UP], ['Pierna A', LOW], ['Torso B', UP], ['Pierna B', LOW]] },
            5: { dias: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'], sesiones: [['Pecho', ['Pecho', 'Pecho', 'Brazos']], ['Espalda', ['Espalda', 'Espalda', 'Brazos']], ['Pierna', LOW], ['Hombros y abdomen', ['Hombros', 'Hombros', 'Abdomen']], ['Brazos y cardio', ['Brazos', 'Brazos', 'Cardio']]] },
            6: { dias: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], sesiones: [['Empuje A', PUSH], ['Tirón A', PULL], ['Pierna A', LOW], ['Empuje B', PUSH], ['Tirón B', PULL], ['Pierna B', LOW]] }
        };
        return mapa[Math.max(1, Math.min(6, dias))];
    }

    function parametros(objetivo, nivel) {
        var series = nivel === 'principiante' ? 3 : 4;
        var o = {
            bajar_grasa: { series: 3, reps: '15', desc: '30 s' },
            ganar_musculo: { series: series, reps: '8-12', desc: '90 s' },
            tonificar: { series: 3, reps: '12-15', desc: '45 s' },
            resistencia: { series: 3, reps: '15-20', desc: '30 s' },
            salud: { series: 3, reps: '12', desc: '60 s' }
        };
        return o[objetivo] || o.salud;
    }

    // ---- Generador local (respaldo sin internet) ----
    function construirLocal(p, rnd) {
        var lib = bibliotecaPara(estado.socio.genero);
        var nivel = p.actividad === 'muy_activo' ? 'avanzado' : (p.actividad === 'activo' ? 'intermedio' : 'principiante');
        var objetivo = p.objetivo || 'salud';
        var par = parametros(objetivo, nivel);
        var plan = divisionSemanal(p.dias_semana || 3, nivel, estado.socio.genero === 'femenino' && lib === (window.EJERCICIOS_DATA_MUJER || []));
        var porSesion = nivel === 'avanzado' ? 7 : (nivel === 'intermedio' ? 6 : 5);
        var prefEq = nivel === 'principiante'
            ? ['Máquina de palanca', 'Mancuerna', 'Peso corporal', 'Polea', 'Máquina Smith', 'Banda elástica', 'Kettlebell', 'Barra Z', 'Barra']
            : ['Barra', 'Mancuerna', 'Polea', 'Máquina Smith', 'Máquina de palanca', 'Kettlebell', 'Barra Z', 'Peso corporal', 'Banda elástica'];
        var seguro = filtroSeguro(p);

        function elegir(parte, usados, cuantos) {
            var base = lib.filter(function (e) {
                return e.parte_es === parte && EQUIPO_OK.indexOf(e.equipo_es) !== -1 && seguro(e) && !usados[e.id];
            });
            var orden = base.map(function (e) {
                var pe = prefEq.indexOf(e.equipo_es); if (pe < 0) pe = 20;
                return { e: e, k: pe + rnd() * 6 };
            }).sort(function (a, b) { return a.k - b.k; });
            var out = [], musculos = {};
            orden.forEach(function (o) {
                if (out.length >= cuantos) return;
                if (musculos[o.e.objetivo_es] && orden.length > cuantos * 3) return;
                musculos[o.e.objetivo_es] = 1; out.push(o.e); usados[o.e.id] = 1;
            });
            orden.forEach(function (o) {
                if (out.length < cuantos && !usados[o.e.id]) { out.push(o.e); usados[o.e.id] = 1; }
            });
            return out;
        }

        var nuevos = DIAS.map(function (d) { return { dia: d, ejercicios: [] }; });
        var usadosSemana = {};
        plan.sesiones.forEach(function (ses, i) {
            var partes = ses[1];
            var porParte = Math.max(1, Math.round(porSesion / partes.length));
            var lista = [];
            partes.forEach(function (parte) {
                var cuantos = (parte === 'Cardio' || parte === 'Pantorrillas') ? 1 : porParte;
                elegir(parte, usadosSemana, cuantos).forEach(function (e) { lista.push(e); });
            });
            if ((objetivo === 'bajar_grasa' || objetivo === 'resistencia') && partes.indexOf('Cardio') === -1) {
                elegir('Cardio', usadosSemana, 1).forEach(function (e) { lista.push(e); });
            }
            var dia = nuevos.filter(function (x) { return x.dia === plan.dias[i]; })[0];
            dia.ejercicios = lista.map(function (e, idx) {
                var cardio = e.parte_es === 'Cardio';
                return {
                    id: e.id, nombre: e.nombre,
                    series: cardio ? 1 : par.series,
                    repeticiones: cardio ? '10-15 min' : par.reps,
                    descanso: cardio ? '' : par.desc,
                    nota: (i === 0 && idx === 0) ? 'Calienta 5-10 min antes de empezar' : ''
                };
            });
        });
        var notas = 'Propuesta automática (' + nivel + '). Termina cada serie con 1-2 repeticiones de reserva.';
        if (p.lesiones) notas += ' Se evitaron ejercicios delicados por: ' + p.lesiones + '.';
        return { dias: nuevos, nombre: (OBJ[objetivo] || 'Rutina') + ' · ' + plan.dias.length + ' días', notas: '', primerDia: plan.dias[0] };
    }

    function filtroSeguro(p) {
        var prohibidas = palabrasProhibidas(p.lesiones);
        var v = imc(p);
        var impacto = (v != null && v >= 30) ? ['jump', 'burpee', 'plyo', 'sprint', 'skip'] : [];
        return function (ej) {
            var n = (ej.nombre || '').toLowerCase(), i;
            for (i = 0; i < prohibidas.length; i++) if (n.indexOf(prohibidas[i]) !== -1) return false;
            for (i = 0; i < impacto.length; i++) if (n.indexOf(impacto[i]) !== -1) return false;
            return true;
        };
    }

    // Catálogo reducido (ya sin ejercicios peligrosos) que se le manda a la IA
    function catalogoParaIA(p, rnd) {
        var lib = bibliotecaPara(estado.socio.genero), seguro = filtroSeguro(p), porParte = {};
        lib.forEach(function (e) {
            if (EQUIPO_OK.indexOf(e.equipo_es) === -1 || !seguro(e) || !e.parte_es) return;
            (porParte[e.parte_es] = porParte[e.parte_es] || []).push(e);
        });
        var out = [];
        Object.keys(porParte).forEach(function (parte) {
            var arr = porParte[parte].map(function (e) { return { e: e, k: rnd() }; })
                .sort(function (a, b) { return a.k - b.k; })
                .slice(0, parte === 'Cardio' || parte === 'Pantorrillas' || parte === 'Cuello' || parte === 'Antebrazos' ? 8 : 20);
            arr.forEach(function (o) { out.push({ id: String(o.e.id), n: o.e.nombre, p: o.e.parte_es, e: o.e.equipo_es }); });
        });
        return out;
    }

    function quitarAcentos(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

    // Valida lo que respondió la IA: solo ejercicios del catálogo enviado
    function validarIA(resp, catalogo) {
        var r = resp && resp.rutina;
        if (!r || !Array.isArray(r.dias)) return null;
        var permitidos = {};
        catalogo.forEach(function (c) { permitidos[c.id] = 1; });
        var mapaDias = {};
        DIAS.forEach(function (d) { mapaDias[quitarAcentos(d)] = d; });
        var nuevos = DIAS.map(function (d) { return { dia: d, ejercicios: [] }; });
        var vistos = {}, diasBuenos = 0, primero = null;
        r.dias.forEach(function (d) {
            var nom = mapaDias[quitarAcentos(d.dia)];
            if (!nom) return;
            var dest = nuevos.filter(function (x) { return x.dia === nom; })[0];
            (d.ejercicios || []).forEach(function (e) {
                var id = String(e.id);
                var ref = permitidos[id] ? ejercicio(id) || ejercicio(isNaN(id) ? id : Number(id)) : null;
                if (!ref || vistos[id]) return;
                vistos[id] = 1;
                var cardio = ref.parte_es === 'Cardio';
                dest.ejercicios.push({
                    id: ref.id, nombre: ref.nombre,
                    series: Math.max(1, Math.min(10, parseInt(e.series, 10) || 3)),
                    repeticiones: String(e.repeticiones || (cardio ? '10-15 min' : '12')).slice(0, 20),
                    descanso: String(e.descanso || '').slice(0, 20),
                    nota: String(e.nota || '').slice(0, 200)
                });
            });
            if (dest.ejercicios.length >= 3) { diasBuenos++; if (!primero) primero = nom; }
        });
        if (diasBuenos < 2) return null;
        return { dias: nuevos, nombre: String(r.nombre || 'Rutina semanal').slice(0, 80), notas: '', primerDia: primero };
    }

    function setIAEstado(tipo, texto) {
        estado.iaMsg = texto ? { tipo: tipo, texto: texto } : null;
        var el = panel.querySelector('#trnIAEstado');
        if (el) { el.className = 'trn__ia-estado' + (tipo ? ' is-' + tipo : ''); el.innerHTML = texto || ''; }
    }

    function aplicarGenerada(res, origen, detalle) {
        estado.rutina.dias = res.dias;
        estado.rutina.nombre = res.nombre;
        estado.rutina.notas = res.notas;
        estado.dia = res.primerDia || 'Lunes';
        estado.tab = 'rutina';
        estado.iaMsg = origen === 'ia'
            ? { tipo: 'ok', texto: '<i class="fas fa-circle-check"></i> Generada con IA' + (detalle ? ' (' + esc(detalle) + ')' : '') + '. Revisa y corrige antes de publicar.' }
            : { tipo: 'warn', texto: '<i class="fas fa-circle-info"></i> La IA no respondió' + (detalle ? ' (' + esc(detalle) + ')' : '') + ': se usó el generador integrado. Pulsa de nuevo para reintentar con IA.' };
        pintarEditor();
        marcarSucio();
        abrirVistaPrevia(origen);
    }

    // ---- Ventana flotante: revisar, editar y publicar ----
    function cerrarVistaPrevia() {
        var o = document.getElementById('trnRev');
        if (o) o.remove();
    }

    function abrirVistaPrevia(origen) {
        cerrarVistaPrevia();
        var entrenador = ((panel.querySelector('#trnUsuario') || {}).textContent || '').trim();
        var diasConEj = DIAS.filter(function (d) { return diaObj(d).ejercicios.length; });
        var diaSel = diasConEj[0] || 'Lunes';
        var ov = document.createElement('div');
        ov.className = 'trn__rv';
        ov.id = 'trnRev';
        ov.innerHTML =
            '<div class="trn__rv-card" role="dialog" aria-modal="true">' +
                '<div class="trn__rv-head">' +
                    '<div class="trn__rv-ico"><i class="fas fa-circle-check"></i></div>' +
                    '<div class="trn__rv-tit"><h3>Rutina generada</h3>' +
                        '<span>Para <b>' + esc(estado.socio.nombre) + '</b>' + (entrenador ? ' · Entrenador: <b>' + esc(entrenador) + '</b>' : '') + '</span></div>' +
                    '<span class="trn__tag ' + (origen === 'ia' ? 'trn__tag--ok' : 'trn__tag--off') + '">' + (origen === 'ia' ? '<i class="fas fa-wand-magic-sparkles"></i> IA' : 'Generador integrado') + '</span>' +
                    '<button type="button" class="trn__rv-x" id="trnRvX" aria-label="Cerrar"><i class="fas fa-xmark"></i></button>' +
                '</div>' +
                '<div class="trn__rv-body">' +
                    '<p class="trn__rv-aviso">Revísala con calma: puedes cambiar series y repeticiones, quitar ejercicios o abrir el editor completo.</p>' +
                    '<div class="trn__rv-campos">' +
                        '<label>Nombre<input id="trnRvNombre" maxlength="80" value="' + esc(estado.rutina.nombre) + '"></label>' +
                    '</div>' +
                    '<div class="trn__rv-dias" id="trnRvDias"></div>' +
                    '<div class="trn__rv-lista" id="trnRvLista"></div>' +
                '</div>' +
                '<div class="trn__rv-pie">' +
                    '<button type="button" class="trn__btn trn__btn--ghost" id="trnRvEditar"><i class="fas fa-pen"></i> Editar en el panel</button>' +
                    '<button type="button" class="trn__btn trn__btn--ghost" id="trnRvBorrador"><i class="fas fa-floppy-disk"></i> Guardar borrador</button>' +
                    '<button type="button" class="trn__btn trn__btn--primary" id="trnRvPublicar"><i class="fas fa-paper-plane"></i> Publicar ahora</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(ov);

        function pintarDiasRv() {
            var cont = ov.querySelector('#trnRvDias');
            cont.innerHTML = DIAS.map(function (d) {
                var n = diaObj(d).ejercicios.length;
                if (!n) return '';
                return '<button type="button" class="trn__rv-dia' + (d === diaSel ? ' is-active' : '') + '" data-d="' + d + '">' + esc(d.slice(0, 3)) + '<b>' + n + '</b></button>';
            }).join('');
            cont.querySelectorAll('button').forEach(function (b) {
                b.addEventListener('click', function () { diaSel = b.getAttribute('data-d'); pintarDiasRv(); pintarListaRv(); });
            });
        }
        function pintarListaRv() {
            var lista = diaObj(diaSel).ejercicios, cont = ov.querySelector('#trnRvLista');
            if (!lista.length) { cont.innerHTML = '<div class="trn__dia-vacio">Día de descanso</div>'; return; }
            cont.innerHTML = lista.map(function (e, i) {
                var ref = ejercicio(e.id);
                var img = ref ? '<img src="' + esc(ref.imagen) + '" alt="" loading="lazy">' : '<i class="fas fa-dumbbell"></i>';
                return '<div class="trn__rv-ej" data-i="' + i + '">' +
                    '<div class="trn__rv-img">' + img + '</div>' +
                    '<div class="trn__rv-info"><strong>' + esc(e.nombre) + '</strong>' +
                        '<small>' + esc(ref ? (ref.objetivo_es && ref.objetivo_es !== ref.parte_es ? ref.parte_es + ' · ' + ref.objetivo_es : ref.parte_es) : '') + '</small></div>' +
                    '<label class="trn__rv-mini"><span>Series</span><input data-c="series" type="number" inputmode="numeric" min="1" max="99" value="' + esc(e.series) + '"></label>' +
                    '<label class="trn__rv-mini"><span>Reps</span><input data-c="repeticiones" maxlength="20" value="' + esc(e.repeticiones) + '"></label>' +
                    '<button type="button" class="trn__rv-del" data-del="' + i + '" aria-label="Quitar"><i class="fas fa-trash"></i></button>' +
                '</div>';
            }).join('');
            cont.querySelectorAll('.trn__rv-ej').forEach(function (el) {
                var i = parseInt(el.getAttribute('data-i'), 10);
                el.querySelectorAll('input[data-c]').forEach(function (inp) {
                    inp.addEventListener('input', function () { lista[i][inp.getAttribute('data-c')] = inp.value; marcarSucio(); });
                });
                el.querySelector('[data-del]').addEventListener('click', function () {
                    lista.splice(i, 1); marcarSucio();
                    if (!lista.length) { var rest = DIAS.filter(function (d) { return diaObj(d).ejercicios.length; }); diaSel = rest[0] || diaSel; }
                    pintarDiasRv(); pintarListaRv();
                });
            });
        }
        pintarDiasRv(); pintarListaRv();

        function cerrar() { cerrarVistaPrevia(); pintarDias(); pintarEjercicios(); }
        ov.querySelector('#trnRvNombre').addEventListener('input', function (e) { estado.rutina.nombre = e.target.value; marcarSucio(); });
        ov.querySelector('#trnRvX').addEventListener('click', cerrar);
        ov.querySelector('#trnRvEditar').addEventListener('click', function () {
            estado.dia = diaSel;
            cerrarVistaPrevia(); pintarEditor();
            var rut = panel.querySelector('.trn__rut');
            if (rut) rut.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        function guardarDesde(publicar) {
            var b1 = ov.querySelector('#trnRvPublicar'), b2 = ov.querySelector('#trnRvBorrador');
            b1.disabled = b2.disabled = true;
            guardar(publicar).then(function (ok) {
                if (ok) { cerrarVistaPrevia(); pintarEditor(); } else { b1.disabled = b2.disabled = false; }
            });
        }
        ov.querySelector('#trnRvPublicar').addEventListener('click', function () { guardarDesde(true); });
        ov.querySelector('#trnRvBorrador').addEventListener('click', function () { guardarDesde(false); });
    }

    function generarRutinaInteligente() {
        var p = estado.perfil;
        if (!p) { toast('El socio aún no envió sus datos', 'err'); return; }
        var hayEj = DIAS.some(function (d) { return diaObj(d).ejercicios.length; });
        if (hayEj && !confirm('Esto reemplazará los ejercicios actuales por una propuesta nueva. ¿Continuar?')) return;
        if (!(bibliotecaPara(estado.socio.genero)).length) { toast('No hay biblioteca de ejercicios cargada', 'err'); return; }

        estado.genCont = (estado.genCont || 0) + 1;
        var rnd = semilla((estado.idSocio || 1) * 7919 + estado.genCont * 104729);
        var btn = panel.querySelector('#trnGenerar');
        var extraEl = panel.querySelector('#trnExtra');
        var extra = extraEl ? extraEl.value.trim() : '';
        estado.extraIA = extra;
        if (btn) { btn.disabled = true; btn.classList.add('is-cargando'); btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generando...'; }
        setIAEstado('cargando', 'La IA está armando la rutina, puede tardar unos segundos...');

        var catalogo = catalogoParaIA(p, rnd);
        portalFetch('/api/entrenador/ia/rutina', { method: 'POST', body: JSON.stringify({ perfil: p, catalogo: catalogo, extra: extra }) })
            .then(function (r) {
                var res = validarIA(r, catalogo);
                if (!res) throw new Error('Respuesta de IA no válida');
                aplicarGenerada(res, 'ia', r.proveedor ? String(r.proveedor).split(' · ')[0] : '');
            })
            .catch(function (err) {
                var d = String((err && err.message) || '').replace(/^La IA no respondió\.?\s*/, '').slice(0, 140);
                aplicarGenerada(construirLocal(p, rnd), 'local', d);
            });
    }

    // ---- Ventana "Mis datos" del socio (estilo Apple) ----
    var modalDatos = null;
    var ACT_INFO = {
        sedentario: ['fa-couch', 'Sedentario', 'Poco movimiento'],
        ligero: ['fa-person-walking', 'Poco activo', '1-2 días / sem'],
        activo: ['fa-person-running', 'Activo', '3-4 días / sem'],
        muy_activo: ['fa-fire-flame-curved', 'Muy activo', '5+ días / sem']
    };
    var OBJ_INFO = {
        bajar_grasa: ['fa-fire', 'Bajar grasa'], ganar_musculo: ['fa-dumbbell', 'Ganar músculo'],
        tonificar: ['fa-bolt', 'Tonificar'], resistencia: ['fa-heart-pulse', 'Resistencia'], salud: ['fa-leaf', 'Salud general']
    };
    var LES_RAPIDAS = ['Rodilla', 'Hombro', 'Espalda baja', 'Muñeca', 'Codo', 'Cuello'];

    function etiquetaBotonDatos(lleno) {
        var btn = document.getElementById('btnAbrirDatos');
        if (!btn) return;
        btn.classList.toggle('is-ok', !!lleno);
        btn.innerHTML = lleno
            ? '<i class="fas fa-circle-check"></i> <span>Datos enviados</span><span class="bd-edit"><i class="fas fa-pen"></i> Editar</span>'
            : '<i class="fas fa-pen-to-square"></i> <span>Añadir mis datos</span>';
        btn.title = lleno ? 'Toca para editar tus datos (por ejemplo, tu peso)' : 'Envía tus datos a tu entrenador';
        btn.classList.toggle('btn-datos--llamar', !lleno);
        avisoDatosRutina(!lleno);
    }

    // Aviso visible en "Mi rutina" mientras el miembro no haya enviado sus datos:
    // explica para qué sirve y apunta con una flecha al botón de enviar datos.
    function avisoDatosRutina(mostrar) {
        var panel = document.querySelector('.profile-panel[data-panel="rutinas"]');
        if (!panel) return;
        var aviso = document.getElementById('avisoDatosRutina');
        if (!mostrar) { if (aviso) aviso.remove(); return; }
        if (aviso) return;
        aviso = document.createElement('button');
        aviso.type = 'button';
        aviso.id = 'avisoDatosRutina';
        aviso.className = 'aviso-datos';
        aviso.innerHTML =
            '<span class="aviso-datos__ico"><i class="fas fa-dumbbell"></i></span>' +
            '<span class="aviso-datos__txt"><b>¿Quieres una rutina hecha para ti?</b>' +
            '<span>Para tener una rutina especializada con tu entrenador, rellena tus datos y envíalos.</span></span>' +
            '<span class="aviso-datos__flecha" aria-hidden="true"><i class="fas fa-arrow-up"></i><em>Enviar datos</em></span>';
        aviso.addEventListener('click', function () {
            var b = document.getElementById('btnAbrirDatos');
            if (b) b.click();
        });
        var ref = document.getElementById('miPuntoPartida') || document.getElementById('miRutinaEntrenador');
        if (ref) ref.insertAdjacentElement('beforebegin', aviso); else panel.appendChild(aviso);
    }

    function fechaLarga(iso) {
        try { return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
    }

    // Tarjeta "Tu punto de partida" (peso con el que empezó + mensaje)
    var perfilSocio = null;
    function pintarPartida(p) {
        perfilSocio = p || null;
        var bp = document.getElementById('btnPartida');
        if (bp) bp.hidden = !p;
        var el = document.getElementById('miPuntoPartida');
        if (!el) return;
        if (!p) { el.innerHTML = ''; return; }
        var ini = p.peso_inicial_kg, hoy = p.peso_kg, cambio = '';
        if (ini && hoy && Math.abs(hoy - ini) >= 0.1) {
            var d = Math.round((hoy - ini) * 10) / 10;
            cambio = '<span class="mp-cambio ' + (d < 0 ? 'baja' : 'sube') + '">Hoy ' + hoy + ' kg · ' + (d > 0 ? '+' : '−') + Math.abs(d) + ' kg</span>';
        }
        el.innerHTML =
            '<div class="mp-card">' +
                '<div class="mp-ico"><i class="fas fa-flag-checkered"></i></div>' +
                '<div class="mp-txt"><b>Tu punto de partida</b>' +
                    '<span>' + (p.desde ? 'Empezaste el ' + esc(fechaLarga(p.desde)) + ' con ' : 'Empezaste con ') + '<strong>' + esc(ini || hoy || '') + ' kg</strong>' +
                        (p.estatura_cm ? ' · ' + esc(p.estatura_cm) + ' cm' : '') + '</span>' + cambio +
                    '<em>' + (p.objetivo && OBJ[p.objetivo] ? 'Tu meta: ' + esc(OBJ[p.objetivo]) + '. ' : '') + 'Espero que te vaya muy bien, ¡sé constante y verás los resultados!</em>' +
                '</div>' +
            '</div>';
    }

    // Mensaje flotante "Tu punto de partida" (celulares / tablets)
    function abrirPartida() {
        var p = perfilSocio;
        if (!p) return;
        var m = document.getElementById('partidaModal');
        if (m) m.remove();
        var ini = p.peso_inicial_kg || p.peso_kg, hoy = p.peso_kg, d = (ini && hoy) ? Math.round((hoy - ini) * 10) / 10 : 0;
        m = document.createElement('div');
        m.className = 'modal';
        m.id = 'partidaModal';
        m.innerHTML =
            '<div class="modal-content partida-modal">' +
                '<span class="close-modal" id="partidaCerrar">&times;</span>' +
                '<div class="pm-ico"><i class="fas fa-flag-checkered"></i></div>' +
                '<h3>Tu punto de partida</h3>' +
                '<p class="pm-fecha">' + (p.desde ? 'Empezaste el ' + esc(fechaLarga(p.desde)) : 'Tu inicio') + '</p>' +
                '<div class="pm-datos">' +
                    '<div><b>' + esc(ini || '-') + ' kg</b><small>Peso inicial</small></div>' +
                    (p.estatura_cm ? '<div><b>' + esc(p.estatura_cm) + ' cm</b><small>Estatura</small></div>' : '') +
                    (Math.abs(d) >= 0.1 ? '<div><b class="' + (d < 0 ? 'baja' : 'sube') + '">' + (d > 0 ? '+' : '−') + Math.abs(d) + ' kg</b><small>Hoy ' + esc(hoy) + ' kg</small></div>' : '') +
                '</div>' +
                '<p class="pm-msg">' + (p.objetivo && OBJ[p.objetivo] ? 'Tu meta: <b>' + esc(OBJ[p.objetivo]) + '</b>.<br>' : '') + 'Espero que te vaya muy bien. ¡Sé constante y verás los resultados!</p>' +
                '<button type="button" class="pm-ok" id="partidaOk">¡Vamos!</button>' +
            '</div>';
        document.body.appendChild(m);
        function cerrarP() { m.classList.remove('is-open'); setTimeout(function () { m.remove(); }, 300); }
        m.querySelector('#partidaCerrar').addEventListener('click', cerrarP);
        m.querySelector('#partidaOk').addEventListener('click', cerrarP);
        m.addEventListener('click', function (e) { if (e.target === m) cerrarP(); });
        requestAnimationFrame(function () { requestAnimationFrame(function () { m.classList.add('is-open'); }); });
    }

    function refrescarPerfilSocio() {
        return portalFetch('/api/portal/me/perfil-fisico').then(function (r) {
            etiquetaBotonDatos(!!r.perfil);
            pintarPartida(r.perfil);
            return r.perfil;
        }).catch(function () { return null; });
    }

    function medida(id, etiqueta, unidad, min, max, paso, valor) {
        return '<div class="dm-medida" data-m="' + id + '">' +
            '<div class="dm-medida__top"><span>' + etiqueta + '</span></div>' +
            '<div class="dm-medida__valor">' +
                '<button type="button" class="dm-circ" data-d="-1" aria-label="Menos"><i class="fas fa-minus"></i></button>' +
                '<div class="dm-num"><b id="' + id + 'Val">' + valor + '</b><em>' + unidad + '</em></div>' +
                '<button type="button" class="dm-circ" data-d="1" aria-label="Más"><i class="fas fa-plus"></i></button>' +
            '</div>' +
            '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + paso + '" value="' + valor + '">' +
        '</div>';
    }

    function construirModalDatos() {
        if (modalDatos) return;
        modalDatos = document.createElement('div');
        modalDatos.className = 'modal';
        modalDatos.id = 'datosModal';
        modalDatos.innerHTML =
            '<div class="modal-content datos-modal">' +
                '<span class="close-modal" id="datosCerrar">&times;</span>' +
                '<div class="dm-scroll">' +
                    '<div class="dm-col dm-col--izq">' +
                    '<div class="dm-head"><div class="dm-ico"><i class="fas fa-heart-pulse"></i></div>' +
                        '<h2 id="dmTitulo">Tus datos</h2><p id="dmSub">Tu entrenador los usa para armar una rutina hecha para ti.</p></div>' +
                    '<div class="dm-medidas">' +
                        medida('dtEstatura', 'Estatura', 'cm', 120, 220, 1, 170) +
                        medida('dtPeso', 'Peso actual', 'kg', 35, 200, 0.5, 70) +
                    '</div>' +
                    '</div>' +
                    '<div class="dm-col dm-col--der">' +
                    '<div class="dm-sec"><h4>Nivel de actividad</h4><div class="dm-cards" id="dtActividad">' +
                        Object.keys(ACT_INFO).map(function (k) {
                            var a = ACT_INFO[k];
                            return '<button type="button" class="dm-card" data-v="' + k + '"><i class="fas ' + a[0] + '"></i><b>' + a[1] + '</b><small>' + a[2] + '</small></button>';
                        }).join('') +
                    '</div></div>' +
                    '<div class="dm-sec"><h4>Tu objetivo</h4><div class="dm-pills" id="dtObjetivo">' +
                        Object.keys(OBJ_INFO).map(function (k) {
                            return '<button type="button" class="dm-pill" data-v="' + k + '"><i class="fas ' + OBJ_INFO[k][0] + '"></i> ' + OBJ_INFO[k][1] + '</button>';
                        }).join('') +
                    '</div></div>' +
                    '<div class="dm-sec"><h4>Días que puedes entrenar</h4><div class="dm-dias" id="dtDias">' +
                        [2, 3, 4, 5, 6].map(function (n) { return '<button type="button" data-v="' + n + '">' + n + '</button>'; }).join('') +
                    '</div></div>' +
                    '<div class="dm-sec"><h4>Lesiones o limitaciones <small>(opcional)</small></h4><div class="dm-pills dm-pills--multi" id="dtLesChips">' +
                        LES_RAPIDAS.map(function (l) { return '<button type="button" class="dm-pill" data-l="' + l + '">' + l + '</button>'; }).join('') +
                    '</div><input type="text" id="dtLesiones" maxlength="300" placeholder="Otra molestia o comentario..."></div>' +
                    '</div>' +
                '</div>' +
                '<div class="dm-pie"><button type="button" class="dm-guardar" id="dtGuardar"><span>Guardar datos</span></button></div>' +
            '</div>';
        document.body.appendChild(modalDatos);

        function cerrarM() { modalDatos.classList.remove('is-open'); }
        modalDatos.querySelector('#datosCerrar').addEventListener('click', cerrarM);
        modalDatos.addEventListener('click', function (e) { if (e.target === modalDatos) cerrarM(); });

        // sliders + botones +/-
        modalDatos.querySelectorAll('.dm-medida').forEach(function (m) {
            var rango = m.querySelector('input[type=range]'), val = m.querySelector('.dm-num b');
            function pintar() {
                val.textContent = rango.value;
                var pct = (rango.value - rango.min) * 100 / (rango.max - rango.min);
                rango.style.setProperty('--pct', pct + '%');
            }
            rango.addEventListener('input', pintar);
            m.querySelectorAll('.dm-circ').forEach(function (b) {
                b.addEventListener('click', function () {
                    var n = parseFloat(rango.value) + parseFloat(b.getAttribute('data-d')) * parseFloat(rango.step);
                    rango.value = Math.max(rango.min, Math.min(rango.max, n));
                    pintar();
                });
            });
            pintar();
        });
        // selección única
        ['dtActividad', 'dtObjetivo', 'dtDias'].forEach(function (id) {
            var cont = modalDatos.querySelector('#' + id);
            cont.addEventListener('click', function (e) {
                var b = e.target.closest('button'); if (!b) return;
                cont.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
                cont.classList.remove('dm-falta');
            });
        });
        // lesiones rápidas: varias a la vez
        modalDatos.querySelector('#dtLesChips').addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (b) b.classList.toggle('is-active');
        });

        modalDatos.querySelector('#dtGuardar').addEventListener('click', function () {
            function val(id) { var b = modalDatos.querySelector('#' + id + ' .is-active'); return b ? b.getAttribute('data-v') : null; }
            var act = val('dtActividad'), obj = val('dtObjetivo'), dias = val('dtDias');
            var falta = [];
            if (!act) falta.push('dtActividad'); if (!obj) falta.push('dtObjetivo'); if (!dias) falta.push('dtDias');
            if (falta.length) {
                falta.forEach(function (id) { var c = modalDatos.querySelector('#' + id); c.classList.add('dm-falta'); });
                modalDatos.querySelector('#' + falta[0]).scrollIntoView({ behavior: 'smooth', block: 'center' });
                toast('Completa actividad, objetivo y días', 'err');
                return;
            }
            var les = [];
            modalDatos.querySelectorAll('#dtLesChips .is-active').forEach(function (b) { les.push(b.getAttribute('data-l')); });
            var libre = modalDatos.querySelector('#dtLesiones').value.trim();
            if (libre) les.push(libre);
            var cuerpo = {
                estatura_cm: modalDatos.querySelector('#dtEstatura').value,
                peso_kg: modalDatos.querySelector('#dtPeso').value,
                actividad: act, objetivo: obj, dias_semana: dias,
                lesiones: les.join(', ').slice(0, 300)
            };
            var btn = modalDatos.querySelector('#dtGuardar'); btn.disabled = true;
            btn.querySelector('span').textContent = 'Guardando...';
            portalFetch('/api/portal/me/perfil-fisico', { method: 'PUT', body: JSON.stringify(cuerpo) })
                .then(function () {
                    btn.classList.add('is-ok');
                    btn.querySelector('span').innerHTML = '<i class="fas fa-check"></i> Enviado a tu entrenador';
                    refrescarPerfilSocio();
                    setTimeout(function () { cerrarM(); btn.classList.remove('is-ok'); btn.querySelector('span').textContent = 'Actualizar datos'; btn.disabled = false; }, 1200);
                })
                .catch(function (err) {
                    toast(err.message || 'No se pudo guardar', 'err');
                    btn.disabled = false; btn.querySelector('span').textContent = modalDatos.dataset.tiene === '1' ? 'Actualizar datos' : 'Guardar datos';
                });
        });
    }

    function abrirDatos() {
        if (typeof getPortalToken === 'function' && !getPortalToken()) {
            alert('Tu sesión expiró. Inicia sesión de nuevo.');
            localStorage.removeItem('currentUser');
            location.reload();
            return;
        }
        construirModalDatos();
        modalDatos.classList.add('is-open');
        portalFetch('/api/portal/me/perfil-fisico').then(function (r) {
            var p = r.perfil;
            etiquetaBotonDatos(!!p);
            pintarPartida(p);
            modalDatos.dataset.tiene = p ? '1' : '0';
            modalDatos.querySelector('#dmTitulo').textContent = p ? 'Editar tus datos' : 'Tus datos';
            modalDatos.querySelector('#dmSub').textContent = p ? 'Actualiza tu peso u otros datos cuando cambien. Tu entrenador los verá al instante.' : 'Tu entrenador los usa para armar una rutina hecha para ti.';
            modalDatos.querySelector('#dtGuardar span').textContent = p ? 'Actualizar datos' : 'Guardar datos';
            if (!p) return;
            function fijar(id, v) {
                var el = modalDatos.querySelector('#' + id);
                if (v) { el.value = v; el.dispatchEvent(new Event('input')); }
            }
            fijar('dtEstatura', p.estatura_cm); fijar('dtPeso', p.peso_kg);
            [['dtActividad', p.actividad], ['dtObjetivo', p.objetivo], ['dtDias', p.dias_semana]].forEach(function (par) {
                modalDatos.querySelectorAll('#' + par[0] + ' button').forEach(function (b) {
                    b.classList.toggle('is-active', String(b.getAttribute('data-v')) === String(par[1]));
                });
            });
            var restante = [];
            String(p.lesiones || '').split(',').forEach(function (t) {
                t = t.trim(); if (!t) return;
                var chip = modalDatos.querySelector('#dtLesChips button[data-l="' + t + '"]');
                if (chip) chip.classList.add('is-active'); else restante.push(t);
            });
            modalDatos.querySelector('#dtLesiones').value = restante.join(', ');
        }).catch(function () {});
    }

    document.addEventListener('click', function (e) {
        if (e.target.closest('#btnAbrirDatos')) abrirDatos();
        else if (e.target.closest('#btnPartida')) abrirPartida();
    });

    window.abrirPanelEntrenador = abrir;
    window.cerrarPanelEntrenador = cerrar;
    window.cargarMiRutina = cargarMiRutina;
})();
