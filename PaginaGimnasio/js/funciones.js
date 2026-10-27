document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentUser = null;
    const adminCredentials = {
        email: 'admin@spasso.cl',
        password: 'admin123'
    };
    
    // Credenciales de recepcionistas
    const receptionCredentials = [
        {
            email: 'recepcion1@spasso.cl',
            password: 'recepcion1',
            name: 'Recepcionista Mañana',
            shift: 'morning'
        },
        {
            email: 'recepcion2@spasso.cl',
            password: 'recepcion2',
            name: 'Recepcionista Tarde',
            shift: 'afternoon'
        }
    ];
    
    // Datos de ejemplo para usuarios
    const sampleUsers = [
        // Dueño
        {
            name: 'Dueño Spasso',
            email: 'dueno@spasso.cl',
            phone: '73415902',
            password: 'admin123',
            role: 'owner',
            status: 'active'
        },
        // Recepcionista mañana
        {
            name: 'Recepcionista Mañana',
            email: 'recepcion1@spasso.cl',
            phone: '73415902',
            password: 'recepcion1',
            role: 'reception',
            status: 'active',
            shift: 'morning'
        },
        // Recepcionista tarde
        {
            name: 'Recepcionista Tarde',
            email: 'recepcion2@spasso.cl',
            phone: '73415902',
            password: 'recepcion2',
            role: 'reception',
            status: 'active',
            shift: 'afternoon'
        },
        // Usuario normal
        {
            name: 'Juan Pérez',
            email: 'juan@email.com',
            phone: '+56 9 8765 4321',
            password: 'juan123',
            role: 'user',
            status: 'active',
            membership: {
                plan: 'Estándar',
                startDate: '2023-06-01',
                endDate: '2023-06-30'
            }
        }
    ];
    
    // Pinta el botón de sesión del header (ícono + texto + color) según
    // haya alguien logueado o no. Los 2 íconos (usuario/logout) ya están
    // en el DOM -ver index.html-, así que acá solo se alterna cuál se
    // muestra en vez de reescribir el SVG a mano cada vez. Se expone en
    // window porque portal-client.js (que carga después, para el login
    // real contra el backend) también la usa para actualizar el mismo
    // botón cuando la sesión viene de ahí en vez de currentUser.
    window.actualizarBotonSesion = function (logueado, nombre) {
        const boton = document.getElementById('loginBtn');
        const textoSpan = document.getElementById('loginBtnText');
        if (!boton || !textoSpan) return;
        const iconoUser = boton.querySelector('.icon-user');
        const iconoLogout = boton.querySelector('.icon-logout');
        const perfilLink = document.getElementById('headerProfileLink');

        if (logueado) {
            boton.classList.add('session-btn--logout');
            textoSpan.textContent = 'Cerrar Sesión';
            if (iconoUser) iconoUser.setAttribute('hidden', '');
            if (iconoLogout) iconoLogout.removeAttribute('hidden');
            if (perfilLink) {
                perfilLink.removeAttribute('hidden');
                perfilLink.textContent = nombre ? `Hola, ${nombre.split(' ')[0]}` : 'Mi Perfil';
            }
        } else {
            boton.classList.remove('session-btn--logout');
            textoSpan.textContent = 'Iniciar Sesión';
            if (iconoUser) iconoUser.removeAttribute('hidden');
            if (iconoLogout) iconoLogout.setAttribute('hidden', '');
            if (perfilLink) perfilLink.setAttribute('hidden', '');
        }
    };

    // Elementos del DOM
    const loginBtn = document.getElementById('loginBtn');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const profileModal = document.getElementById('profileModal');
    const adminModal = document.getElementById('adminModal');
    const receptionModal = document.getElementById('receptionModal');
    const ubicacionModal = document.getElementById('ubicacionModal');
    const navUbicacionContacto = document.getElementById('navUbicacionContacto');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const closeModals = document.querySelectorAll('.close-modal');
    const editContentBtn = document.getElementById('editContentBtn');
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    const manageUsersBtn = document.getElementById('manageUsersBtn');
    const manageMembershipsBtn = document.getElementById('manageMembershipsBtn');
    const adminControls = document.getElementById('adminControls');
    const receptionControls = document.getElementById('receptionControls');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const levelBtns = document.querySelectorAll('.level-btn');
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const adminLoginCheckbox = document.getElementById('adminLogin');
    const receptionLoginCheckbox = document.getElementById('receptionLogin');
    const userSearch = document.getElementById('userSearch');
    const searchUserBtn = document.getElementById('searchUserBtn');
    const usersList = document.getElementById('usersList');
    const notification = document.getElementById('notification');
    const membershipsList = document.getElementById('membershipsList');
    const membershipSearch = document.getElementById('membershipSearch');
    const searchMembershipBtn = document.getElementById('searchMembershipBtn');
    const whatsappPopup = document.getElementById('whatsappPopup');
    const whatsappMessage = document.getElementById('whatsappMessage');
    const whatsappLink = document.getElementById('whatsappLink');
    const closeWhatsapp = document.getElementById('closeWhatsapp');
    const registerGymIncomeBtn = document.getElementById('registerGymIncomeBtn');
    const registerSaunaIncomeBtn = document.getElementById('registerSaunaIncomeBtn');
    const registerPoolIncomeBtn = document.getElementById('registerPoolIncomeBtn');
    const viewTodayClientsBtn = document.getElementById('viewTodayClientsBtn');
    const receptionShiftSelect = document.getElementById('receptionShiftSelect');
    const receptionistName = document.getElementById('receptionistName');
    const shiftSelect = document.getElementById('shiftSelect');
    const receptionistNameInput = document.getElementById('receptionistNameInput');
    const registerIncomeBtn = document.getElementById('registerIncomeBtn');
    const viewClientsBtn = document.getElementById('viewClientsBtn');

    // Música de fondo del portal.
    //
    // Regla de negocio: si esta página está siendo mostrada dentro de un
    // iframe (la vista previa del editor de Página Web en Recepción), la
    // música NUNCA debe sonar, ni siquiera si alguien intenta reproducirla
    // desde ahí (edición o no) — Recepción es una herramienta de trabajo,
    // no el sitio público. Si en cambio esta es la página real que ve un
    // visitante (top-level, no embebida), se reproduce sola desde el
    // segundo 19 como antes, y el visitante puede pausarla/reanudarla con
    // el botón flotante tipo disco (#btnMusicaPortal).
    (function () {
        const audioEl = document.getElementById('audio');
        const btnMusica = document.getElementById('btnMusicaPortal');
        if (!audioEl) return;

        let enIframe;
        try {
            enIframe = window.self !== window.top;
        } catch (e) {
            // Acceder a window.top puede lanzar en algunos casos de origen
            // cruzado; si pasa, lo más seguro es asumir que SÍ está
            // embebida y no reproducir nada.
            enIframe = true;
        }
        window.__portalEnIframe = enIframe;

        function actualizarIconoBoton(reproduciendo) {
            if (!btnMusica) return;
            btnMusica.classList.toggle('reproduciendo', reproduciendo);
            const icono = btnMusica.querySelector('.musica-toggle-btn__icono');
            if (icono) {
                icono.classList.toggle('fa-pause', reproduciendo);
                icono.classList.toggle('fa-play', !reproduciendo);
            }
            btnMusica.setAttribute('aria-label', reproduciendo ? 'Pausar música' : 'Reproducir música');
            btnMusica.title = reproduciendo ? 'Pausar música' : 'Reproducir música';
        }

        if (enIframe) {
            // Dentro de Recepción (vista previa o el modal de edición): el
            // botón de disco se queda VISIBLE, con el mismo diseño que ve un
            // visitante real, para que la vista previa sea fiel al portal
            // público de verdad. Pero queda inerte — no reacciona a clics —
            // y el audio se mantiene pausado siempre, pase lo que pase.
            if (btnMusica) {
                btnMusica.classList.add('silenciado');
                btnMusica.setAttribute('aria-disabled', 'true');
                btnMusica.title = 'Silenciado en la vista de edición (Recepción)';
                actualizarIconoBoton(false);
            }
            audioEl.pause();
            audioEl.addEventListener('play', function () {
                audioEl.pause();
            });
            return;
        }

        // --- A partir de acá, solo corre para el portal real (top-level) ---

        audioEl.addEventListener('loadedmetadata', function () {
            audioEl.currentTime = 19;
        });
        audioEl.play().then(() => {
            actualizarIconoBoton(true);
        }).catch(() => {
            // Autoplay bloqueado por el navegador: no rompe nada, sonará
            // recién cuando el usuario interactúe con la página (o toque
            // el botón de música).
            actualizarIconoBoton(false);
        });

        audioEl.addEventListener('play', () => actualizarIconoBoton(true));
        audioEl.addEventListener('pause', () => actualizarIconoBoton(false));

        if (btnMusica) {
            btnMusica.addEventListener('click', function () {
                if (audioEl.paused) {
                    audioEl.play().catch(() => {});
                } else {
                    audioEl.pause();
                }
            });
        }

        // Expuesto para portal-client.js: cuando Recepción cambia la pista
        // de música desde el editor (ver applyTheme / config.musica), esto
        // actualiza el <source> y recarga sin interrumpir la regla de
        // arriba (en el portal real sigue sonando si ya estaba sonando).
        window.__cambiarPistaMusicaPortal = function (nombreArchivo) {
            if (!nombreArchivo) return;
            const sourceEl = audioEl.querySelector('source');
            if (!sourceEl) return;
            const estabaSonando = !audioEl.paused;
            sourceEl.setAttribute('src', 'music/' + encodeURIComponent(nombreArchivo));
            audioEl.load();
            if (estabaSonando) {
                audioEl.play().catch(() => {});
            }
        };
    })();

    // Imágenes para el carrusel del inicio. 'let' (no 'const') a propósito:
    // window.__establecerImagenesHero (ver más abajo, dentro de
    // initHeroCarousel) la reemplaza cuando Recepción eligió otras fotos
    // desde Configuración > Página Web.
    let heroImages = [
        'img/carrusel1.png',
        'img/carrusel2.jpeg',
        'img/carrusel3.jpg',
        'img/carrusel4.jpg'
    ];
    
    // Crear partículas
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        const particleCount = 30;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            
            // Tamaño aleatorio entre 2px y 6px
            const size = Math.random() * 4 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            
            // Posición aleatoria
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            
            // Motas de luz blancas/gris claro (discretas) sobre el hero oscuro,
            // en vez de puntos de color: coherente con la paleta monocroma.
            const colors = ['#FFFFFF', '#F5F5F7', '#D2D2D7'];
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            particle.style.opacity = (Math.random() * 0.25 + 0.15).toFixed(2);
            
            // Duración de animación aleatoria
            const duration = Math.random() * 10 + 5;
            particle.style.animationDuration = `${duration}s`;
            
            // Retraso de animación aleatorio
            particle.style.animationDelay = `${Math.random() * 5}s`;
            
            particlesContainer.appendChild(particle);
        }
    }
    
    // Iniciar carrusel de imágenes en el inicio: 2 capas apiladas
    // (.hero-bg-layer--a/--b, ver styles.css) en vez de reescribir el
    // background-image de #inicio de un golpe -eso no se puede animar y
    // se veía como un corte seco-. Cada 2.5s se le pone la próxima foto a
    // la capa que está oculta (con opacity:0, así no se ve el cambio) y
    // recién ahí se cruzan las clases ".is-visible": eso dispara la
    // transición de opacity de ambas capas a la vez, o sea un fundido
    // (fade) real entre una foto y la siguiente.
    function initHeroCarousel() {
        const layerA = document.querySelector('.hero-bg-layer--a');
        const layerB = document.querySelector('.hero-bg-layer--b');
        if (!layerA || !layerB || heroImages.length === 0) return;

        let currentImage = 0;
        let capaVisible = layerA;
        let capaOculta = layerB;

        layerA.style.backgroundImage = `url('${heroImages[0]}')`;
        layerA.classList.add('is-visible');

        setInterval(() => {
            currentImage = (currentImage + 1) % heroImages.length;
            capaOculta.style.backgroundImage = `url('${heroImages[currentImage]}')`;

            // Deja que el navegador pinte la nueva imagen en la capa oculta
            // antes de animar su opacity; si se hace en el mismo frame que
            // el cambio de src, algunos navegadores se saltan la transición.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    capaOculta.classList.add('is-visible');
                    capaVisible.classList.remove('is-visible');
                    const temp = capaVisible;
                    capaVisible = capaOculta;
                    capaOculta = temp;
                });
            });
        }, 2500);

        // Expuesto para portal-client.js: cuando Recepción define otras
        // imágenes para el carrusel del inicio (ver applyTheme /
        // config.hero_imagenes), reemplaza la lista completa y refresca la
        // capa visible de inmediato con la primera imagen nueva — el
        // intervalo de arriba ya sigue rotando sobre 'heroImages' (variable
        // de este mismo closure), así que a partir de acá usa las nuevas.
        window.__establecerImagenesHero = function (nuevasImagenes) {
            if (!Array.isArray(nuevasImagenes) || nuevasImagenes.length === 0) return;
            heroImages = nuevasImagenes;
            currentImage = 0;
            capaVisible.style.backgroundImage = `url('${heroImages[0]}')`;
        };
    }

    // Fondo de PÁGINA (global, no solo del hero): alterna entre el aurora
    // CSS de siempre (.aurora-bg, por defecto — tipo 'fotos'), un fondo
    // animado por shader (Aurora / Floating Lines / Lightfall / Grainient,
    // ver fondos-animados.js) o un color/degradado liso. Se ve detrás de
    // TODA la página -inicio, beneficios, gimnasio, planes-, no solo detrás
    // del hero. El carrusel de fotos del hero (heroImages, más arriba) es
    // un elemento totalmente aparte que no cambia según esto: por eso
    // tipo 'fotos' acá NO significa "mostrar el carrusel" (ese ya se
    // muestra siempre, solo), significa "sin fondo de página personalizado,
    // usar el aurora de siempre".
    //
    // Recepción define cuál usar desde Configuración > Página Web y lo
    // manda vía config.hero_fondo (applyTheme en portal-client.js), que
    // llama a esta función expuesta acá.
    //
    // config esperado: { tipo, colores, estatico }
    //   tipo: 'fotos' | 'aurora' | 'floating-lines' | 'lightfall' | 'grainient' | 'solido'
    //   colores: array de strings hex — 1 solo valor para color sólido, 2
    //            para degradado (o uso interno del shader si aplica)
    //   estatico: true congela el fondo animado en un solo frame (sin
    //             movimiento) — no aplica a 'fotos' ni 'solido'
    let fondoAnimadoInstancia = null;
    window.__establecerFondoPagina = function (config) {
        if (!config || typeof config !== 'object') return;
        const html = document.documentElement;
        const canvas = document.getElementById('fondoPaginaAnimado');
        const solido = document.getElementById('fondoPaginaSolido');
        if (!html) return;

        const tipo = config.tipo || 'fotos';
        const TIPOS_ANIMADOS = ['aurora', 'floating-lines', 'lightfall', 'grainient'];

        html.classList.remove('fondo-pagina-animado', 'fondo-pagina-solido');

        if (TIPOS_ANIMADOS.includes(tipo) && canvas && typeof window.crearFondoAnimado === 'function') {
            html.classList.add('fondo-pagina-animado');

            // Si ya había una instancia de OTRO tipo, se destruye y se crea
            // de nuevo: cada shader tiene su propio programa/uniforms y no
            // tiene sentido reutilizar el contexto WebGL entre tipos.
            if (fondoAnimadoInstancia && fondoAnimadoInstancia.tipo !== tipo) {
                fondoAnimadoInstancia.instancia.destruir();
                fondoAnimadoInstancia = null;
            }

            if (!fondoAnimadoInstancia) {
                const instancia = window.crearFondoAnimado(tipo, canvas, {
                    colores: config.colores || [],
                    estatico: !!config.estatico
                });
                if (instancia && instancia.soportado) {
                    instancia.iniciar();
                    fondoAnimadoInstancia = { tipo, instancia };
                }
            } else {
                fondoAnimadoInstancia.instancia.actualizar({
                    colores: config.colores || [],
                    estatico: !!config.estatico
                });
            }
        } else if (tipo === 'solido' && solido) {
            html.classList.add('fondo-pagina-solido');
            const colores = (config.colores && config.colores.length) ? config.colores : ['#111113'];
            // 1 color = liso; 2+ colores = degradado (mismo criterio que el
            // editor de Tarjetas de Socio).
            solido.style.background = colores.length > 1
                ? `linear-gradient(135deg, ${colores.join(', ')})`
                : colores[0];
            // El fondo animado (si había uno corriendo) no hace falta
            // destruirlo: la clase fondo-pagina-solido ya lo oculta con
            // opacity 0, y así evitamos recompilar shaders si el usuario
            // vuelve a cambiar de opción.
        }
        // tipo === 'fotos': no se agrega ninguna clase — .aurora-bg (que
        // nunca se tocó) vuelve a ser visible solo con quitarle las clases
        // de arriba a <html>.
    };

    // Mostrar notificación
    function showNotification(message, type = 'info') {
        notification.textContent = message;
        notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    // Mostrar/ocultar modales
    // El modal ya vive en el DOM con opacity:0 (ver .modal en styles.css);
    // acá solo alternamos la clase que dispara la transición de blur+scale
    // ("materializarse"), tanto al entrar como al salir.
    function showModal(modal) {
        if (!modal) return;
        modal.classList.add('is-open');
        // overflow:hidden solo en <body> no alcanza para bloquear el
        // scroll de fondo: en varios navegadores <html> sigue siendo el
        // elemento que realmente scrollea, así que si no se bloquea
        // también ahí queda la barra del navegador scrolleando la página
        // de atrás A LA VEZ que la barra interna de la página a pantalla
        // completa (como "Ubicaciones y Contacto") - dos barras visibles
        // en vez de una sola.
        // IMPORTANTE: se toca solo overflowY (no el shorthand "overflow"),
        // porque html/body ya traen overflow-x:hidden por CSS para evitar
        // el scroll horizontal fantasma (ver #notification); el shorthand
        // pisaría ese overflow-x y lo volvería a dejar en "auto" al cerrar
        // el modal, trayendo de vuelta la barra horizontal.
        document.documentElement.style.overflowY = 'hidden';
        document.body.style.overflowY = 'hidden';
    }

    function hideModal(modal) {
        if (!modal) return;
        modal.classList.remove('is-open');
        document.documentElement.style.overflowY = '';
        document.body.style.overflowY = 'auto';
    }
    
    // Habilitar scroll horizontal en contenedores
    function enableHorizontalScroll() {
        const scrollableContainers = [
            document.getElementById('users-tab'),
            document.getElementById('memberships-tab'),
            document.querySelector('.users-list')
        ];
        
        scrollableContainers.forEach(container => {
            if (container) {
                container.style.overflowX = 'auto';
                container.style.overflowY = 'hidden';
                container.style.whiteSpace = 'nowrap';
                container.style.paddingBottom = '15px';
                container.style.scrollBehavior = 'smooth';
                
                // Asegurar que los elementos hijos se muestren en línea
                Array.from(container.children).forEach(child => {
                    child.style.display = 'inline-block';
                    child.style.whiteSpace = 'normal';
                    child.style.verticalAlign = 'top';
                    child.style.marginRight = '15px';
                });
                
                // Configurar el evento de rueda del mouse
                container.addEventListener('wheel', function(e) {
                    // Prevenir el scroll vertical por defecto
                    e.preventDefault();
                    
                    // Ajustar la velocidad del scroll (puedes modificar este valor)
                    const scrollSpeed = 40;
                    
                    // Aplicar el scroll horizontal
                    this.scrollLeft += e.deltaY * scrollSpeed;
                });
            }
        });
    }
    
    // Cambiar entre pestañas de rutinas (Hombres/Mujeres)
    // El contenido real de rutinas todavía no existe: esto solo actualiza
    // los botones activos y el data-genero del contenedor placeholder,
    // listo para cuando se inyecten datos reales (renderRoutines()).
    function switchTab(tabName) {
        const container = document.getElementById('routinesContainer');
        if (container) container.dataset.genero = tabName;

        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        renderRoutines();
    }

    // Cambiar entre niveles de rutina (Novato/Intermedio/Avanzado)
    function switchLevel(level, tabName) {
        const container = document.getElementById('routinesContainer');
        if (container) {
            container.dataset.nivel = level;
            if (tabName) container.dataset.genero = tabName;
        }

        levelBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.level === level) {
                btn.classList.add('active');
            }
        });

        renderRoutines();
    }

    // Punto de enganche para el futuro: cuando exista una fuente de datos
    // real (ej. un archivo de GitHub con ejercicios), esta función debe
    // leer container.dataset.genero / container.dataset.nivel y pintar las
    // rutinas correspondientes dentro de #routinesContainer. Por ahora solo
    // mantiene el estado vacío ya presente en el HTML.
    function renderRoutines() {
        // Placeholder intencional: no hace nada todavía.
    }
    
    // Cambiar entre pestañas de administrador
    function switchAdminTab(tabName) {
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        const activeTab = document.getElementById(`${tabName}-tab`);
        activeTab.style.display = 'block';
        
        // Aplicar scroll horizontal después de cambiar de pestaña
        setTimeout(() => {
            enableHorizontalScroll();
        }, 50);
        
        adminTabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Cargar contenido según la pestaña
        if (tabName === 'users') {
            loadUsers();
        } else if (tabName === 'memberships') {
            loadMemberships();
        }
    }
    
    // Iniciar sesión
    function loginUser(email, password, isAdminLogin = false, isReceptionLogin = false) {
        if (isAdminLogin) {
            // Verificar credenciales de admin
            if (email === adminCredentials.email && password === adminCredentials.password) {
                currentUser = {
                    name: 'Administrador Spasso',
                    email: adminCredentials.email,
                    role: 'admin',
                    phone: '+56 9 8765 4321',
                    status: 'active'
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showNotification('Bienvenido Administrador', 'success');
                return true;
            }
            showNotification('Credenciales de administrador incorrectas', 'error');
            return false;
        } else if (isReceptionLogin) {
            // Verificar credenciales de recepcionista
            const receptionist = receptionCredentials.find(
                r => r.email === email && r.password === password
            );
            
            if (receptionist) {
                currentUser = {
                    name: receptionist.name,
                    email: receptionist.email,
                    role: 'reception',
                    status: 'active',
                    shift: receptionist.shift
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showNotification(`Bienvenido ${receptionist.name}`, 'success');
                return true;
            }
            showNotification('Credenciales de recepción incorrectas', 'error');
            return false;
        } else {
            // Verificar usuarios normales
            const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
            const user = users.find(u => u.email === email && u.password === password);
            
            if (user) {
                // Verificar si el usuario está bloqueado
                if (user.status === 'blocked') {
                    showNotification('Tu cuenta ha sido bloqueada. Contacta al administrador.', 'error');
                    return false;
                }
                
                currentUser = user;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showNotification(`Bienvenido ${user.name.split(' ')[0]}`, 'success');
                
                return true;
            }
            
            showNotification('Correo o contraseña incorrectos', 'error');
            return false;
        }
    }
    
    // Registrar usuario
    function registerUser(userData) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        
        // Validar campos
        if (!userData.name || !userData.email || !userData.password) {
            showNotification('Todos los campos son obligatorios', 'error');
            return false;
        }
        
        if (userData.password !== document.getElementById('registerConfirm').value) {
            showNotification('Las contraseñas no coinciden', 'error');
            return false;
        }
        
        // Verificar si el usuario ya existe
        if (users.some(u => u.email === userData.email)) {
            showNotification('El correo electrónico ya está registrado', 'error');
            return false;
        }
        
        // No permitir registro con email de admin o recepción
        if (userData.email === adminCredentials.email || 
            receptionCredentials.some(r => r.email === userData.email)) {
            showNotification('No puedes registrarte con este correo electrónico', 'error');
            return false;
        }
        
        // Validar formato de email
        if (!/^\S+@\S+\.\S+$/.test(userData.email)) {
            showNotification('Ingresa un correo electrónico válido', 'error');
            return false;
        }
        
        // Validar longitud de contraseña
        if (userData.password.length < 6) {
            showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
            return false;
        }
        
        users.push({
            ...userData,
            role: 'user',
            status: 'active',
            membership: {
                plan: 'Ninguna',
                startDate: '',
                endDate: ''
            }
        });
        localStorage.setItem('spassoUsers', JSON.stringify(users));
        
        showNotification('¡Registro exitoso! Ahora puedes iniciar sesión', 'success');
        return true;
    }
    
    // Actualizar UI según el usuario
    function updateUI() {
        if (currentUser && currentUser.role === 'trainer') {
            // El entrenador no usa el perfil de socio: solo el botón del header.
            window.actualizarBotonSesion(true, currentUser.name);
            document.body.classList.add('logged-in');
            return;
        }
        if (currentUser) {
            window.actualizarBotonSesion(true, currentUser.name);

            // Mostrar datos en el perfil
            document.getElementById('profileName').textContent = currentUser.name;
            document.getElementById('profileEmail').textContent = currentUser.email;
            const mn = document.getElementById('profileMobName'), me = document.getElementById('profileMobEmail');
            if (mn) mn.textContent = currentUser.name || 'Mi cuenta';
            if (me) me.textContent = currentUser.email || '';
            actualizarPerfilDatos();

            // Actualizar el rol mostrado
            const roleElement = document.getElementById('profileRole');
            if (currentUser.role === 'admin') {
                roleElement.textContent = 'Administrador';
                roleElement.style.color = 'var(--rosa-fucsia)';
                roleElement.style.fontWeight = 'bold';
                adminControls.style.display = 'block';
                receptionControls.style.display = 'none';
            } else if (currentUser.role === 'reception') {
                roleElement.textContent = 'Recepcionista';
                roleElement.style.color = 'var(--celeste)';
                roleElement.style.fontWeight = 'bold';
                adminControls.style.display = 'none';
                receptionControls.style.display = 'block';
                
                // Configurar turno y nombre del recepcionista
                if (currentUser.shift) {
                    shiftSelect.value = currentUser.shift;
                    receptionShiftSelect.value = currentUser.shift;
                }
                if (currentUser.name) {
                    receptionistNameInput.value = currentUser.name;
                    receptionistName.value = currentUser.name;
                }
            } else if (currentUser.role === 'owner') {
                roleElement.textContent = 'Dueño';
                roleElement.style.color = 'var(--cafe-claro)';
                roleElement.style.fontWeight = 'bold';
                adminControls.style.display = 'block';
                receptionControls.style.display = 'none';
            } else {
                roleElement.textContent = 'Miembro';
                roleElement.style.color = 'var(--celeste)';
                roleElement.style.fontWeight = 'normal';
                adminControls.style.display = 'none';
                receptionControls.style.display = 'none';
                
                // Mostrar información de membresía
                updateMembershipInfo();
            }
            
            // Habilitar menús de usuario
            document.body.classList.add('logged-in');
            
            // Habilitar scroll horizontal en los menús
            setTimeout(() => {
                enableHorizontalScroll();
            }, 100);
        } else {
            window.actualizarBotonSesion(false);
            document.body.classList.remove('logged-in');
        }
    }
    
    // Actualizar información de membresía en el perfil
    function updateMembershipInfo() {
        if (currentUser && currentUser.membership) {
            document.getElementById('membershipPlan').textContent = currentUser.membership.plan;
            const resumenPlanNombreEl = document.getElementById('resumenPlanNombre');
            if (resumenPlanNombreEl) resumenPlanNombreEl.textContent = currentUser.membership.plan;

            let startDate = null;
            if (currentUser.membership.startDate) {
                startDate = new Date(currentUser.membership.startDate);
                document.getElementById('membershipStart').textContent = startDate.toLocaleDateString('es-CL');
            } else {
                document.getElementById('membershipStart').textContent = 'No asignada';
            }

            let endDate = null;
            if (currentUser.membership.endDate) {
                endDate = new Date(currentUser.membership.endDate);
                document.getElementById('membershipEnd').textContent = endDate.toLocaleDateString('es-CL');
            } else {
                document.getElementById('membershipEnd').textContent = 'No asignada';
            }

            actualizarResumenMembresia(startDate, endDate);
        }
    }

    // Días restantes + anillo del panel "Resumen" del perfil, calculados a
    // partir de las mismas fechas de inicio/término que ya se muestran en
    // "Tu Membresía" (nada de datos inventados).
    function actualizarResumenMembresia(startDate, endDate) {
        const diasTexto = document.getElementById('resumenDiasTexto');
        const planVence = document.getElementById('resumenPlanVence');
        const anilloFill = document.getElementById('resumenAnilloFill');
        if (!diasTexto || !planVence) return;

        // Etiqueta de estado de la membresía (Perfil): verde si está vigente, ámbar si vence pronto, roja si venció.
        const estadoEl = document.getElementById('membershipEstado');
        if (estadoEl) {
            estadoEl.className = 'memb-card__estado';
            if (!endDate) {
                estadoEl.hidden = true;
            } else {
                const dr = Math.ceil((endDate - new Date()) / 86400000);
                estadoEl.hidden = false;
                if (dr < 0) { estadoEl.textContent = 'Vencida'; estadoEl.classList.add('memb-card__estado--vencida'); }
                else if (dr <= 7) { estadoEl.textContent = dr === 0 ? 'Vence hoy' : 'Faltan ' + dr + (dr === 1 ? ' día' : ' días'); estadoEl.classList.add('memb-card__estado--pronto'); }
                else { estadoEl.textContent = 'Vigente · ' + dr + ' días'; estadoEl.classList.add('memb-card__estado--ok'); }
            }
        }

        // Circunferencia real del círculo SVG (r=30): 2*PI*30 ~= 188.5.
        // stroke-dashoffset en 0 = anillo lleno; en la circunferencia
        // completa = anillo vacío. Coincide con el valor fijo en el CSS.
        const CIRCUNFERENCIA = 188.5;
        const setAnillo = (porcentaje) => {
            if (!anilloFill) return;
            const pct = Math.max(0, Math.min(100, porcentaje));
            anilloFill.style.strokeDashoffset = CIRCUNFERENCIA * (1 - pct / 100);
        };

        if (!endDate) {
            diasTexto.textContent = '--';
            planVence.textContent = 'Sin fecha de vencimiento registrada';
            setAnillo(0);
            return;
        }

        const msPorDia = 24 * 60 * 60 * 1000;
        const diasRestantes = Math.ceil((endDate - new Date()) / msPorDia);

        if (diasRestantes < 0) {
            diasTexto.textContent = 'Vencido';
            setAnillo(0);
            planVence.textContent = 'Venció el ' + endDate.toLocaleDateString('es-CL');
        } else {
            diasTexto.textContent = diasRestantes + ' d';
            let porcentaje = 100;
            if (startDate) {
                const totalDias = Math.max(1, Math.round((endDate - startDate) / msPorDia));
                porcentaje = Math.max(0, Math.min(100, Math.round((diasRestantes / totalDias) * 100)));
            }
            setAnillo(porcentaje);
            planVence.textContent = 'Vence el ' + endDate.toLocaleDateString('es-CL');
        }
    }

    // Puente para portal-client.js: cuando el socio ya inicio sesion en una
    // visita anterior (token guardado) o justo termina de loguearse, este es
    // el UNICO lugar que arma currentUser y pinta el perfil real (sidebar).
    // portal-client.js ya NO debe tocar el HTML de #profileModal directamente.
    window.aplicarSesionSocio = function (perfil, plan) {
        currentUser = {
            name: `${perfil.nombres || ''} ${perfil.apellidos || ''}`.trim() || perfil.email,
            email: perfil.email,
            dni: perfil.dni || '',
            genero: perfil.genero || '',
            fechaRegistro: perfil.fecha_registro || '',
            role: 'user',
            membership: {
                plan: plan ? plan.nombre_plan : 'Sin plan activo',
                startDate: plan ? plan.fecha_inicio : '',
                endDate: plan ? plan.fecha_vencimiento : ''
            }
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUI();
        if (window.ejerciciosRefrescar) window.ejerciciosRefrescar();

        // Datos que no vienen en /me ni en /me/plan: asistencia real (huella)
        // y casillero asignado. No bloquean el resto del perfil si fallan.
        cargarAsistenciaResumen();
        cargarLockerResumen();
    };

    // Sesión de Entrenador: sin perfil de socio; abre el panel de entrenador
    // (js/entrenador-portal.js). El header muestra su usuario para poder
    // cerrar sesión con el mismo botón de siempre.
    window.aplicarSesionEntrenador = function (username) {
        currentUser = { name: username, email: username, role: 'trainer' };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        window.actualizarBotonSesion(true, username);
        document.body.classList.add('logged-in');
        if (window.abrirPanelEntrenador) window.abrirPanelEntrenador(username);
        showNotification('Bienvenido, entrenador ' + username, 'success');
    };

    // Datos personales del socio en la pestaña "Perfil" (antes "Membresía").
    // Nota: la ficha del socio en el sistema no guarda fecha de nacimiento,
    // por eso ese dato no aparece acá - solo se muestra lo que existe de
    // verdad en la base de datos (nombre, correo, DNI, fecha de registro).
    function actualizarPerfilDatos() {
        if (!currentUser) return;
        const nombreEl = document.getElementById('perfilNombre');
        const correoEl = document.getElementById('perfilCorreo');
        const dniEl = document.getElementById('perfilDni');
        const desdeEl = document.getElementById('perfilMiembroDesde');
        if (nombreEl) nombreEl.textContent = currentUser.name || '--';
        if (correoEl) correoEl.textContent = currentUser.email || '--';
        if (dniEl) dniEl.textContent = currentUser.dni || 'No registrado';
        if (desdeEl) {
            desdeEl.textContent = currentUser.fechaRegistro
                ? new Date(currentUser.fechaRegistro).toLocaleDateString('es-CL')
                : '--';
        }
    }

    // Asistencia real del socio (marcada con su huella en recepción) para el
    // panel "Resumen": mini-calendario del mes actual + racha de días
    // seguidos + total de visitas. Todo viene de /api/portal/me/visits, que
    // ya existe en el backend (asistencias_log) - nada de datos inventados.
    async function cargarAsistenciaResumen() {
        const calendario = document.getElementById('resumenCalendario');
        if (!calendario || typeof getSocioVisits !== 'function') return;

        try {
            const resp = await getSocioVisits(90);
            const visitas = resp.visitas || [];

            // Fechas visitadas como 'YYYY-MM-DD' en hora local (evita que un
            // registro nocturno "se corra" de día por el offset UTC).
            const toClave = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            const fechasVisitadas = new Set(
                visitas
                    .filter(v => v.fecha_entrada)
                    .map(v => toClave(new Date(v.fecha_entrada)))
            );

            const hoy = new Date();
            const claveHoy = toClave(hoy);

            // --- Racha: días consecutivos con asistencia terminando hoy o ayer ---
            let racha = 0;
            let cursor = new Date(hoy);
            if (!fechasVisitadas.has(claveHoy)) {
                cursor.setDate(cursor.getDate() - 1);
            }
            while (fechasVisitadas.has(toClave(cursor))) {
                racha++;
                cursor.setDate(cursor.getDate() - 1);
            }

            const rachaEl = document.getElementById('resumenRacha');
            const rachaTextoEl = document.getElementById('resumenRachaTexto');
            if (rachaEl && rachaTextoEl) {
                rachaTextoEl.textContent = racha;
                rachaEl.classList.toggle('activa', racha > 0);
                rachaEl.hidden = false;
            }

            // --- Visitas este mes / totales ---
            const mesActual = hoy.getMonth();
            const anioActual = hoy.getFullYear();
            const diasDelMesConVisita = new Set(
                [...fechasVisitadas].filter(clave => {
                    const [y, m] = clave.split('-').map(Number);
                    return y === anioActual && (m - 1) === mesActual;
                })
            );

            const visitasMesEl = document.getElementById('resumenVisitasMes');
            const visitasTotalEl = document.getElementById('resumenVisitasTotal');
            if (visitasMesEl) visitasMesEl.textContent = diasDelMesConVisita.size;
            if (visitasTotalEl) visitasTotalEl.textContent = resp.total_visitas || 0;

            const mesEl = document.getElementById('resumenAsistenciaMes');
            if (mesEl) {
                mesEl.textContent = hoy.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            }

            // --- Mini-calendario del mes actual ---
            const diasSemana = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
            const primerDia = new Date(anioActual, mesActual, 1);
            const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate();
            // getDay(): 0=domingo..6=sabado. Se reindexa a lunes-primero.
            const offsetInicial = (primerDia.getDay() + 6) % 7;

            let html = diasSemana.map(d => `<div class="resumen-cal-dow">${d}</div>`).join('');

            for (let i = 0; i < offsetInicial; i++) {
                html += '<div class="resumen-cal-dia vacio"></div>';
            }

            // Inicio del conteo de faltas: la fecha más antigua entre registro,
            // inicio de membresía y primera visita (no se marca en rojo lo
            // anterior a que el socio existiera en el gimnasio).
            let inicio = null;
            const candidatas = [
                currentUser && currentUser.fechaRegistro,
                currentUser && currentUser.membership && currentUser.membership.startDate,
                ...fechasVisitadas
            ];
            candidatas.forEach(f => {
                if (!f) return;
                const d = /^\d{4}-\d{2}-\d{2}$/.test(f)
                    ? new Date(f + 'T00:00:00') : new Date(f);
                if (isNaN(d)) return;
                const k = toClave(d);
                if (!inicio || k < inicio) inicio = k;
            });

            for (let dia = 1; dia <= diasEnMes; dia++) {
                const claveDia = toClave(new Date(anioActual, mesActual, dia));
                const clases = ['resumen-cal-dia'];
                if (fechasVisitadas.has(claveDia)) clases.push('asistio');
                else if (inicio && claveDia >= inicio && claveDia < claveHoy) clases.push('falta');
                if (claveDia === claveHoy) clases.push('hoy');
                const delay = (offsetInicial + dia - 1) * 0.012;
                html += `<div class="${clases.join(' ')}" style="animation-delay:${delay}s">${dia}</div>`;
            }

            calendario.innerHTML = html;
        } catch (e) {
            console.warn('No se pudo cargar la asistencia del socio:', e);
        }
    }

    // Casillero asignado (si el gimnasio usa lockers y el socio tiene uno).
    async function cargarLockerResumen() {
        const card = document.getElementById('resumenLockerCard');
        if (!card || typeof getSocioLocker !== 'function') return;

        try {
            const resp = await getSocioLocker();
            const perfilLocker = document.getElementById('perfilLocker');
            if (resp.locker) {
                const numEl = document.getElementById('resumenLockerNumero');
                const zonaEl = document.getElementById('resumenLockerZona');
                if (numEl) numEl.textContent = resp.locker.numero_locker;
                if (zonaEl) zonaEl.textContent = 'Casillero asignado en recepción';
                card.hidden = false;
                if (perfilLocker) perfilLocker.textContent = 'Casillero ' + resp.locker.numero_locker;
            } else {
                card.hidden = true;
                if (perfilLocker) perfilLocker.textContent = 'Sin casillero asignado';
            }
        } catch (e) {
            card.hidden = true;
        }
    }

    // ---- Actualización en vivo de "Mi cuenta" ----
    // Cada ~2 s se pide una "firma" muy liviana (/me/pulso). Solo si cambia
    // (huella registrada, casillero asignado, plan renovado) se vuelven a pedir
    // los datos completos: así se ve en 2-3 segundos lo que pasa en Recepción.
    let _vivoOcupado = false, _ultimaFirma = null;

    async function recargarDatosSocio() {
        await Promise.all([cargarAsistenciaResumen(), cargarLockerResumen()]);
        if (typeof getSocioPlan === 'function') {
            const r = await getSocioPlan().catch(() => null);
            const plan = r && r.plan;
            if (plan && currentUser && currentUser.membership &&
                (currentUser.membership.plan !== plan.nombre_plan ||
                 currentUser.membership.endDate !== plan.fecha_vencimiento)) {
                currentUser.membership = {
                    plan: plan.nombre_plan, startDate: plan.fecha_inicio, endDate: plan.fecha_vencimiento
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUI();
            }
        }
    }

    async function refrescarDatosSocio(forzar) {
        if (_vivoOcupado || document.hidden) return;
        if (!currentUser || currentUser.role !== 'user') return;
        const pm = document.getElementById('profileModal');
        if (!pm || !pm.classList.contains('is-open')) { _ultimaFirma = null; return; }
        if (typeof getPortalToken === 'function' && !getPortalToken()) return;
        _vivoOcupado = true;
        try {
            const r = await portalFetch('/api/portal/me/pulso');
            if (forzar === true || (_ultimaFirma !== null && r.v !== _ultimaFirma)) await recargarDatosSocio();
            _ultimaFirma = r.v;
        } catch (e) { /* sin conexión: se reintenta en el próximo ciclo */ }
        _vivoOcupado = false;
    }
    window.refrescarDatosSocio = refrescarDatosSocio;
    setInterval(refrescarDatosSocio, 2000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refrescarDatosSocio(true); });
    window.addEventListener('focus', function () { refrescarDatosSocio(true); });

    // Pestañas del perfil (Resumen/Membresía/Rutinas/Alimentación/Promociones):
    // el sidebar (PC) y la barra inferior (celular) comparten data-panel, así
    // que un solo handler mantiene ambos en el mismo estado.
    function cambiarPanelPerfil(panel) {
        document.querySelectorAll('.profile-panel').forEach(function (p) {
            p.classList.toggle('active', p.getAttribute('data-panel') === panel);
        });
        document.querySelectorAll('.profile-nav__item, .profile-bottomnav__item').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-panel') === panel);
        });
    }

    // Cambio de contraseña del socio (Perfil > Seguridad).
    function initCambioPassword() {
        const form = document.getElementById('formCambiarPass');
        if (!form) return;
        const passModal = document.getElementById('passModal');
        const abrirPass = document.getElementById('btnAbrirPass');
        const cerrarPassModal = function () { if (passModal) passModal.classList.remove('is-open'); form.reset(); };
        if (abrirPass) abrirPass.addEventListener('click', function () { if (passModal) passModal.classList.add('is-open'); });
        const cerrarPassX = document.getElementById('passModalCerrar');
        if (cerrarPassX) cerrarPassX.addEventListener('click', cerrarPassModal);
        if (passModal) passModal.addEventListener('click', function (e) { if (e.target === passModal) cerrarPassModal(); });
        const btnLogout = document.getElementById('btnPerfilLogout');
        if (btnLogout) btnLogout.addEventListener('click', function () {
            const b = document.getElementById('loginBtn');
            if (b) b.click();
        });
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            const nueva = document.getElementById('passNueva').value;
            const nueva2 = document.getElementById('passNueva2').value;
            if (nueva.length < 8) { showNotification('La nueva contraseña debe tener al menos 8 caracteres', 'error'); return; }
            if (nueva !== nueva2) { showNotification('Las contraseñas nuevas no coinciden', 'error'); return; }
            if (!/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) { showNotification('La contraseña nueva debe combinar letras y números', 'error'); return; }
            const btn = document.getElementById('btnCambiarPass');
            btn.disabled = true;
            try {
                await changePassword(null, nueva);
                cerrarPassModal();
                showNotification('Contraseña actualizada correctamente', 'success');
            } catch (err) {
                showNotification(err.message || 'No se pudo cambiar la contraseña', 'error');
            } finally {
                btn.disabled = false;
            }
        });
    }

    function initPerfilTabs() {
        document.querySelectorAll('.profile-nav__item, .profile-bottomnav__item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                cambiarPanelPerfil(btn.getAttribute('data-panel'));
            });
        });

        // Accesos rápidos de Resumen (Ejercicios/Rutinas/Mi perfil): mismo
        // cambio de pestaña que el sidebar, solo que arrancan desde adentro
        // del panel para no obligar a bajar/subir al menú.
        document.querySelectorAll('.resumen-acceso').forEach(function (btn) {
            btn.addEventListener('click', function () {
                cambiarPanelPerfil(btn.getAttribute('data-ir-panel'));
            });
        });
    }
    
    // Habilitar edición de contenido
    function enableContentEditing() {
        const editableElements = document.querySelectorAll('h1, h2, h3, h4, p:not(.price):not(.toggle-form)');
        
        editableElements.forEach(el => {
            el.contentEditable = true;
            el.style.borderBottom = '1px dashed #ccc';
            el.style.paddingBottom = '2px';
        });
        
        editContentBtn.style.display = 'none';
        saveChangesBtn.style.display = 'inline-block';
        showNotification('Modo edición activado. Haz clic en cualquier texto para editarlo', 'info');
    }
    
    // Deshabilitar edición de contenido
    function disableContentEditing() {
        const editableElements = document.querySelectorAll('[contenteditable="true"]');
        
        editableElements.forEach(el => {
            el.contentEditable = false;
            el.style.borderBottom = 'none';
            el.style.paddingBottom = '0';
        });
        
        editContentBtn.style.display = 'inline-block';
        saveChangesBtn.style.display = 'none';
        showNotification('Cambios guardados correctamente', 'success');
    }
    
    // Cargar usuarios en el panel de administración
    function loadUsers(searchTerm = '') {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        usersList.innerHTML = '';
        
        // Filtrar usuarios si hay término de búsqueda
        const filteredUsers = searchTerm 
            ? users.filter(user => 
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                user.email.toLowerCase().includes(searchTerm.toLowerCase()))
            : users;
        
        if (filteredUsers.length === 0) {
            usersList.innerHTML = '<p>No se encontraron usuarios</p>';
            return;
        }
        
        filteredUsers.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.style.display = 'inline-block';
            userCard.style.width = '300px';
            userCard.style.marginRight = '15px';
            
            userCard.innerHTML = `
                <div class="user-info">
                    <i class="fas fa-user-circle"></i>
                    <div>
                        <h4>${user.name}</h4>
                        <p>${user.email}</p>
                        <span class="user-role ${user.role}">${user.role === 'admin' ? 'Admin' : user.role === 'owner' ? 'Dueño' : user.role === 'reception' ? 'Recepcionista' : 'Miembro'}</span>
                        <span class="user-status ${user.status}">${user.status === 'blocked' ? 'Bloqueado' : 'Activo'}</span>
                    </div>
                </div>
                <div class="user-actions">
                    ${user.role !== 'admin' && user.role !== 'owner' 
                        ? `<button class="make-admin" data-email="${user.email}">Hacer Admin</button>` 
                        : ''}
                    <button class="edit-user" data-email="${user.email}"><i class="fas fa-edit"></i></button>
                    <button class="block-user" data-email="${user.email}">${user.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}</button>
                    <button class="delete-user" data-email="${user.email}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            usersList.appendChild(userCard);
        });
        
        // Agregar event listeners a los botones
        document.querySelectorAll('.make-admin').forEach(btn => {
            btn.addEventListener('click', function() {
                makeAdmin(this.dataset.email);
            });
        });
        
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.addEventListener('click', function() {
                editUser(this.dataset.email);
            });
        });
        
        document.querySelectorAll('.block-user').forEach(btn => {
            btn.addEventListener('click', function() {
                toggleBlockUser(this.dataset.email);
            });
        });
        
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteUser(this.dataset.email);
            });
        });
        
        // Habilitar scroll horizontal después de cargar los usuarios
        setTimeout(() => {
            enableHorizontalScroll();
        }, 50);
    }
    
    // Convertir usuario en admin
    function makeAdmin(email) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const updatedUsers = users.map(user => {
            if (user.email === email) {
                return { ...user, role: 'admin' };
            }
            return user;
        });
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        loadUsers();
        showNotification('Usuario promovido a administrador', 'success');
    }
    
    // Bloquear/Desbloquear usuario
    function toggleBlockUser(email) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const updatedUsers = users.map(user => {
            if (user.email === email) {
                return { 
                    ...user, 
                    status: user.status === 'blocked' ? 'active' : 'blocked' 
                };
            }
            return user;
        });
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        
        // Si el usuario bloqueado es el actual, cerrar sesión
        if (currentUser && currentUser.email === email && updatedUsers.find(u => u.email === email).status === 'blocked') {
            logoutUser();
            showNotification('Tu cuenta ha sido bloqueada', 'error');
        } else {
            loadUsers();
            showNotification(`Usuario ${updatedUsers.find(u => u.email === email).status === 'blocked' ? 'bloqueado' : 'desbloqueado'}`, 'success');
        }
    }
    
    // Editar usuario
    function editUser(email) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const user = users.find(u => u.email === email);
        
        if (!user) {
            showNotification('Usuario no encontrado', 'error');
            return;
        }
        
        const newName = prompt('Nuevo nombre:', user.name);
        if (newName === null) return;
        
        const newEmail = prompt('Nuevo correo electrónico:', user.email);
        if (newEmail === null) return;
        
        // Validar nuevo email
        if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
            showNotification('Ingresa un correo electrónico válido', 'error');
            return;
        }
        
        // Verificar si el nuevo email ya existe
        const emailExists = users.some(u => u.email === newEmail && u.email !== user.email);
        if (emailExists) {
            showNotification('El correo electrónico ya está en uso', 'error');
            return;
        }
        
        const updatedUsers = users.map(u => {
            if (u.email === email) {
                return { ...u, name: newName, email: newEmail };
            }
            return u;
        });
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        
        // Si el usuario editado es el actual, actualizar datos
        if (currentUser && currentUser.email === email) {
            currentUser.name = newName;
            currentUser.email = newEmail;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUI();
        }
        
        loadUsers();
        showNotification('Usuario actualizado correctamente', 'success');
    }
    
    // Eliminar usuario
    function deleteUser(email) {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
        
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const updatedUsers = users.filter(user => user.email !== email);
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        
        // Si el usuario eliminado es el actual, cerrar sesión
        if (currentUser && currentUser.email === email) {
            logoutUser();
        }
        
        loadUsers();
        showNotification('Usuario eliminado correctamente', 'success');
    }
    
    // Cargar mensualidades en el panel de administración
    function loadMemberships(searchTerm = '') {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        membershipsList.innerHTML = '';
        
        // Filtrar usuarios si hay término de búsqueda
        const filteredUsers = searchTerm 
            ? users.filter(user => 
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                user.email.toLowerCase().includes(searchTerm.toLowerCase()))
            : users;
        
        if (filteredUsers.length === 0) {
            membershipsList.innerHTML = '<tr><td colspan="5">No se encontraron usuarios</td></tr>';
            return;
        }
        
        filteredUsers.forEach(user => {
            const row = document.createElement('tr');
            
            // Formatear fechas
            const startDate = user.membership.startDate 
                ? new Date(user.membership.startDate).toLocaleDateString('es-CL') 
                : 'No asignada';
            
            const endDate = user.membership.endDate 
                ? new Date(user.membership.endDate).toLocaleDateString('es-CL') 
                : 'No asignada';
            
            row.innerHTML = `
                <td>${user.name}</td>
                <td>${user.membership.plan || 'Ninguno'}</td>
                <td>${startDate}</td>
                <td>${endDate}</td>
                <td>
                    <span class="edit-membership" data-email="${user.email}">
                        <i class="fas fa-edit"></i> Editar
                    </span>
                </td>
            `;
            
            membershipsList.appendChild(row);
        });
        
        // Agregar event listeners a los botones de edición
        document.querySelectorAll('.edit-membership').forEach(btn => {
            btn.addEventListener('click', function() {
                editMembership(this.dataset.email);
            });
        });
    }
    
    // Editar mensualidad de usuario
    function editMembership(email) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const user = users.find(u => u.email === email);
        
        if (!user) {
            showNotification('Usuario no encontrado', 'error');
            return;
        }
        
        // Obtener planes disponibles
        const plans = ['Ninguno', 'Básico', 'Estándar', 'VIP'];
        
        // Crear formulario de edición
        const plan = prompt('Selecciona el plan:\n\n1. Básico\n2. Estándar\n3. VIP\n\nIngresa el número del plan:', 
            plans.indexOf(user.membership.plan) + 1);
        
        if (plan === null) return;
        
        let selectedPlan = '';
        if (plan === '1') selectedPlan = 'Básico';
        else if (plan === '2') selectedPlan = 'Estándar';
        else if (plan === '3') selectedPlan = 'VIP';
        else {
            showNotification('Opción no válida', 'error');
            return;
        }
        
        const startDate = prompt('Fecha de inicio (YYYY-MM-DD):', user.membership.startDate || '');
        if (startDate === null) return;
        
        // Validar fecha de inicio
        if (startDate && isNaN(new Date(startDate).getTime())) {
            showNotification('Fecha no válida', 'error');
            return;
        }
        
        const endDate = prompt('Fecha de término (YYYY-MM-DD):', user.membership.endDate || '');
        if (endDate === null) return;
        
        // Validar fecha de término
        if (endDate && isNaN(new Date(endDate).getTime())) {
            showNotification('Fecha no válida', 'error');
            return;
        }
        
        // Actualizar usuario
        const updatedUsers = users.map(u => {
            if (u.email === email) {
                return { 
                    ...u, 
                    membership: {
                        plan: selectedPlan,
                        startDate: startDate || '',
                        endDate: endDate || ''
                    }
                };
            }
            return u;
        });
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        
        // Si el usuario editado es el actual, actualizar datos
        if (currentUser && currentUser.email === email) {
            currentUser.membership = {
                plan: selectedPlan,
                startDate: startDate || '',
                endDate: endDate || ''
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUI();
        }
        
        loadMemberships();
        showNotification('Membresía actualizada correctamente', 'success');
    }
    
    // Mostrar popup de WhatsApp con la promoción seleccionada
    function showWhatsappPopup(promoText) {
        whatsappMessage.textContent = `Estoy interesado en la promoción: ${promoText}`;
        const encodedMessage = encodeURIComponent(whatsappMessage.textContent);
        whatsappLink.href = `https://wa.me/73415902?text=${encodedMessage}`;
        whatsappPopup.style.display = 'block';
    }
    
    // Registrar ingreso al gimnasio
    function registerGymIncome() {
        if (!receptionistName.value || !receptionShiftSelect.value) {
            showNotification('Por favor completa tu nombre y turno', 'error');
            return;
        }
        
        // Redirigir al archivo python.html
        window.location.href = 'python.py';
    }
    
    // Cerrar sesión
    function logoutUser() {
        // Si había una sesión real de socio (token del portal), también se
        // cierra acá: antes este logout solo limpiaba el currentUser local
        // y dejaba el token vivo, así que al volver a presionar "Iniciar
        // Sesión" el header lo detectaba como sesión activa y disparaba
        // otro logout (con recarga completa) en vez de abrir el login.
        // Todo esto pasa sin recargar la página.
        if (window.getPortalToken && window.getPortalToken() && window.removePortalToken) {
            window.removePortalToken();
        }
        currentUser = null;
        localStorage.removeItem('currentUser');
        if (window.cerrarPanelEntrenador) window.cerrarPanelEntrenador();
        hideModal(profileModal);
        hideModal(adminModal);
        hideModal(receptionModal);
        updateUI();
        showNotification('Sesión cerrada correctamente', 'info');
    }

    // Puente para portal-client.js: logoutSocio() usa esto en vez de
    // location.reload(), para que cerrar sesión sea instantáneo (sin
    // parpadeo de recarga) y quede unificado en un solo lugar.
    window.cerrarSesionCompleta = logoutUser;
    
    // Mostrar popup de promociones al cargar la página
    let lastPopupTime = 0;

    function showPromoPopup() {
        const now = Date.now();
        const minTimeBetweenPopups = 5000; // 5 segundos entre popups
        
        if (now - lastPopupTime > minTimeBetweenPopups) {
            setTimeout(() => {
                promoPopup.style.display = 'block';
                lastPopupTime = now;
            }, 1000);
        }
    }

    // Deshabilitado por ahora: la sección de Promociones está oculta
    // (display:none) hasta que se habilite dinámicamente desde la app de
    // recepción, así que no tiene sentido seguir mostrando este popup con
    // ofertas mientras esa función está apagada. Descomentar cuando
    // Promociones vuelva a estar activa.
    // document.addEventListener('DOMContentLoaded', showPromoPopup);
    
    // Event Listeners

    // Abre "Mi Perfil" con el menú correcto según el rol (login local
    // currentUser); para sesiones del backend real (portal-client.js) el
    // modal ya viene armado por renderDashboard(), así que ahí alcanza con
    // mostrarlo. Antes esta lógica vivía adentro del click de loginBtn,
    // ahora ese botón es solo de logout (ver window.actualizarBotonSesion)
    // y el acceso al perfil pasó al link #headerProfileLink de al lado.
    function abrirPerfilLocal() {
        showModal(profileModal);
        if (currentUser.role === 'admin' || currentUser.role === 'owner') {
            document.getElementById('adminControls').style.display = 'block';
            document.getElementById('receptionControls').style.display = 'none';
            switchAdminTab('users');
        } else if (currentUser.role === 'reception') {
            document.getElementById('adminControls').style.display = 'none';
            document.getElementById('receptionControls').style.display = 'block';

            // Configurar turno y nombre del recepcionista
            if (currentUser.shift) {
                shiftSelect.value = currentUser.shift;
                receptionShiftSelect.value = currentUser.shift;
            }
            if (currentUser.name) {
                receptionistNameInput.value = currentUser.name;
                receptionistName.value = currentUser.name;
            }
        } else {
            document.getElementById('adminControls').style.display = 'none';
            document.getElementById('receptionControls').style.display = 'none';
            switchTab('hombres');
        }
    }

    const headerProfileLink = document.getElementById('headerProfileLink');
    if (headerProfileLink) {
        headerProfileLink.addEventListener('click', function (e) {
            e.preventDefault();
            if (currentUser) {
                abrirPerfilLocal();
            } else if (window.getPortalToken && window.getPortalToken()) {
                showModal(profileModal);
            }
        });
    }

    // Botón principal del header: si NO hay sesión abre el login; si hay
    // sesión (local o del backend real) cierra sesión directo -es lo que
    // pide el diseño de logout que se adaptó (icono/texto cambian solos
    // en window.actualizarBotonSesion())-. logoutUser() ya sabe limpiar
    // el token real además del currentUser local, y no recarga la
    // página, así que sirve para los dos casos sin ramificar.
    loginBtn.addEventListener('click', function() {
        if (currentUser || (window.getPortalToken && window.getPortalToken())) {
            logoutUser();
        } else {
            loginModal.style.display = '';
            showModal(loginModal);
        }
    });

    showRegister.addEventListener('click', function(e) {
        e.preventDefault();
        hideModal(loginModal);
        showModal(registerModal);
    });

    // No hay recuperación de contraseña por correo, así que "Cambiar"
    // reutiliza el popup de WhatsApp que ya usa el sitio para promociones,
    // pero con su propio mensaje: pide el correo escrito en el login (si
    // ya lo puso) para que recepción pueda ubicar la cuenta.
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            // Recuperación con código al correo (js/recuperar-portal.js)
            if (typeof window.abrirRecuperarPortal === 'function') { window.abrirRecuperarPortal(); return; }
            const email = document.getElementById('loginEmail').value.trim();
            const mensaje = email
                ? `Olvidé mi contraseña. Mi correo registrado es: ${email}. ¿Me ayudan a restablecerla?`
                : 'Olvidé mi contraseña, ¿me ayudan a restablecerla?';
            hideModal(loginModal);
            whatsappMessage.textContent = mensaje;
            whatsappLink.href = `https://wa.me/73415902?text=${encodeURIComponent(mensaje)}`;
            whatsappPopup.style.display = 'block';
        });
    }

    showLogin.addEventListener('click', function(e) {
        e.preventDefault();
        hideModal(registerModal);
        showModal(loginModal);
    });
    
    closeModals.forEach(btn => {
        // La X de "Cambiar contraseña" solo cierra esa ventana (la maneja initCambioPassword),
        // no debe cerrar Mi Cuenta ni el resto de modales.
        if (btn.closest('#passModal')) return;
        btn.addEventListener('click', function() {
            hideModal(loginModal);
            hideModal(registerModal);
            hideModal(profileModal);
            hideModal(adminModal);
            hideModal(receptionModal);
            if (ubicacionModal && ubicacionModal.classList.contains('is-open')) {
                hideModal(ubicacionModal);
                // Al "volver" de Ubicaciones y Contacto sin elegir otra
                // sección, el resaltado del menú regresa a Inicio.
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                const inicioLink = document.querySelector('.nav-link[href="#inicio"]');
                if (inicioLink) inicioLink.classList.add('active');
            }
        });
    });

    // "Ubicaciones y Contacto": ya no es una sección del scroll, se abre
    // como una página propia (a pantalla completa, sin fondo difuminado
    // detrás como los demás modales) solo al hacer clic en el enlace del
    // menú, nunca bajando la página con el mouse.
    if (navUbicacionContacto) {
        navUbicacionContacto.addEventListener('click', function(e) {
            e.preventDefault();
            if (profileModal && profileModal.classList.contains('is-open')) hideModal(profileModal);
            showModal(ubicacionModal);
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            navUbicacionContacto.classList.add('active');
        });
    }
    
    closePopup.addEventListener('click', function() {
        promoPopup.style.display = 'none';
    });
    
    closeWhatsapp.addEventListener('click', function() {
        whatsappPopup.style.display = 'none';
    });
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(e) {
        if (e.target === loginModal) hideModal(loginModal);
        if (e.target === registerModal) hideModal(registerModal);
        if (e.target === profileModal) hideModal(profileModal);
        if (e.target === adminModal) hideModal(adminModal);
        if (e.target === receptionModal) hideModal(receptionModal);
        if (e.target === ubicacionModal) hideModal(ubicacionModal);
        if (e.target === promoPopup) promoPopup.style.display = 'none';
        if (e.target === whatsappPopup) whatsappPopup.style.display = 'none';
    });
    
    // Termina el ingreso del socio/entrenador (después de la contraseña, o del código si el dispositivo es nuevo)
    async function finalizarLoginSocio(respLogin) {

        // Cuenta de Entrenador: no tiene perfil de socio, abre su panel.
        if (respLogin && respLogin.usuario && respLogin.usuario.rol === 'Entrenador') {
            window.aplicarSesionEntrenador(respLogin.usuario.username);
            hideModal(loginModal);
            return;
        }

        // Traer los datos reales del socio y su plan actual
        const perfil = await getSocioProfile();
        let plan = null;
        try {
            const planResp = await getSocioPlan();
            plan = planResp.plan || null;
        } catch (e) {
            console.warn('No se pudo obtener el plan del socio:', e);
        }

        window.aplicarSesionSocio(perfil, plan);

        showNotification('Bienvenido ' + currentUser.name, 'success');
        hideModal(loginModal);
        showModal(profileModal);
    }

    // Paso del código enviado al correo (solo se pide una vez por dispositivo)
    function mostrarCodigoPortal(resp, rememberMe, alTerminar, reenviarLogin) {
        let box = document.getElementById('loginCodigoBox');
        const campos = Array.from(loginForm.children).filter(c => c.id !== 'loginCodigoBox');
        if (!box) {
            box = document.createElement('div');
            box.id = 'loginCodigoBox';
            box.className = 'codigo-box';
            box.innerHTML = '<p class="codigo-box__txt" id="loginCodigoMsg"></p>' +
                '<input class="login-card__input codigo-box__input" type="text" id="loginCodigoPortal" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="• • • • • •">' +
                '<button type="button" class="login-card__submit" id="loginCodigoOk">Verificar</button>' +
                '<a href="#" class="codigo-box__link" id="loginCodigoReenviar">No me llegó, enviar otro código</a>' +
                '<a href="#" class="codigo-box__link codigo-box__link--tenue" id="loginCodigoVolver">← Volver</a>';
            loginForm.appendChild(box);
        }
        let actual = resp;
        const texto = () => 'Te enviamos un código de 6 dígitos a ' + (actual.correo || 'tu correo') + '. Solo se pide una vez en este dispositivo. Revisa también Spam.';
        document.getElementById('loginCodigoMsg').textContent = texto();
        campos.forEach(c => c.style.display = 'none');
        box.style.display = 'flex';
        const input = document.getElementById('loginCodigoPortal');
        input.value = ''; input.focus();
        input.oninput = () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); };
        const cerrar = () => { box.style.display = 'none'; campos.forEach(c => c.style.display = ''); };
        document.getElementById('loginCodigoVolver').onclick = (ev) => { ev.preventDefault(); cerrar(); };
        const reenv = document.getElementById('loginCodigoReenviar');
        reenv.onclick = async (ev) => {
            ev.preventDefault();
            if (!reenviarLogin || reenv.dataset.espera) return;
            reenv.dataset.espera = '1'; reenv.textContent = 'Enviando…';
            try {
                const r = await reenviarLogin();
                if (r && r.requiere_codigo) {
                    actual = r;
                    document.getElementById('loginCodigoMsg').textContent = r.ya_enviado
                        ? 'Ya te enviamos un código hace un momento a ' + (r.correo || 'tu correo') + '. Revisa tu bandeja y Spam; puedes pedir otro en unos segundos.'
                        : 'Listo, te enviamos un código nuevo a ' + (r.correo || 'tu correo') + '.';
                    resp = r;
                } else if (r) {
                    cerrar(); await alTerminar(r); return;
                }
            } catch (err) {
                showNotification(err.message || 'No se pudo reenviar el código', 'error');
            }
            let n = 20;
            const t = setInterval(() => {
                n--;
                if (n <= 0) { clearInterval(t); delete reenv.dataset.espera; reenv.textContent = 'No me llegó, enviar otro código'; }
                else reenv.textContent = 'Podrás pedir otro en ' + n + ' s';
            }, 1000);
            reenv.textContent = 'Podrás pedir otro en ' + n + ' s';
        };
        const enviar = async () => {
            const codigo = input.value.replace(/\D/g, '');
            if (codigo.length !== 6) { showNotification('Escribe los 6 dígitos del código', 'error'); return; }
            const ok = document.getElementById('loginCodigoOk'); ok.disabled = true;
            try {
                const r = await verificarCodigoPortal(resp.desafio, codigo, rememberMe);
                cerrar();
                await alTerminar(r);
            } catch (err) {
                showNotification(err.message || 'Código incorrecto', 'error');
            } finally { ok.disabled = false; }
        };
        document.getElementById('loginCodigoOk').onclick = enviar;
        input.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); enviar(); } };
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const isAdminLogin = document.getElementById('adminLogin').checked;
        const isReceptionLogin = document.getElementById('receptionLogin').checked;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        // Validar que no estén ambos checkboxes marcados
        if (isAdminLogin && isReceptionLogin) {
            showNotification('Solo puedes seleccionar un tipo de acceso a la vez', 'error');
            return;
        }
        
        // Si es admin o recepción, usar login local
        if (isAdminLogin || isReceptionLogin) {
            if (loginUser(email, password, isAdminLogin, isReceptionLogin)) {
                hideModal(loginModal);
                updateUI();
                
                // Mostrar el modal correspondiente según el rol
                if (currentUser.role === 'reception') {
                    showModal(receptionModal);
                } else {
                    showModal(profileModal);
                }
            }
        } else {
            // Login de socio via API (backend real de recepción, puerto 7000)
            try {
                const respLogin = await loginSocio(email, password, rememberMe);
                if (respLogin && respLogin.requiere_codigo) {
                    mostrarCodigoPortal(respLogin, rememberMe, finalizarLoginSocio, () => loginSocio(email, password, rememberMe));
                    return;
                }
                await finalizarLoginSocio(respLogin);

            } catch (error) {
                showNotification(error.message || 'Error al iniciar sesión', 'error');
                console.error('Error login:', error);
            }
        }
    });
    
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const userData = {
            name: document.getElementById('registerName').value,
            email: document.getElementById('registerEmail').value,
            phone: document.getElementById('registerPhone').value,
            password: document.getElementById('registerPassword').value
        };
        
        if (registerUser(userData)) {
            currentUser = {
                ...userData,
                role: 'user',
                status: 'active',
                membership: {
                    plan: 'Ninguna',
                    startDate: '',
                    endDate: ''
                }
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            hideModal(registerModal);
            updateUI();
            showModal(profileModal);
        }
    });
    
    // El botón "Cerrar Sesión" de abajo del perfil se quitó (era redundante
    // con el ícono de logout del header, que ya cierra sesión sin recargar
    // la página - ver loginBtn más arriba).

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    levelBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const activeTab = document.querySelector('.tab-btn.active');
            switchLevel(this.dataset.level, activeTab.dataset.tab);
        });
    });
    
    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            switchAdminTab(this.dataset.tab);
        });
    });
    
    editContentBtn.addEventListener('click', enableContentEditing);
    saveChangesBtn.addEventListener('click', disableContentEditing);
    
    manageUsersBtn.addEventListener('click', function() {
        hideModal(profileModal);
        showModal(adminModal);
        switchAdminTab('users');
    });
    
    manageMembershipsBtn.addEventListener('click', function() {
        hideModal(profileModal);
        showModal(adminModal);
        switchAdminTab('memberships');
    });
    
    // Botones de promoción - WhatsApp
    document.querySelectorAll('.promo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const promoText = this.getAttribute('data-promo');
            showWhatsappPopup(promoText);
        });
    });
    
    // Botones de recepcionista
    registerGymIncomeBtn.addEventListener('click', registerGymIncome);
    registerSaunaIncomeBtn.addEventListener('click', function() {
        showNotification('Funcionalidad en desarrollo', 'info');
    });
    registerPoolIncomeBtn.addEventListener('click', function() {
        showNotification('Funcionalidad en desarrollo', 'info');
    });
    viewTodayClientsBtn.addEventListener('click', function() {
        showNotification('Funcionalidad en desarrollo', 'info');
    });
    
    registerIncomeBtn.addEventListener('click', function() {
        if (!receptionistNameInput.value || !shiftSelect.value) {
            showNotification('Por favor completa tu nombre y turno', 'error');
            return;
        }
        
        // Redirigir al archivo python.html
        window.location.href = 'python.html';
    });
    
    viewClientsBtn.addEventListener('click', function() {
        showNotification('Funcionalidad en desarrollo', 'info');
    });
    
    // Buscar usuarios
    searchUserBtn.addEventListener('click', function(e) {
        e.preventDefault();
        loadUsers(userSearch.value);
    });
    
    userSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadUsers(userSearch.value);
        }
    });
    
    // Buscar mensualidades
    searchMembershipBtn.addEventListener('click', function(e) {
        e.preventDefault();
        loadMemberships(membershipSearch.value);
    });
    
    membershipSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadMemberships(membershipSearch.value);
        }
    });
    
    // Menú hamburguesa del navbar (pantallas angostas): al hacer clic en
    // cualquier link de adentro (sea uno con scroll suave o el especial de
    // "Ubicaciones y Contacto"), se cierra el desplegable. Un solo listener
    // delegado en el <ul> en vez de tocar cada handler de click por separado.
    const navToggleCheckbox = document.getElementById('navToggle');
    const navLinksList = document.getElementById('navLinks');
    if (navToggleCheckbox && navLinksList) {
        navLinksList.addEventListener('click', function(e) {
            if (e.target.closest('.nav-link')) {
                navToggleCheckbox.checked = false;
            }
        });
    }

    // Scroll suave para enlaces
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        const destino = anchor.getAttribute('href');
        // "Ubicaciones y Contacto" usa href="#" a propósito (abre una
        // ventana flotante, no una sección del scroll) y ya tiene su propio
        // listener más abajo; si lo dejamos entrar aquí, document.querySelector('#')
        // lanza un error porque "#" solo no es un selector válido.
        if (!destino || destino === '#' || anchor.id === 'navUbicacionContacto') return;

        anchor.addEventListener('click', function(e) {
            e.preventDefault();

            // Si "Ubicaciones y Contacto" está abierta y el visitante hace
            // clic en cualquier otro enlace del menú, se cierra primero
            // (como "volver" de una página real) y recién ahí se hace el
            // scroll normal a la sección elegida.
            if (ubicacionModal && ubicacionModal.classList.contains('is-open')) {
                hideModal(ubicacionModal);
            }
            // Igual con "Mi Cuenta": elegir una sección del menú cierra la cuenta y lleva a esa sección.
            if (profileModal && profileModal.classList.contains('is-open')) {
                hideModal(profileModal);
            }

            const _dest = document.querySelector(this.getAttribute('href'));
            if (_dest) setTimeout(function () { _dest.scrollIntoView({ behavior: 'smooth' }); }, 50);

            // Actualizar enlace activo
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Header + Hero "scroll-tied": un solo listener de scroll, acelerado con
    // requestAnimationFrame (nunca directo en el handler, para no forzar
    // reflow en cada evento). El header solo alterna una clase (el color
    // vive en CSS); el hero recibe una variable --scroll-progress que el
    // CSS usa para escalar/desenfocar/atenuar el fondo a medida que se
    // hace scroll, al estilo de las páginas de producto de Apple.
    const heroSection = document.getElementById('inicio');
    const headerEl = document.querySelector('header');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scrollTicking = false;

    function updateOnScroll() {
        const scrollY = window.scrollY;

        if (headerEl) headerEl.classList.toggle('is-scrolled', scrollY > 50);

        if (heroSection && !prefersReducedMotion) {
            const heroHeight = heroSection.offsetHeight || window.innerHeight;
            const progress = Math.min(Math.max(scrollY / heroHeight, 0), 1);
            heroSection.style.setProperty('--scroll-progress', progress.toFixed(3));
        }

        scrollTicking = false;
    }

    window.addEventListener('scroll', function() {
        if (!scrollTicking) {
            requestAnimationFrame(updateOnScroll);
            scrollTicking = true;
        }
    }, { passive: true });

    // Scroll-reveal: fade-up sutil al entrar en viewport. Usa
    // IntersectionObserver (nunca un listener de scroll) y un pequeño
    // stagger por tarjeta dentro de cada grid. Se salta por completo con
    // prefers-reduced-motion: el contenido queda visible desde el inicio.
    function initScrollReveal() {
        const targets = document.querySelectorAll(
            '.section-title, .section-subtitle, ' +
            '.pricing-card, .feature-card, .plan-card, .promo-card, ' +
            '.content-info, .gym-info, .contact-form, .contact-info, .service-hours, .benefit-card'
        );
        if (!targets.length) return;

        if (prefersReducedMotion || !('IntersectionObserver' in window)) {
            targets.forEach(el => el.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        targets.forEach((el, i) => {
            el.classList.add('reveal-target');
            el.style.transitionDelay = `${(i % 4) * 80}ms`;
            observer.observe(el);
        });
    }

    // ===== TEMA CLARO / OSCURO =====
    // El <head> ya aplicó el data-theme guardado antes de pintar (evita
    // parpadeo). Acá solo sincronizamos el checkbox del switch con ese
    // estado y conectamos el evento para alternar y guardar la elección.
    const THEME_STORAGE_KEY = 'temaPortal';

    function sincronizarSwitchDeTema() {
        const input = document.getElementById('themeToggleInput');
        if (!input) return;
        const esOscuro = document.documentElement.getAttribute('data-theme') !== 'light';
        input.checked = esOscuro; // checked = luna = oscuro
    }

    function alternarTemaPortal() {
        const esClaroActual = document.documentElement.getAttribute('data-theme') === 'light';
        const nuevoEsClaro = !esClaroActual;
        document.documentElement.setAttribute('data-theme', nuevoEsClaro ? 'light' : 'dark');
        try {
            localStorage.setItem(THEME_STORAGE_KEY, nuevoEsClaro ? 'light' : 'dark');
        } catch (e) { /* Almacenamiento no disponible: el tema no persiste, pero no rompe nada */ }
    }

    function initThemeSwitch() {
        sincronizarSwitchDeTema();
        const input = document.getElementById('themeToggleInput');
        if (input) input.addEventListener('change', alternarTemaPortal);
    }

    // ===== RULETA 3D DE FOTOS DEL GIMNASIO =====
    // El giro, la pausa al pasar el cursor y la reanudación al salir son
    // 100% CSS (ver ".card-3d" y "@keyframes gym3d-gira" en styles.css):
    // "animation-play-state: paused" en ":hover" congela la ruleta tal
    // cual está (sin recalcular nada en JS, sin curvas que ajustar) y al
    // quitar el cursor retoma exactamente desde ahí, porque una animación
    // CSS en pausa no pierde su punto en el tiempo. Esto reemplaza al
    // carrusel Swiper.js anterior, que resultaba frágil (se podía quedar
    // "congelado" o acelerarse de forma errática al mover el cursor
    // rápido entre fotos). Aquí en JS solo queda cablear el clic en
    // cualquier foto para abrirla en la ventana flotante.
    function initGymCarousel() {
        const ruleta = document.getElementById('gymCard3d');
        const lightbox = document.getElementById('gymLightbox');
        const lightboxImg = document.getElementById('gymLightboxImg');
        const lightboxCerrar = document.getElementById('gymLightboxCerrar');
        if (!ruleta || !lightbox || !lightboxImg) return;

        function abrirLightbox(imgEl) {
            lightboxImg.src = imgEl.currentSrc || imgEl.src;
            lightboxImg.alt = imgEl.alt || '';
            lightbox.classList.add('activo');
        }

        function cerrarLightbox() {
            lightbox.classList.remove('activo');
        }

        // Cualquier foto de la ruleta (esté al frente o de lado) abre la
        // ventana flotante al hacer clic.
        ruleta.addEventListener('click', (e) => {
            const img = e.target.closest('img');
            if (img) abrirLightbox(img);
        });

        if (lightboxCerrar) lightboxCerrar.addEventListener('click', cerrarLightbox);
        // Clic fuera de la imagen (en el fondo oscuro) también cierra.
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) cerrarLightbox();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') cerrarLightbox();
        });
    }

    // Inicialización
    function init() {
        createParticles();
        initHeroCarousel();
        initScrollReveal();
        initThemeSwitch();
        initGymCarousel();
        initPerfilTabs();
        initCambioPassword();
        switchTab('hombres');
        
        // Verificar sesión al cargar y actualizar UI
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            // Socio guardado pero SIN token (el token vive en sessionStorage y se borra al cerrar
            // el navegador): sin token no hay datos reales (asistencia, casillero, rutina), así que
            // se cierra la sesión local para que vuelva a iniciar sesión en vez de ver todo vacío.
            if (currentUser && currentUser.role === 'user' && !(window.getPortalToken && window.getPortalToken())) {
                currentUser = null;
                localStorage.removeItem('currentUser');
            }
            updateUI();
            // Entrenador con sesión guardada: reabrir su panel (si el token sigue).
            if (currentUser && currentUser.role === 'trainer') {
                if (window.getPortalToken && window.getPortalToken()) {
                    setTimeout(function () {
                        if (window.abrirPanelEntrenador) window.abrirPanelEntrenador(currentUser.name);
                    }, 0);
                } else {
                    currentUser = null;
                    localStorage.removeItem('currentUser');
                    updateUI();
                }
            }
        }
        
        // Cargar datos de ejemplo si no existen
        if (!localStorage.getItem('spassoUsers')) {
            localStorage.setItem('spassoUsers', JSON.stringify(sampleUsers));
        }
        
        // Habilitar scroll horizontal inicial
        setTimeout(() => {
            enableHorizontalScroll();
        }, 200);
        
        // Popup de promociones deshabilitado por ahora: la sección
        // Promociones está oculta (display:none) hasta que se habilite
        // dinámicamente desde la app de recepción. Descomentar cuando
        // vuelva a estar activa.
        // showPromoPopup();
    }
    
    // Llamar a la inicialización
    init();
});