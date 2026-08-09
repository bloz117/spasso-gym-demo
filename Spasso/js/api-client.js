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
          // Errores de validación de Pydantic (422): lista de
          // { loc: [...], msg: "...", type: "..." }
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
      throw new Error('No se pudo conectar al servidor. Verifica que el backend esté corriendo en puerto 7000.');
    }

    throw error;
  }
}

// ==================== MÓDULO AUTH ====================

const authAPI = {
  /**
   * Login de usuario (recepción/admin)
   * @param {string} usuario - Nombre de usuario
   * @param {string} password - Contraseña
   * @returns {Promise<object>} { access_token, token_type, usuario, rol }
   */
  async login(usuario, password) {
    const response = await apiCall('POST', '/api/auth/login', 
      { username: usuario, password }, 
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
   * Listar cuentas del sistema (solo Administrador)
   * @returns {Promise<Array>} Lista de usuarios
   */
  async listarUsuarios() {
    return await apiCall('GET', '/api/auth/usuarios');
  },

  /**
   * Crear una nueva cuenta del sistema (solo Administrador)
   * @param {object} data - { username, password, rol }
   * @returns {Promise<object>} Usuario creado
   */
  async crearUsuario(data) {
    return await apiCall('POST', '/api/auth/usuarios', data);
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

const sociosAPI = {
  /**
   * Listar todos los socios
   * @returns {Promise<Array>} Lista de socios
   */
  async listar() {
    return await apiCall('GET', '/api/socios/');
  },

  /**
   * Crear un nuevo socio
   * @param {object} socioData - Datos del socio
   * @returns {Promise<object>} Socio creado + credenciales del portal
   */
  async crear(socioData) {
    return await apiCall('POST', '/api/socios/', socioData);
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
    return await apiCall('POST', '/api/asistencias/', { dni_socio });
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
  },

  /**
   * Historial de asistencias con locker/salida/turno/duración, para la
   * tabla "Historial de Asistencias del Día" del módulo de Asistencia.
   * @param {string} periodo - 'hoy', 'ayer', 'semana', 'mes'
   * @returns {Promise<object>} { periodo, total, registros: [...] }
   */
  async historial(periodo = 'hoy') {
    return await apiCall('GET', `/api/asistencias/historial?periodo=${periodo}`);
  }
};

// ==================== MÓDULO VENTAS ====================

const ventasAPI = {
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

// ==================== MÓDULO PRODUCTOS / INVENTARIO ====================

const productosAPI = {
  /**
   * Listar productos del inventario
   * @returns {Promise<Array>} Lista de productos
   */
  async listar() {
    return await apiCall('GET', '/api/productos/');
  },

  /**
   * Crear un producto nuevo (solo Administrador)
   * @param {object} data - { codigo, nombre, categoria, precio_compra, precio_venta, cantidad, stock_minimo, stock_maximo, imagen_url }
   * @returns {Promise<object>} Producto creado
   */
  async crear(data) {
    return await apiCall('POST', '/api/productos/', data);
  },

  /**
   * Actualizar un producto existente (solo Administrador)
   * @param {number} idProducto
   * @param {object} data
   * @returns {Promise<object>} Producto actualizado
   */
  async actualizar(idProducto, data) {
    return await apiCall('PUT', `/api/productos/${idProducto}`, data);
  },

  /**
   * Registrar entrada/salida/ajuste de stock (solo Administrador)
   * @param {number} idProducto
   * @param {object} data - { tipo: 'entrada'|'salida'|'ajuste', cantidad, motivo }
   * @returns {Promise<object>} { success, cantidad_actual }
   */
  async registrarStock(idProducto, data) {
    return await apiCall('POST', `/api/productos/${idProducto}/stock`, data);
  },

  /**
   * Desactivar (eliminar) un producto (solo Administrador)
   * @param {number} idProducto
   * @returns {Promise<object>} Confirmación
   */
  async eliminar(idProducto) {
    return await apiCall('DELETE', `/api/productos/${idProducto}`);
  }
};

// ==================== MÓDULO ESTADÍSTICAS ====================

const statsAPI = {
  /**
   * Estadísticas del dashboard principal
   * @returns {Promise<object>}
   */
  async dashboard() {
    return await apiCall('GET', '/api/stats/dashboard');
  },

  /**
   * Ingresos reales de los últimos 6 meses
   * @returns {Promise<object>} { meses: [{ mes, total }] }
   */
  async ingresosMensuales() {
    return await apiCall('GET', '/api/stats/ingresos-mensuales');
  }
};

// ==================== MÓDULO BIOMETRÍA (huella real) ====================

const biometriaAPI = {
  /**
   * Guarda (o reemplaza) la huella real de un socio, a partir de hasta 3
   * capturas del mismo dedo (se piden 3 toques para que quede bien
   * registrada y de forma segura — el backend rechaza el enrolamiento
   * completo si las capturas no coinciden entre sí).
   * @param {number} idSocio
   * @param {string|string[]} imagenesBase64 - una imagen o un array de hasta 3 (recomendado: 3)
   * @returns {Promise<object>} { id_huella, calidad_puntos, muestras_guardadas }
   */
  async enrolar(idSocio, imagenesBase64) {
    const imagenes = Array.isArray(imagenesBase64) ? imagenesBase64 : [imagenesBase64];
    return await apiCall('POST', '/api/biometria/enrolar', { id_socio: idSocio, imagenes_base64: imagenes });
  },

  /**
   * Valida que un grupo de capturas (hasta 3) tengan buena calidad y sean
   * del mismo dedo entre sí, SIN guardar nada todavía. Se usa en Registro
   * para avisar de inmediato si algo salió mal apenas se toman los 3
   * toques, antes de que la recepcionista siga llenando el resto del
   * formulario (el socio, y por lo tanto el enrolamiento real, recién se
   * crea al final).
   * @param {string[]} imagenesBase64
   * @returns {Promise<object>} { valido, muestras_validas }
   */
  async validarMuestras(imagenesBase64) {
    return await apiCall('POST', '/api/biometria/validar-muestras', { imagenes_base64: imagenesBase64 });
  },

  /**
   * Identifica a qué socio pertenece una huella recién capturada.
   * @param {string} imagenBase64
   * @returns {Promise<object>} { encontrado, id_socio, nombres, apellidos, dni, similitud }
   */
  async identificar(imagenBase64) {
    return await apiCall('POST', '/api/biometria/identificar', { imagen_base64: imagenBase64 });
  },

  /**
   * Indica si un socio ya tiene una huella registrada.
   * @param {number} idSocio
   * @returns {Promise<object>} { registrada, calidad_puntos, fecha_registro }
   */
  async estado(idSocio) {
    return await apiCall('GET', `/api/biometria/estado/${idSocio}`);
  },

  /**
   * Widget flotante de asistencia: identifica al socio y, en la misma
   * llamada, registra entrada o salida (y asigna/libera casillero según
   * la configuración del gimnasio).
   * @param {string} imagenBase64
   * @returns {Promise<object>} { encontrado, tipo, locker_asignado|locker_liberado|requiere_seleccion_locker, ... }
   */
  async marcarAsistencia(imagenBase64) {
    return await apiCall('POST', '/api/biometria/marcar-asistencia', { imagen_base64: imagenBase64 });
  },

  /**
   * Confirma manualmente el casillero elegido por la recepcionista para
   * una entrada recién registrada por marcarAsistencia().
   * @param {number} idLog
   * @param {number} idLocker
   */
  async asignarLockerAsistencia(idLog, idLocker) {
    return await apiCall('POST', '/api/biometria/asignar-locker-asistencia', { id_log: idLog, id_locker: idLocker });
  }
};

// ==================== MÓDULO LOCKERS ====================

const lockersAPI = {
  /**
   * Listar todos los lockers
   * @returns {Promise<Array>} Lista de lockers
   */
  async listar() {
    return await apiCall('GET', '/api/lockers/');
  },

  /**
   * Asignar locker a un socio
   * @param {number} numero - Número del locker
   * @param {string} socio_id - UUID del socio
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

const cmsAPI = {
  /**
   * Obtener tema visual activo
   * @returns {Promise<object>} Configuración del tema
   */
  async obtenerTema() {
    return await apiCall('GET', '/api/cms/active-theme');
  },

  /**
   * Crear o actualizar tema visual
   * @param {object} themeData - Configuración del tema
   * @returns {Promise<object>} Tema guardado
   */
  async guardarTema(themeData) {
    return await apiCall('PUT', '/api/cms/themes/1', themeData);
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
    return await apiCall('POST', `/api/cms/themes/${theme_id}/activate`);
  }
};

// ==================== MÓDULO GYM CONFIG ====================

const gymConfigAPI = {
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
    return await apiCall('POST', '/api/gym/config/toggle-lockers', payload);
  }
};

// ==================== MÓDULO RUTINAS ====================

const rutinasAPI = {
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

const utilsAPI = {
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
      const response = await apiCall('GET', '/api/gym/health', null, false);
      return response.status === 'ok';
    } catch (error) {
      return false;
    }
  }
};

// ==================== MÓDULO PLANES (catálogo editable) ====================

const planesAPI = {
  /**
   * Categorías (pestañas) con sus planes anidados. Único endpoint que
   * necesitan Registro, Renovaciones y el panel de Configuración.
   * @returns {Promise<Array>} [{ id_categoria, nombre, orden, activo, planes: [...] }]
   */
  async listarCategorias() {
    return await apiCall('GET', '/api/planes/categorias');
  },

  async crearCategoria(nombre) {
    return await apiCall('POST', '/api/planes/categorias', { nombre });
  },

  async actualizarCategoria(idCategoria, data) {
    return await apiCall('PUT', `/api/planes/categorias/${idCategoria}`, data);
  },

  async eliminarCategoria(idCategoria) {
    return await apiCall('DELETE', `/api/planes/categorias/${idCategoria}`);
  },

  async crearPlan(data) {
    return await apiCall('POST', '/api/planes/', data);
  },

  async actualizarPlan(idPlan, data) {
    return await apiCall('PUT', `/api/planes/${idPlan}`, data);
  },

  async eliminarPlan(idPlan) {
    return await apiCall('DELETE', `/api/planes/${idPlan}`);
  }
};

// ==================== EXPORTAR MÓDULOS ====================

// Si se usa como módulo ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    apiCall,
    auth: authAPI,
    socios: sociosAPI,
    asistencias: asistenciasAPI,
    ventas: ventasAPI,
    productos: productosAPI,
    stats: statsAPI,
    biometria: biometriaAPI,
    lockers: lockersAPI,
    cms: cmsAPI,
    gymConfig: gymConfigAPI,
    rutinas: rutinasAPI,
    planes: planesAPI,
    utils: utilsAPI,
    API_CONFIG
  };
}

// Si se carga directamente en el navegador, hacer disponibles globalmente
if (typeof window !== 'undefined') {
  window.API = {
    call: apiCall,
    auth: authAPI,
    socios: sociosAPI,
    asistencias: asistenciasAPI,
    ventas: ventasAPI,
    productos: productosAPI,
    stats: statsAPI,
    biometria: biometriaAPI,
    lockers: lockersAPI,
    cms: cmsAPI,
    gymConfig: gymConfigAPI,
    rutinas: rutinasAPI,
    planes: planesAPI,
    utils: utilsAPI,
    config: API_CONFIG
  };
  
  console.log('✅ API Client cargado correctamente');
  console.log('📡 Backend: ' + API_CONFIG.BASE_URL);
  console.log('🔑 Token almacenado en:', API_CONFIG.TOKEN_KEY);
}
