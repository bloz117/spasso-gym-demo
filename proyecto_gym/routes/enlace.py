"""
routes/enlace.py - Páginas del enlace único que se envía al miembro (WhatsApp/correo). Se sirve desde la NUBE (Render).

  GET /r/{token}                    página con dos botones: "Ver mi comprobante" y "Entrar a mi portal"
  GET /r/{token}/comprobante        comprobante en pantalla (intenta descargar el PDF solo + botón grande de respaldo)
  GET /r/{token}/comprobante.pdf    PDF de la nota de pago
  GET /r/{token}/acceso             usuario siempre; contraseña temporal solo mientras no la haya cambiado (máx. 30 días)

El token (enlace_token.py) va cifrado: contiene el comprobante y las credenciales, así que la nube no guarda nada
sensible. El comprobante no caduca; la contraseña temporal solo se muestra durante TOKEN_DIAS días.
"""
import html

from fastapi import APIRouter
from fastapi.responses import HTMLResponse, Response

import enlace_token
from nota_pdf import pdf_nota

router = APIRouter(prefix="/r")

_CABECERAS = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer"}

_CSS = """
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0e0e10;color:#f2f2f2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
display:flex;align-items:center;justify-content:center;padding:20px}
.card{width:100%;max-width:440px;background:#18181b;border:1px solid #2a2a2f;border-radius:20px;padding:26px 22px;text-align:center}
h1{font-size:1.35rem;margin:0 0 4px}p{color:#b5b5bd;line-height:1.45;margin:8px 0}
.btn{display:block;width:100%;padding:16px;margin:12px 0 0;border-radius:14px;border:0;font-size:1.05rem;font-weight:700;text-decoration:none;
cursor:pointer;color:#fff;background:linear-gradient(135deg,#e11d74,#7c3aed)}
.btn.sec{background:#26262c;color:#f2f2f2}.fila{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #26262c;text-align:left}
.fila span:first-child{color:#9a9aa5}.total{font-size:1.5rem;font-weight:800;margin:16px 0 4px}
.dato{background:#0e0e10;border:1px solid #2a2a2f;border-radius:12px;padding:12px;margin:10px 0;text-align:left}
.dato small{color:#9a9aa5;display:block;margin-bottom:4px}.dato b{font-size:1.15rem;word-break:break-all;letter-spacing:.3px}
.copiar{float:right;background:#26262c;color:#fff;border:0;border-radius:8px;padding:6px 10px;font-size:.8rem;cursor:pointer}
.aviso{background:#2a2110;border:1px solid #6b5316;color:#f5d98b;border-radius:12px;padding:12px;margin:12px 0;font-size:.92rem;text-align:left}
"""


def _pagina(titulo: str, cuerpo: str, script: str = "") -> HTMLResponse:
    doc = (f"<!doctype html><html lang='es'><head><meta charset='utf-8'>"
           f"<meta name='viewport' content='width=device-width,initial-scale=1'><meta name='robots' content='noindex'>"
           f"<title>{html.escape(titulo)}</title><style>{_CSS}</style></head><body><div class='card'>{cuerpo}</div>"
           f"{('<script>' + script + '</script>') if script else ''}</body></html>")
    return HTMLResponse(doc, headers=_CABECERAS)


def _invalido() -> HTMLResponse:
    r = _pagina("Enlace no válido",
                "<h1>Enlace no válido</h1><p>Este enlace está incompleto o fue modificado. "
                "Pide a Recepción que te lo envíe de nuevo.</p>")
    r.status_code = 404
    return r


def _abrir(token: str):
    r = enlace_token.abrir_token(token)
    if not r:
        return None, None
    return r


@router.get("/{token}", include_in_schema=False)
def inicio(token: str):
    d, _edad = _abrir(token)
    if d is None:
        return _invalido()
    g = html.escape(d.get("g") or "Tu gimnasio")
    n = html.escape((d.get("n") or "").split(" ")[0])
    t = html.escape(token)
    cuerpo = (f"<h1>¡Hola{(' ' + n) if n else ''}!</h1><p>Gracias por tu pago en <b>{g}</b>.</p>"
              f"<a class='btn' href='/r/{t}/comprobante'>🧾 Ver mi comprobante</a>"
              f"<a class='btn sec' href='/r/{t}/acceso'>🔑 Entrar a mi portal</a>")
    return _pagina(f"{d.get('g') or 'Gimnasio'} - Tu comprobante y acceso", cuerpo)


@router.get("/{token}/comprobante", include_in_schema=False)
def comprobante(token: str):
    d, _edad = _abrir(token)
    if d is None:
        return _invalido()
    c = d.get("c") or {}
    g = d.get("g") or "Gimnasio"
    t = html.escape(token)
    filas = [("Nota N°", c.get("numero")), ("Fecha", c.get("fecha")), ("Miembro", c.get("nombre")), ("CI", c.get("ci")),
             ("Plan", c.get("plan")), ("Inicio", c.get("inicio")), ("Vencimiento", c.get("vence")), ("Pago", c.get("metodo"))]
    tabla = "".join(f"<div class='fila'><span>{html.escape(a)}</span><span>{html.escape(str(b or '-'))}</span></div>"
                    for a, b in filas)
    try:
        monto = f"Bs {float(c.get('monto') or 0):.2f}"
    except (TypeError, ValueError):
        monto = "-"
    pdf = f"/r/{t}/comprobante.pdf"
    cuerpo = (f"<h1>{html.escape(g)}</h1><p>{html.escape(c.get('titulo') or 'Nota de pago')}</p>{tabla}"
              f"<div class='total'>{html.escape(monto)}</div><p id='msg'>Se está descargando tu comprobante…</p>"
              f"<a class='btn' href='{pdf}' download>⬇ Guardar comprobante (PDF)</a>"
              f"<a class='btn sec' href='/r/{t}'>← Volver</a>")
    # Descarga automática una sola vez; si el teléfono la bloquea, queda el botón grande.
    script = (f"setTimeout(function(){{var a=document.createElement('a');a.href='{pdf}';a.download='';"
              f"document.body.appendChild(a);a.click();a.remove();"
              f"document.getElementById('msg').textContent='Si no se descargó, toca «Guardar comprobante».';}},700);")
    return _pagina(f"Comprobante - {g}", cuerpo, script)


@router.get("/{token}/comprobante.pdf", include_in_schema=False)
def comprobante_pdf(token: str):
    d, _edad = _abrir(token)
    if d is None:
        return _invalido()
    c = d.get("c") or {}
    try:
        c = dict(c)
        c["monto"] = float(c.get("monto") or 0)
        pdf = pdf_nota(d.get("g") or "Gimnasio", c)
    except Exception:
        pdf = None
    if not pdf:
        return Response("No se pudo generar el PDF.", status_code=500, media_type="text/plain")
    nombre = "".join(ch for ch in str(c.get("numero") or "comprobante") if ch.isalnum() or ch in "-_")
    return Response(pdf, media_type="application/pdf",
                    headers={**_CABECERAS, "Content-Disposition": f'attachment; filename="comprobante_{nombre}.pdf"'})


def _clave_vigente(d: dict, edad: float) -> bool:
    """La contraseña temporal se muestra solo si aún no la cambió y el enlace tiene menos de TOKEN_DIAS días."""
    if not d.get("p") or edad > enlace_token.TOKEN_DIAS:
        return False
    try:
        import database
        with database.get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT must_change_password FROM portal_accounts WHERE id_socio = %s", (int(d.get("s") or 0),))
            f = cur.fetchone()
    except Exception:
        return False   # ante la duda, no mostrar la contraseña
    return True if f is None else bool(f[0])   # sin fila: la sincronización aún no llegó (miembro nuevo)


def _copiar_js() -> str:
    return ("function cp(id,b){var t=document.getElementById(id).textContent;"
            "if(navigator.clipboard){navigator.clipboard.writeText(t)}else{var x=document.createElement('textarea');x.value=t;"
            "document.body.appendChild(x);x.select();document.execCommand('copy');x.remove()}"
            "b.textContent='¡Copiado!';setTimeout(function(){b.textContent='Copiar'},1500)}")


@router.get("/{token}/acceso", include_in_schema=False)
def acceso(token: str):
    d, edad = _abrir(token)
    if d is None:
        return _invalido()
    t = html.escape(token)
    g = html.escape(d.get("g") or "Gimnasio")
    usuario = html.escape(d.get("u") or "")
    partes = [f"<h1>Tu acceso al portal</h1><p>{g}</p>",
              f"<div class='dato'><button class='copiar' onclick=\"cp('u',this)\">Copiar</button><small>Usuario</small><b id='u'>{usuario}</b></div>"]
    if _clave_vigente(d, edad):
        clave = html.escape(d.get("p") or "")
        partes.append(f"<div class='dato'><button class='copiar' onclick=\"cp('p',this)\">Copiar</button>"
                      f"<small>Contraseña temporal</small><b id='p'>{clave}</b></div>"
                      "<div class='aviso'>Copia tu usuario y contraseña, entra al portal y <b>cámbiala</b> cuando te lo pida.</div>")
    else:
        tel = html.escape(d.get("t") or "")
        extra = (f" o escríbenos al <b>{tel}</b>" if tel else "")
        partes.append("<div class='aviso'>Por seguridad la contraseña temporal ya no se muestra. "
                      f"Si la olvidaste, usa «¿Olvidaste tu contraseña?» en el portal{extra} y Recepción te genera una nueva.</div>")
    partes.append("<a class='btn' href='/portal-static/index.html'>Entrar a mi portal</a>"
                  f"<a class='btn sec' href='/r/{t}'>← Volver</a>")
    return _pagina(f"Acceso - {d.get('g') or 'Gimnasio'}", "".join(partes), _copiar_js())
