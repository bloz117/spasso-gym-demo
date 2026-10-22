/* Modo GO: entrenar un ejercicio de "Mi rutina" con cuenta regresiva, cronómetro de serie
   y descanso controlado (los datos —series, repeticiones y descanso— los pone el entrenador;
   el socio no edita nada). Avisos: pitidos 3-2-1 y vibración (si el celular la permite). */
(function () {
    'use strict';
    var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    var PREP = 5;
    var KEY = 'spassoRutinaHecha';

    // ---------- Sonido y vibración ----------
    var AC = null;
    function audio() {
        try {
            if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
            if (AC.state === 'suspended') AC.resume();
        } catch (e) { AC = null; }
        return AC;
    }
    function beep(freq, dur, vol) {
        var ac = audio(); if (!ac) return;
        try {
            var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
            o.type = 'sine'; o.frequency.value = freq;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol || 0.35, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
        } catch (e) {}
    }
    function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
    var wake = null;
    function pantallaEncendida(on) {
        try {
            if (on && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {});
            else if (!on && wake) { wake.release(); wake = null; }
        } catch (e) {}
    }

    // ---------- Ejercicios hechos hoy (solo en este celular) ----------
    function hoyFecha() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    var mem = {};   // respaldo si el navegador no deja usar localStorage
    function leer() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return mem; } }
    function hechosHoy() { var a = leer()[hoyFecha()]; return Array.isArray(a) ? a : []; }
    function marcarHecho(k) {
        var o = {}, f = hoyFecha(), cur = hechosHoy().slice();
        if (cur.indexOf(k) === -1) cur.push(k);
        o[f] = cur; mem = o;                                   // solo se guarda el día de hoy
        try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    }
    function listaHoy() {
        var r = window.__rutinaSocio; if (!r) return [];
        var hoy = DIAS[(new Date().getDay() + 6) % 7];
        var d = (r.dias || []).filter(function (x) { return x.dia === hoy; })[0];
        return (d && d.ejercicios) || [];
    }
    function claveDe(e, i) { return i + ':' + e.id; }

    function refrescar() {
        var hechos = hechosHoy(), lista = listaHoy();
        document.querySelectorAll('.mirutina__go').forEach(function (b) {
            var i = parseInt(b.getAttribute('data-i'), 10), e = lista[i];
            var ok = e && hechos.indexOf(claveDe(e, i)) !== -1;
            b.classList.toggle('hecho', !!ok);
            b.innerHTML = ok ? '<i class="fas fa-check"></i><span>Hecho</span>' : '<i class="fas fa-play"></i><span>GO</span>';
            var fila = b.closest('.mirutina__fila'); if (fila) fila.classList.toggle('hecha', !!ok);
        });
    }

    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function fmt(seg) { var m = Math.floor(seg / 60), s = seg % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }

    // ---------- Pantalla de entrenamiento ----------
    function abrir(idx) {
        var lista = listaHoy(), ej = lista[idx];
        if (!ej) return;
        audio();                        // el toque del usuario habilita el sonido
        pantallaEncendida(true);

        var total = Math.max(1, parseInt(ej.series, 10) || 1);
        var desc = (window.segDescansoRutina ? window.segDescansoRutina(ej.descanso) : 60) || 60;
        var reps = String(ej.repeticiones || '').trim();
        var repsTxt = reps ? (/^[\d\-–\s]+$/.test(reps) ? reps + ' reps' : reps) : '';
        var ref = (window.ejercicioPorId && window.ejercicioPorId(ej.id)) || null;
        var img = ref ? (ref.poster || ref.imagen || '') : '';
        var vid = ref && ref.video ? ref.video : '';

        var ov = document.createElement('div');
        ov.className = 'go';
        var dots = ''; for (var i = 0; i < total; i++) dots += '<i class="go__dot"></i>';
        ov.innerHTML =
            '<div class="go__top"><button type="button" class="go__x" aria-label="Salir"><i class="fas fa-xmark"></i></button>' +
            '<div class="go__tit"><strong>' + esc(ej.nombre) + '</strong><small>' + esc(ej.series) + '×' + esc(ej.repeticiones) + ' · descanso ' + desc + 's</small></div></div>' +
            (vid ? '<div class="go__media"><video class="go__video" src="' + esc(vid) + '" poster="' + esc(img) + '" autoplay loop muted playsinline preload="auto"></video>' +
                   '<input class="go__seek" type="range" min="0" max="1000" value="0" aria-label="Adelantar o retroceder"></div>'
                 : (img ? '<img class="go__img" src="' + esc(img) + '" alt="">' : '')) +
            '<div class="go__dots">' + dots + '</div>' +
            '<div class="go__stage" data-fase="idle">' +
              '<svg class="go__ring" viewBox="0 0 120 120"><circle class="go__ring-bg" cx="60" cy="60" r="54"/><circle class="go__ring-fg" cx="60" cy="60" r="54"/></svg>' +
              '<div class="go__centro"><span class="go__label"></span><b class="go__num"></b><span class="go__sub"></span></div>' +
            '</div>' +
            (ej.nota ? '<p class="go__nota"><i class="fas fa-circle-info"></i> ' + esc(ej.nota) + '</p>' : '') +
            '<button type="button" class="go__btn"></button>';
        document.body.appendChild(ov);
        document.documentElement.style.overflow = 'hidden';

        var $ = function (c) { return ov.querySelector(c); };
        var stage = $('.go__stage'), label = $('.go__label'), num = $('.go__num'), sub = $('.go__sub'), btn = $('.go__btn');
        var fg = $('.go__ring-fg'), dotEls = ov.querySelectorAll('.go__dot');
        var CIRC = 2 * Math.PI * 54; fg.style.strokeDasharray = CIRC;
        // Video del ejercicio: bucle; tocar = pausa/reanuda; la barra permite adelantar/retroceder.
        var gv = $('.go__video'), gs = $('.go__seek'), arrastra = false;
        if (gv) {
            gv.addEventListener('click', function () { if (gv.paused) { var p = gv.play(); if (p && p.catch) p.catch(function () {}); } else gv.pause(); });
            gv.addEventListener('timeupdate', function () { if (!arrastra && gv.duration) gs.value = Math.round(gv.currentTime / gv.duration * 1000); });
            gs.addEventListener('pointerdown', function () { arrastra = true; });
            gs.addEventListener('input', function () { if (gv.duration) gv.currentTime = gs.value / 1000 * gv.duration; });
            var finArr = function () { arrastra = false; };
            gs.addEventListener('pointerup', finArr); gs.addEventListener('pointercancel', finArr); gs.addEventListener('change', finArr);
        }
        // Animación "salto" del número (cuenta regresiva)
        function pop(txt, ya) {
            num.textContent = txt;
            num.classList.remove('pop', 'pop--ya'); stage.classList.remove('tick');
            void num.offsetWidth;
            num.classList.add(ya ? 'pop--ya' : 'pop'); stage.classList.add('tick');
        }
        // Alarma de los últimos segundos del descanso: "ti-ti" que sube de tono + vibración
        function alarma(r) {
            var f = 760 + (5 - r) * 90;
            beep(f, 0.11, 0.5); setTimeout(function () { beep(f, 0.11, 0.5); }, 150);
            vib([90, 60, 90]);
        }

        var serie = 1, fase = 'idle', fin = 0, dur = 0, ini = 0, ultimo = -1, timer = null;

        function anillo(frac) { fg.style.strokeDashoffset = CIRC * (1 - Math.max(0, Math.min(1, frac))); }
        function setFase(f) { fase = f; stage.setAttribute('data-fase', f); ultimo = -1; num.classList.remove('pop', 'pop--ya'); if (f !== 'rest') stage.classList.remove('urgente'); }
        function paraTimer() { if (timer) { clearInterval(timer); timer = null; } }

        function pintaIdle() {
            setFase('idle'); paraTimer();
            label.textContent = 'Serie ' + serie + ' de ' + total;
            num.textContent = repsTxt || 'Listo'; sub.textContent = 'Toca para empezar'; anillo(1);
            btn.textContent = serie === 1 ? 'EMPEZAR EJERCICIO' : 'EMPEZAR SERIE ' + serie; btn.hidden = false;
        }
        function cuenta(seg, onTick, onFin) {
            paraTimer(); dur = seg * 1000; fin = Date.now() + dur; ultimo = -1;
            function tick() {
                var rest = Math.ceil((fin - Date.now()) / 1000);
                anillo((fin - Date.now()) / dur);
                if (rest !== ultimo) { ultimo = rest; if (rest > 0) onTick(rest); }
                if (rest <= 0) { paraTimer(); onFin(); }
            }
            tick(); timer = setInterval(tick, 150);
        }

        function prep() {
            setFase('prep'); btn.hidden = true;
            label.textContent = 'Prepárate'; sub.textContent = 'Acomódate bien';
            cuenta(PREP, function (r) {
                pop(r);
                beep(r <= 3 ? 660 + (3 - r) * 110 : 520, 0.16, 0.45); vib(r <= 3 ? 70 : 35);
            }, trabajo);
        }
        function trabajo() {
            setFase('work');
            stage.classList.remove('urgente');
            beep(1040, 0.35, 0.45); vib([180]);
            label.textContent = '¡Ya! · Serie ' + serie + ' de ' + total;
            sub.textContent = repsTxt ? repsTxt + ' · toca al terminar' : 'Toca al terminar';
            btn.textContent = 'TERMINÉ'; btn.hidden = false; anillo(1);
            ini = Date.now(); paraTimer();
            pop('¡YA!', true);
            function t() { if (Date.now() - ini < 1100) return; num.classList.remove('pop--ya'); num.textContent = fmt(Math.floor((Date.now() - ini) / 1000)); }
            t(); timer = setInterval(t, 250);
        }
        function serieHecha() {
            paraTimer();
            dotEls[serie - 1].classList.add('ok');
            beep(880, 0.12); vib(60);
            if (serie >= total) return completado();
            descanso();
        }
        function descanso() {
            setFase('rest'); btn.hidden = true;
            label.textContent = '¡Bien! Descanso'; sub.textContent = 'Respira y recupérate';
            stage.classList.remove('urgente');
            cuenta(desc, function (r) {
                if (r <= 5) { pop(r); stage.classList.add('urgente'); alarma(r); }
                else num.textContent = r;
                if (r <= 10) { label.textContent = 'Prepárate'; sub.textContent = r <= 5 ? 'Serie ' + (serie + 1) + ' en…' : 'Ya casi'; }
                if (r === 10) { beep(520, 0.18, 0.25); vib(60); }
            }, function () { serie++; trabajo(); });
        }
        function completado() {
            setFase('done'); paraTimer();
            beep(784, 0.15); setTimeout(function () { beep(988, 0.15); }, 160); setTimeout(function () { beep(1318, 0.3); }, 320); vib([80, 60, 80, 60, 200]);
            label.textContent = 'Completado'; num.innerHTML = '<i class="fas fa-check"></i>'; sub.textContent = ej.nombre; anillo(1);
            btn.textContent = 'LISTO'; btn.hidden = false;
            marcarHecho(claveDe(ej, idx)); refrescar();
        }
        function cerrar() {
            paraTimer(); pantallaEncendida(false); ov.remove();
            document.documentElement.style.overflow = '';
        }
        function finDelDia() {
            var hechos = hechosHoy(), l = listaHoy();
            return l.length > 0 && l.every(function (e, i) { return hechos.indexOf(claveDe(e, i)) !== -1; });
        }
        function felicitar() {
            ov.innerHTML = '<div class="go__fiesta"><div class="go__confeti">' + new Array(18).join('<i></i>') + '</div>' +
                '<span class="go__copa"><i class="fas fa-trophy"></i></span><h3>¡Felicidades!</h3>' +
                '<p>Completaste muy bien el día de hoy.<br>Ve a comer algo bien y descansa.</p>' +
                '<button type="button" class="go__btn go__btn--fin">CERRAR</button></div>';
            ov.querySelectorAll('.go__confeti i').forEach(function (c, i) {
                c.style.left = (4 + i * 5.5) + '%'; c.style.animationDelay = (i % 6) * 0.15 + 's';
                c.style.background = ['#ff2d87', '#22d3ee', '#22c55e', '#fbbf24'][i % 4];
            });
            beep(784, 0.15); setTimeout(function () { beep(1046, 0.2); }, 180); setTimeout(function () { beep(1318, 0.4); }, 380); vib([100, 80, 100, 80, 300]);
            ov.querySelector('.go__btn--fin').addEventListener('click', cerrar);
        }

        btn.addEventListener('click', function () {
            audio();
            if (fase === 'idle') prep();
            else if (fase === 'work') serieHecha();
            else if (fase === 'done') { if (finDelDia()) felicitar(); else cerrar(); }
        });
        // En la fase de trabajo, tocar cualquier parte de la cuenta también termina la serie
        stage.addEventListener('click', function () { if (fase === 'work') { audio(); serieHecha(); } });
        $('.go__x').addEventListener('click', function () {
            if (fase === 'idle' || fase === 'done' || confirm('¿Salir del ejercicio? Se pierde el avance de esta vez.')) cerrar();
        });

        pintaIdle();
    }

    window.RutinaGo = { abrir: abrir, refrescar: refrescar };
})();
