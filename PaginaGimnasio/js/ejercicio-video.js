/**
 * ejercicio-video.js - Reproductor compartido de ejercicios (video en bucle).
 *
 * API: window.EjVideo.abrir(ref) / window.EjVideo.cerrar()
 *   ref = { nombre, video, poster|imagen, parte_es, objetivo_es, detalle }
 *
 * - Bucle infinito, sin sonido, playsinline (no salta a pantalla completa en iOS).
 * - Tocar el video = pausar / reanudar (icono central).
 * - Barra inferior: play/pausa, línea de tiempo (se puede arrastrar para
 *   retroceder/adelantar), tiempo y velocidad (1x / 0.5x / 0.25x).
 * - Se crea una sola vez y se reutiliza (biblioteca, rutinas y modo GO).
 */
(function () {
    if (window.EjVideo) return;

    var overlay, video, titulo, chips, playBtn, seek, tiempo, velBtn, centro, cargando;
    var VELS = [1, 0.5, 0.25];
    var velIdx = 0;
    var arrastrando = false;

    function esc(t) {
        var d = document.createElement('div');
        d.textContent = t == null ? '' : String(t);
        return d.innerHTML;
    }
    function fmt(s) {
        if (!isFinite(s)) s = 0;
        var m = Math.floor(s / 60), x = Math.floor(s % 60);
        return m + ':' + (x < 10 ? '0' : '') + x;
    }

    var ICON_PLAY = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>';
    var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

    function construir() {
        overlay = document.createElement('div');
        overlay.className = 'ejv';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML =
            '<div class="ejv__card">' +
                '<button class="ejv__cerrar" type="button" aria-label="Cerrar"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none"/></svg></button>' +
                '<div class="ejv__stage">' +
                    '<video class="ejv__video" playsinline loop muted preload="auto" disablepictureinpicture></video>' +
                    '<div class="ejv__cargando" aria-hidden="true"></div>' +
                    '<div class="ejv__centro" aria-hidden="true"></div>' +
                    '<div class="ejv__barra">' +
                        '<button class="ejv__play" type="button" aria-label="Pausar"></button>' +
                        '<input class="ejv__seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Posición del video">' +
                        '<span class="ejv__tiempo">0:00</span>' +
                        '<button class="ejv__vel" type="button" aria-label="Velocidad">1x</button>' +
                    '</div>' +
                '</div>' +
                '<div class="ejv__info">' +
                    '<h3 class="ejv__titulo"></h3>' +
                    '<div class="ejv__chips"></div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        video = overlay.querySelector('.ejv__video');
        titulo = overlay.querySelector('.ejv__titulo');
        chips = overlay.querySelector('.ejv__chips');
        playBtn = overlay.querySelector('.ejv__play');
        seek = overlay.querySelector('.ejv__seek');
        tiempo = overlay.querySelector('.ejv__tiempo');
        velBtn = overlay.querySelector('.ejv__vel');
        centro = overlay.querySelector('.ejv__centro');
        cargando = overlay.querySelector('.ejv__cargando');

        overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrar(); });
        overlay.querySelector('.ejv__cerrar').addEventListener('click', cerrar);

        // Tocar el video (no la barra) alterna pausa/reproducción.
        video.addEventListener('click', alternar);
        centro.addEventListener('click', alternar);
        playBtn.addEventListener('click', alternar);

        video.addEventListener('play', refrescarEstado);
        video.addEventListener('pause', refrescarEstado);
        video.addEventListener('waiting', function () { overlay.classList.add('ejv--carga'); });
        video.addEventListener('playing', function () { overlay.classList.remove('ejv--carga'); });
        video.addEventListener('canplay', function () { overlay.classList.remove('ejv--carga'); });
        video.addEventListener('timeupdate', function () {
            if (arrastrando || !video.duration) return;
            seek.value = Math.round((video.currentTime / video.duration) * 1000);
            tiempo.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
        });
        video.addEventListener('loadedmetadata', function () {
            tiempo.textContent = '0:00 / ' + fmt(video.duration);
        });

        // Arrastrar la línea de tiempo: pausa mientras se arrastra y retoma al soltar.
        var estabaReproduciendo = false;
        seek.addEventListener('pointerdown', function () {
            arrastrando = true;
            estabaReproduciendo = !video.paused;
        });
        seek.addEventListener('input', function () {
            if (!video.duration) return;
            video.currentTime = (seek.value / 1000) * video.duration;
            tiempo.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
        });
        function soltar() {
            if (!arrastrando) return;
            arrastrando = false;
            if (estabaReproduciendo) reproducir();
        }
        seek.addEventListener('pointerup', soltar);
        seek.addEventListener('pointercancel', soltar);
        seek.addEventListener('change', soltar);

        velBtn.addEventListener('click', function () {
            velIdx = (velIdx + 1) % VELS.length;
            aplicarVel();
        });

        document.addEventListener('keydown', function (e) {
            if (!overlay.classList.contains('ejv--activo')) return;
            if (e.key === 'Escape') cerrar();
            else if (e.key === ' ' || e.key === 'k') { e.preventDefault(); alternar(); }
            else if (e.key === 'ArrowLeft') { video.currentTime = Math.max(0, video.currentTime - 1); }
            else if (e.key === 'ArrowRight') { video.currentTime = Math.min(video.duration || 0, video.currentTime + 1); }
        });
    }

    function aplicarVel() {
        video.playbackRate = VELS[velIdx];
        velBtn.textContent = (VELS[velIdx] === 1 ? '1' : String(VELS[velIdx]).replace(/^0/, '0')) + 'x';
    }

    function reproducir() {
        var p = video.play();
        if (p && p.catch) p.catch(function () { refrescarEstado(); });
    }

    function alternar() {
        if (video.paused) reproducir(); else video.pause();
    }

    function refrescarEstado() {
        var pausado = video.paused;
        overlay.classList.toggle('ejv--pausa', pausado);
        playBtn.innerHTML = pausado ? ICON_PLAY : ICON_PAUSE;
        playBtn.setAttribute('aria-label', pausado ? 'Reproducir' : 'Pausar');
        centro.innerHTML = pausado ? ICON_PLAY.replace(/30/g, '40') : '';
    }

    function abrir(ref) {
        if (!ref) return;
        if (!overlay) construir();
        var src = ref.video;
        if (!src) return; // sin video no hay nada que reproducir
        velIdx = 0;
        aplicarVel();
        seek.value = 0;
        tiempo.textContent = '0:00';
        overlay.classList.add('ejv--carga');
        video.poster = ref.poster || ref.imagen || '';
        video.removeAttribute('src');
        video.src = src;
        video.load();
        titulo.textContent = ref.nombre || '';
        var c = [];
        if (ref.parte_es) c.push(ref.parte_es);
        if (ref.objetivo_es && ref.objetivo_es !== ref.parte_es) c.push(ref.objetivo_es);
        if (ref.detalle) c.push(ref.detalle);
        chips.innerHTML = c.map(function (t) { return '<span class="ejv__chip">' + esc(t) + '</span>'; }).join('');
        overlay.classList.add('ejv--activo');
        document.documentElement.classList.add('ejv-abierto');
        refrescarEstado();
        reproducir();
    }

    function cerrar() {
        if (!overlay) return;
        overlay.classList.remove('ejv--activo');
        document.documentElement.classList.remove('ejv-abierto');
        video.pause();
        video.removeAttribute('src');
        video.load();
    }

    window.EjVideo = { abrir: abrir, cerrar: cerrar };
})();
