/*
 * Recuperar la contraseña del portal con un código enviado al correo del socio.
 * Pasos: 1) correo o usuario  ->  2) código + contraseña nueva.
 * Usa portalFetch (portal-client.js). Se abre desde "¿Olvidaste tu contraseña? Cambiar".
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var desafio = null;

  function msg(texto, tipo) {
    var m = $('recMsg'); if (!m) return;
    m.textContent = texto || '';
    m.className = 'recuperar__msg' + (tipo ? ' recuperar__msg--' + tipo : '');
  }

  function vista(paso) {
    var login = paso === 'login';
    var f = $('loginForm'), t = document.querySelector('#loginModal > .login-card > .login-card__toggle'),
        hd = document.querySelector('#loginModal > .login-card > .login-card__heading');
    if (f) f.style.display = login ? '' : 'none';
    if (t) t.style.display = login ? '' : 'none';
    if (hd) hd.style.display = login ? '' : 'none';
    $('recuperarPanel').style.display = login ? 'none' : 'flex';
    $('recPaso1').style.display = paso === 'pedir' ? '' : 'none';
    $('recPaso2').style.display = paso === 'codigo' ? '' : 'none';
    msg('');
  }

  function abrir() {
    var prev = (($('loginEmail') || {}).value || '').trim();
    $('recIdent').value = prev;
    // Si ya escribió su correo/usuario al iniciar sesión, aquí queda fijo (no editable):
    // el código siempre va al correo que el gimnasio registró para esa cuenta.
    $('recIdent').readOnly = !!prev;
    $('recIdent').classList.toggle('recuperar__ident--fijo', !!prev);
    var t1 = document.querySelector('#recPaso1 .recuperar__txt');
    if (t1) t1.textContent = prev
      ? 'Te enviamos un código de 6 dígitos al correo que diste en el gimnasio para esta cuenta. Si no es tu cuenta, vuelve atrás.'
      : 'Escribe tu correo (o usuario). Te enviamos un código de 6 dígitos al correo que diste en el gimnasio.';
    desafio = null;
    vista('pedir');
    if (!prev) setTimeout(function () { $('recIdent').focus(); }, 50);
  }
  window.abrirRecuperarPortal = abrir;

  async function enviar() {
    var ident = $('recIdent').value.trim();
    if (!ident) { msg('Escribe tu correo o usuario', 'error'); return; }
    var b = $('recBtnEnviar'); b.disabled = true; msg('Enviando…');
    try {
      var r = await portalFetch('/api/portal/recuperar/solicitar', { method: 'POST', body: JSON.stringify({ identificador: ident }) });
      desafio = r.desafio;
      $('recTxt2').textContent = 'Si la cuenta existe, te enviamos un código a ' + (r.correo || 'tu correo') + '. Vale ' + (r.vigencia_min || 10) + ' minutos.';
      vista('codigo');
      $('recCodigo').value = ''; $('recCodigo').focus();
    } catch (e) {
      msg(e.message || 'No se pudo enviar el código', 'error');
    } finally { b.disabled = false; }
  }

  async function guardar() {
    var codigo = $('recCodigo').value.replace(/\D/g, '');
    var n1 = $('recNueva').value, n2 = $('recNueva2').value;
    if (codigo.length !== 6) { msg('Escribe los 6 dígitos del código', 'error'); return; }
    if (n1.length < 8 || !/[A-Za-z]/.test(n1) || !/\d/.test(n1)) { msg('La contraseña debe tener 8 o más caracteres, con letras y números', 'error'); return; }
    if (n1 !== n2) { msg('Las contraseñas no coinciden', 'error'); return; }
    var b = $('recBtnGuardar'); b.disabled = true; msg('Guardando…');
    try {
      await portalFetch('/api/portal/recuperar/confirmar', { method: 'POST', body: JSON.stringify({ desafio: desafio, codigo: codigo, password_nuevo: n1 }) });
      var ident = $('recIdent').value.trim();
      vista('login');
      if ($('loginEmail')) $('loginEmail').value = ident;
      if ($('loginPassword')) { $('loginPassword').value = ''; $('loginPassword').focus(); }
      $('recNueva').value = ''; $('recNueva2').value = '';
      alert('Listo. Ya puedes entrar con tu contraseña nueva.');
    } catch (e) {
      msg(e.message || 'No se pudo cambiar la contraseña', 'error');
    } finally { b.disabled = false; }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!$('recuperarPanel')) return;
    $('recBtnEnviar').addEventListener('click', enviar);
    $('recIdent').addEventListener('keydown', function (e) { if (e.key === 'Enter') enviar(); });
    $('recBtnGuardar').addEventListener('click', guardar);
    $('recNueva2').addEventListener('keydown', function (e) { if (e.key === 'Enter') guardar(); });
    $('recCodigo').addEventListener('input', function () { this.value = this.value.replace(/\D/g, ''); });
    $('recReenviar').addEventListener('click', function (e) { e.preventDefault(); enviar(); });
    $('recVolver').addEventListener('click', function (e) { e.preventDefault(); vista('login'); });
    // Al cerrar el modal siempre se vuelve a la vista de iniciar sesión
    var cerrar = document.querySelector('#loginModal .close-modal');
    if (cerrar) cerrar.addEventListener('click', function () { vista('login'); });
  });
})();
