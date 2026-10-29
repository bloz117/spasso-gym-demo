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
    // Campanita de "¡empieza!": parciales agudos con caída larga; suena distinta a cualquier pitido
    function campana() {
        var ac = audio(); if (!ac) return;
        try {
            var t = ac.currentTime;
            [[1568, 0.55], [2349, 0.3], [3136, 0.2], [4186, 0.1]].forEach(function (p) {
                var o = ac.createOscillator(), g = ac.createGain();
                o.type = 'sine'; o.frequency.value = p[0];
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(p[1], t + 0.008);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
                o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 1.7);
            });
        } catch (e) {}
    }

    // ---------- Voz guía (masculina o femenina según la cuenta) ----------
    var VOZ_F = /sabina|helena|elvira|paulina|monica|mónica|laura|elena|lucia|lucía|marisol|dalia|camila|female|mujer|google espa/i;
    var VOZ_M = /pablo|raul|raúl|jorge|diego|alvaro|álvaro|enrique|carlos|juan|male|hombre/i;
    var vozElegida = null, vozGenero = null;
    function generoCuenta() {
        try {
            var u = JSON.parse(localStorage.getItem('currentUser') || 'null');
            return u && u.genero === 'femenino' ? 'f' : 'm';
        } catch (e) { return 'm'; }
    }
    function elegirVoz() {
        var g = generoCuenta();
        if (vozElegida && vozGenero === g) return vozElegida;
        var vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
        var es = vs.filter(function (v) { return /^es(-|_|$)/i.test(v.lang); });
        var pref = es.filter(function (v) { return (g === 'f' ? VOZ_F : VOZ_M).test(v.name); });
        var noOpuesta = es.filter(function (v) { return !(g === 'f' ? VOZ_M : VOZ_F).test(v.name); });
        vozElegida = pref[0] || noOpuesta[0] || es[0] || null; vozGenero = g;
        return vozElegida;
    }
    if (window.speechSynthesis) { try { speechSynthesis.onvoiceschanged = function () { vozElegida = null; }; } catch (e) {} }
    // Frases grabadas (voz de hombre / de mujer según la cuenta). Si no cargan, se usa la voz del celular.
    var FRASES = { diez: 'Ya falta diez', prepara: 'Prepárate, ya casi', tres: 'Tres', dos: 'Dos', uno: 'Uno', empieza: 'Empieza' };
    var bufVoz = {}, bufGenero = null, vozSrc = null, elVoz = {}, elGenero = null;
    // Respaldo principal: elementos <audio> (suenan aunque el celular esté en silencio y en cualquier navegador).
    // Se "desbloquean" una vez con el toque del usuario (reproducir en mudo y pausar).
    function prepararElementos() {
        var g = generoCuenta();
        if (elGenero === g && Object.keys(elVoz).length) return;
        elVoz = {}; elGenero = g;
        Object.keys(FRASES).forEach(function (k) {
            try {
                var a = new Audio('audio/voz/' + (g === 'f' ? 'mujer' : 'hombre') + '/' + k + '.mp3?v=3');
                a.preload = 'auto'; a.volume = 1; a.muted = true;
                var pr = a.play();
                var listo = function () { try { a.pause(); a.currentTime = 0; a.muted = false; } catch (e) {} };
                if (pr && pr.then) pr.then(listo, function () { a.muted = false; }); else listo();
                elVoz[k] = a;
            } catch (e) {}
        });
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    }
    function cargarVoz() {
        var ac = audio(), g = generoCuenta();
        if (!ac || (bufGenero === g && Object.keys(bufVoz).length)) return;
        bufVoz = {}; bufGenero = g;
        Object.keys(FRASES).forEach(function (k) {
            try {
                fetch('audio/voz/' + (g === 'f' ? 'mujer' : 'hombre') + '/' + k + '.mp3?v=3')
                    .then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
                    .then(function (ab) { return new Promise(function (ok, no) { ac.decodeAudioData(ab, ok, no); }); })
                    .then(function (buf) { if (bufGenero === g) bufVoz[k] = buf; })
                    .catch(function () {});
            } catch (e) {}
        });
    }
    function decirTTS(txt) {
        try {
            if (!window.speechSynthesis) return;
            var u = new SpeechSynthesisUtterance(txt), v = elegirVoz(), g = generoCuenta();
            u.lang = 'es-ES'; if (v) { u.voice = v; u.lang = v.lang; }
            u.volume = 1; u.rate = 1.05;
            var propia = v && (g === 'f' ? VOZ_F : VOZ_M).test(v.name);
            u.pitch = propia ? 1 : (g === 'f' ? 1.3 : 0.7);
            speechSynthesis.cancel(); speechSynthesis.speak(u);
        } catch (e) {}
    }
    // Preferencia del socio: con voz o sin voz (se guarda en este celular)
    var KEY_VOZ = 'spassoVozGo';
    function vozActiva() { try { return localStorage.getItem(KEY_VOZ) !== '0'; } catch (e) { return true; } }
    function fijarVoz(on) { try { localStorage.setItem(KEY_VOZ, on ? '1' : '0'); } catch (e) {} if (!on) callarVoz(); }
    var htmlAud = null;
    function vozArchivo(clave) {   // respaldo si WebAudio no pudo cargar la frase
        try {
            if (htmlAud) { htmlAud.pause(); }
            htmlAud = new Audio('audio/voz/' + (generoCuenta() === 'f' ? 'mujer' : 'hombre') + '/' + clave + '.mp3?v=3');
            htmlAud.volume = 1;
            var p = htmlAud.play();
            if (p && p.catch) p.catch(function () { decirTTS(FRASES[clave]); });
        } catch (e) { decirTTS(FRASES[clave]); }
    }
    function voz(clave, forzar) {
        if (!forzar && !vozActiva()) return;
        var el = elVoz[clave];
        if (el) {
            try {
                Object.keys(elVoz).forEach(function (k) { if (k !== clave) { try { elVoz[k].pause(); } catch (e) {} } });
                el.muted = false; el.currentTime = 0;
                var pr = el.play();
                if (pr && pr.catch) pr.catch(function () { vozWebAudio(clave); });
                return;
            } catch (e) {}
        }
        vozWebAudio(clave);
    }
    function vozWebAudio(clave) {
        var ac = audio(), buf = bufVoz[clave];
        if (ac && buf) {
            try {
                if (vozSrc) { try { vozSrc.stop(); } catch (e) {} }
                var src = ac.createBufferSource(), g = ac.createGain();
                src.buffer = buf; g.gain.value = 1.4;
                src.connect(g); g.connect(ac.destination); src.start(0); vozSrc = src;
                return;
            } catch (e) {}
        }
        vozArchivo(clave);
    }
    function calentarVoz() { cargarVoz(); prepararElementos(); try { if (window.speechSynthesis) { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); elegirVoz(); } } catch (e) {} }
    function callarVoz() {
        try { if (vozSrc) { vozSrc.stop(); vozSrc = null; } } catch (e) {}
        try { if (htmlAud) htmlAud.pause(); } catch (e) {}
        try { Object.keys(elVoz).forEach(function (k) { elVoz[k].pause(); }); } catch (e) {}
        try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    }
    var NUM_VOZ = { 1: 'uno', 2: 'dos', 3: 'tres' };
    function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
    var wake = null;
    function pantallaEncendida(on) {
        try {
            if (on && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {});
            else if (!on && wake) { wake.release(); wake = null; }
        } catch (e) {}
    }

    // ---------- Ejercicios hechos (solo en este celular; se guardan los últimos días para poder consultarlos) ----------
    function fechaStr(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function hoyFecha() { return fechaStr(new Date()); }
    var mem = {};   // respaldo si el navegador no deja usar localStorage
    function leer() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return mem; } }
    function hechosDe(f) { var a = leer()[f]; return Array.isArray(a) ? a : []; }
    function hechosHoy() { return hechosDe(hoyFecha()); }
    function marcarHecho(k, f) {
        f = f || hoyFecha();
        var o = leer(), cur = hechosDe(f).slice(), lim = Date.now() - 21 * 86400000;
        if (cur.indexOf(k) === -1) cur.push(k);
        o[f] = cur;
        Object.keys(o).forEach(function (x) {              // se conservan ~3 semanas
            var p = x.split('-'), t = new Date(+p[0], +p[1] - 1, +p[2]).getTime();
            if (!isNaN(t) && t < lim) delete o[x];
        });
        mem = o;
        try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    }
    function indiceHoy() { return (new Date().getDay() + 6) % 7; }
    function listaDe(dia) {
        var r = window.__rutinaSocio; if (!r) return [];
        var d = (r.dias || []).filter(function (x) { return x.dia === dia; })[0];
        return (d && d.ejercicios) || [];
    }
    function listaHoy() { return listaDe(DIAS[indiceHoy()]); }
    // Fecha (de esta semana) que corresponde a un día de la rutina
    function fechaDelDia(dia) {
        var d = new Date(); d.setDate(d.getDate() + (DIAS.indexOf(dia) - indiceHoy()));
        return d;
    }
    // La marca de "hecho" se guarda por EJERCICIO (id + nº de repetición del mismo ejercicio en el día),
    // ya no por posición: así quitar, añadir o reordenar ejercicios al editar la rutina NO borra el avance.
    function claveDe(e, i, lista) {
        var l = lista || listaHoy(), n = 0;
        for (var k = 0; k <= i && k < l.length; k++) if (l[k] && l[k].id === e.id) n++;
        return e.id + '#' + (n || 1);
    }
    // Compatibilidad: marcas guardadas con el formato anterior (posición:id) se siguen reconociendo y se migran.
    function estaHecho(e, i, hechos, lista, fecha) {
        if (!e) return false;
        if (hechos.indexOf(claveDe(e, i, lista)) !== -1) return true;
        if (hechos.indexOf(i + ':' + e.id) !== -1) { marcarHecho(claveDe(e, i, lista), fecha); return true; }
        return false;
    }

    function refrescar() {
        var hechos = hechosHoy(), lista = listaHoy();
        document.querySelectorAll('.mirutina__go').forEach(function (b) {
            var i = parseInt(b.getAttribute('data-i'), 10), e = lista[i];
            var ok = estaHecho(e, i, hechos, lista);
            b.classList.toggle('hecho', !!ok);
            b.innerHTML = ok ? '<i class="fas fa-check"></i><span>Hecho</span>' : '<i class="fas fa-play"></i><span>GO</span>';
            var fila = b.closest('.mirutina__fila'); if (fila) fila.classList.toggle('hecha', !!ok);
        });
        // Otros días (solo lectura): los pasados muestran si se hicieron o no; los futuros quedan sin estado.
        var hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
        document.querySelectorAll('.mirutina__est').forEach(function (b) {
            var dia = b.getAttribute('data-dia'), i = parseInt(b.getAttribute('data-i'), 10);
            var l = listaDe(dia), e = l[i], f = fechaDelDia(dia); f.setHours(0, 0, 0, 0);
            var fila = b.closest('.mirutina__fila');
            if (!e) { b.innerHTML = ''; b.className = 'mirutina__est'; if (fila) fila.classList.remove('hecha'); return; }
            if (f.getTime() >= hoy0.getTime()) { b.className = 'mirutina__est pend'; b.innerHTML = '<i class="fas fa-clock"></i><span>Pendiente</span>'; if (fila) fila.classList.remove('hecha'); return; }
            var ok = estaHecho(e, i, hechosDe(fechaStr(f)), l, fechaStr(f));
            b.className = 'mirutina__est ' + (ok ? 'ok' : 'no');
            b.innerHTML = ok ? '<i class="fas fa-check"></i><span>Hecho</span>' : '<i class="fas fa-minus"></i><span>Sin hacer</span>';
            if (fila) fila.classList.toggle('hecha', !!ok);
        });
    }

    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function fmt(seg) { var m = Math.floor(seg / 60), s = seg % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }

    // ---------- Pantalla de entrenamiento ----------
    function abrir(idx) {
        var lista = listaHoy(), ej = lista[idx];
        if (!ej) return;
        audio(); calentarVoz();         // el toque del usuario habilita el sonido y la voz
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
        // La voz dice el número (10, 5, 3, 2, 1) y un tic suave marca el 4; la campanita queda solo para empezar.
        function alarma(r) {
            if (vozActiva()) {
                if (r === 5) voz('prepara');
                else if (r <= 3) voz(NUM_VOZ[r]);
                else beep(700, 0.08, 0.3);
            } else {
                var f = 760 + (5 - r) * 90;
                beep(f, 0.11, 0.5); setTimeout(function () { beep(f, 0.11, 0.5); }, 150);
            }
            vib(r <= 3 ? [90, 60, 90] : 60);
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
                if (r <= 3 && vozActiva()) voz(NUM_VOZ[r]); else beep(r <= 3 ? 660 + (3 - r) * 110 : 520, 0.16, 0.4);
                vib(r <= 3 ? 70 : 35);
            }, trabajo);
        }
        function trabajo() {
            setFase('work');
            stage.classList.remove('urgente');
            callarVoz(); campana(); setTimeout(function () { voz('empieza'); }, 250); vib([180]);
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
                if (r === 10) { if (vozActiva()) voz('diez'); else beep(520, 0.18, 0.25); vib(60); }
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
            paraTimer(); callarVoz(); pantallaEncendida(false); ov.remove();
            document.documentElement.style.overflow = '';
        }
        function finDelDia() {
            var hechos = hechosHoy(), l = listaHoy();
            return l.length > 0 && l.every(function (e, i) { return estaHecho(e, i, hechos); });
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

    // Botón "Voz" de Mi rutina (arriba de los ejercicios): activa o desactiva la voz guía
    function pintarBotonVoz(b) {
        var on = vozActiva();
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.innerHTML = '<i class="fas ' + (on ? 'fa-volume-high' : 'fa-volume-xmark') + '"></i><span>' + (on ? 'Con voz' : 'Sin voz') + '</span>';
    }
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.mirutina__voz'); if (!b) return;
        var on = !vozActiva(); fijarVoz(on);
        document.querySelectorAll('.mirutina__voz').forEach(pintarBotonVoz);
        if (on) {
            audio(); calentarVoz(); setTimeout(function () { voz('prepara', true); }, 350);   // prueba al activar
            setTimeout(function () {   // aviso con el estado real, para saber si el celular dejó sonar el audio
                var listos = Object.keys(elVoz).filter(function (k) { return elVoz[k].readyState >= 2; }).length;
                var msg = listos ? 'Voz activada. Si no la oyes, sube el volumen multimedia del celular.' : 'No se pudieron cargar los audios de voz. Revisa tu conexión y recarga.';
                var t = document.createElement('div'); t.className = 'mirutina__voz-aviso'; t.textContent = msg;
                document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4200);
            }, 1200);
        }
    });
    window.RutinaGo = { vozActiva: vozActiva, pintarBotonVoz: pintarBotonVoz, abrir: abrir, refrescar: refrescar, claveDe: claveDe, marcarHecho: marcarHecho };
})();
