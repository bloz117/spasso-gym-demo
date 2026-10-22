/**
 * ejercicios.js - Biblioteca general de ejercicios para "Mi Cuenta"
 *
 * Lee window.EJERCICIOS_DATA (hombres, data/exercises-data.js) y
 * window.EJERCICIOS_DATA_MUJER (mujeres, data/exercises-data-mujer.js; vacía
 * hasta que lleguen esos videos). Cada ejercicio es un VIDEO en bucle con una
 * portada (poster) capturada del propio video; sin instrucciones de texto.
 *
 * Pinta tabs por parte del cuerpo + subtabs por músculo + buscador + grid de
 * tarjetas. Al tocar una tarjeta se abre el reproductor compartido
 * (js/ejercicio-video.js: bucle, pausa al tocar, barra para retroceder).
 * El selector Hombres/Mujeres solo aparece cuando ya hay ejercicios de mujeres.
 */
(function () {
    const DATOS_H = window.EJERCICIOS_DATA || [];
    const DATOS_M = window.EJERCICIOS_DATA_MUJER || [];
    if (!DATOS_H.length && !DATOS_M.length) {
        console.warn('EJERCICIOS_DATA no está disponible; revisa data/exercises-data.js');
        return;
    }

    const PAGE_SIZE = 36;

    const ORDEN_PARTES = [
        'Pecho', 'Espalda', 'Hombros', 'Brazos',
        'Abdomen', 'Piernas', 'Cuello', 'Cuerpo completo'
    ];
    // Orden de pestañas en la biblioteca de mujeres (Glúteos primero).
    const ORDEN_PARTES_M = [
        'Glúteos', 'Piernas', 'Espalda', 'Pecho', 'Hombros',
        'Brazos', 'Abdomen', 'Cuerpo completo', 'Movilidad'
    ];

    // Iconos de img/iconos/ (torso con el músculo resaltado).
    const ICONOS_IMG = {
        'Pecho': 'img/iconos/pecho.png',
        'Espalda': 'img/iconos/espalda.png',
        'Hombros': 'img/iconos/hombros.png',
        'Brazos': 'img/iconos/brazos.png',
        'Abdomen': 'img/iconos/abdomen.png',
        'Piernas': 'img/iconos/piernas.png',
        'Cuello': 'img/iconos/cuello.png',
        'Cuerpo completo': 'img/iconos/todos.png',
        'Todos': 'img/iconos/todos.png'
    };

    // Icono por subgrupo; si no hay uno específico se usa el de la parte.
    const ICONOS_SUB = {
        'Bíceps': 'img/iconos/biceps.png',
        'Tríceps': 'img/iconos/brazos.png',
        'Antebrazo': 'img/iconos/antebrazos.png',
        'Braquial': 'img/iconos/brazos.png',
        'Brazos completos': 'img/iconos/brazos.png',
        'Cuádriceps': 'img/iconos/cuadriceps.png',
        'Glúteos': 'img/iconos/gluteos.png',
        'Femorales': 'img/iconos/piernas.png',
        'Aductores': 'img/iconos/aductores.png',
        'Flexores de cadera': 'img/iconos/piernas.png',
        'Pantorrillas y tibial': 'img/iconos/pantorrillas.png',
        'Piernas completas': 'img/iconos/piernas.png',
        'Dorsales': 'img/iconos/dorsales.png',
        'Espalda alta': 'img/iconos/espalda.png',
        'Espalda baja': 'img/iconos/columna.png',
        'Espalda completa': 'img/iconos/espalda.png',
        'Trapecio': 'img/iconos/trapecios.png',
        'Serrato': 'img/iconos/serrato.png',
        'Pecho superior': 'img/iconos/pecho.png',
        'Pecho medio': 'img/iconos/pecho.png',
        'Pecho inferior': 'img/iconos/pecho.png',
        'Pecho completo': 'img/iconos/pecho.png',
        'Abdomen inferior': 'img/iconos/abdomen.png',
        'Abdomen superior': 'img/iconos/abdomen.png',
        'Oblicuos': 'img/iconos/abdomen.png',
        'Core completo': 'img/iconos/abdomen.png',
        'Deltoide anterior': 'img/iconos/hombros.png',
        'Deltoide lateral': 'img/iconos/hombros.png',
        'Deltoide posterior': 'img/iconos/hombros.png',
        'Manguito rotador': 'img/iconos/hombros.png',
        'Hombro completo': 'img/iconos/hombros.png'
    };

    // Iconos femeninos (img/iconos/mujer/): mismo estilo, cuerpo de mujer.
    const M = 'img/iconos/mujer/';
    const ICONOS_IMG_M = {
        'Glúteos': M + 'gluteos.png', 'Piernas': M + 'piernas.png', 'Espalda': M + 'espalda.png',
        'Pecho': M + 'pecho.png', 'Hombros': M + 'hombros.png', 'Brazos': M + 'brazos.png',
        'Abdomen': M + 'abdomen.png', 'Cuerpo completo': M + 'todos.png',
        'Movilidad': 'img/iconos/cardio.png', 'Todos': M + 'todos.png'
    };
    const ICONOS_SUB_M = {
        'Glúteo mayor': M + 'gluteos.png', 'Glúteo medio': M + 'gluteo_medio.png', 'Rutina de glúteos': M + 'gluteos.png',
        'Cuádriceps': M + 'cuadriceps.png', 'Isquiotibiales': M + 'femorales.png', 'Aductores': M + 'aductores.png',
        'Pantorrillas': M + 'pantorrillas.png', 'Piernas completas': M + 'piernas.png', 'Rutina de piernas': M + 'piernas.png',
        'Dorsales': M + 'dorsales.png', 'Espalda media': M + 'espalda.png', 'Espalda baja': M + 'espalda_baja.png',
        'Trapecio': M + 'trapecio.png', 'Rutina de espalda': M + 'espalda.png',
        'Pecho completo': M + 'pecho.png', 'Pecho superior': M + 'pecho_sup.png',
        'Deltoide frontal': M + 'hombros.png', 'Deltoide lateral': M + 'hombros.png', 'Deltoide posterior': M + 'deltoide_post.png', 'Hombro completo': M + 'hombros.png',
        'Bíceps': M + 'biceps.png', 'Tríceps': M + 'triceps.png', 'Antebrazo': M + 'antebrazo.png', 'Brazos completos': M + 'brazos.png',
        'Abdomen superior': M + 'abdomen_sup.png', 'Oblicuos': M + 'oblicuos.png', 'Core y estabilidad': M + 'abdomen.png',
        'Cuerpo completo': M + 'todos.png', 'Tren superior': M + 'pecho.png',
        'Cardio': 'img/iconos/cardio.png', 'Movilidad': 'img/iconos/cardio.png'
    };
    const ORDEN_SUB_M = {
        'Glúteos': ['Glúteo mayor', 'Glúteo medio', 'Rutina de glúteos'],
        'Piernas': ['Piernas completas', 'Cuádriceps', 'Isquiotibiales', 'Aductores', 'Pantorrillas', 'Rutina de piernas'],
        'Espalda': ['Dorsales', 'Espalda media', 'Espalda baja', 'Trapecio', 'Rutina de espalda'],
        'Pecho': ['Pecho completo', 'Pecho superior'],
        'Hombros': ['Deltoide frontal', 'Deltoide lateral', 'Deltoide posterior', 'Hombro completo'],
        'Brazos': ['Bíceps', 'Tríceps', 'Antebrazo', 'Brazos completos'],
        'Abdomen': ['Abdomen superior', 'Oblicuos', 'Core y estabilidad']
    };

    const ORDEN_SUB = {
        'Pecho': ['Pecho superior', 'Pecho medio', 'Pecho inferior', 'Serrato', 'Pecho completo'],
        'Espalda': ['Dorsales', 'Espalda alta', 'Espalda baja', 'Trapecio', 'Espalda completa'],
        'Hombros': ['Deltoide anterior', 'Deltoide lateral', 'Deltoide posterior', 'Manguito rotador', 'Hombro completo'],
        'Brazos': ['Bíceps', 'Braquial', 'Tríceps', 'Antebrazo', 'Brazos completos'],
        'Abdomen': ['Abdomen superior', 'Abdomen inferior', 'Oblicuos', 'Core completo'],
        'Piernas': ['Cuádriceps', 'Femorales', 'Glúteos', 'Aductores', 'Flexores de cadera', 'Pantorrillas y tibial', 'Piernas completas']
    };

    // Género de la sesión (socio). 'femenino' => solo biblioteca de mujeres;
    // 'masculino' => solo hombres; sin dato => selector con ambas.
    function generoSesion() {
        try {
            const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
            return u && u.genero ? u.genero : '';
        } catch (e) { return ''; }
    }
    function generoInicial() {
        const g = generoSesion();
        if (g === 'femenino' && DATOS_M.length) return 'mujer';
        if (g === 'masculino' && DATOS_H.length) return 'hombre';
        return DATOS_H.length ? 'hombre' : 'mujer';
    }
    let generoActual = generoInicial();
    let datos = [];
    let categorias = [];
    let subcategoriasPorParte = {};

    let categoriaActual = 'Todos';
    let subFiltroActual = null;
    let termino = '';
    let visibles = PAGE_SIZE;

    const tabsEl = document.getElementById('ejerciciosTabs');
    const subtabsEl = document.getElementById('ejerciciosSubtabs');
    const gridEl = document.getElementById('ejerciciosGrid');
    const buscarEl = document.getElementById('ejerciciosBuscar');
    const cargarMasEl = document.getElementById('ejerciciosCargarMas');

    if (!tabsEl || !gridEl) return;

    function escaparHtml(texto) {
        const div = document.createElement('div');
        div.textContent = texto == null ? '' : String(texto);
        return div.innerHTML;
    }

    // Recalcula categorías y subgrupos según la biblioteca activa.
    function prepararDatos() {
        datos = generoActual === 'mujer' ? DATOS_M : DATOS_H;
        const presentes = new Set(datos.map(function (e) { return e.parte_es; }));
        const ordenP = generoActual === 'mujer' ? ORDEN_PARTES_M : ORDEN_PARTES;
        categorias = ['Todos'].concat(ordenP.filter(function (p) { return presentes.has(p); }));
        subcategoriasPorParte = {};
        categorias.forEach(function (cat) {
            if (cat === 'Todos') return;
            const objetivos = new Set();
            datos.forEach(function (e) {
                if (e.parte_es === cat && e.objetivo_es) objetivos.add(e.objetivo_es);
            });
            if (objetivos.size > 1) {
                const orden = (generoActual === 'mujer' ? ORDEN_SUB_M : ORDEN_SUB)[cat] || [];
                subcategoriasPorParte[cat] = Array.from(objetivos).sort(function (a, b) {
                    const ia = orden.indexOf(a), ib = orden.indexOf(b);
                    if (ia === -1 && ib === -1) return a.localeCompare(b);
                    if (ia === -1) return 1;
                    if (ib === -1) return -1;
                    return ia - ib;
                });
            }
        });
        categoriaActual = 'Todos';
        subFiltroActual = null;
        visibles = PAGE_SIZE;
    }

    // Selector Hombres/Mujeres: solo si ya hay ejercicios de ambos.
    function renderGenero() {
        let el = document.getElementById('ejerciciosGenero');
        // El selector solo aparece si no se conoce el género de la cuenta.
        if (!(DATOS_H.length && DATOS_M.length) || generoSesion()) { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement('div');
            el.id = 'ejerciciosGenero';
            el.className = 'ejercicios-genero';
            subtabsEl.parentNode.insertBefore(el, subtabsEl);
        }
        el.innerHTML = ['hombre', 'mujer'].map(function (g) {
            return '<button type="button" class="ejercicios-genero__btn' + (g === generoActual ? ' active' : '') +
                '" data-g="' + g + '">' + (g === 'hombre' ? 'Hombres' : 'Mujeres') + '</button>';
        }).join('');
        el.querySelectorAll('button').forEach(function (b) {
            b.addEventListener('click', function () {
                generoActual = b.getAttribute('data-g');
                prepararDatos();
                renderGenero();
                renderTabs();
                renderSubtabs();
                renderGrid();
            });
        });
    }

    function iconoTab(cat) {
        const mapa = generoActual === 'mujer' ? ICONOS_IMG_M : ICONOS_IMG;
        const src = mapa[cat] || mapa['Todos'];
        return '<span class="ejercicios-tab__icono-wrap"><img class="ejercicios-tab__icono" src="' + src + '" alt="" aria-hidden="true"></span>';
    }

    function renderTabs() {
        tabsEl.innerHTML = categorias.map(function (cat) {
            const activa = cat === categoriaActual ? ' active' : '';
            return (
                '<button class="ejercicios-tab' + activa + '" data-parte="' + escaparHtml(cat) + '">' +
                    iconoTab(cat) +
                    '<span class="ejercicios-tab__label">' + escaparHtml(cat) + '</span>' +
                '</button>'
            );
        }).join('');

        tabsEl.querySelectorAll('.ejercicios-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                categoriaActual = btn.getAttribute('data-parte');
                subFiltroActual = null;
                visibles = PAGE_SIZE;
                tabsEl.querySelectorAll('.ejercicios-tab').forEach(function (b) {
                    b.classList.toggle('active', b === btn);
                });
                renderSubtabs();
                renderGrid();
            });
        });
    }

    function renderSubtabs() {
        if (!subtabsEl) return;
        const lista = subcategoriasPorParte[categoriaActual];
        if (!lista || !lista.length) {
            subtabsEl.hidden = true;
            subtabsEl.innerHTML = '';
            return;
        }

        subtabsEl.hidden = false;
        const chips = ['<button class="ejercicios-subtab' + (subFiltroActual ? '' : ' active') + '" data-sub="">Todos</button>'];
        lista.forEach(function (musculo) {
            const activa = musculo === subFiltroActual ? ' active' : '';
            const icono = (generoActual === 'mujer' ? ICONOS_SUB_M : ICONOS_SUB)[musculo];
            const iconoHtml = icono ? '<img class="ejercicios-subtab__icono" src="' + icono + '" alt="" aria-hidden="true">' : '';
            chips.push(
                '<button class="ejercicios-subtab' + activa + '" data-sub="' + escaparHtml(musculo) + '">' +
                    iconoHtml +
                    '<span>' + escaparHtml(musculo) + '</span>' +
                '</button>'
            );
        });
        subtabsEl.innerHTML = chips.join('');

        subtabsEl.querySelectorAll('.ejercicios-subtab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                subFiltroActual = btn.getAttribute('data-sub') || null;
                visibles = PAGE_SIZE;
                subtabsEl.querySelectorAll('.ejercicios-subtab').forEach(function (b) {
                    b.classList.toggle('active', b === btn);
                });
                renderGrid();
            });
        });
    }

    function obtenerFiltrados() {
        const term = termino.trim().toLowerCase();
        return datos.filter(function (ej) {
            if (categoriaActual !== 'Todos' && ej.parte_es !== categoriaActual) return false;
            if (subFiltroActual && ej.objetivo_es !== subFiltroActual) return false;
            if (term) {
                const texto = (ej.nombre + ' ' + (ej.objetivo_es || '') + ' ' + (ej.detalle || '')).toLowerCase();
                if (texto.indexOf(term) === -1) return false;
            }
            return true;
        });
    }

    function renderGrid() {
        const filtrados = obtenerFiltrados();
        const mostrar = filtrados.slice(0, visibles);

        if (!mostrar.length) {
            gridEl.innerHTML = '<div class="ejercicios-vacio">' +
                (datos.length ? 'No se encontraron ejercicios con ese filtro.' : 'Pronto habrá ejercicios en esta sección.') + '</div>';
            cargarMasEl.hidden = true;
            return;
        }

        gridEl.innerHTML = mostrar.map(function (ej) {
            const indiceReal = datos.indexOf(ej);
            const sub = ej.objetivo_es && ej.objetivo_es !== ej.parte_es ? ej.objetivo_es : ej.parte_es;
            return (
                '<button class="ejercicio-card" data-idx="' + indiceReal + '">' +
                    '<span class="ejercicio-card__media">' +
                        '<img loading="lazy" decoding="async" src="' + escaparHtml(ej.poster || ej.imagen) + '" alt="' + escaparHtml(ej.nombre) + '">' +
                        '<span class="ejercicio-card__play" aria-hidden="true"></span>' +
                    '</span>' +
                    '<div class="ejercicio-card__info">' +
                        '<span class="ejercicio-card__nombre">' + escaparHtml(ej.nombre) + '</span>' +
                        '<span class="ejercicio-card__equipo">' + escaparHtml(sub) + '</span>' +
                    '</div>' +
                '</button>'
            );
        }).join('');

        gridEl.querySelectorAll('.ejercicio-card').forEach(function (card) {
            card.addEventListener('click', function () {
                const idx = parseInt(card.getAttribute('data-idx'), 10);
                if (window.EjVideo) window.EjVideo.abrir(datos[idx]);
            });
        });

        cargarMasEl.hidden = visibles >= filtrados.length;
    }

    if (buscarEl) {
        buscarEl.addEventListener('input', function () {
            termino = buscarEl.value;
            visibles = PAGE_SIZE;
            renderGrid();
        });
    }

    if (cargarMasEl) {
        cargarMasEl.addEventListener('click', function () {
            visibles += PAGE_SIZE;
            renderGrid();
        });
    }

    function refrescar() {
        generoActual = generoInicial();
        prepararDatos();
        renderGenero();
        renderTabs();
        renderSubtabs();
        renderGrid();
    }
    // funciones.js llama a esto al iniciar o cambiar de sesión.
    window.ejerciciosRefrescar = refrescar;
    refrescar();
})();
