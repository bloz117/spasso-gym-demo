/**
 * Portal Client para Spasso Gym - Portal Público
 * Backend API: http://127.0.0.1:9000
 * 
 * Maneja login de socios, dashboard y temas visuales
 */

const PORTAL_API = {
  BASE_URL: 'http://127.0.0.1:9000',
  TOKEN_KEY: 'portal_token'
};

// ==================== UTILIDADES ====================

function getPortalToken() {
  return sessionStorage.getItem(PORTAL_API.TOKEN_KEY);
}

function setPortalToken(token) {
  sessionStorage.setItem(PORTAL_API.TOKEN_KEY, token);
}

function removePortalToken() {
  sessionStorage.removeItem(PORTAL_API.TOKEN_KEY);
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

async function loginSocio(email, password) {
  const response = await portalFetch('/api/portal/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  
  if (response.access_token) {
    setPortalToken(response.access_token);
  }
  
  return response;
}

async function getSocioProfile() {
  return await portalFetch('/api/portal/me');
}

async function changePassword(currentPassword, newPassword) {
  return await portalFetch('/api/portal/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  });
}

function logoutSocio() {
  removePortalToken();
  location.reload();
}

// ==================== DATOS DEL SOCIO ====================

async function getSocioPlan() {
  return await portalFetch('/api/portal/me/plan');
}

async function getSocioRoutines() {
  return await portalFetch('/api/portal/me/routines');
}

async function getSocioVisits() {
  return await portalFetch('/api/portal/me/visits');
}

async function getSocioStats() {
  return await portalFetch('/api/portal/me/stats');
}

async function getSocioLocker() {
  return await portalFetch('/api/portal/me/locker');
}

// ==================== CMS TEMAS ====================

async function getActiveTheme() {
  return await portalFetch('/api/cms/themes/active');
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
    right: 20px;
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
    const [profile, plan, routines, visits, stats, locker] = await Promise.all([
      getSocioProfile(),
      getSocioPlan().catch(() => null),
      getSocioRoutines().catch(() => []),
      getSocioVisits().catch(() => []),
      getSocioStats().catch(() => ({})),
      getSocioLocker().catch(() => null)
    ]);
    
    // Mostrar dashboard
    renderDashboard(profile, plan, routines, visits, stats, locker);
    
  } catch (error) {
    console.error('Error al cargar dashboard:', error);
    showNotification('Error al cargar datos del perfil', 'error');
  }
}

function renderDashboard(profile, plan, routines, visits, stats, locker) {
  // Ocultar modal de login
  document.getElementById('loginModal').style.display = 'none';
  
  // Actualizar botón de login a perfil
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${profile.nombre || 'Mi Perfil'}`;
    loginBtn.onclick = () => document.getElementById('profileModal').style.display = 'flex';
  }
  
  // Renderizar modal de perfil
  const profileModal = document.getElementById('profileModal');
  if (profileModal) {
    const modalContent = profileModal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.innerHTML = `
        <span class="close-modal">&times;</span>
        <h2>Mi Perfil</h2>
        <div class="profile-info">
          <div class="profile-header">
            <i class="fas fa-user-circle" style="font-size: 80px; color: var(--primary-color);"></i>
            <h3>${profile.nombre} ${profile.apellido || ''}</h3>
            <p>${profile.email}</p>
          </div>
          
          ${plan ? `
          <div class="plan-section">
            <h4><i class="fas fa-dumbbell"></i> Plan Activo</h4>
            <div class="plan-card">
              <div class="plan-name">${plan.nombre_plan}</div>
              <div class="plan-dates">
                <span>Inicio: ${formatDate(plan.fecha_inicio)}</span>
                <span>Vence: ${formatDate(plan.fecha_vencimiento)}</span>
              </div>
              <div class="plan-status ${plan.estado === 'activo' ? 'active' : 'inactive'}">
                ${plan.estado === 'activo' ? '✅ Activo' : '⚠️ Vencido'}
              </div>
            </div>
          </div>
          ` : ''}
          
          ${locker ? `
          <div class="locker-section">
            <h4><i class="fas fa-door-closed"></i> Mi Locker</h4>
            <div class="locker-card">
              <div class="locker-number">#${locker.numero}</div>
              <p>Asignado el ${formatDate(locker.fecha_asignacion)}</p>
            </div>
          </div>
          ` : ''}
          
          ${stats && stats.total_visitas ? `
          <div class="stats-section">
            <h4><i class="fas fa-chart-line"></i> Estadísticas</h4>
            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-number">${stats.total_visitas || 0}</div>
                <div class="stat-label">Visitas Totales</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">${stats.visitas_mes || 0}</div>
                <div class="stat-label">Este Mes</div>
              </div>
            </div>
          </div>
          ` : ''}
          
          ${routines && routines.length > 0 ? `
          <div class="routines-section">
            <h4><i class="fas fa-list-check"></i> Mis Rutinas</h4>
            <div class="routines-list">
              ${routines.map(r => `
                <div class="routine-card">
                  <h5>${r.nombre}</h5>
                  <p>${r.descripcion || ''}</p>
                  <div class="routine-days">${r.dias_semana ? r.dias_semana.join(', ') : ''}</div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          <div class="profile-actions">
            <button class="btn-secondary" onclick="showChangePassword()">
              <i class="fas fa-key"></i> Cambiar Contraseña
            </button>
            <button class="btn-danger" onclick="logoutSocio()">
              <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
            </button>
          </div>
        </div>
      `;
      
      // Agregar event listener al botón cerrar
      const closeBtn = modalContent.querySelector('.close-modal');
      if (closeBtn) {
        closeBtn.onclick = () => profileModal.style.display = 'none';
      }
    }
  }
}

function showChangePassword() {
  const currentPassword = prompt('Contraseña actual:');
  if (!currentPassword) return;
  
  const newPassword = prompt('Nueva contraseña:');
  if (!newPassword) return;
  
  const confirmPassword = prompt('Confirmar nueva contraseña:');
  if (newPassword !== confirmPassword) {
    showNotification('Las contraseñas no coinciden', 'error');
    return;
  }
  
  changePassword(currentPassword, newPassword)
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
  if (isPortalAuthenticated()) {
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
