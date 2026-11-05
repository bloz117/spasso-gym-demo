"""
routes/bienvenida.py - Mensaje de bienvenida al socio (WhatsApp / correo).

Recepción, después de registrar a un socio, puede mandarle un mensaje formal
con sus datos de acceso al portal:
  - WhatsApp: el backend arma el texto y el número (enlace wa.me); se abre
    WhatsApp con el mensaje listo y recepción solo presiona Enviar.
  - Correo: se envía automáticamente por SMTP (cuenta Gmail del gimnasio,
    configurada en Configuración > Mensajes al Socio).
"""
import html
import re
import secrets
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Depends, Body, Request
from database import get_db
from dependencies import require_rol, require_permiso
from auth import hash_password

router = APIRouter(prefix="/api/bienvenida", tags=["Bienvenida"])


# ----------------------------------------------------------------------
# Configuración (solo Administrador)
# ----------------------------------------------------------------------
def _leer_config(cur):
    cur.execute(
        "SELECT smtp_host, smtp_port, smtp_user, smtp_pass, remitente, portal_url, pais_codigo, auto_correo "
        "FROM config_mensajes WHERE id = 1"
    )
    r = cur.fetchone()
    if not r:
        return {"smtp_host": "smtp.gmail.com", "smtp_port": 587, "smtp_user": None,
                "smtp_pass": None, "remitente": "Spasso Gym", "portal_url": None, "pais_codigo": "591",
                "auto_correo": True}
    return {"smtp_host": r[0], "smtp_port": r[1], "smtp_user": r[2], "smtp_pass": r[3],
            "remitente": r[4], "portal_url": r[5], "pais_codigo": r[6] or "591",
            "auto_correo": True if r[7] is None else bool(r[7])}


def _url_portal(cfg, base_url):
    """Enlace del portal para los mensajes. Si no hay uno configurado, usa la
    dirección desde la que se está usando el sistema; y si es 'localhost'
    (que en un celular no sirve) la cambia por la IP de esta PC en el WiFi."""
    if cfg.get("portal_url"):
        return cfg["portal_url"]
    # Con la nube activa, el socio debe recibir el enlace público (funciona
    # desde cualquier red), no la IP local de la PC.
    import os
    nube = (os.getenv("SYNC_CLOUD_URL") or "").strip().rstrip("/")
    if nube:
        return f"{nube}/portal-static/index.html"
    from urllib.parse import urlparse
    p = urlparse(str(base_url))
    host = p.hostname or ""
    puerto = p.port
    if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        from red_local import ip_lan
        ip = ip_lan()
        if ip:
            host = ip
    esquema = p.scheme or "http"
    netloc = host + (f":{puerto}" if puerto else "")
    return f"{esquema}://{netloc}/portal-static/index.html"


@router.get("/config")
def obtener_config(usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    with get_db() as conn:
        cur = conn.cursor()
        c = _leer_config(cur)
    return {
        "smtp_host": c["smtp_host"], "smtp_port": c["smtp_port"], "smtp_user": c["smtp_user"] or "",
        "tiene_password": bool(c["smtp_pass"]), "remitente": c["remitente"],
        "portal_url": c["portal_url"] or "", "pais_codigo": c["pais_codigo"],
        "correo_configurado": bool(c["smtp_user"] and c["smtp_pass"]),
        "auto_correo": c["auto_correo"],
        "portal_url_detectada": _url_portal({"portal_url": None}, "http://localhost:7000"),
    }


@router.put("/config")
def guardar_config(data: dict = Body(...), usuario=Depends(require_rol(["Administrador"]))):
    host = str(data.get("smtp_host") or "smtp.gmail.com").strip()[:120]
    try:
        port = int(data.get("smtp_port") or 587)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Puerto inválido")
    user = str(data.get("smtp_user") or "").strip()[:160]
    if user and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", user):
        raise HTTPException(status_code=422, detail="El correo del gimnasio no es válido")
    remitente = str(data.get("remitente") or "Spasso Gym").strip()[:120]
    portal_url = str(data.get("portal_url") or "").strip()[:300]
    pais = re.sub(r"\D", "", str(data.get("pais_codigo") or "591"))[:5] or "591"
    pwd = data.get("smtp_pass")
    auto_correo = data.get("auto_correo")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE config_mensajes SET smtp_host=%s, smtp_port=%s, smtp_user=%s, remitente=%s, "
            "portal_url=%s, pais_codigo=%s WHERE id = 1",
            (host, port, user or None, remitente, portal_url or None, pais),
        )
        if isinstance(auto_correo, bool):
            cur.execute("UPDATE config_mensajes SET auto_correo=%s WHERE id = 1", (auto_correo,))
        if isinstance(pwd, str) and pwd.strip():
            # Gmail muestra la contraseña de aplicación con espacios: se quitan.
            cur.execute("UPDATE config_mensajes SET smtp_pass = %s WHERE id = 1", (pwd.replace(" ", ""),))
    return {"mensaje": "Configuración guardada"}


# ----------------------------------------------------------------------
# Armado del mensaje
# ----------------------------------------------------------------------
def _nombre_gimnasio(cur):
    try:
        cur.execute("SELECT nombre_gimnasio FROM gym_config LIMIT 1")
        r = cur.fetchone()
        if r and r[0]:
            return r[0]
    except Exception:
        pass
    return "Spasso Gym"


def _normalizar_telefono(tel, pais):
    digitos = re.sub(r"\D", "", tel or "")
    if not digitos:
        return None
    if digitos.startswith("00"):
        digitos = digitos[2:]
    elif len(digitos) <= 9 and not digitos.startswith(pais):
        digitos = pais + digitos.lstrip("0")
    return digitos


def _armar_mensaje(nombre, gimnasio, url, usuario_login, password, password_aparte=False):
    lineas = [
        f"¡Bienvenido/a a {gimnasio}, {nombre}!",
        "",
        "Gracias por confiar en nosotros. Es un gusto tenerte en nuestra familia y esperamos "
        "que disfrutes cada entrenamiento.",
        "",
        "Con tu cuenta del portal puedes consultar tu membresía, tu asistencia, tu rutina y "
        "nuestras promociones.",
        "",
        "Tus datos de acceso:",
    ]
    if url:
        lineas.append(f"Portal: {url}")
        lineas.append("(Si el enlace se abre dentro de Gmail, toca los tres puntos ⋮ de arriba a la derecha y elige "
                      "«Abrir en el navegador» o «Abrir en Chrome»: así tu sesión queda guardada.)")
    lineas.append(f"Usuario: {usuario_login}")
    if password and password_aparte:
        # WhatsApp: la contraseña se manda SOLA en el mensaje siguiente para poder copiarla con un toque.
        lineas.append("Contraseña temporal: te la envío sola en el siguiente mensaje (así la copias fácil).")
        lineas += ["", "Por tu seguridad, cambia la contraseña al ingresar (Mi cuenta > Perfil > Cambiar contraseña)."]
    elif password:
        lineas.append(f"Contraseña temporal: {password}")
        lineas += ["", "Por tu seguridad, cambia la contraseña al ingresar (Mi cuenta > Perfil > Cambiar contraseña)."]
    else:
        lineas += ["", "Ingresa con tu usuario (o tu correo) y la contraseña que elegiste."]
    lineas += [
        "",
        "La primera vez que entres desde un celular o computadora nuevos te llegará un código a este correo "
        "para confirmar que eres tú; después no se vuelve a pedir en ese dispositivo. "
        "Marca «Recuérdame» y tu sesión se mantiene abierta.",
        "Si olvidas tu contraseña, usa «¿Olvidaste tu contraseña?» en el portal: te enviamos un código a este correo.",
    ]
    lineas += ["", f"¡Nos vemos en {gimnasio}!"]
    return "\n".join(lineas)


def _datos_socio(cur, id_socio, request):
    """`request` puede ser un Request de FastAPI o directamente la URL base (str)."""
    cur.execute(
        "SELECT s.nombres, s.apellidos, s.email, s.telefono, pa.temp_password, pa.must_change_password, pa.username "
        "FROM socios s LEFT JOIN portal_accounts pa ON pa.id_socio = s.id_socio WHERE s.id_socio = %s",
        (id_socio,),
    )
    r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    nombres, apellidos, email, telefono, temp, must, username = r
    cfg = _leer_config(cur)
    gimnasio = _nombre_gimnasio(cur)
    base = request if isinstance(request, str) else request.base_url
    url = _url_portal(cfg, base)
    password = temp if (must and temp) else None
    # Se puede entrar con el correo o con el usuario del portal.
    if email and username:
        usuario_login = f"{email} (o {username})"
    else:
        usuario_login = email or username or ""
    mensaje = _armar_mensaje(nombres, gimnasio, url, usuario_login, password)
    mensaje_wa = _armar_mensaje(nombres, gimnasio, url, usuario_login, password, password_aparte=True)
    tel = _normalizar_telefono(telefono, cfg["pais_codigo"])
    return {
        "nombre": f"{nombres} {apellidos or ''}".strip(),
        "correo": email,
        "usuario": username,
        "telefono": telefono,
        "tiene_password_temporal": bool(password),
        "gimnasio": gimnasio,
        "asunto": f"¡Bienvenido/a a {gimnasio}!",
        "mensaje": mensaje,
        "whatsapp_url": (f"https://wa.me/{tel}?text={quote(mensaje_wa if password else mensaje)}" if tel else None),
        # 2.º mensaje de WhatsApp: SOLO la contraseña (para copiarla exacta); null si ya la cambió
        "whatsapp_pass_url": (f"https://wa.me/{tel}?text={quote(password)}" if (tel and password) else None),
        "correo_configurado": bool(cfg["smtp_user"] and cfg["smtp_pass"]),
    }


def _marcar_enviada(cur, id_socio):
    cur.execute("UPDATE portal_accounts SET bienvenida_enviada_en = now() WHERE id_socio = %s", (id_socio,))


@router.get("/pendientes")
def listar_pendientes(usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """Socios activos cuya bienvenida aún no se envió y que no han cambiado su contraseña."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id_socio, s.nombres, s.apellidos, s.email, s.telefono
            FROM portal_accounts pa
            JOIN socios s ON s.id_socio = pa.id_socio
            WHERE COALESCE(s.activo, TRUE) AND pa.is_active
              AND pa.must_change_password AND pa.bienvenida_enviada_en IS NULL
            ORDER BY pa.created_at DESC
            """
        )
        filas = cur.fetchall()
        cfg = _leer_config(cur)
    return {
        "total": len(filas),
        "con_correo": sum(1 for f in filas if f[3]),
        "sin_correo": sum(1 for f in filas if not f[3]),
        "correo_configurado": bool(cfg["smtp_user"] and cfg["smtp_pass"]),
        "socios": [{"id_socio": f[0], "nombre": f"{f[1]} {f[2] or ''}".strip(), "correo": f[3], "telefono": f[4]} for f in filas],
    }


@router.post("/pendientes/enviar")
def enviar_pendientes(request: Request, usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """Envía por correo, de una vez, la bienvenida a todos los socios pendientes que tengan correo."""
    base = str(request.base_url)
    with get_db() as conn:
        cur = conn.cursor()
        cfg = _leer_config(cur)
        if not (cfg["smtp_user"] and cfg["smtp_pass"]):
            raise HTTPException(status_code=400, detail="Aún no configuraste el correo del gimnasio (Configuración > Mensajes al Miembro)")
        cur.execute(
            """
            SELECT s.id_socio
            FROM portal_accounts pa JOIN socios s ON s.id_socio = pa.id_socio
            WHERE COALESCE(s.activo, TRUE) AND pa.is_active AND pa.must_change_password
              AND pa.bienvenida_enviada_en IS NULL AND s.email IS NOT NULL AND s.email <> ''
            """
        )
        ids = [r[0] for r in cur.fetchall()]
    enviados, fallidos = 0, []
    for id_socio in ids:
        try:
            with get_db() as conn:
                cur = conn.cursor()
                d = _datos_socio(cur, id_socio, base)
            _enviar_smtp(cfg, d["correo"], d["asunto"], d["mensaje"], _html_correo(d["gimnasio"], d["mensaje"]))
            with get_db() as conn:
                _marcar_enviada(conn.cursor(), id_socio)
            enviados += 1
        except HTTPException as e:
            fallidos.append({"id_socio": id_socio, "error": e.detail})
            if "rechazó" in str(e.detail):  # credenciales mal: no seguir intentando
                break
        except Exception as e:  # noqa: BLE001
            fallidos.append({"id_socio": id_socio, "error": str(e)})
    return {"enviados": enviados, "fallidos": fallidos, "mensaje": f"{enviados} correo(s) enviado(s)" + (f", {len(fallidos)} con error" if fallidos else "")}


@router.post("/{id_socio}/whatsapp-enviado")
def whatsapp_enviado(id_socio: int, usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """Recepción abrió WhatsApp con el mensaje: se marca la bienvenida como enviada."""
    with get_db() as conn:
        _marcar_enviada(conn.cursor(), id_socio)
    return {"ok": True}


@router.get("/{id_socio}")
def vista_previa(id_socio: int, request: Request,
                 usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    with get_db() as conn:
        cur = conn.cursor()
        return _datos_socio(cur, id_socio, request)


@router.post("/{id_socio}/restablecer")
def nueva_password(id_socio: int, request: Request,
                   usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """Genera una nueva contraseña temporal (para socios que ya la cambiaron u olvidaron)."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM portal_accounts WHERE id_socio = %s", (id_socio,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Este miembro no tiene cuenta de portal")
        nueva = secrets.token_urlsafe(9)
        cur.execute(
            "UPDATE portal_accounts SET password_hash=%s, temp_password=%s, must_change_password=TRUE "
            "WHERE id_socio=%s",
            (hash_password(nueva), nueva, id_socio),
        )
        return _datos_socio(cur, id_socio, request)


# ----------------------------------------------------------------------
# Envío por correo
# ----------------------------------------------------------------------
def _html_correo(gimnasio, mensaje):
    """Correo siempre claro (fondo blanco, letras oscuras), sin depender de ningún tema."""
    cuerpo = "<br>".join(html.escape(l) for l in mensaje.split("\n"))
    return (
        "<meta name='color-scheme' content='light only'><meta name='supported-color-schemes' content='light only'>"
        "<div style='background:#ffffff;font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;"
        "border:1px solid #e5e7eb;border-radius:14px;overflow:hidden'>"
        f"<div style='background:#ffffff;color:#111827;padding:20px 24px;font-size:20px;font-weight:700;border-bottom:3px solid #E619A8'>{html.escape(gimnasio)}</div>"
        f"<div style='background:#ffffff;padding:24px;color:#1f2937;font-size:15px;line-height:1.6'>{cuerpo}</div></div>"
    )


def _enviar_smtp(cfg, destino, asunto, texto, html_cuerpo, adjunto=None):
    """`adjunto` = (nombre_archivo, bytes, subtipo_mime) opcional, p. ej. ("nota.pdf", datos, "pdf")."""
    if adjunto:
        msg = MIMEMultipart("mixed")
        cuerpo = MIMEMultipart("alternative")
        cuerpo.attach(MIMEText(texto, "plain", "utf-8"))
        cuerpo.attach(MIMEText(html_cuerpo, "html", "utf-8"))
        msg.attach(cuerpo)
        nombre, datos, subtipo = adjunto
        parte = MIMEApplication(datos, _subtype=subtipo)
        parte.add_header("Content-Disposition", "attachment", filename=nombre)
        msg.attach(parte)
    else:
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(texto, "plain", "utf-8"))
        msg.attach(MIMEText(html_cuerpo, "html", "utf-8"))
    msg["Subject"] = asunto
    msg["From"] = f"{cfg['remitente']} <{cfg['smtp_user']}>"
    msg["To"] = destino
    import ssl
    import time as _t
    import re as _re
    host = cfg["smtp_host"]
    puerto = int(cfg["smtp_port"])
    # Limpieza: la contraseña de aplicación de Google se copia con espacios (a veces "duros") y el correo
    # con espacios/saltos de línea; cualquiera de eso hace que Gmail corte la sesión al iniciar sesión.
    cfg = dict(cfg)
    cfg["smtp_user"] = _re.sub(r"\s+", "", str(cfg["smtp_user"] or ""))
    cfg["smtp_pass"] = _re.sub(r"\s+", "", str(cfg["smtp_pass"] or ""))
    fallos = []   # (modo, paso, error) de cada intento: sirve para explicar qué falla de verdad

    # 1) Gmail SMTP: 587 (STARTTLS) y 465 (SSL), forzando IPv4 (muchas PCs con Windows tienen IPv6
    #    "a medias" y Gmail cierra la conexión), dos intentos por puerto.
    intentos = [puerto, 465 if puerto != 465 else 587]
    ctx = ssl.create_default_context()
    for p in intentos:
        for n in range(2):
            srv, paso = None, "conexión"
            try:
                if p == 465:
                    srv = _SMTP_SSL_IPv4(host, 465, timeout=25, context=ctx)
                else:
                    srv = _SMTP_IPv4(host, p, timeout=25)
                    paso = "saludo (EHLO)"
                    srv.ehlo()
                    paso = "cifrado (STARTTLS)"
                    srv.starttls(context=ctx)
                    srv.ehlo()
                paso = "inicio de sesión"
                try:
                    srv.login(cfg["smtp_user"], cfg["smtp_pass"])
                except smtplib.SMTPServerDisconnected:
                    # Gmail cortó la sesión con el método automático: reconectar y forzar AUTH LOGIN.
                    try:
                        srv.close()
                    except Exception:  # noqa: BLE001
                        pass
                    if p == 465:
                        srv = _SMTP_SSL_IPv4(host, 465, timeout=25, context=ctx)
                    else:
                        srv = _SMTP_IPv4(host, p, timeout=25)
                        srv.ehlo()
                        srv.starttls(context=ctx)
                        srv.ehlo()
                    srv.user, srv.password = cfg["smtp_user"], cfg["smtp_pass"]
                    srv.auth("LOGIN", srv.auth_login)
                paso = "envío"
                srv.sendmail(cfg["smtp_user"], [destino], msg.as_string())
                try:
                    srv.quit()
                except Exception:  # noqa: BLE001
                    pass
                return
            except smtplib.SMTPAuthenticationError:
                raise HTTPException(status_code=502, detail="Gmail rechazó el usuario o la contraseña de aplicación. Revisa Configuración > Mensajes al Miembro.")
            except Exception as e:  # noqa: BLE001
                fallos.append((p, paso, e))
                try:
                    if srv:
                        srv.close()
                except Exception:  # noqa: BLE001
                    pass
                _t.sleep(1.2)

    # 2) Respaldo por HTTPS (Brevo): funciona aunque la red/antivirus bloquee el correo SMTP.
    #    Se activa con las variables BREVO_API_KEY y BREVO_FROM (ver CLAUDE.md).
    import os as _os
    if _os.getenv("BREVO_API_KEY") and _os.getenv("BREVO_FROM"):
        try:
            from routes.verificacion import _enviar as _enviar_https
            _enviar_https(("brevo-api", 443, _os.getenv("BREVO_FROM"), _os.getenv("BREVO_API_KEY"), cfg.get("remitente") or "Spasso Gym"),
                          destino, asunto, texto, html_cuerpo)
            return
        except Exception as e:  # noqa: BLE001
            fallos.append(("https", "envío por Brevo", e))

    u = cfg["smtp_user"]
    pista_cuenta = f" Cuenta usada: {u[:2]}***@{u.partition('@')[2] or '?'}; la contraseña guardada tiene {len(cfg['smtp_pass'])} caracteres"
    pista_cuenta += (" (una contraseña de aplicación de Google tiene exactamente 16 letras: si no coincide, vuelve a pegarla en Configuración > Mensajes al Miembro)."
                     if len(cfg["smtp_pass"]) != 16 else ".")
    resumen = "; ".join(f"puerto {m}: falló en {pa} ({str(er)[:60]})" for m, pa, er in fallos[:4])
    raise HTTPException(
        status_code=502,
        detail=("No se pudo enviar con Gmail (" + resumen + ")." + pista_cuenta + " "
                "Si falla en «inicio de sesión»: la contraseña de aplicación puede estar vencida o mal pegada (genera una nueva en "
                "myaccount.google.com/apppasswords) o Google bloqueó el intento (entra a Gmail y confirma «fui yo» en el aviso de seguridad). "
                "Si falla antes: suele deberse a: antivirus que analiza el correo/SSL (desactiva «protección de correo» o «análisis SSL/HTTPS» "
                "de Avast, ESET, Kaspersky, etc.), firewall, un proveedor de internet que bloquea los puertos 587/465, o hora/fecha "
                "incorrecta de Windows. Prueba con otra red (datos del celular) o usa «Copiar enlace»."),
    )


import socket as _socket


class _SMTP_IPv4(smtplib.SMTP):
    """SMTP que solo usa IPv4 (evita conexiones cerradas por IPv6 mal configurado)."""
    def _get_socket(self, host, port, timeout):
        infos = _socket.getaddrinfo(host, port, _socket.AF_INET, _socket.SOCK_STREAM)
        ultimo = None
        for fam, tipo, proto, _c, addr in infos:
            try:
                return _socket.create_connection(addr, timeout, self.source_address)
            except OSError as e:
                ultimo = e
        raise ultimo or OSError("sin direcciones IPv4")


class _SMTP_SSL_IPv4(smtplib.SMTP_SSL):
    def _get_socket(self, host, port, timeout):
        infos = _socket.getaddrinfo(host, port, _socket.AF_INET, _socket.SOCK_STREAM)
        ultimo = None
        for fam, tipo, proto, _c, addr in infos:
            try:
                raw = _socket.create_connection(addr, timeout, self.source_address)
                return self.context.wrap_socket(raw, server_hostname=host)
            except OSError as e:
                ultimo = e
        raise ultimo or OSError("sin direcciones IPv4")


@router.post("/{id_socio}/correo")
def enviar_correo(id_socio: int, request: Request,
                  usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    with get_db() as conn:
        cur = conn.cursor()
        d = _datos_socio(cur, id_socio, request)
        cfg = _leer_config(cur)
    if not d["correo"]:
        raise HTTPException(status_code=400, detail="El miembro no tiene correo registrado")
    if not (cfg["smtp_user"] and cfg["smtp_pass"]):
        raise HTTPException(status_code=400, detail="Aún no configuraste el correo del gimnasio (Configuración > Mensajes al Miembro)")
    _enviar_smtp(cfg, d["correo"], d["asunto"], d["mensaje"], _html_correo(d["gimnasio"], d["mensaje"]))
    with get_db() as conn:
        _marcar_enviada(conn.cursor(), id_socio)
    return {"mensaje": f"Correo enviado a {d['correo']}"}


# ----------------------------------------------------------------------
# Nota de pago por correo (PDF adjunto)
# ----------------------------------------------------------------------
def _pdf_nota(gimnasio, d):
    """Nota de pago en PDF (requiere reportlab). Devuelve bytes o None si no está instalado."""
    try:
        from io import BytesIO
        from reportlab.lib.pagesizes import A5
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except ImportError:
        return None
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A5)
    w, h = A5
    y = h - 22 * mm
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(w / 2, y, gimnasio)
    y -= 8 * mm
    c.setFont("Helvetica", 11)
    c.drawCentredString(w / 2, y, d["titulo"])
    y -= 5 * mm
    c.line(15 * mm, y, w - 15 * mm, y)
    y -= 9 * mm
    filas = [
        ("Nota N°", d["numero"]), ("Fecha", d["fecha"]), ("Socio", d["nombre"]),
        ("CI", d["ci"]), ("Plan", d["plan"]), ("Inicio", d["inicio"]),
        ("Vencimiento", d["vence"]), ("Método de pago", d["metodo"]),
    ]
    for etiqueta, valor in filas:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(18 * mm, y, f"{etiqueta}:")
        c.setFont("Helvetica", 10)
        c.drawString(55 * mm, y, str(valor or "-"))
        y -= 7 * mm
    y -= 2 * mm
    c.line(15 * mm, y, w - 15 * mm, y)
    y -= 10 * mm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(18 * mm, y, "TOTAL PAGADO:")
    c.drawRightString(w - 18 * mm, y, f"Bs {d['monto']:.2f}")
    y -= 14 * mm
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(w / 2, y, f"Gracias por tu pago. ¡Nos vemos en {gimnasio}!")
    c.showPage()
    c.save()
    return buf.getvalue()


def _es_renovacion(cur, id_socio, id_membresia):
    """Una membresía es renovación si el socio tiene otra anterior."""
    cur.execute(
        "SELECT 1 FROM membresias m WHERE m.id_socio = %s AND m.id_membresia <> %s AND "
        "m.fecha_inicio < (SELECT fecha_inicio FROM membresias WHERE id_membresia = %s) LIMIT 1",
        (id_socio, id_membresia, id_membresia),
    )
    return cur.fetchone() is not None


def _datos_nota(cur, id_socio, tipo=None, id_membresia=None):
    """Datos de una membresía del socio (la última, o `id_membresia`) para armar la nota de pago."""
    cur.execute("SELECT nombres, apellidos, email, ci, telefono FROM socios WHERE id_socio = %s", (id_socio,))
    s = cur.fetchone()
    if not s:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    cols = "id_membresia, plan, tipo_membresia, fecha_inicio, fecha_vencimiento, monto, metodo_pago"
    if id_membresia:
        cur.execute(f"SELECT {cols} FROM membresias WHERE id_socio = %s AND id_membresia = %s", (id_socio, id_membresia))
    else:
        cur.execute(f"SELECT {cols} FROM membresias WHERE id_socio = %s "
                    "ORDER BY fecha_inicio DESC, fecha_vencimiento DESC LIMIT 1", (id_socio,))
    m = cur.fetchone()
    if not m:
        raise HTTPException(status_code=404, detail="No se encontró ese pago del miembro")
    if tipo is None:
        tipo = "renovacion" if _es_renovacion(cur, id_socio, m[0]) else "registro"
    from datetime import date
    metodos = {"efectivo": "Efectivo", "qr": "QR", "tarjeta": "Tarjeta"}
    fecha_pago = m[3].date() if m[3] else date.today()
    datos = {
        "titulo": "NOTA DE PAGO - " + ("RENOVACIÓN" if tipo == "renovacion" else "NUEVA SUSCRIPCIÓN"),
        "numero": f"{fecha_pago:%Y%m%d}-{id_socio}-{m[0]}", "fecha": f"{fecha_pago:%d/%m/%Y}",
        "nombre": f"{s[0]} {s[1] or ''}".strip(), "ci": s[3],
        "plan": f"{m[1]} ({m[2]})" if m[2] else m[1],
        "inicio": f"{m[3]:%d/%m/%Y}" if m[3] else "-", "vence": f"{m[4]:%d/%m/%Y}" if m[4] else "-",
        "metodo": metodos.get(str(m[6]), str(m[6] or "-")), "monto": float(m[5] or 0),
    }
    return s, datos


def _pdf_desde_cliente(data):
    """PDF que armó el navegador con el mismo modelo del ticket impreso (base64). None si no vino o es inválido."""
    import base64
    raw = (data or {}).get("pdf_base64")
    if not raw:
        return None
    try:
        pdf = base64.b64decode(raw, validate=True)
    except Exception:
        return None
    return pdf if pdf[:4] == b"%PDF" and len(pdf) < 8_000_000 else None


def _texto_nota(gimnasio, s, datos, con_pdf):
    return (f"Hola {s[0]},\n\nGracias por tu pago en {gimnasio}. "
            + ("Adjuntamos tu nota de pago en PDF." if con_pdf else "Estos son los datos de tu pago.")
            + f"\n\n{datos['titulo'].title()}\nPlan: {datos['plan']}\nVigencia: {datos['inicio']} al {datos['vence']}\n"
            f"Total pagado: Bs {datos['monto']:.2f}\nNota Nº {datos['numero']}\n\n¡Nos vemos en {gimnasio}!")


@router.get("/{id_socio}/pagos")
def listar_pagos(id_socio: int, usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """Pagos (inscripción y renovaciones) del socio, del más reciente al más antiguo."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT nombres, apellidos, ci, telefono FROM socios WHERE id_socio = %s", (id_socio,))
        so = cur.fetchone()
        if not so:
            raise HTTPException(status_code=404, detail="Miembro no encontrado")
        cur.execute(
            "SELECT id_membresia, plan, fecha_inicio, fecha_vencimiento, monto, metodo_pago, tipo_membresia "
            "FROM membresias WHERE id_socio = %s ORDER BY fecha_inicio DESC, id_membresia DESC LIMIT 30",
            (id_socio,),
        )
        filas = cur.fetchall()
        out = []
        for f in filas:
            out.append({
                "id_membresia": f[0], "plan": f[1],
                "fecha": f[2].strftime("%d/%m/%Y") if f[2] else "",
                "vence": f[3].strftime("%d/%m/%Y") if f[3] else "",
                "monto": float(f[4] or 0), "metodo": f[5],
                "tipo": "renovacion" if _es_renovacion(cur, id_socio, f[0]) else "registro",
                "tipo_membresia": f[6],
                "inicio_iso": f[2].strftime("%Y-%m-%d") if f[2] else "",
                "vence_iso": f[3].strftime("%Y-%m-%d") if f[3] else "",
            })
        return {"socio": {"nombre": f"{so[0]} {so[1] or ''}".strip(), "ci": so[2], "telefono": so[3]}, "pagos": out}


@router.post("/{id_socio}/nota-correo")
def enviar_nota_correo(id_socio: int, data: dict = Body(default={}),
                       usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """Envía por correo la nota de pago (PDF adjunto) de la última membresía, o de `id_membresia`."""
    id_m = data.get("id_membresia")
    tipo = {"renovacion": "renovacion", "registro": "registro"}.get(str(data.get("tipo")))
    with get_db() as conn:
        cur = conn.cursor()
        cfg = _leer_config(cur)
        gimnasio = _nombre_gimnasio(cur)
        if not (cfg["smtp_user"] and cfg["smtp_pass"]):
            raise HTTPException(status_code=400, detail="Aún no configuraste el correo del gimnasio (Configuración > Mensajes al Miembro)")
        s, datos = _datos_nota(cur, id_socio, tipo, int(id_m) if id_m else None)
        if not s[2]:
            raise HTTPException(status_code=400, detail="El miembro no tiene correo registrado")
    pdf = _pdf_desde_cliente(data) or _pdf_nota(gimnasio, datos)
    adjunto = (f"nota_pago_{datos['numero']}.pdf", pdf, "pdf") if pdf else None
    texto = _texto_nota(gimnasio, s, datos, bool(pdf))
    _enviar_smtp(cfg, s[2], f"Nota de pago - {gimnasio}", texto, _html_correo(gimnasio, texto), adjunto)
    return {"mensaje": f"Nota enviada a {s[2]}" + ("" if pdf else " (sin PDF: falta instalar reportlab)")}


@router.get("/{id_socio}/nota-pdf")
def descargar_nota_pdf(id_socio: int, id_membresia: int = None,
                       usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """PDF de la nota de pago, para descargarlo y adjuntarlo (p. ej. en WhatsApp)."""
    from fastapi.responses import Response
    with get_db() as conn:
        cur = conn.cursor()
        gimnasio = _nombre_gimnasio(cur)
        s, datos = _datos_nota(cur, id_socio, None, id_membresia)
    pdf = _pdf_nota(gimnasio, datos)
    if not pdf:
        raise HTTPException(status_code=500, detail="Falta instalar reportlab (pip install reportlab)")
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="nota_pago_{datos["numero"]}.pdf"'})


@router.get("/{id_socio}/nota-whatsapp")
def nota_whatsapp(id_socio: int, id_membresia: int = None,
                  usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """Enlace de WhatsApp con el resumen del pago (el PDF se adjunta a mano: WhatsApp no lo permite por enlace)."""
    with get_db() as conn:
        cur = conn.cursor()
        cfg = _leer_config(cur)
        gimnasio = _nombre_gimnasio(cur)
        s, datos = _datos_nota(cur, id_socio, None, id_membresia)
    tel = _normalizar_telefono(s[4], cfg["pais_codigo"])
    if not tel:
        raise HTTPException(status_code=400, detail="El miembro no tiene un teléfono válido registrado")
    texto = _texto_nota(gimnasio, s, datos, False).replace(
        "Estos son los datos de tu pago.", "Te enviamos tu nota de pago (adjunta en este chat).")
    return {"whatsapp_url": f"https://wa.me/{tel}?text={quote(texto)}", "texto": texto}


@router.post("/{id_socio}/inscripcion-correo")
def enviar_inscripcion_correo(id_socio: int, request: Request, data: dict = Body(default={}),
                              usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """
    UN solo correo para la inscripción nueva: bienvenida + enlace del portal +
    usuario/contraseña temporal + nota de pago de la inscripción en PDF adjunto.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cfg = _leer_config(cur)
        if not (cfg["smtp_user"] and cfg["smtp_pass"]):
            raise HTTPException(status_code=400, detail="Aún no configuraste el correo del gimnasio (Configuración > Mensajes al Miembro)")
        d = _datos_socio(cur, id_socio, request)
        gimnasio = d["gimnasio"]
        s, datos = _datos_nota(cur, id_socio, "registro")
    pdf = _pdf_desde_cliente(data) or _pdf_nota(gimnasio, datos)
    adjunto = (f"inscripcion_{datos['numero']}.pdf", pdf, "pdf") if pdf else None
    resumen = (
        "\n\nResumen de tu inscripción:\n"
        f"Plan: {datos['plan']}\nVigencia: {datos['inicio']} al {datos['vence']}\n"
        f"Total pagado: Bs {datos['monto']:.2f}\n"
        + ("Adjuntamos la nota de pago de tu inscripción en PDF." if pdf else "")
    )
    texto = d["mensaje"] + resumen
    _enviar_smtp(cfg, s[2], f"¡Bienvenido/a a {gimnasio}! Tu inscripción y accesos", texto,
                 _html_correo(gimnasio, texto), adjunto)
    with get_db() as conn:
        _marcar_enviada(conn.cursor(), id_socio)
    return {"mensaje": f"Correo de inscripción enviado a {s[2]}" + ("" if pdf else " (sin PDF: falta instalar reportlab)")}


@router.post("/prueba")
def correo_prueba(data: dict = Body(...), usuario=Depends(require_rol(["Administrador"]))):
    destino = str(data.get("destino") or "").strip()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", destino):
        raise HTTPException(status_code=422, detail="Correo de destino inválido")
    with get_db() as conn:
        cur = conn.cursor()
        cfg = _leer_config(cur)
        gimnasio = _nombre_gimnasio(cur)
    if not (cfg["smtp_user"] and cfg["smtp_pass"]):
        raise HTTPException(status_code=400, detail="Guarda primero el correo y la contraseña de aplicación")
    texto = "Este es un correo de prueba. Si lo recibes, el envío de bienvenida está funcionando."
    _enviar_smtp(cfg, destino, f"Prueba de correo - {gimnasio}", texto, _html_correo(gimnasio, texto))
    return {"mensaje": f"Correo de prueba enviado a {destino}"}
