/**
 * API Client para Spasso Gym - Sistema de Recepción
 * Backend: http://127.0.0.1:7000
 * 
 * Todas las llamadas al API incluyen automáticamente el JWT
 * Token almacenado en sessionStorage (clave: 'jwt_token')
 */

const API_CONFIG = {
  BASE_URL: 'http://127.0.0.1:7000',
  TIMEOUT: 30000, // 30 segundos
  TOKEN_KEY: 'jwt_token'
};

/**
 * Función centralizada para llamadas HTTP
 * @param {string} method - GET, POST, PUT, DELETE
 * @param {string} path - Ruta del endpoint (ej: '/api/auth/login')
 * @param {object} body - Datos a enviar (opcional)
 * @param {boolean} requireAuth - Si requiere JWT (por defecto true)
 * @returns {Promise<object>} Respuesta del servidor
 */
async function apiCall(method, path, body = null, requireAuth = true) {
  const url = `${API_CONFIG.BASE_URL}${path}`;
  
  const headers = {
    'Content-Type': 'application/json',
  };

  // Inyectar JWT automáticamente si está disponible
  if (requireAuth) {
    const token = sessionStorage.getItem(API_CONFIG.TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      throw new Error('No hay sesión activa. Por favor inicia sesión.');
    }
  }

  const options = {
    method,
    headers,
    mode: 'cors',
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    options.signal = controller.signal;
    
    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    // Manejar errores HTTP
    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}`;

      try {
        const errorData = await response.json();
        const detail = errorData.detail || errorData.message;

        if (Array.isArray(detail)) {
          errorMessage = detail
            .map(e => {
              const campo = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : '';
              return campo ? `${campo}: ${e.msg}` : e.msg;
            })
            .join(' | ');
        } else if (typeof detail === 'string' && detail) {
          errorMessage = detail;
        } else if (detail) {
          errorMessage = JSON.stringify(detail);
        }
      } catch (e) {
        // Si no puede parsear JSON, usar mensaje por defecto
      }

      throw new Error(errorMessage);
    }

    // Manejar respuesta vacía (204 No Content)
    if (response.status === 204) {
      return { success: true };
    }

    return await response.json();

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verifica tu conexión.');
    }
    
    if (error.message.includes('Failed to fetch')) {
      throw new Error('No se pudo conectar al servidor. Verifica que el backend esté corriendo en puerto 5000.');
    }

    throw error;
  }
}

// ==================== MÓDULO AUTH ====================

const auth = {
  /**
   * Login de usuario (recepción/admin)
   * @param {string} usuario - Nombre de usuario
   * @param {string} password - Contraseña
   * @returns {Promise<object>} { access_token, token_type, usuario, rol }
   */
  async login(usuario, password) {
    const response = await apiCall('POST', '/api/auth/login', 
      { usuario, password }, 
      false // No requiere auth
    );
    
    // Guardar token en sessionStorage
    if (response.access_token) {
      sessionStorage.setItem(API_CONFIG.TOKEN_KEY, response.access_token);
    }
    
    return response;
  },

  /**
   * Obtener información del usuario actual
   * @returns {Promise<object>} Datos del usuario
   */
  async me() {
    return await apiCall('GET', '/api/auth/me');
  },

  /**
   * Cerrar sesión (elimina token)
   */
  logout() {
    sessionStorage.removeItem(API_CONFIG.TOKEN_KEY);
  },

  /**
   * Verifica si hay sesión activa
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!sessionStorage.getItem(API_CONFIG.TOKEN_KEY);
  },

  /**
   * Obtiene el token actual
   * @returns {string|null}
   */
  getToken() {
    return sessionStorage.getItem(API_CONFIG.TOKEN_KEY);
  }
};

// ==================== MÓDULO SOCIOS ====================

const socios = {
  /**
   * Listar todos los socios
   * @returns {Promise<Array>} Lista de socios
   */
  async listar() {
    return await apiCall('GET', '/api/socios');
  },

  /**
   * Crear un nuevo socio
   * @param {object} socioData - Datos del socio
   * @returns {Promise<object>} Socio creado + credenciales del portal
   */
  async crear(socioData) {
    return await apiCall('POST', '/api/socios', socioData);
  },

  /**
   * Obtener un socio por ID
   * @param {string} id - UUID del socio
   * @returns {Promise<object>} Datos del socio
   */
  async obtener(id) {
    return await apiCall('GET', `/api/socios/${id}`);
  },

  /**
   * Actualizar un socio
   * @param {string} id - UUID del socio
   * @param {object} socioData - Datos a actualizar
   * @returns {Promise<object>} Socio actualizado
   */
  async actualizar(id, socioData) {
    return await apiCall('PUT', `/api/socios/${id}`, socioData);
  },

  /**
   * Eliminar un socio
   * @param {string} id - UUID del socio
   * @returns {Promise<object>} Confirmación
   */
  async eliminar(id) {
    return await apiCall('DELETE', `/api/socios/${id}`);
  },

  /**
   * Buscar socio por huella (simulado)
   * @param {string} huella - Código de huella
   * @returns {Promise<object>} Socio encontrado
   */
  async buscarPorHuella(huella) {
    return await apiCall('POST', '/api/socios/buscar-huella', { huella });
  },

  /**
   * Buscar socios por DNI, nombre o apellido
   * @param {string} q - Texto de búsqueda (mínimo 2 caracteres)
   * @returns {Promise<Array>} Coincidencias
   */
  async buscar(q) {
    return await apiCall('GET', `/api/socios/buscar?q=${encodeURIComponent(q)}`);
  },

  /**
   * Lista de socios con membresía por vencer o vencida
   * @returns {Promise<Array>} Lista de vencimientos
   */
  async vencimientos() {
    return await apiCall('GET', '/api/socios/vencimientos');
  },

  /**
   * Renovar/crear la membresía de un socio
   * @param {number} idSocio - ID del socio
   * @param {object} data - { plan, tipo_membresia, duracion_dias, monto, metodo_pago }
   * @returns {Promise<object>} Membresía creada
   */
  async renovar(idSocio, data) {
    return await apiCall('POST', `/api/socios/${idSocio}/renovar`, data);
  }
};

// ==================== MÓDULO ASISTENCIAS ====================

const asistenciasAPI = {
  /**
   * Registrar asistencia de un socio
   * @param {string} socio_id - UUID del socio
   * @returns {Promise<object>} Asistencia registrada
   */
  async registrar(dni_socio) {
    return await apiCall('POST', '/api/asistencias', { dni_socio });
  },

  /**
   * Ingresos registrados hoy
   * @returns {Promise<object>} { fecha, total_ingresos, ingresos: [...] }
   */
  async hoy() {
    return await apiCall('GET', '/api/asistencias/hoy');
  },

  /**
   * Listar asistencias con filtros opcionales
   * @param {object} filtros - { fecha_inicio, fecha_fin, socio_id }
   * @returns {Promise<Array>} Lista de asistencias
   */
  async listar(filtros = {}) {
    const params = new URLSearchParams(filtros);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiCall('GET', `/api/asistencias${query}`);
  },

  /**
   * Obtener estadísticas de asistencias
   * @param {string} periodo - 'dia', 'semana', 'mes'
   * @returns {Promise<object>} Estadísticas
   */
  async estadisticas(periodo = 'mes') {
    return await apiCall('GET', `/api/asistencias/stats?periodo=${periodo}`);
  }
};

// ==================== MÓDULO VENTAS ====================

const ventas = {
  /**
   * Registrar una venta
   * @param {object} ventaData - Datos de la venta
   * @returns {Promise<object>} Venta registrada
   */
  async registrar(ventaData) {
    return await apiCall('POST', '/api/ventas/', ventaData);
  },

  /**
   * Listar ventas con filtros
   * @param {object} filtros - { fecha_inicio, fecha_fin }
   * @returns {Promise<Array>} Lista de ventas
   */
  async listar(filtros = {}) {
    const params = new URLSearchParams(filtros);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiCall('GET', `/api/ventas/${query}`);
  },

  /**
   * Obtener reporte de ventas
   * @param {string} periodo - 'dia', 'semana', 'mes'
   * @returns {Promise<object>} Reporte
   */
  async reporte(periodo = 'mes') {
    return await apiCall('GET', `/api/ventas/reporte?periodo=${periodo}`);
  },

  /**
   * Historial paginado de ventas
   * @param {number} pagina
   * @returns {Promise<object>} { total, pagina, por_pagina, ventas: [...] }
   */
  async historial(pagina = 1) {
    return await apiCall('GET', `/api/ventas/historial?pagina=${pagina}`);
  },

  /**
   * Resumen financiero del día
   * @returns {Promise<object>} { total_ventas, monto_total, monto_recepcion }
   */
  async resumenHoy() {
    return await apiCall('GET', '/api/ventas/resumen-hoy');
  }
};

// ==================== MÓDULO LOCKERS ====================

const lockers = {
  /**
   * Listar todos los lockers
   * @returns {Promise<Array>} Lista de lockers
   */
  async listar() {
    return await apiCall('GET', '/api/lockers/');
  },

  /**
   * Asignar locker a un socio
   * @param {number} idLocker - ID interno del locker (id_locker en BD)
   * @param {number} idSocio - ID del socio
   * @returns {Promise<object>} Locker asignado
   */
  async asignar(idLocker, idSocio) {
    return await apiCall('POST', `/api/lockers/${idLocker}/asignar`, { id_socio: idSocio });
  },

  /**
   * Liberar un locker
   * @param {number} idLocker - ID interno del locker (id_locker en BD)
   * @returns {Promise<object>} Locker liberado
   */
  async liberar(idLocker) {
    return await apiCall('POST', `/api/lockers/${idLocker}/liberar`);
  },

  /**
   * Actualizar cantidad de lockers
   * @param {number} cantidad - Nueva cantidad total
   * @returns {Promise<object>} Confirmación
   */
  async actualizarCantidad(cantidad) {
    return await apiCall('PUT', '/api/lockers/cantidad', { cantidad });
  }
};

// ==================== MÓDULO CMS ====================

const cms = {
  /**
   * Obtener tema visual activo
   * @returns {Promise<object>} Configuración del tema
   */
  async obtenerTema() {
    return await apiCall('GET', '/api/cms/themes/active');
  },

  /**
   * Crear o actualizar tema visual
   * @param {object} themeData - Configuración del tema
   * @returns {Promise<object>} Tema guardado
   */
  async guardarTema(themeData) {
    return await apiCall('POST', '/api/cms/themes', themeData);
  },

  /**
   * Listar todos los temas
   * @returns {Promise<Array>} Lista de temas
   */
  async listarTemas() {
    return await apiCall('GET', '/api/cms/themes');
  },

  /**
   * Activar un tema específico
   * @param {string} theme_id - UUID del tema
   * @returns {Promise<object>} Confirmación
   */
  async activarTema(theme_id) {
    return await apiCall('PUT', `/api/cms/themes/${theme_id}/activate`);
  }
};

// ==================== MÓDULO GYM CONFIG ====================

const gymConfig = {
  /**
   * Obtener configuración del gimnasio
   * @returns {Promise<object>} Configuración actual
   */
  async obtener() {
    return await apiCall('GET', '/api/gym/config');
  },

  /**
   * Actualizar configuración del gimnasio
   * @param {object} configData - Nueva configuración
   * @returns {Promise<object>} Configuración actualizada
   */
  async actualizar(configData) {
    return await apiCall('PUT', '/api/gym/config', configData);
  },

  /**
   * Toggle módulo de lockers
   * @param {boolean} habilitado - true/false
   * @param {number} cantidad - Cantidad de lockers (opcional)
   * @returns {Promise<object>} Configuración actualizada
   */
  async toggleLockers(habilitado, cantidad = null) {
    const payload = { lockers_habilitado: habilitado };
    if (cantidad !== null) {
      payload.cantidad_lockers = cantidad;
    }
    return await apiCall('PUT', '/api/gym/config', payload);
  }
};

// ==================== MÓDULO RUTINAS ====================

const rutinas = {
  /**
   * Listar rutinas de un socio
   * @param {string} socio_id - UUID del socio
   * @returns {Promise<Array>} Lista de rutinas
   */
  async listarPorSocio(socio_id) {
    return await apiCall('GET', `/api/routines/socio/${socio_id}`);
  },

  /**
   * Crear rutina para un socio
   * @param {object} rutinaData - Datos de la rutina
   * @returns {Promise<object>} Rutina creada
   */
  async crear(rutinaData) {
    return await apiCall('POST', '/api/routines', rutinaData);
  },

  /**
   * Actualizar rutina existente
   * @param {string} id - UUID de la rutina
   * @param {object} rutinaData - Datos a actualizar
   * @returns {Promise<object>} Rutina actualizada
   */
  async actualizar(id, rutinaData) {
    return await apiCall('PUT', `/api/routines/${id}`, rutinaData);
  },

  /**
   * Eliminar rutina
   * @param {string} id - UUID de la rutina
   * @returns {Promise<object>} Confirmación
   */
  async eliminar(id) {
    return await apiCall('DELETE', `/api/routines/${id}`);
  }
};

// ==================== UTILIDADES ====================

const utils = {
  /**
   * Formatear fecha para el API (YYYY-MM-DD)
   * @param {Date} date - Objeto Date
   * @returns {string} Fecha formateada
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Parsear fecha del API a objeto Date
   * @param {string} dateString - Fecha en formato ISO
   * @returns {Date} Objeto Date
   */
  parseDate(dateString) {
    return new Date(dateString);
  },

  /**
   * Verificar estado del servidor
   * @returns {Promise<boolean>} true si el servidor está disponible
   */
  async checkHealth() {
    try {
      const response = await apiCall('GET', '/api/health', null, false);
      return response.status === 'ok';
    } catch (error) {
      return false;
    }
  }
};

// ==================== EXPORTAR MÓDULOS ====================

// Si se usa como módulo ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    apiCall,
    auth,
    socios,
    asistencias: asistenciasAPI,
    ventas,
    lockers,
    cms,
    gymConfig,
    rutinas,
    utils,
    API_CONFIG
  };
}

// Si se carga directamente en el navegador, hacer disponibles globalmente
if (typeof window !== 'undefined') {
  window.API = {
    call: apiCall,
    auth,
    socios,
    asistencias: asistenciasAPI,
    ventas,
    lockers,
    cms,
    gymConfig,
    rutinas,
    utils,
    config: API_CONFIG
  };
  
  console.log('✅ API Client cargado correctamente');
  console.log('📡 Backend: ' + API_CONFIG.BASE_URL);
  console.log('🔑 Token almacenado en:', API_CONFIG.TOKEN_KEY);
}
