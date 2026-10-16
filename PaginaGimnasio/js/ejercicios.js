/**
 * ejercicios.js - Biblioteca general de ejercicios para "Mi Cuenta"
 *
 * Lee window.EJERCICIOS_DATA (ver data/exercises-data.js, generado desde
 * exercises-dataset-main) y pinta la pestaña "Ejercicios" del perfil:
 * tabs por parte del cuerpo + buscador + grid de tarjetas + detalle con
 * pasos en español. Es independiente de "Rutinas" (planes ya armados);
 * acá se ve TODO el catálogo de ejercicios sueltos.
 *
 * Se carga después de funciones.js: reutiliza el mismo mecanismo de tabs
 * del perfil (data-panel="ejercicios" ya wireado por cambiarPanelPerfil),
 * así que este archivo solo se encarga del contenido de ese panel.
 */
(function () {
    const datos = window.EJERCICIOS_DATA || [];
    if (!datos.length) {
        console.warn('EJERCICIOS_DATA no está disponible; revisa data/exercises-data.js');
        return;
    }

    const PAGE_SIZE = 36;

    // Orden fijo de categorías (más natural que el orden de aparición en
    // el dataset), "Todos" primero.
    const ORDEN_PARTES = [
        'Pecho', 'Espalda', 'Hombros', 'Brazos', 'Antebrazos',
        'Abdomen', 'Piernas', 'Pantorrillas', 'Cardio', 'Cuello'
    ];
    const partesPresentes = new Set(datos.map(function (e) { return e.parte_es; }));
    const categorias = ['Todos'].concat(ORDEN_PARTES.filter(function (p) { return partesPresentes.has(p); }));

    // Iconos reales (recorte de torso con el músculo resaltado en rojo,
    // mismo estilo en las 11 categorías) - ver img/iconos/. "Cardio" y
    // "Todos" no vienen del pack original de músculos (no son un músculo
    // puntual), así que esos dos se generaron aparte con el mismo estilo
    // visual (torso/cuerpo gris-azulado + resalte rojo) y se recortaron
    // igual que el resto.
    const ICONOS_IMG = {
        'Pecho': 'img/iconos/pecho.png',
        'Espalda': 'img/iconos/espalda.png',
        'Hombros': 'img/iconos/hombros.png',
        'Brazos': 'img/iconos/brazos.png',
        'Antebrazos': 'img/iconos/antebrazos.png',
        'Abdomen': 'img/iconos/abdomen.png',
        'Piernas': 'img/iconos/piernas.png',
        'Pantorrillas': 'img/iconos/pantorrillas.png',
        'Cuello': 'img/iconos/cuello.png',
        'Cardio': 'img/iconos/cardio.png',
        'Todos': 'img/iconos/todos.png'
    };

    // Subcategorías por músculo específico dentro de cada parte grande
    // (2do nivel de filtro). Salen directo de los datos reales -campo
    // "objetivo_es" de cada ejercicio-, no son inventadas: si mañana el
    // dataset trae un músculo nuevo para una parte, aparece solo. El
    // icono es del mismo pack de imágenes que mandó el usuario (recorte
    // de torso con ESE músculo puntual resaltado); cuando el pack no
    // trae uno específico para ese músculo, se cae de vuelta al icono
    // de la parte grande (mejor eso que mostrar el músculo equivocado).
    const ICONOS_SUB = {
        'Bíceps': 'img/iconos/biceps.png',
        'Tríceps': 'img/iconos/brazos.png',
        'Cuádriceps': 'img/iconos/cuadriceps.png',
        'Glúteos': 'img/iconos/gluteos.png',
        'Isquiotibiales': 'img/iconos/piernas.png',
        'Aductores': 'img/iconos/aductores.png',
        'Abductores': 'img/iconos/piernas.png',
        'Columna': 'img/iconos/columna.png',
        'Dorsales': 'img/iconos/dorsales.png',
        'Espalda alta': 'img/iconos/espalda.png',
        'Trapecios': 'img/iconos/trapecios.png',
        'Pectorales': 'img/iconos/pecho.png',
        'Serrato anterior': 'img/iconos/serrato.png'
    };

    // Orden de subcategorías por parte (para que no salgan en el orden
    // random en que aparece cada músculo en el dataset).
    const ORDEN_SUB = {
        'Piernas': ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Aductores', 'Abductores'],
        'Brazos': ['Bíceps', 'Tríceps'],
        'Espalda': ['Dorsales', 'Trapecios', 'Espalda alta', 'Columna'],
        'Pecho': ['Pectorales', 'Serrato anterior']
    };

    // Mapa parte -> lista de músculos objetivo distintos que realmente
    // aparecen en los datos para esa parte. Solo se muestran subtabs si
    // hay más de uno (si solo hay uno, "toda la parte" ya es ese músculo).
    const subcategoriasPorParte = {};
    categorias.forEach(function (cat) {
        if (cat === 'Todos') return;
        const objetivos = new Set();
        datos.forEach(function (e) {
            if (e.parte_es === cat && e.objetivo_es) objetivos.add(e.objetivo_es);
        });
        if (objetivos.size > 1) {
            const orden = ORDEN_SUB[cat] || [];
            const lista = Array.from(objetivos).sort(function (a, b) {
                const ia = orden.indexOf(a), ib = orden.indexOf(b);
                if (ia === -1 && ib === -1) return a.localeCompare(b);
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            });
            subcategoriasPorParte[cat] = lista;
        }
    });

    function iconoTab(cat) {
        const src = ICONOS_IMG[cat] || ICONOS_IMG['Todos'];
        const interno = '<img class="ejercicios-tab__icono" src="' + src + '" alt="" aria-hidden="true">';
        // Círculo "placa" detrás (ver .ejercicios-tab__icono-wrap en CSS):
        // uniforma el peso visual entre las 11 fotos del pack.
        return '<span class="ejercicios-tab__icono-wrap">' + interno + '</span>';
    }

    let categoriaActual = 'Todos';
    let subFiltroActual = null;
    let termino = '';
    let visibles = PAGE_SIZE;

    const tabsEl = document.getElementById('ejerciciosTabs');
    const subtabsEl = document.getElementById('ejerciciosSubtabs');
    const gridEl = document.getElementById('ejerciciosGrid');
    const buscarEl = document.getElementById('ejerciciosBuscar');
    const cargarMasEl = document.getElementById('ejerciciosCargarMas');

    // Ventana flotante (lightbox) con el gif del ejercicio - vive fuera de
    // #profileModal, ver index.html (mismo patrón que .gym-lightbox).
    const lightboxEl = document.getElementById('ejercicioLightbox');
    const lightboxCerrarEl = document.getElementById('ejercicioLightboxCerrar');
    const lightboxGifEl = document.getElementById('ejercicioLightboxGif');
    const lightboxNombreEl = document.getElementById('ejercicioLightboxNombre');
    const lightboxParteEl = document.getElementById('ejercicioLightboxParte');
    const lightboxEquipoEl = document.getElementById('ejercicioLightboxEquipo');
    const lightboxObjetivoEl = document.getElementById('ejercicioLightboxObjetivo');
    const lightboxPasosEl = document.getElementById('ejercicioLightboxPasos');

    if (!tabsEl || !gridEl) return;

    function escaparHtml(texto) {
        const div = document.createElement('div');
        div.textContent = texto == null ? '' : String(texto);
        return div.innerHTML;
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

    // Fila de chips por músculo específico (2do nivel), solo si la parte
    // elegida tiene más de un objetivo_es distinto en los datos - ver
    // subcategoriasPorParte más arriba. Incluye un chip "Todos" propio de
    // esa parte para volver a ver el catálogo completo de la categoría.
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
            const icono = ICONOS_SUB[musculo];
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
            if (term && ej.nombre.toLowerCase().indexOf(term) === -1) return false;
            return true;
        });
    }

    function renderGrid() {
        const filtrados = obtenerFiltrados();
        const mostrar = filtrados.slice(0, visibles);

        if (!mostrar.length) {
            gridEl.innerHTML = '<div class="ejercicios-vacio">No se encontraron ejercicios con ese filtro.</div>';
            cargarMasEl.hidden = true;
            return;
        }

        gridEl.innerHTML = mostrar.map(function (ej) {
            const indiceReal = datos.indexOf(ej);
            return (
                '<button class="ejercicio-card" data-idx="' + indiceReal + '">' +
                    '<img loading="lazy" src="' + escaparHtml(ej.imagen) + '" alt="' + escaparHtml(ej.nombre) + '">' +
                    '<div class="ejercicio-card__info">' +
                        '<span class="ejercicio-card__nombre">' + escaparHtml(ej.nombre) + '</span>' +
                        '<span class="ejercicio-card__equipo">' + escaparHtml(ej.equipo_es) + '</span>' +
                    '</div>' +
                '</button>'
            );
        }).join('');

        gridEl.querySelectorAll('.ejercicio-card').forEach(function (card) {
            card.addEventListener('click', function () {
                const idx = parseInt(card.getAttribute('data-idx'), 10);
                abrirLightbox(datos[idx]);
            });
        });

        cargarMasEl.hidden = visibles >= filtrados.length;
    }

    // Resumen corto de la técnica: máx. 3 pasos, cada uno recortado a su
    // primera frase (~85 caracteres), para que todos los ejercicios tengan
    // casi la misma cantidad de texto (la imagen ya explica el movimiento).
    function resumirPasos(pasos) {
        return (pasos || []).slice(0, 3).map(function (p) {
            var t = String(p || '').replace(/\s+/g, ' ').trim();
            var m = t.match(/^(.+?[.!?])(\s|$)/);
            if (m) t = m[1];
            if (t.length > 85) {
                t = t.slice(0, 85);
                var i = t.lastIndexOf(' ');
                if (i > 50) t = t.slice(0, i);
                t = t.replace(/[,;:\s]+$/, '') + '…';
            }
            return t;
        }).filter(Boolean);
    }

    // Abre la ventana flotante con el gif del ejercicio (toda la ejecución
    // del movimiento, no solo una foto fija) y sus datos/pasos.
    function abrirLightbox(ej) {
        if (!ej || !lightboxEl) return;
        // Truco para que el gif siempre arranque desde el primer frame al
        // abrir (si el navegador ya lo tenía cacheado, reasignar el mismo
        // src no lo reinicia): se limpia el src antes de ponerlo de nuevo.
        lightboxGifEl.src = '';
        lightboxGifEl.src = ej.gif || ej.imagen;
        lightboxGifEl.alt = ej.nombre;
        lightboxNombreEl.textContent = ej.nombre;
        lightboxParteEl.textContent = ej.parte_es;
        lightboxEquipoEl.textContent = ej.equipo_es;
        lightboxObjetivoEl.textContent = ej.objetivo_es;
        lightboxPasosEl.innerHTML = resumirPasos(ej.pasos).map(function (paso) {
            return '<li>' + escaparHtml(paso) + '</li>';
        }).join('') || '<li>Sin instrucciones detalladas para este ejercicio.</li>';

        lightboxEl.classList.add('activo');
    }

    function cerrarLightbox() {
        lightboxEl.classList.remove('activo');
        lightboxGifEl.src = '';
    }

    if (lightboxCerrarEl) {
        lightboxCerrarEl.addEventListener('click', cerrarLightbox);
    }
    if (lightboxEl) {
        // Clic en el fondo oscuro (fuera de la tarjeta) también cierra.
        lightboxEl.addEventListener('click', function (e) {
            if (e.target === lightboxEl) cerrarLightbox();
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && lightboxEl && lightboxEl.classList.contains('activo')) {
            cerrarLightbox();
        }
    });

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

    renderTabs();
    renderSubtabs();
    renderGrid();
})();
