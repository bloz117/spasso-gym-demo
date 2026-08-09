/**
 * biometria.js - Integración real con el lector de huellas DigitalPersona U.are.U 4500
 *
 * Requiere que estos scripts ya estén cargados ANTES que este archivo:
 *   1. WebSdk (index.js del repositorio de ejemplo de HID)
 *   2. @digitalpersona/core   (dist/es5.bundles/index.umd.js)
 *   3. @digitalpersona/services (dist/es5.bundles/index.umd.js)
 *   4. @digitalpersona/devices  (dist/es5.bundles/index.umd.js)
 *
 * Y que en la computadora Windows esté instalado:
 *   - El driver del lector U.are.U 4500
 *   - El "HID Authentication Device Client" (antes "DigitalPersona Lite Client"),
 *     que corre como servicio local y expone el puerto https://127.0.0.1:52181
 *
 * Si algo de eso falta, capturarHuellaReal() rechaza la promesa con un
 * mensaje claro explicando qué revisar — NUNCA debe fallar en silencio.
 *
 * Este archivo expone DOS formas de usar el lector:
 *
 *   1. window.capturarHuellaReal(timeoutMs, onEstado) → Promise<base64>
 *      Captura PUNTUAL de una sola huella (se usa en Registro, para
 *      enrolar, y en Renovaciones al tocar el botón "Huella").
 *
 *   2. window.iniciarEscuchaContinua(onMuestra, onEstado)
 *      window.detenerEscuchaContinua()
 *      Deja el lector escuchando en segundo plano de forma indefinida:
 *      cada vez que alguien toca el sensor, se llama a onMuestra(base64)
 *      automáticamente — sin que la recepcionista tenga que presionar
 *      ningún botón ni estar en ninguna pantalla en particular. Se usa
 *      para el widget flotante de Asistencia.
 *
 *      Las capturas puntuales (modo 1) PAUSAN automáticamente la escucha
 *      continua mientras duran, y la reanudan solas al terminar, para
 *      que nunca compitan por el mismo canal del lector.
 */

(function () {
  'use strict';

  function libreriaDisponible() {
    return !!(window.dp && window.dp.devices && window.dp.devices.FingerprintReader);
  }

  // ─────────────────────────────────────────────────────────────────
  // IMPORTANTE (fix error 0x80070057 "No se pudo conectar con el lector"):
  // Antes se creaba un `new FingerprintReader()` distinto en cada
  // captura, y `stopAcquisition()` (asíncrono) no se esperaba. Eso dejaba
  // el canal nativo en un estado inconsistente y CUALQUIER intento
  // posterior de startAcquisition() fallaba con 0x80070057.
  //
  // La solución: UNA sola instancia de FingerprintReader reutilizada
  // para toda la sesión de la página, esperar de verdad a que
  // stopAcquisition() termine antes de dar una operación por cerrada, y
  // serializar/coordinar todo acceso al lector (nunca dos operaciones al
  // mismo tiempo peleando por el mismo canal).
  // ─────────────────────────────────────────────────────────────────
  let readerCompartido = null;
  let colaCaptura = Promise.resolve(); // serializa capturas puntuales, nunca concurrentes

  function obtenerReader() {
    if (!readerCompartido) {
      readerCompartido = new window.dp.devices.FingerprintReader();
    }
    return readerCompartido;
  }

  function esperar(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /**
   * El SDK de DigitalPersona entrega las muestras codificadas en
   * "base64url" (RFC 4648 §5: usa '-' y '_' en vez de '+' y '/', y a
   * veces sin el relleno '=' final) — NO es base64 estándar. Si se manda
   * tal cual al backend, `base64.b64decode()` en Python lo rechaza con
   * "Invalid base64". Esta función lo normaliza a base64 estándar, sea
   * cual sea la variante que haya llegado (si ya viene en base64
   * estándar, esto no le cambia nada, así que es seguro aplicarlo siempre).
   */
  function normalizarBase64(str) {
    if (typeof str !== 'string') return str;
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    return s;
  }

  /**
   * Intenta extraer el string base64 de la imagen PNG de un evento
   * SamplesAcquired. El SDK de DigitalPersona puede entregar los samples
   * en formas ligeramente distintas según la versión, así que se prueban
   * varias formas conocidas antes de rendirse.
   */
  function extraerImagenBase64(event) {
    let samples = event.samples;

    // A veces 'samples' viene como un string JSON en vez de un array/objeto ya parseado
    if (typeof samples === 'string') {
      try {
        samples = JSON.parse(samples);
      } catch (e) {
        // Si no es JSON, asumimos que YA es directamente el base64 de la imagen
        return normalizarBase64(samples);
      }
    }

    const primera = Array.isArray(samples) ? samples[0] : samples;

    if (typeof primera === 'string') return normalizarBase64(primera);
    if (primera && typeof primera === 'object') {
      // Distintas versiones del SDK han usado distintos nombres de campo
      const valor = primera.Data || primera.data || primera.SampleData || primera.sampleData || null;
      return normalizarBase64(valor);
    }

    return null;
  }

  function quitarTodosLosListeners(reader) {
    try { reader.off('DeviceConnected'); } catch (e) { /* noop */ }
    try { reader.off('DeviceDisconnected'); } catch (e) { /* noop */ }
    try { reader.off('QualityReported'); } catch (e) { /* noop */ }
    try { reader.off('SamplesAcquired'); } catch (e) { /* noop */ }
    try { reader.off('ErrorOccurred'); } catch (e) { /* noop */ }
  }

  // ═══════════════════════════════════════════════════════════════
  // MODO CONTINUO — escucha en segundo plano (widget flotante)
  // ═══════════════════════════════════════════════════════════════
  let escuchaContinuaConfig = null; // { onMuestra, onEstado } mientras el modo continuo está activo (o pausado temporalmente)
  let escuchaContinuaCorriendo = false; // true solo cuando el reader está realmente en startAcquisition()
  let procesandoMuestraContinua = false; // evita procesar dos toques a la vez

  function adjuntarListenersContinuos(reader) {
    const onMuestra = escuchaContinuaConfig.onMuestra;
    const onEstado = escuchaContinuaConfig.onEstado || function () {};

    reader.on('DeviceConnected', function () { onEstado('conectado'); });
    reader.on('DeviceDisconnected', function () { onEstado('desconectado'); });
    reader.on('QualityReported', function () { onEstado('leyendo'); });
    reader.on('ErrorOccurred', function (event) {
      console.error('[biometria] ErrorOccurred (escucha continua):', event);
      onEstado('error', event);
    });
    reader.on('SamplesAcquired', function (event) {
      if (procesandoMuestraContinua) return; // ignora toques mientras se procesa el anterior
      console.log('[biometria] SamplesAcquired (escucha continua):', event);
      let imagenBase64;
      try {
        imagenBase64 = extraerImagenBase64(event);
      } catch (e) {
        imagenBase64 = null;
      }
      if (!imagenBase64) return;

      procesandoMuestraContinua = true;
      Promise.resolve()
        .then(function () { return onMuestra(imagenBase64); })
        .catch(function (e) { console.error('[biometria] Error procesando muestra continua:', e); })
        .then(function () { procesandoMuestraContinua = false; });
    });
  }

  function iniciarAcquisicionContinua() {
    if (!escuchaContinuaConfig) return Promise.resolve();
    const onEstado = escuchaContinuaConfig.onEstado || function () {};

    if (!libreriaDisponible()) {
      onEstado('error', 'La librería del lector de huellas no cargó.');
      return Promise.resolve();
    }

    const SampleFormat = window.dp.devices.SampleFormat;
    const reader = obtenerReader();
    adjuntarListenersContinuos(reader);

    return reader.startAcquisition(SampleFormat.PngImage).then(function () {
      escuchaContinuaCorriendo = true;
      onEstado('escuchando');
    }).catch(function (err) {
      console.error('[biometria] Error al iniciar escucha continua:', err);
      escuchaContinuaCorriendo = false;
      onEstado('error', err && err.message ? err.message : err);
    });
  }

  /**
   * Deja el lector escuchando indefinidamente en segundo plano. Cada vez
   * que alguien coloca el dedo, se llama a onMuestra(imagenBase64) — sin
   * necesidad de presionar ningún botón. onMuestra puede devolver una
   * Promise; mientras esté pendiente, se ignoran nuevos toques (para no
   * procesar dos identificaciones a la vez).
   *
   * @param {function(string): (Promise|void)} onMuestra
   * @param {function(string, any=)} onEstado - ('conectado'|'desconectado'|'leyendo'|'escuchando'|'error', detalle)
   */
  window.iniciarEscuchaContinua = function (onMuestra, onEstado) {
    escuchaContinuaConfig = { onMuestra: onMuestra, onEstado: onEstado };
    return iniciarAcquisicionContinua();
  };

  /** Detiene la escucha continua para siempre (p. ej. al cerrar sesión). */
  window.detenerEscuchaContinua = function () {
    escuchaContinuaConfig = null;
    if (!escuchaContinuaCorriendo) return Promise.resolve();
    const reader = obtenerReader();
    escuchaContinuaCorriendo = false;
    return Promise.resolve().then(function () { return reader.stopAcquisition(); })
      .catch(function () { /* noop */ })
      .then(function () { quitarTodosLosListeners(reader); });
  };

  /** Pausa temporal (sin perder la configuración) para cederle el lector a una captura puntual. */
  function pausarEscuchaContinuaTemporal() {
    if (!escuchaContinuaCorriendo) return Promise.resolve(false);
    const reader = obtenerReader();
    escuchaContinuaCorriendo = false;
    return Promise.resolve().then(function () { return reader.stopAcquisition(); })
      .catch(function () { /* noop */ })
      .then(function () { quitarTodosLosListeners(reader); })
      .then(function () { return true; });
  }

  // ═══════════════════════════════════════════════════════════════
  // MODO PUNTUAL — una sola captura (Registro, Renovaciones)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Captura una huella real desde el lector físico.
   * Devuelve una Promise que resuelve con un string base64 de una imagen PNG.
   *
   * Si la escucha continua estaba activa, se pausa automáticamente
   * durante esta captura y se reanuda sola al terminar.
   *
   * @param {number} timeoutMs - Tiempo máximo de espera (por defecto 20s)
   * @param {function} onEstado - callback opcional(mensaje) para mostrar progreso en la UI
   */
  window.capturarHuellaReal = function (timeoutMs, onEstado) {
    timeoutMs = timeoutMs || 20000;
    const notificarEstado = typeof onEstado === 'function' ? onEstado : function () {};

    // Encadena esta captura después de que termine la anterior (si hay una
    // en curso), para nunca tener dos capturas simultáneas peleando por el
    // mismo canal del lector.
    const resultado = colaCaptura.then(function () {
      return pausarEscuchaContinuaTemporal().then(function (habiaEscuchaActiva) {
        return intentarCaptura(timeoutMs, notificarEstado, /*reintentoDisponible=*/true)
          .then(
            function (valor) {
              if (habiaEscuchaActiva) iniciarAcquisicionContinua();
              return valor;
            },
            function (error) {
              if (habiaEscuchaActiva) iniciarAcquisicionContinua();
              throw error;
            }
          );
      });
    });

    // Pase lo que pase (éxito o error), la cola sigue libre para la
    // siguiente captura.
    colaCaptura = resultado.catch(function () { /* noop, solo libera la cola */ });

    return resultado;
  };

  function intentarCaptura(timeoutMs, notificarEstado, reintentoDisponible) {
    if (!libreriaDisponible()) {
      return Promise.reject(new Error(
        'La librería del lector de huellas no cargó. Verifica tu conexión a internet ' +
        '(los scripts se cargan desde un CDN) o recarga la página.'
      ));
    }

    return new Promise(function (resolve, reject) {
      const SampleFormat = window.dp.devices.SampleFormat;
      const reader = obtenerReader();
      let resuelto = false;
      let timer = null;

      function limpiarYFinalizar(accion) {
        clearTimeout(timer);
        if (resuelto) return;
        resuelto = true;
        Promise.resolve()
          .then(function () { return reader.stopAcquisition(); })
          .catch(function () { /* noop: puede fallar si ya estaba detenido */ })
          .then(function () {
            quitarTodosLosListeners(reader);
            // Pequeña pausa para darle tiempo al servicio nativo de liberar
            // el canal antes de permitir una próxima operación — esto es lo
            // que evita el error 0x80070057 en el siguiente intento.
            return esperar(300);
          })
          .then(accion);
      }

      timer = setTimeout(function () {
        limpiarYFinalizar(function () {
          reject(new Error('Tiempo de espera agotado. Coloque el dedo firmemente en el lector e intente de nuevo.'));
        });
      }, timeoutMs);

      reader.on('DeviceConnected', function () {
        notificarEstado('🔌 Lector conectado');
      });

      reader.on('DeviceDisconnected', function () {
        limpiarYFinalizar(function () {
          reject(new Error('El lector de huellas se desconectó. Verifica el cable USB.'));
        });
      });

      reader.on('QualityReported', function (event) {
        console.log('[biometria] Calidad reportada:', event);
        notificarEstado('👆 Leyendo huella...');
      });

      reader.on('SamplesAcquired', function (event) {
        if (resuelto) return;
        console.log('[biometria] SamplesAcquired (evento crudo):', event);
        let imagenBase64, errorExtraccion;
        try {
          imagenBase64 = extraerImagenBase64(event);
          if (!imagenBase64) {
            errorExtraccion = new Error('El lector devolvió una muestra pero no se pudo extraer la imagen. Revisa la consola (F12) para ver el evento crudo.');
          }
        } catch (err) {
          errorExtraccion = err;
        }
        limpiarYFinalizar(function () {
          if (errorExtraccion) {
            reject(errorExtraccion);
          } else {
            notificarEstado('✅ Huella capturada');
            resolve(imagenBase64);
          }
        });
      });

      reader.on('ErrorOccurred', function (event) {
        if (resuelto) return;
        console.error('[biometria] ErrorOccurred:', event);
        limpiarYFinalizar(function () {
          reject(new Error(
            'Error del lector de huellas. Verifica que el dispositivo esté conectado y que el ' +
            '"HID Authentication Device Client" esté instalado y corriendo. Detalle: ' +
            JSON.stringify(event)
          ));
        });
      });

      notificarEstado('🔄 Conectando con el lector...');

      reader.startAcquisition(SampleFormat.PngImage).catch(function (err) {
        if (resuelto) return;
        console.error('[biometria] Error al iniciar captura:', err);
        resuelto = true;
        clearTimeout(timer);

        // Reintento automático una sola vez: este error suele ocurrir si el
        // canal anterior no terminó de liberarse a tiempo (ver comentario
        // arriba). Esperamos un poco más y probamos de nuevo antes de
        // rendirnos y mostrarle el error a la recepcionista.
        if (reintentoDisponible) {
          esperar(600).then(function () {
            intentarCaptura(timeoutMs, notificarEstado, false).then(resolve, reject);
          });
          return;
        }

        reject(new Error(
          'No se pudo conectar con el lector de huellas. Verifica que: ' +
          '(1) el dispositivo esté conectado por USB, ' +
          '(2) el driver esté instalado, y ' +
          '(3) el "HID Authentication Device Client" esté corriendo. Si el problema persiste, ' +
          'recarga la página (F5). Detalle: ' +
          (err && err.message ? err.message : JSON.stringify(err))
        ));
      });
    });
  }

  console.log('✅ biometria.js cargado — capturarHuellaReal() disponible:', libreriaDisponible());
})();
