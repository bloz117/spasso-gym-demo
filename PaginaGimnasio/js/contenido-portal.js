/* Contenido editable del portal (lo define Recepción > Configuración >
   Página Web): planes, texto de bienvenida, contacto, horario y alerta de
   promoción. Si no hay conexión con el servidor, se queda el contenido
   que ya trae la página. */
(function () {
    'use strict';

    function baseApi() {
        var h = location.hostname;
        if (h && h !== 'localhost' && h !== '127.0.0.1' && location.protocol.indexOf('http') === 0) {
            return location.origin;
        }
        return (typeof PORTAL_API !== 'undefined' && PORTAL_API.BASE_URL) || 'http://127.0.0.1:7000';
    }

    function el(tag, clase, texto) {
        var n = document.createElement(tag);
        if (clase) n.className = clase;
        if (texto !== undefined) n.textContent = texto;
        return n;
    }

    function setTextoConSaltos(nodo, texto) {
        nodo.textContent = '';
        String(texto || '').split('\n').forEach(function (linea, i) {
            if (i) nodo.appendChild(document.createElement('br'));
            nodo.appendChild(document.createTextNode(linea));
        });
    }

    var SVG_CHECK = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path></svg>';
    var SVG_FLECHA = '<svg viewBox="0 0 24 24" fill="none"><path d="M17 8l4 4m0 0l-4 4m4-4H3" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path></svg>';

    function tarjetaPlan(plan, telefono) {
        var card = el('div', 'plan-card' + (plan.popular ? ' plan-card-popular' : ''));
        card.appendChild(el('div', 'plan-card-glow plan-card-glow-tl'));
        card.appendChild(el('div', 'plan-card-glow plan-card-glow-br'));
        if (plan.popular) {
            var rib = el('div', 'plan-card-ribbon');
            rib.appendChild(el('span', '', 'MÁS POPULAR'));
            card.appendChild(rib);
        }
        var head = el('div', 'plan-card-header');
        head.appendChild(el('h3', 'plan-card-nombre', plan.nombre));
        var precio = el('div', 'plan-card-precio');
        precio.appendChild(el('span', 'plan-card-monto', plan.precio));
        precio.appendChild(el('span', 'plan-card-periodo', plan.periodo));
        head.appendChild(precio);
        head.appendChild(el('p', 'plan-card-desc', plan.descripcion));
        card.appendChild(head);

        var ul = el('ul', 'plan-card-features');
        (plan.beneficios || []).forEach(function (b) {
            var li = el('li');
            var chk = el('span', 'plan-card-check');
            chk.innerHTML = SVG_CHECK;
            li.appendChild(chk);
            li.appendChild(el('p', '', b));
            ul.appendChild(li);
        });
        card.appendChild(ul);

        var a = el('a', 'plan-card-btn');
        a.target = '_blank';
        a.rel = 'noopener';
        var msg = 'Hola, quiero registrarme en el plan ' + plan.nombre +
            (plan.precio ? ' (' + plan.precio + ' ' + plan.periodo + ')' : '') + '.';
        a.href = 'https://wa.me/' + String(telefono || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
        var sp = el('span', '', 'Registrarme');
        sp.insertAdjacentHTML('beforeend', ' ' + SVG_FLECHA);
        a.appendChild(sp);
        card.appendChild(a);
        return card;
    }

    function aplicarPlanes(planes, telefono) {
        var cont = document.getElementById('planesContenedor');
        if (!cont || !Array.isArray(planes) || !planes.length) return;
        cont.textContent = '';
        planes.forEach(function (p) { cont.appendChild(tarjetaPlan(p, telefono)); });
    }

    // opciones.vistaPrevia: la usa el editor de Recepción (iframe): muestra la
    // alerta al instante y sin recordar que ya se vio.
    // Panel "Promociones" del perfil del socio (detallado).
    function renderPromosPanel(promo, telefono) {
        var cont = document.getElementById('promosPanel');
        if (!cont) return;
        cont.textContent = '';
        if (!promo || !promo.titulo || !promo.activa) {
            var vacio = el('div', 'promos-vacio');
            vacio.appendChild(el('i', 'fas fa-tags'));
            vacio.appendChild(el('h4', '', 'Sin promociones por ahora'));
            vacio.appendChild(el('p', '', 'Cuando el gimnasio publique una oferta, la verás aquí.'));
            cont.appendChild(vacio);
            return;
        }
        var card = el('article', 'promo-hero');
        card.appendChild(el('span', 'promo-hero__badge', 'PROMOCIÓN ACTIVA'));
        var ico = el('div', 'promo-hero__ico');
        ico.appendChild(el('i', 'fas fa-gift'));
        card.appendChild(ico);
        card.appendChild(el('h4', 'promo-hero__titulo', promo.titulo));
        if (promo.texto) {
            var p = el('p', 'promo-hero__texto');
            setTextoRico(p, promo.texto);
            card.appendChild(p);
        }
        if (promo.vigencia) {
            var v = el('div', 'promo-hero__vigencia');
            v.appendChild(el('i', 'fas fa-calendar-check'));
            v.appendChild(el('span', '', promo.vigencia));
            card.appendChild(v);
        }
        var tel = String(telefono || '').replace(/\D/g, '');
        if (tel) {
            var a = el('a', 'promo-hero__btn', 'Consultar por WhatsApp');
            a.href = 'https://wa.me/' + tel + '?text=' + encodeURIComponent('Hola, quiero aprovechar la promoción: ' + promo.titulo);
            a.target = '_blank';
            a.rel = 'noopener';
            card.appendChild(a);
        }
        cont.appendChild(card);
    }
    window.renderPromosPanel = renderPromosPanel;

    function aplicarPromocion(promo, opciones) {
        opciones = opciones || {};
        renderPromosPanel(promo && (promo.activa || opciones.vistaPrevia) ? Object.assign({}, promo, { activa: true }) : promo, window.__telPortal);
        var caja = document.getElementById('promoAlerta');
        if (!caja) return;
        var mostrar = promo && promo.titulo && (promo.activa || opciones.vistaPrevia);
        if (!mostrar) {
            caja.classList.remove('visible');
            caja.hidden = true;
            return;
        }
        var clave = 'promoVista:' + promo.titulo + '|' + promo.texto;
        if (!opciones.vistaPrevia) {
            try { if (sessionStorage.getItem(clave)) return; } catch (e) {}
        }

        document.getElementById('promoAlertaTitulo').textContent = promo.titulo;
        document.getElementById('promoAlertaTexto').textContent = promo.texto || '';
        document.getElementById('promoAlertaVigencia').textContent = promo.vigencia || '';

        function cerrar() {
            caja.classList.remove('visible');
            setTimeout(function () { caja.hidden = true; }, 300);
            if (!opciones.vistaPrevia) {
                try { sessionStorage.setItem(clave, '1'); } catch (e) {}
            }
        }
        document.getElementById('promoAlertaCerrar').onclick = cerrar;
        document.getElementById('promoAlertaBtn').onclick = cerrar;
        caja.onclick = function (e) { if (e.target === caja) cerrar(); };

        function abrir() {
            caja.hidden = false;
            requestAnimationFrame(function () { caja.classList.add('visible'); });
        }
        // Espera a que termine la intro de bienvenida (~3 s) en la visita real.
        if (opciones.vistaPrevia) abrir(); else setTimeout(abrir, 3200);
    }

    // **negrita** -> <strong>, sin permitir HTML
    function setTextoRico(nodo, texto) {
        nodo.textContent = '';
        String(texto || '').split('\n').forEach(function (linea, i) {
            if (i) nodo.appendChild(document.createElement('br'));
            String(linea).split('**').forEach(function (trozo, j) {
                if (!trozo) return;
                if (j % 2) nodo.appendChild(el('strong', '', trozo));
                else nodo.appendChild(document.createTextNode(trozo));
            });
        });
    }

    function aplicarSecciones(c) {
        var nav = c.nav || {}, tit = c.titulos || {};
        Object.keys(nav).forEach(function (k) {
            var a = document.querySelector('[data-nav="' + k + '"]');
            if (a && nav[k]) a.textContent = nav[k];
        });
        Object.keys(tit).forEach(function (k) {
            var n = document.querySelector('[data-tit="' + k + '"]');
            if (n && tit[k]) n.textContent = tit[k];
        });
        var boton = document.getElementById('heroBoton');
        if (boton && c.textos && c.textos.boton_hero) boton.textContent = c.textos.boton_hero;

        (c.beneficios || []).forEach(function (b, i) {
            var card = document.querySelector('.benefit-card[data-benef="' + i + '"]');
            if (!card) return;
            var h3 = card.querySelector('h3');
            var p = card.querySelector(':scope > p');
            if (h3 && b.titulo) setTextoConSaltos(h3, b.titulo);
            if (p && b.texto) setTextoRico(p, b.texto);
        });
    }

    function aplicarImagenes(img) {
        if (!img) return;
        (img.beneficios || []).forEach(function (par, i) {
            var card = document.querySelector('.benefit-card[data-benef="' + i + '"]');
            if (!card) return;
            var a = card.querySelector('.crossfade-layer--a');
            var b = card.querySelector('.crossfade-layer--b');
            if (a && par[0]) a.style.backgroundImage = "url('img/" + par[0] + "')";
            if (b && par[1]) b.style.backgroundImage = "url('img/" + par[1] + "')";
        });
        var fotos = document.querySelectorAll('#gymCard3d img');
        (img.gimnasio || []).forEach(function (f, i) {
            if (fotos[i] && f) fotos[i].src = 'img/' + f;
        });
    }

    function aplicar(c, opciones) {
        if (!c) return;
        var t = c.textos || {}, k = c.contacto || {};
        if (t.titulo) setTextoConSaltos(document.getElementById('heroTitulo'), t.titulo);
        if (t.subtitulo) document.getElementById('heroSubtitulo').textContent = t.subtitulo;

        if (k.ciudad) document.getElementById('contactoCiudad').textContent = k.ciudad;
        if (k.direccion) setTextoConSaltos(document.getElementById('contactoDireccion'), k.direccion);
        if (k.telefono) document.getElementById('contactoTelefono').textContent = k.telefono;
        if (k.correo) document.getElementById('contactoCorreo').textContent = k.correo;
        document.querySelectorAll('.js-horario').forEach(function (p) {
            p.textContent = '';
            var s1 = el('strong', '', 'Lunes a Viernes:');
            p.appendChild(s1);
            p.appendChild(document.createTextNode(' ' + (k.horario_semana || '')));
            p.appendChild(document.createElement('br'));
            p.appendChild(el('strong', '', 'Sábado y Domingo:'));
            p.appendChild(document.createTextNode(' ' + (k.horario_finde || '')));
        });
        if (k.telefono) {
            document.querySelectorAll('a.social-icon.whatsapp').forEach(function (a) {
                a.href = 'https://wa.me/' + String(k.telefono).replace(/\D/g, '');
            });
        }

        aplicarSecciones(c);
        aplicarImagenes(c.imagenes);
        aplicarPlanes(c.planes, k.telefono);
        window.__telPortal = k.telefono || '';
        aplicarPromocion(c.promocion, opciones);
    }

    // Vista previa en vivo desde el editor de Recepción (mismo origen, iframe).
    window.addEventListener('message', function (e) {
        if (e.origin !== location.origin || !e.data) return;
        if (e.data.tipo === 'portal-preview') {
            var cont = e.data.contenido || {};
            if (!e.data.promoVisible) cont = Object.assign({}, cont, { promocion: { activa: false } });
            aplicar(cont, { vistaPrevia: true });
            if (Array.isArray(e.data.hero) && e.data.hero.length && typeof window.__establecerImagenesHero === 'function') {
                window.__establecerImagenesHero(e.data.hero.map(function (f) { return 'img/' + f; }));
            }
        } else if (e.data.tipo === 'portal-ir-a') {
            var modalUbi = document.getElementById('ubicacionModal');
            var cerrarUbi = document.querySelector('#ubicacionModal .pagina-ubicacion-cerrar');
            if (e.data.id === 'contacto') {
                var nav = document.getElementById('navUbicacionContacto');
                if (nav) nav.click();
            } else {
                if (cerrarUbi && modalUbi && getComputedStyle(modalUbi).visibility !== 'hidden' && getComputedStyle(modalUbi).opacity !== '0') cerrarUbi.click();
                var s = document.getElementById(e.data.id);
                if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        renderPromosPanel(null);
        fetch(baseApi() + '/api/cms/contenido', { mode: 'cors' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (c) { aplicar(c); })
            .catch(function () { /* sin servidor: queda el contenido de la página */ });
    });
})();
