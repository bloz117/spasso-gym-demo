"""
sync_core.py — Sincronización Recepción (PC del gimnasio) <-> Nube (portal público)

IDEA GENERAL
------------
* Recepción (APP_MODE=local) es la fuente de verdad de socios, membresías,
  planes, casilleros, asistencias, contenido de la página, etc.
* La nube (APP_MODE=cloud, main_cloud.py) guarda una COPIA de lo que el portal
  necesita y responde al portal SIN consultar a Recepción.
* Recepción empuja los cambios a la nube (push) cada vez que algo cambia, y si no
  hay internet los deja en una cola (tabla sync_outbox) hasta que vuelva.
* Los pocos datos que nacen en la nube (datos físicos del socio, rutina que arma
  el entrenador, cambio de contraseña del socio) se traen de vuelta a Recepción
  (pull). Esas tablas son "bidireccionales" y se resuelven por "gana el más
  reciente" (columna `lww`).

SEGURIDAD
---------
* Cada petición va firmada con HMAC-SHA256 (SYNC_SECRET compartido) incluyendo
  método, ruta, hora, nonce y hash del cuerpo: no se puede falsificar, alterar
  ni repetir (anti-replay).
* Solo viajan las columnas listadas en cada tabla (`push` / `pull`). NUNCA viajan:
  huellas, ventas/caja, cuentas de Administrador/Recepcionista, contraseñas SMTP,
  contraseñas temporales en texto, fotos, teléfonos.
"""
import hashlib
import hmac
import json
import os
import secrets
import threading
import time

# ─────────────────────────────────────────────────────────────────────────
# Qué se sincroniza (el ORDEN importa: primero los "padres", luego los "hijos")
# ─────────────────────────────────────────────────────────────────────────
SPECS = [
    dict(name="roles_permisos", pk=["id_rol"],
         push=["id_rol", "nombre_rol"],
         filtro="t.nombre_rol = 'Entrenador'"),
    # Entrenadores: la contraseña también puede cambiarse en la nube (recuperar con código);
    # de vuelta a Recepción solo viaja password_hash (nunca cuentas de Administrador/Recepcionista)
    dict(name="usuarios_sistema", pk=["id_usuario"], bidi=True, lww="sync_at",
         push=["id_usuario", "username", "password_hash", "id_rol", "correo", "sync_at"],
         pull=["id_usuario", "password_hash", "sync_at"],
         digest=["id_usuario", "username", "password_hash", "id_rol", "correo"],
         filtro="t.id_rol IN (SELECT id_rol FROM roles_permisos WHERE nombre_rol = 'Entrenador')"),
    dict(name="categorias_planes", pk=["id_categoria"],
         push=["id_categoria", "nombre", "orden", "activo", "creado_en"]),
    dict(name="planes", pk=["id_plan"], texto=["precio_base"],
         push=["id_plan", "nombre_plan", "precio_base", "duracion_dias", "id_categoria",
               "descripcion", "activo", "incluye_rutina"]),
    dict(name="socios", pk=["id_socio"],
         push=["id_socio", "uuid_web", "nombres", "apellidos", "ci", "email",
               "fecha_registro", "activo", "genero"]),
    dict(name="portal_accounts", pk=["id"], bidi=True, lww="sync_at",
         push=["id", "id_socio", "username", "password_hash", "must_change_password",
               "is_active", "created_at", "sync_at"],
         pull=["id", "id_socio", "username", "password_hash", "must_change_password",
               "is_active", "sync_at", "last_login"],
         aparte=["last_login"],
         digest=["id", "id_socio", "username", "password_hash", "must_change_password", "is_active"]),
    dict(name="membresias", pk=["id_membresia"], texto=["monto"],
         push=["id_membresia", "id_socio", "tipo_membresia", "plan", "fecha_inicio",
               "fecha_vencimiento", "estado", "monto", "creado_en"]),
    dict(name="gestion_lockers", pk=["id_locker"],
         push=["id_locker", "numero_locker", "zona", "estado", "id_socio_actual"]),
    dict(name="asistencias_log", pk=["id_log"],
         push=["id_log", "id_socio", "fecha_entrada", "id_locker", "fecha_salida"]),
    dict(name="entrenador_socios", pk=["id_entrenador", "id_socio"],
         push=["id_entrenador", "id_socio"]),
    dict(name="workout_routines", pk=["id"],
         push=["id", "level", "name", "description", "duration_minutes", "exercises",
               "is_active", "created_at", "updated_at"]),
    dict(name="cms_theme", pk=["id"],
         push=["id", "color_palette", "animation_preset", "button_shape", "typography",
               "layout_preset", "custom_css", "is_active", "created_by", "created_at",
               "updated_at", "musica_archivo", "hero_imagenes", "hero_fondo",
               "contenido_portal"]),
    dict(name="perfil_fisico_socio", pk=["id_socio"], bidi=True, lww="actualizado_en",
         texto=["estatura_cm", "peso_kg", "peso_inicial_kg"],
         push=["id_socio", "estatura_cm", "peso_kg", "actividad", "objetivo", "dias_semana",
               "lesiones", "actualizado_en", "peso_inicial_kg", "desde"]),
    dict(name="rutinas_socio", pk=["id_socio"], bidi=True, lww="actualizado_en",
         push=["id_socio", "id_entrenador", "contenido", "publicada", "actualizado_en"]),
]

POR_NOMBRE = {s["name"]: s for s in SPECS}
ORDEN = {s["name"]: i for i, s in enumerate(SPECS)}
TABLAS_BIDI = [s["name"] for s in SPECS if s.get("bidi")]
MAX_INTENTOS = 8           # reintentos antes de marcar un cambio como "con error"
MAX_ITEMS_PUSH = 200
MAX_BODY = 6 * 1024 * 1024  # 6 MB por petición


def columnas(spec, direccion):
    """Columnas permitidas al RECIBIR en esa dirección ('push' = hacia la nube,
    'pull' = de la nube hacia Recepción)."""
    if direccion == "pull":
        return list(spec.get("pull") or spec["push"])
    return list(spec["push"])


def pk_texto(pk):
    return json.dumps(pk, sort_keys=True, separators=(",", ":"), default=str)


# ─────────────────────────────────────────────────────────────────────────
# Esquema de apoyo (outbox + triggers), idempotente. Se ejecuta en ambos lados.
# ─────────────────────────────────────────────────────────────────────────
_SQL_BASE = """
CREATE TABLE IF NOT EXISTS sync_outbox (
    id        BIGSERIAL PRIMARY KEY,
    tabla     TEXT NOT NULL,
    pk        JSONB NOT NULL,
    op        CHAR(1) NOT NULL,
    creado    TIMESTAMPTZ NOT NULL DEFAULT now(),
    intentos  INT NOT NULL DEFAULT 0,
    error     TEXT
);
CREATE INDEX IF NOT EXISTS ix_sync_outbox_pend ON sync_outbox (id) WHERE intentos < 8;

CREATE TABLE IF NOT EXISTS sync_state (
    clave TEXT PRIMARY KEY,
    valor TEXT
);

-- Hash de lo último enviado por fila (evita reenviar filas sin cambios reales)
CREATE TABLE IF NOT EXISTS sync_sent (
    tabla TEXT NOT NULL,
    pk    TEXT NOT NULL,
    hash  TEXT NOT NULL,
    PRIMARY KEY (tabla, pk)
);

CREATE OR REPLACE FUNCTION sync_registrar() RETURNS trigger AS $$
DECLARE
    fila  jsonb;
    pkj   jsonb := '{}'::jsonb;
    k     text;
BEGIN
    -- Cuando el propio sistema está APLICANDO datos recibidos, no los vuelve a encolar
    IF current_setting('spasso.sync_apply', true) = '1' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_OP = 'DELETE' THEN fila := to_jsonb(OLD); ELSE fila := to_jsonb(NEW); END IF;
    FOREACH k IN ARRAY string_to_array(TG_ARGV[0], ',') LOOP
        pkj := pkj || jsonb_build_object(k, fila -> k);
    END LOOP;
    INSERT INTO sync_outbox (tabla, pk, op) VALUES (TG_TABLE_NAME, pkj, left(TG_OP, 1));
    RETURN COALESCE(NEW, OLD);
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_portal_accounts_stamp() RETURNS trigger AS $$
BEGIN
    IF current_setting('spasso.sync_apply', true) = '1' THEN
        RETURN NEW;
    END IF;
    -- sync_at solo cambia cuando cambia algo "de verdad" de la cuenta (no con last_login)
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
       OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.username IS DISTINCT FROM OLD.username THEN
        NEW.sync_at := now();
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_usuarios_stamp() RETURNS trigger AS $$
BEGIN
    IF current_setting('spasso.sync_apply', true) = '1' THEN
        RETURN NEW;
    END IF;
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
       OR NEW.username IS DISTINCT FROM OLD.username
       OR NEW.correo IS DISTINCT FROM OLD.correo THEN
        NEW.sync_at := now();
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;
"""


def asegurar_esquema_sync(conn, lado):
    """Crea outbox/estado y los triggers. lado='local' → todas las tablas;
    lado='cloud' → solo las bidireccionales."""
    cur = conn.cursor()
    cur.execute(_SQL_BASE)
    # sync_at en portal_accounts (clave del "gana el más reciente")
    cur.execute("SELECT to_regclass('public.portal_accounts')")
    if cur.fetchone()[0]:
        cur.execute("ALTER TABLE portal_accounts ADD COLUMN IF NOT EXISTS sync_at TIMESTAMPTZ NOT NULL DEFAULT now()")
        cur.execute("DROP TRIGGER IF EXISTS sync_pa_stamp ON portal_accounts")
        cur.execute("CREATE TRIGGER sync_pa_stamp BEFORE UPDATE ON portal_accounts "
                    "FOR EACH ROW EXECUTE FUNCTION sync_portal_accounts_stamp()")
    # sync_at en usuarios_sistema (contraseña de Entrenadores cambiada en la nube)
    cur.execute("SELECT to_regclass('public.usuarios_sistema')")
    if cur.fetchone()[0]:
        cur.execute("ALTER TABLE usuarios_sistema ADD COLUMN IF NOT EXISTS sync_at TIMESTAMPTZ NOT NULL DEFAULT now()")
        cur.execute("DROP TRIGGER IF EXISTS sync_us_stamp ON usuarios_sistema")
        cur.execute("CREATE TRIGGER sync_us_stamp BEFORE UPDATE ON usuarios_sistema "
                    "FOR EACH ROW EXECUTE FUNCTION sync_usuarios_stamp()")
    for spec in SPECS:
        if lado == "cloud" and not spec.get("bidi"):
            continue
        t = spec["name"]
        cur.execute("SELECT to_regclass(%s)", (f"public.{t}",))
        if not cur.fetchone()[0]:
            continue
        cur.execute(f"DROP TRIGGER IF EXISTS sync_trg ON {t}")
        cur.execute(f"CREATE TRIGGER sync_trg AFTER INSERT OR UPDATE OR DELETE ON {t} "
                    f"FOR EACH ROW EXECUTE FUNCTION sync_registrar(%s)", (",".join(spec["pk"]),))
    conn.commit()


def encolar_todo(conn):
    """Encola TODAS las filas (carga inicial / 'sincronizar todo')."""
    cur = conn.cursor()
    cur.execute("DELETE FROM sync_sent")
    n = 0
    for spec in SPECS:
        t = spec["name"]
        cur.execute("SELECT to_regclass(%s)", (f"public.{t}",))
        if not cur.fetchone()[0]:
            continue
        pkobj = ", ".join(f"'{c}', t.{c}" for c in spec["pk"])
        filtro = f" WHERE {spec['filtro']}" if spec.get("filtro") else ""
        cur.execute(
            f"INSERT INTO sync_outbox (tabla, pk, op) "
            f"SELECT %s, jsonb_build_object({pkobj}), 'U' FROM {t} t{filtro}", (t,))
        n += cur.rowcount
    conn.commit()
    return n


# ─────────────────────────────────────────────────────────────────────────
# Leer / aplicar filas
# ─────────────────────────────────────────────────────────────────────────
def leer_fila(cur, spec, pk, cols):
    """Estado ACTUAL de una fila (solo las columnas permitidas) o None si ya no
    existe / no cumple el filtro."""
    t = spec["name"]
    # Los numéricos viajan como TEXTO para conservar exactamente su escala (50.00 ≠ 50.0)
    texto = set(spec.get("texto") or [])
    sel = ", ".join(f"t.{c}::text AS {c}" if c in texto else f"t.{c}" for c in cols)
    pk_t = ", ".join(f"t.{c}" for c in spec["pk"])
    pk_r = ", ".join(f"r.{c}" for c in spec["pk"])
    filtro = f" AND ({spec['filtro']})" if spec.get("filtro") else ""
    cur.execute(
        f"SELECT to_jsonb(s) FROM (SELECT {sel} FROM {t} t "
        f"WHERE ({pk_t}) = (SELECT {pk_r} FROM jsonb_populate_record(NULL::{t}, %s::jsonb) r){filtro}) s",
        (json.dumps(pk),))
    r = cur.fetchone()
    return r[0] if r else None


def hash_fila(row):
    return hashlib.sha256(json.dumps(row, sort_keys=True, default=str).encode()).hexdigest()


def _ident_ok(nombre):
    return nombre.replace("_", "").isalnum()


def aplicar_item(cur, spec, op, pk, row, direccion):
    """Aplica UN cambio recibido. Lanza excepción si falla (el llamador usa SAVEPOINT).
    direccion: 'push' (la nube recibe de Recepción) o 'pull' (Recepción recibe de la nube)."""
    t = spec["name"]
    pkcols = spec["pk"]
    permitidas = columnas(spec, direccion)
    if not _ident_ok(t) or not all(_ident_ok(c) for c in permitidas):
        raise ValueError("identificador inválido")
    if set(pk.keys()) != set(pkcols):
        raise ValueError("clave primaria inválida")

    pk_where = " AND ".join(f"{c} = (SELECT r.{c} FROM jsonb_populate_record(NULL::{t}, %s::jsonb) r)" for c in pkcols)
    pk_json = json.dumps(pk)

    if op == "D":
        # Solo la dirección Recepción→nube borra; en 'pull' los borrados no se aplican en Recepción
        cur.execute(f"DELETE FROM {t} WHERE {pk_where}", [pk_json] * len(pkcols))
        return

    if not isinstance(row, dict):
        raise ValueError("fila inválida")
    # Defensa en profundidad: aunque alguien tuviera el secreto, la nube solo acepta
    # cuentas de Entrenador (nunca Administrador/Recepcionista)
    if direccion == "push" and t == "roles_permisos" and row.get("nombre_rol") != "Entrenador":
        raise ValueError("rol no permitido en la nube")
    if direccion == "push" and t == "usuarios_sistema":
        cur.execute("SELECT 1 FROM roles_permisos WHERE id_rol = %s AND nombre_rol = 'Entrenador'",
                    (row.get("id_rol"),))
        if not cur.fetchone():
            raise ValueError("solo se aceptan cuentas de Entrenador")
    # Contraseña de un Entrenador cambiada en la nube → Recepción: solo password_hash y solo Entrenadores
    if direccion == "pull" and t == "usuarios_sistema":
        ph = str(row.get("password_hash") or "")
        if not (ph.startswith("$2b$") or ph.startswith("$2a$")) or not row.get("sync_at"):
            raise ValueError("contraseña inválida")
        cur.execute(
            "UPDATE usuarios_sistema SET password_hash = %s, sync_at = %s::timestamptz "
            "WHERE id_usuario = %s AND sync_at <= %s::timestamptz "
            "AND id_rol IN (SELECT id_rol FROM roles_permisos WHERE nombre_rol = 'Entrenador')",
            (ph, row["sync_at"], pk["id_usuario"], row["sync_at"]))
        return
    aparte = set(spec.get("aparte") or [])
    cols = [c for c in permitidas if c in row and c not in aparte]
    for c in pkcols:
        if c not in cols:
            raise ValueError("falta la clave primaria en la fila")
    row_json = json.dumps({c: row[c] for c in cols})

    # Cuenta recreada en Recepción (otro id para el mismo socio/usuario): se limpia la vieja
    if t == "portal_accounts" and direccion == "push":
        cur.execute("DELETE FROM portal_accounts WHERE id <> (%s::jsonb->>'id')::uuid "
                    "AND (id_socio = (%s::jsonb->>'id_socio')::int "
                    "OR (username IS NOT NULL AND username = %s::jsonb->>'username'))",
                    (row_json, row_json, row_json))

    collist = ", ".join(cols)
    sets = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c not in pkcols)
    lww = spec.get("lww")
    donde = f" WHERE {t}.{lww} <= EXCLUDED.{lww}" if (lww and lww in cols) else ""
    conflicto = (f"ON CONFLICT ({', '.join(pkcols)}) DO UPDATE SET {sets}{donde}" if sets
                 else f"ON CONFLICT ({', '.join(pkcols)}) DO NOTHING")
    cur.execute(
        f"INSERT INTO {t} ({collist}) SELECT {collist} FROM jsonb_populate_record(NULL::{t}, %s::jsonb) "
        f"{conflicto}", (row_json,))

    # last_login: siempre el más reciente (no depende del "gana el más reciente" de la cuenta)
    if t == "portal_accounts" and direccion == "pull" and row.get("last_login"):
        cur.execute("UPDATE portal_accounts SET last_login = GREATEST(COALESCE(last_login, '-infinity'::timestamptz), %s::timestamptz) "
                    "WHERE id = %s::uuid", (row["last_login"], pk["id"]))
    # Si el socio ya cambió su contraseña en la nube, Recepción borra la temporal en texto
    if t == "portal_accounts" and direccion == "pull" and row.get("must_change_password") is False:
        cur.execute("UPDATE portal_accounts SET temp_password = NULL WHERE id = %s::uuid AND temp_password IS NOT NULL",
                    (pk["id"],))


def activar_modo_aplicar(cur):
    """Dentro de la transacción actual: los triggers no re-encolan lo que se aplica,
    y las fechas se serializan siempre en UTC."""
    cur.execute("SET LOCAL spasso.sync_apply = '1'")
    cur.execute("SET LOCAL timezone TO 'UTC'")


def coalescer(filas):
    """filas: [(id, tabla, pk(dict), op)] -> {(tabla, pk_texto): {tabla, pk, op, ids:[...]}}
    manteniendo la última operación de cada fila."""
    res = {}
    for fid, tabla, pk, op in filas:
        k = (tabla, pk_texto(pk))
        e = res.get(k)
        if e is None:
            res[k] = {"tabla": tabla, "pk": pk, "op": op, "ids": [fid]}
        else:
            e["op"] = op
            e["ids"].append(fid)
    return list(res.values())


def digest_tabla(cur, spec):
    cols = spec.get("digest") or spec["push"]
    t = spec["name"]
    sel = ", ".join(f"t.{c}" for c in cols)
    orden = ", ".join(f"t.{c}" for c in spec["pk"])
    filtro = f" WHERE {spec['filtro']}" if spec.get("filtro") else ""
    cur.execute(
        f"SELECT count(*), COALESCE(md5(string_agg(to_jsonb(s)::text, '|' ORDER BY s.ord)), '') FROM ("
        f"SELECT {sel}, row({orden})::text AS ord FROM {t} t{filtro}) s")
    n, h = cur.fetchone()
    return {"n": n, "md5": h}


# ─────────────────────────────────────────────────────────────────────────
# Firma HMAC (anti-falsificación y anti-repetición)
# ─────────────────────────────────────────────────────────────────────────
def _firma(secret, method, path_qs, ts, nonce, body):
    msg = "\n".join([method.upper(), path_qs, str(ts), nonce, hashlib.sha256(body or b"").hexdigest()]).encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def cabeceras_firmadas(secret, method, path_qs, body=b""):
    ts = int(time.time())
    nonce = secrets.token_hex(16)
    return {
        "X-Sync-Ts": str(ts),
        "X-Sync-Nonce": nonce,
        "X-Sync-Sig": _firma(secret, method, path_qs, ts, nonce, body),
    }


_nonces = {}
_nonces_lock = threading.Lock()
VENTANA_SEG = 300


def verificar_firma(secret, method, path_qs, headers, body):
    """Devuelve (ok, motivo)."""
    try:
        ts = int(headers.get("x-sync-ts", ""))
        nonce = headers.get("x-sync-nonce", "")
        sig = headers.get("x-sync-sig", "")
    except ValueError:
        return False, "cabeceras inválidas"
    if not nonce or not sig or len(nonce) > 64:
        return False, "cabeceras inválidas"
    ahora = time.time()
    if abs(ahora - ts) > VENTANA_SEG:
        return False, "hora fuera de rango (revisa el reloj de la PC)"
    esperado = _firma(secret, method, path_qs, ts, nonce, body)
    if not hmac.compare_digest(esperado, sig):
        return False, "firma inválida"
    with _nonces_lock:
        if len(_nonces) > 5000:
            for k in [k for k, v in _nonces.items() if v < ahora]:
                _nonces.pop(k, None)
        if nonce in _nonces and _nonces[nonce] >= ahora:
            return False, "petición repetida"
        _nonces[nonce] = ahora + VENTANA_SEG * 2
    return True, ""
