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

    // ---- Sección pública «Promos» (junto a Planes) ----
    function seccionPromosVisible(promo, vistaPrevia) {
        return !!(promo && promo.seccion && Array.isArray(promo.items) && promo.items.length &&
                  (promo.activa || vistaPrevia));
    }

    function tarjetaPromo(it, telefono) {
        var card = el('div', 'plan-card plan-card-promo' + (it.destacada ? ' plan-card-popular' : ''));
        card.appendChild(el('div', 'plan-card-glow plan-card-glow-tl'));
        card.appendChild(el('div', 'plan-card-glow plan-card-glow-br'));
        if (it.etiqueta) {
            var rib = el('div', 'plan-card-ribbon');
            rib.appendChild(el('span', '', it.etiqueta));
            card.appendChild(rib);
        }
        var head = el('div', 'plan-card-header');
        head.appendChild(el('h3', 'plan-card-nombre', it.nombre));
        if (it.precio) {
            var precio = el('div', 'plan-card-precio');
            if (it.precio_antes) precio.appendChild(el('span', 'plan-card-antes', it.precio_antes));
            precio.appendChild(el('span', 'plan-card-monto', it.precio));
            if (it.periodo) precio.appendChild(el('span', 'plan-card-periodo', it.periodo));
            head.appendChild(precio);
        }
        if (it.descripcion) head.appendChild(el('p', 'plan-card-desc', it.descripcion));
        card.appendChild(head);

        var ul = el('ul', 'plan-card-features');
        (it.beneficios || []).forEach(function (b) {
            var li = el('li');
            var chk = el('span', 'plan-card-check');
            chk.innerHTML = SVG_CHECK;
            li.appendChild(chk);
            li.appendChild(el('p', '', b));
            ul.appendChild(li);
        });
        card.appendChild(ul);

        if (it.vigencia) {
            var v = el('div', 'plan-card-vigencia');
            v.appendChild(el('i', 'fas fa-hourglass-half'));
            v.appendChild(el('span', '', it.vigencia));
            card.appendChild(v);
        }

        var a = el('a', 'plan-card-btn');
        a.target = '_blank';
        a.rel = 'noopener';
        var msg = 'Hola, quiero aprovechar la promoción: ' + it.nombre +
            (it.precio ? ' (' + it.precio + (it.periodo ? ' ' + it.periodo : '') + ')' : '') + '.';
        a.href = 'https://wa.me/' + String(telefono || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
        var sp = el('span', '', 'Aprovechar oferta');
        sp.insertAdjacentHTML('beforeend', ' ' + SVG_FLECHA);
        a.appendChild(sp);
        card.appendChild(a);
        return card;
    }

    function aplicarSeccionPromos(promo, telefono, vistaPrevia) {
        var sec = document.getElementById('promociones');
        var nav = document.getElementById('navPromos');
        var cont = document.getElementById('promosContenedor');
        var visible = seccionPromosVisible(promo, vistaPrevia);
        if (sec) sec.style.display = visible ? '' : 'none';
        if (nav) nav.style.display = visible ? '' : 'none';
        if (!cont) return false;
        cont.textContent = '';
        if (visible) promo.items.forEach(function (it) { cont.appendChild(tarjetaPromo(it, telefono)); });
        return visible;
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

    var promoTimers = [];
    function aplicarPromocion(promo, opciones) {
        opciones = opciones || {};
        promoTimers.forEach(clearTimeout); promoTimers = [];
        renderPromosPanel(promo && (promo.activa || opciones.vistaPrevia) ? Object.assign({}, promo, { activa: true }) : promo, window.__telPortal);
        var hayPromos = aplicarSeccionPromos(promo, window.__telPortal, !!opciones.vistaPrevia);
        var caja = document.getElementById('promoAlerta');
        if (!caja) return;
        var vistaPrevia = !!opciones.vistaPrevia;
        // En la vista previa se muestra aunque falte texto (con ejemplos), para poder diseñarla en vivo.
        var mostrar = promo && promo.activa && (promo.titulo || vistaPrevia);
        if (!mostrar) {
            caja.classList.remove('visible');
            caja.hidden = true;
            return;
        }
        var titulo = promo.titulo || 'Título de tu promoción';
        var texto = promo.texto || (promo.titulo ? '' : 'Aquí va el mensaje que verá el visitante.');
        var clave = 'promoVista:' + promo.titulo + '|' + promo.texto;
        var unaVez = promo.frecuencia !== 'siempre';
        if (!vistaPrevia && unaVez) {
            try { if (sessionStorage.getItem(clave)) return; } catch (e) {}
        }

        caja.className = 'promo-alerta promo-c-' + (promo.color || 'rosa') + (promo.posicion === 'esquina' ? ' promo-alerta--esquina' : '');
        document.getElementById('promoAlertaTitulo').textContent = titulo;
        document.getElementById('promoAlertaTexto').textContent = texto;
        document.getElementById('promoAlertaVigencia').textContent = promo.vigencia || (vistaPrevia && !promo.titulo ? 'Vigencia de la promoción' : '');
        caja.querySelector('.promo-alerta__badge').textContent = promo.etiqueta || 'PROMOCIÓN';

        var btn = document.getElementById('promoAlertaBtn');
        var accion = promo.boton_accion || 'planes';
        btn.textContent = promo.boton_texto || (accion === 'promos' ? 'Ver promociones' : 'Ver planes');
        btn.style.display = accion === 'ninguno' && !promo.boton_texto ? 'none' : '';
        if (accion === 'whatsapp' && window.__telPortal) {
            btn.href = 'https://wa.me/' + String(window.__telPortal).replace(/\D/g, '');
            btn.target = '_blank'; btn.rel = 'noopener';
        } else {
            btn.href = accion === 'promos' ? (hayPromos ? '#promociones' : '#planes') : (accion === 'planes' ? '#planes' : '#');
            btn.removeAttribute('target');
        }

        var barra = caja.querySelector('.promo-alerta__barra');
        if (!barra) {
            barra = document.createElement('div');
            barra.className = 'promo-alerta__barra';
            barra.appendChild(document.createElement('i'));
            caja.querySelector('.promo-alerta__caja').appendChild(barra);
        }
        var seg = parseInt(promo.cierre_auto, 10) || 0;
        barra.style.display = seg ? '' : 'none';

        function cerrar() {
            promoTimers.forEach(clearTimeout); promoTimers = [];
            caja.classList.remove('visible');
            promoTimers.push(setTimeout(function () { caja.hidden = true; }, 350));
            if (!vistaPrevia && unaVez) {
                try { sessionStorage.setItem(clave, '1'); } catch (e) {}
            }
        }
        document.getElementById('promoAlertaCerrar').onclick = cerrar;
        btn.onclick = function (e) { if (accion === 'ninguno') e.preventDefault(); cerrar(); };
        caja.onclick = function (e) { if (e.target === caja && promo.posicion !== 'esquina') cerrar(); };

        function abrir() {
            caja.hidden = false;
            var fill = barra.firstChild;
            if (seg) { fill.style.transition = 'none'; fill.style.transform = 'scaleX(1)'; }
            requestAnimationFrame(function () {
                caja.classList.add('visible');
                if (seg) {
                    requestAnimationFrame(function () {
                        fill.style.transition = 'transform ' + seg + 's linear';
                        fill.style.transform = 'scaleX(0)';
                    });
                }
            });
            if (seg) promoTimers.push(setTimeout(cerrar, seg * 1000));
        }
        // Visita real: espera la intro (~3 s) + el retraso elegido. Vista previa: casi inmediata.
        var retraso = vistaPrevia ? (opciones.repetir ? 150 : 400) : 3200 + (parseInt(promo.retraso, 10) || 0) * 1000;
        promoTimers.push(setTimeout(abrir, retraso));
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
            aplicar(cont, { vistaPrevia: true, repetir: !!e.data.replay });
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
