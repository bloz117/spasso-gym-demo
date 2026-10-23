/**
 * Portal Client para Spasso Gym - Portal Público
 * Backend API: http://127.0.0.1:7000
 *
 * Maneja login de socios, dashboard y temas visuales
 */

// Si la página la sirve el propio backend (PC, celular por WiFi, Render) la API
// está en el mismo origen. Solo con un servidor de vista previa (Live Server,
// puerto distinto) se usa la dirección local por defecto.
function _origenApi() {
  var h = location.hostname, p = location.port;
  var esLocal = (h === 'localhost' || h === '127.0.0.1' || h === '');
  if (location.protocol.indexOf('http') === 0 && (!esLocal || p === '7000')) return location.origin;
  return 'http://127.0.0.1:7000';
}

const PORTAL_API = {
  BASE_URL: _origenApi(),
  TOKEN_KEY: 'portal_token'
};

// ==================== UTILIDADES ====================

// El token vive en sessionStorage (se borra al cerrar el navegador) o en
// localStorage (persiste) según haya marcado "Recordarme" en el login.
// getPortalToken() revisa los dos por si cambió de opción entre sesiones.
function getPortalToken() {
  return localStorage.getItem(PORTAL_API.TOKEN_KEY) || sessionStorage.getItem(PORTAL_API.TOKEN_KEY);
}

function setPortalToken(token, remember = false) {
  if (remember) {
    localStorage.setItem(PORTAL_API.TOKEN_KEY, token);
    sessionStorage.removeItem(PORTAL_API.TOKEN_KEY);
  } else {
    sessionStorage.setItem(PORTAL_API.TOKEN_KEY, token);
    localStorage.removeItem(PORTAL_API.TOKEN_KEY);
  }
}

function removePortalToken() {
  sessionStorage.removeItem(PORTAL_API.TOKEN_KEY);
  localStorage.removeItem(PORTAL_API.TOKEN_KEY);
}

function isPortalAuthenticated() {
  return !!getPortalToken();
}

async function portalFetch(endpoint, options = {}) {
  const url = `${PORTAL_API.BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const token = getPortalToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors'
    });

    let expirada = false;
    if (endpoint.indexOf('/login') === -1) {
      if (response.status === 401 && token) expirada = true;
      else if (response.status === 403) { const d = await response.clone().json().catch(() => ({})); expirada = d.detail === 'Not authenticated'; }
    }
    if (expirada) {
      // Token vencido o inválido: se limpia la sesión para no mostrar la cuenta "vacía".
      removePortalToken();
      localStorage.removeItem('currentUser');
      if (window.actualizarBotonSesion) window.actualizarBotonSesion(false);
      document.body.classList.remove('logged-in');
      setTimeout(function () { alert('Tu sesión expiró. Inicia sesión de nuevo.'); location.reload(); }, 50);
      throw new Error('Sesión expirada');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || `Error ${response.status}`);
    }

    if (response.status === 204) {
      return { success: true };
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('No se puede conectar al servidor. Verifica que esté corriendo en puerto 9000.');
    }
    throw error;
  }
}

// ==================== AUTH ====================

async function loginSocio(email, password, remember = false) {
  const response = await portalFetch('/api/portal/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (response.access_token) {
    setPortalToken(response.access_token, remember);
  }

  return response;
}

async function getSocioProfile() {
  return await portalFetch('/api/portal/me');
}

async function changePassword(_actual, newPassword) {
  return await portalFetch('/api/portal/change-password', {
    method: 'POST',
    body: JSON.stringify({ password_nuevo: newPassword })
  });
}

function logoutSocio() {
  // window.cerrarSesionCompleta (funciones.js) ya limpia el token real,
  // el currentUser guardado en localStorage, cierra los modales y repinta
  // el botón del header - todo sin recargar la página. Antes acá se hacía
  // location.reload(), lo que además dejaba currentUser sin limpiar en el
  // primer paso, así que al volver a presionar "Iniciar Sesión" el header
  // detectaba una sesión "activa" y disparaba otro logout con recarga en
  // vez de abrir el formulario de login.
  if (window.cerrarSesionCompleta) {
    window.cerrarSesionCompleta();
  } else {
    removePortalToken();
    localStorage.removeItem('currentUser');
    location.reload();
  }
}

// ==================== DATOS DEL SOCIO ====================

async function getSocioPlan() {
  return await portalFetch('/api/portal/me/plan');
}

async function getSocioRoutines() {
  return await portalFetch('/api/portal/me/routines');
}

async function getSocioVisits(limite = 60) {
  return await portalFetch(`/api/portal/me/visits?limite=${limite}`);
}

async function getSocioStats() {
  return await portalFetch('/api/portal/me/stats');
}

async function getSocioLocker() {
  return await portalFetch('/api/portal/me/locker');
}

// ==================== CMS TEMAS ====================

async function getActiveTheme() {
  return await portalFetch('/api/cms/active-theme');
}

function applyTheme(theme) {
  if (!theme || !theme.configuracion) return;
  
  const config = theme.configuracion;
  const root = document.documentElement;
  
  // Aplicar paleta de colores
  if (config.paleta) {
    const palettes = {
      midnight_fire: {
        primary: '#1a1a2e',
        secondary: '#e94560',
        accent: '#e94560',
        background: '#f8f9fa'
      },
      ocean_sport: {
        primary: '#0077be',
        secondary: '#00d4ff',
        accent: '#00d4ff',
        background: '#e8f4f8'
      },
      forest_strength: {
        primary: '#2d5016',
        secondary: '#76c893',
        accent: '#76c893',
        background: '#f1f8e9'
      },
      sunset_energy: {
        primary: '#ff6b35',
        secondary: '#ffd23f',
        accent: '#ffd23f',
        background: '#fff8e1'
      },
      monochrome_elite: {
        primary: '#2b2d42',
        secondary: '#8d99ae',
        accent: '#8d99ae',
        background: '#f8f9fa'
      }
    };
    
    const palette = palettes[config.paleta] || palettes.midnight_fire;
    root.style.setProperty('--primary-color', palette.primary);
    root.style.setProperty('--secondary-color', palette.secondary);
    root.style.setProperty('--accent-color', palette.accent);
    root.style.setProperty('--bg-color', palette.background);
  }
  
  // Aplicar tipografía
  if (config.tipografia) {
    const fonts = {
      roboto_modern: "'Roboto', sans-serif",
      montserrat_bold: "'Montserrat', sans-serif",
      inter_clean: "'Inter', sans-serif",
      oswald_sport: "'Oswald', sans-serif",
      playfair_premium: "'Playfair Display', serif"
    };
    
    const font = fonts[config.tipografia] || fonts.montserrat_bold;
    root.style.setProperty('--main-font', font);
  }
  
  // Aplicar música de fondo elegida desde Recepción (Configuración >
  // Página Web). window.__cambiarPistaMusicaPortal lo expone funciones.js,
  // que además ya decidió ahí mismo si esta página está embebida en un
  // iframe (Recepción) y por lo tanto debe quedarse muda pase lo que pase.
  if (config.musica && typeof window.__cambiarPistaMusicaPortal === 'function') {
    window.__cambiarPistaMusicaPortal(config.musica);
  }

  // Igual que la música: si Recepción eligió otras imágenes para el
  // carrusel del inicio (Configuración > Página Web), funciones.js expone
  // window.__establecerImagenesHero para reemplazarlas ahí mismo. Acá solo
  // le anteponemos 'img/' a cada nombre de archivo que manda el backend.
  if (Array.isArray(config.hero_imagenes) && config.hero_imagenes.length &&
      typeof window.__establecerImagenesHero === 'function') {
    window.__establecerImagenesHero(config.hero_imagenes.map(f => 'img/' + f));
  }

  // El fondo de la página ya no lo define Recepción: lo elige cada visitante
  // con el selector de fondo (ver js/fondos-portal.js).

  // Aplicar estilo de botones
  if (config.botones) {
    const buttonStyles = {
      rounded_full: '50px',
      rounded_md: '10px',
      square: '0',
      pill_outline: '50px',
      neon_border: '5px'
    };
    
    const borderRadius = buttonStyles[config.botones] || '10px';
    root.style.setProperty('--button-radius', borderRadius);
  }
  
  console.log('✅ Tema aplicado:', config);
}

// ==================== UI HELPERS ====================

function showNotification(message, type = 'info') {
  // Crear notificación toast
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    padding: 15px 25px;
    background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#0ea5e9'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatCurrency(amount) {
  return `${amount.toFixed(2)} Bs`;
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
  try {
    const profile = await getSocioProfile();
    let plan = null;
    try {
      const planResp = await getSocioPlan();
      plan = planResp.plan || null;
    } catch (e) {
      console.warn('No se pudo obtener el plan del socio:', e);
    }

    // Ocultar modal de login por si estaba abierto
    const loginModalEl = document.getElementById('loginModal');
    if (loginModalEl) { loginModalEl.classList.remove('is-open'); loginModalEl.style.display = ''; }

    // El HTML real de #profileModal (sidebar: Resumen/Membresía/Rutinas/
    // Alimentación/Promociones) y su lógica viven en funciones.js. Este
    // archivo solo trae los datos del backend y se los pasa a ese puente,
    // nunca debe reescribir el modal directamente.
    if (window.aplicarSesionSocio) {
      window.aplicarSesionSocio(profile, plan);
    }

  } catch (error) {
    console.error('Error al cargar dashboard:', error);
    showNotification('Error al cargar datos del perfil', 'error');
  }
}

function showChangePassword() {
  const newPassword = prompt('Nueva contraseña:');
  if (!newPassword) return;
  
  const confirmPassword = prompt('Confirmar nueva contraseña:');
  if (newPassword !== confirmPassword) {
    showNotification('Las contraseñas no coinciden', 'error');
    return;
  }
  
  changePassword(null, newPassword)
    .then(() => {
      showNotification('✅ Contraseña actualizada correctamente', 'success');
    })
    .catch(error => {
      showNotification('❌ ' + error.message, 'error');
    });
}

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async function() {
  // Cargar tema activo
  try {
    const theme = await getActiveTheme();
    applyTheme(theme);
  } catch (error) {
    console.log('No se pudo cargar tema CMS, usando tema por defecto');
  }
  
  // Si ya está autenticado, cargar dashboard
  // (La cuenta de Entrenador no tiene perfil de socio: funciones.js reabre su panel.)
  let esEntrenador = false;
  try { esEntrenador = (JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).role === 'trainer'; } catch (e) {}
  if (isPortalAuthenticated() && !esEntrenador) {
    loadDashboard();
  }
  
  // Event listeners para login manejados en funciones.js
  // (comentado para evitar conflictos con el event listener existente)
  
  console.log('✅ Portal Client inicializado');
  console.log('📡 API:', PORTAL_API.BASE_URL);
});

// Exportar funciones globalmente
window.PORTAL = {
  loginSocio,
  logoutSocio,
  getSocioProfile,
  loadDashboard,
  isAuthenticated: isPortalAuthenticated
};
