"""
routes/biometria.py - Huella dactilar real (lector DigitalPersona U.are.U 4500)

Arquitectura:
1. El navegador captura una imagen PNG real de la huella usando el lector
   físico, a través de la librería @digitalpersona/devices (WebSdk) —
   ver Spasso/js/biometria.js.
2. Esa imagen se manda a este backend en base64.
3. Para ENROLAR (Registro de un socio nuevo): se guarda la imagen ligada
   al socio.
4. Para IDENTIFICAR (Asistencia / Renovaciones): se compara la imagen
   capturada contra TODAS las huellas guardadas usando reconocimiento de
   características SIFT + comparador FLANN (OpenCV) — una técnica de
   visión por computadora real y verificable, no una simulación. No es un
   motor de matching biométrico certificado (eso requiere un producto
   comercial aparte de HID), pero es un algoritmo de comparación de
   imágenes genuino, apropiado para un proyecto de tesis.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Body
from fastapi.responses import Response
from database import get_db
from dependencies import require_rol
import base64
import binascii
import cv2
import numpy as np
import psycopg2
from datetime import datetime

router = APIRouter(prefix="/api/biometria", tags=["Biometría"])

# Umbral de similitud (0 a 1) para aceptar una identificación como válida.
# Se puede sobreescribir por request para calibrarlo con el lector real.
# NOTA: con el método anterior (SIFT + FLANN) el mismo dedo daba scores de
# 0.02-0.05 por la textura repetitiva de las crestas — inservible. Con el
# nuevo método de correlación de patrón completo (_comparar_correlacion),
# una prueba sintética de "mismo dedo desplazado/rotado" dio ~0.82 y
# "dedo distinto" dio ~0.005, así que 0.35 da bastante margen de sobra
# para ambos casos. Si en la práctica el mismo socio sigue sin
# reconocerse, o si dos socios distintos se confunden, revisar el campo
# "debug" de la respuesta (en /identificar y /marcar-asistencia) para
# ver el score real y recalibrar con datos del lector.
UMBRAL_SIMILITUD_DEFAULT = 0.35
MIN_KEYPOINTS = 8  # una huella con menos puntos de interés que esto se considera de mala calidad (solo para el chequeo de calidad al capturar)


def _decodificar_imagen(imagen_base64: str) -> np.ndarray:
    """Convierte un string base64 (con o sin prefijo data:image/...) en una imagen OpenCV en escala de grises."""
    if not imagen_base64:
        raise HTTPException(status_code=422, detail="No se recibió ninguna imagen de huella")

    datos = imagen_base64
    if "," in datos and datos.strip().startswith("data:"):
        datos = datos.split(",", 1)[1]

    # Defensa extra: el lector DigitalPersona a veces manda "base64url"
    # (usa '-' y '_' en vez de '+' y '/', y puede faltarle el relleno '=').
    # El frontend ya lo normaliza antes de enviarlo, pero se normaliza
    # también acá por si algún otro cliente llama a este endpoint directo.
    datos = datos.strip().replace("-", "+").replace("_", "/")
    datos += "=" * (-len(datos) % 4)

    try:
        raw = base64.b64decode(datos)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=422, detail="La imagen de huella no es un base64 válido")

    arr = np.frombuffer(raw, dtype=np.uint8)
    imagen = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if imagen is None:
        raise HTTPException(status_code=422, detail="No se pudo leer la imagen de huella recibida")

    return imagen, raw


def _extraer_descriptores(imagen: np.ndarray):
    """
    Se usa para medir la calidad de una huella recién capturada (¿se ve
    suficiente detalle como para considerarla una lectura válida?) Y
    TAMBIÉN como entrada de la verificación geométrica de seguridad — ver
    _verificar_geometria() más abajo.
    """
    imagen_suave = cv2.GaussianBlur(imagen, (3, 3), 0)
    sift = cv2.SIFT_create(nfeatures=300)
    keypoints, descriptores = sift.detectAndCompute(imagen_suave, None)
    return keypoints, descriptores


# Umbrales de la verificación geométrica (ver _verificar_geometria). Se
# pueden sobreescribir por request (igual que UMBRAL_SIMILITUD_DEFAULT)
# para recalibrar en caliente si hace falta durante una demo en vivo — por
# ejemplo, mandando min_inliers: 0 y min_ratio_inliers: 0 se desactiva
# esta segunda comprobación por completo (queda solo la correlación, como
# antes), por si hiciera falta un respaldo rápido sin tocar código.
# Deliberadamente conservadores (exigen poco) para no rechazar huellas
# legítimas: esta comprobación solo debe frenar los casos MUY claros de
# "esto no tiene nada que ver geométricamente" (huellas de personas
# distintas), no huellas del socio correcto con una lectura más ruidosa
# de lo normal.
MIN_INLIERS_GEOMETRICOS_DEFAULT = 5
MIN_RATIO_INLIERS_DEFAULT = 0.18


def _verificar_geometria(kp1, desc1, kp2, desc2):
    """
    Segunda comprobación de seguridad, además de _comparar_correlacion().

    El problema de fondo: _comparar_correlacion() compara el patrón de
    crestas COMPLETO de dos imágenes por correlación cruzada — funciona
    bien para confirmar "esto se parece a una huella igual, desplazada o
    rotada", pero dos huellas de PERSONAS DISTINTAS pueden correlacionar
    más de lo esperado si ambas imágenes tienen contraste, iluminación o
    densidad de crestas parecidos, porque la correlación no verifica que
    los DETALLES finos (minucias) coincidan en las mismas posiciones
    relativas, solo que el patrón general se parezca.

    Esta función sí lo verifica: toma los puntos de interés SIFT de ambas
    imágenes (ya calculados para el chequeo de calidad), los empareja por
    similitud de descriptor (sin el ratio test de Lowe, que falla en
    huellas por su textura repetitiva — ver la nota debajo de este
    bloque) y le pide a RANSAC que encuentre una transformación
    geométrica (homografía) consistente con la MAYOR cantidad posible de
    esos emparejamientos. Si de verdad es el mismo dedo, muchos puntos
    van a "encajar" en una única transformación (mismo dedo movido o
    rotado). Si son dedos de personas distintas, los emparejamientos son
    básicamente ruido y RANSAC no logra encontrar consenso — quedan muy
    pocos "inliers".

    Devuelve (cantidad_inliers, proporcion_inliers, evaluado):
    - `evaluado = False` significa que no hubo suficiente información
      para siquiera intentar la verificación (muy pocos keypoints o
      descriptores en alguna de las dos imágenes, o muy pocos
      emparejamientos candidatos). En ese caso el llamador NO debe usar
      esto como señal ni a favor ni en contra — para no invalidar una
      huella válida capturada con menos nitidez de lo normal.
    - `evaluado = True` significa que SÍ se corrió la verificación de
      verdad: acá pocos inliers (o ninguno) SÍ es una señal fuerte y
      confiable de que son huellas de personas distintas.
    """
    if desc1 is None or desc2 is None or len(kp1) < 8 or len(kp2) < 8:
        return 0, 0.0, False

    try:
        bf = cv2.BFMatcher(cv2.NORM_L2)
        matches = bf.knnMatch(desc1, desc2, k=2)
    except cv2.error:
        return 0, 0.0, False

    # Sin ratio test de Lowe (descarta casi todo en huellas reales por su
    # textura repetitiva — ver nota en _comparar_correlacion). En cambio,
    # se toman los mejores candidatos por distancia de descriptor y se
    # deja que RANSAC descarte los que no encajen geométricamente.
    candidatos = [m[0] for m in matches if len(m) > 0]
    candidatos.sort(key=lambda m: m.distance)
    candidatos = candidatos[:80]
    if len(candidatos) < 8:
        return 0, 0.0, False

    pts1 = np.float32([kp1[m.queryIdx].pt for m in candidatos]).reshape(-1, 1, 2)
    pts2 = np.float32([kp2[m.trainIdx].pt for m in candidatos]).reshape(-1, 1, 2)

    try:
        _, mask = cv2.findHomography(pts1, pts2, cv2.RANSAC, 6.0)
    except cv2.error:
        return 0, 0.0, False
    if mask is None:
        # Sí se pudo intentar, pero no encontró NINGUNA transformación
        # geométrica consistente — es una señal fuerte de rechazo, no
        # falta de datos.
        return 0, 0.0, True

    inliers = int(mask.sum())
    return inliers, inliers / len(candidatos), True


# ─────────────────────────────────────────────────────────────────
# NOTA IMPORTANTE (primera prueba real con el lector, después de dos
# rondas de ajuste que no funcionaron):
#
# La comparación original usaba SIFT (detección de puntos de interés) +
# FLANN, la técnica "de manual" para comparar imágenes en general. El
# problema, confirmado con datos reales del lector: una huella tiene un
# patrón de crestas MUY repetitivo — cada cresta se parece a la de al
# lado — así que la prueba de ratio de Lowe (que decide si un punto es
# "un buen match" comparando la mejor coincidencia contra la segunda
# mejor) descarta casi todas las coincidencias reales, porque en un
# patrón repetitivo la segunda mejor coincidencia es casi tan buena como
# la primera aunque SEA la correcta. Resultado: puntajes de 0.02-0.05
# incluso comparando el mismo dedo consigo mismo.
#
# La solución que sí funciona para este caso (validado con imágenes
# sintéticas: ~0.82 para "mismo dedo desplazado/rotado" vs ~0.005 para
# "dedo distinto"): en vez de puntos sueltos, comparar el patrón de
# crestas COMPLETO por correlación cruzada normalizada, probando un
# pequeño rango de rotaciones para tolerar que el dedo no quede en
# exactamente el mismo ángulo cada vez. Esto es, en esencia, lo mismo
# que hacen los algoritmos de correlación de huellas por patrón global
# (a diferencia de los algoritmos por minucias, que necesitan hardware/
# SDK certificado que no está disponible para este proyecto).
# ─────────────────────────────────────────────────────────────────
def _comparar_correlacion(imagen_1: np.ndarray, imagen_2: np.ndarray) -> float:
    """Devuelve un score de similitud entre 0 y 1 comparando el patrón de crestas completo."""
    h, w = imagen_1.shape
    imagen_2 = cv2.resize(imagen_2, (w, h))

    def realzar(img):
        img = cv2.GaussianBlur(img, (3, 3), 0)
        img = cv2.equalizeHist(img)
        return img.astype(np.float32)

    base = realzar(imagen_1)
    margen = max(10, min(h, w) // 12)

    mejor = 0.0
    for angulo in (-10, -6, -3, 0, 3, 6, 10):
        matriz = cv2.getRotationMatrix2D((w / 2, h / 2), angulo, 1.0)
        rotada = cv2.warpAffine(imagen_2, matriz, (w, h), borderMode=cv2.BORDER_REFLECT)
        candidata = realzar(rotada)
        plantilla = candidata[margen:h - margen, margen:w - margen]
        if plantilla.shape[0] < 10 or plantilla.shape[1] < 10:
            continue
        try:
            resultado = cv2.matchTemplate(base, plantilla, cv2.TM_CCOEFF_NORMED)
        except cv2.error:
            continue
        score = float(resultado.max())
        if score > mejor:
            mejor = score

    return max(mejor, 0.0)


MIN_MUESTRAS_ENROLAMIENTO = 3  # se piden 3 toques del dedo para enrolar/reemplazar una huella


def _validar_y_preparar_muestras(imagenes_base64):
    """
    Valida el enrolamiento de una huella a partir de 1 a 3 capturas:
      1) Cada captura individual debe cumplir el mínimo de calidad
         (MIN_KEYPOINTS), igual que antes.
      2) Si hay más de una captura, TODAS deben corresponder al mismo
         dedo entre sí (se comparan de a pares con la misma correlación +
         verificación geométrica que se usa para identificar) — si dos
         capturas no calzan entre sí, se rechaza el enrolamiento COMPLETO
         con un mensaje claro, en vez de guardar algo a medias que después
         cause errores de reconocimiento.

    Esto es lo que antes faltaba: se podía guardar una huella de mala
    calidad, o incluso (por un despiste al capturar) el dedo equivocado en
    alguno de los pasos, sin que nada lo detectara en el momento — y el
    error solo se notaba después, al fallar el reconocimiento o, peor,
    al confundirse con la huella de otra persona.

    Devuelve una lista de tuplas (raw_bytes, num_keypoints) en el mismo
    orden que se recibieron, lista para guardar.
    """
    if not imagenes_base64:
        raise HTTPException(status_code=422, detail="No se recibió ninguna captura de huella")
    if len(imagenes_base64) > 3:
        imagenes_base64 = imagenes_base64[:3]

    preparadas = []  # (raw, num_keypoints, keypoints, descriptores)
    for i, imagen_base64 in enumerate(imagenes_base64, start=1):
        imagen, raw = _decodificar_imagen(imagen_base64)
        keypoints, descriptores = _extraer_descriptores(imagen)
        num_keypoints = len(keypoints) if keypoints else 0
        if num_keypoints < MIN_KEYPOINTS:
            raise HTTPException(
                status_code=422,
                detail=f"La captura {i} de {len(imagenes_base64)} tiene muy baja calidad "
                       f"({num_keypoints} puntos detectados). Vuelva a colocar el dedo firmemente "
                       f"en el lector y repita las {len(imagenes_base64)} capturas."
            )
        preparadas.append((raw, num_keypoints, keypoints, descriptores, imagen))

    # Si hay más de una muestra, verificar que todas sean del mismo dedo
    # entre sí (comparación de a pares), con el mismo criterio (correlación
    # + geometría) que se usa para identificar — así el enrolamiento exige
    # tanta consistencia como después se le va a exigir a alguien que
    # quiera reconocerse con esta huella.
    if len(preparadas) > 1:
        for i in range(len(preparadas)):
            for j in range(i + 1, len(preparadas)):
                _, _, kp_i, desc_i, img_i = preparadas[i]
                _, _, kp_j, desc_j, img_j = preparadas[j]
                score = _comparar_correlacion(img_i, img_j)
                inliers, ratio_inliers, evaluado = _verificar_geometria(kp_i, desc_i, kp_j, desc_j)
                consistente = score >= UMBRAL_SIMILITUD_DEFAULT and (
                    (not evaluado) or inliers >= MIN_INLIERS_GEOMETRICOS_DEFAULT or ratio_inliers >= MIN_RATIO_INLIERS_DEFAULT
                )
                print(
                    f"[biometria] enrolamiento: comparando captura {i+1} vs {j+1}: "
                    f"correlacion={round(score,4)} inliers={inliers} proporcion={round(ratio_inliers,3)} "
                    f"-> {'CONSISTENTE' if consistente else 'NO COINCIDE'}"
                )
                if not consistente:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Las capturas {i+1} y {j+1} no parecen ser del mismo dedo "
                               f"(similitud {round(score,3)}). Vuelva a intentar colocando el mismo "
                               f"dedo firme, en la misma posición, durante las {len(preparadas)} capturas."
                    )

    return [(raw, num_keypoints) for raw, num_keypoints, _, _, _ in preparadas]


@router.post("/enrolar", status_code=status.HTTP_201_CREATED)
def enrolar_huella(
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Guarda (o reemplaza) la huella real de un socio, a partir de hasta 3
    capturas del mismo dedo (más capturas = identificación más segura,
    ver _identificar_desde_imagen). Las 3 se comparan entre sí antes de
    guardar nada: si no coinciden, se rechaza el enrolamiento completo.

    Recibe: { id_socio, imagenes_base64: [str, str, str] }
    (por compatibilidad, también acepta { id_socio, imagen_base64: str }
    con una sola captura, pero SIEMPRE que se pueda hay que mandar las 3)
    """
    id_socio = data.get("id_socio")
    if not id_socio:
        raise HTTPException(status_code=422, detail="Falta id_socio")

    imagenes_base64 = data.get("imagenes_base64")
    if not imagenes_base64 and data.get("imagen_base64"):
        imagenes_base64 = [data.get("imagen_base64")]

    muestras = _validar_y_preparar_muestras(imagenes_base64)
    # Rellenar hasta 3 columnas (las que falten quedan en NULL)
    while len(muestras) < 3:
        muestras.append((None, None))

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT id_socio FROM socios WHERE id_socio = %s", (id_socio,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Socio no encontrado")

        (raw_1, kp_1), (raw_2, kp_2), (raw_3, kp_3) = muestras
        cur.execute(
            """
            INSERT INTO huellas_biometricas
                (id_socio, imagen_png, num_keypoints, imagen_png_2, num_keypoints_2, imagen_png_3, num_keypoints_3)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id_socio) DO UPDATE SET
                imagen_png = EXCLUDED.imagen_png,
                num_keypoints = EXCLUDED.num_keypoints,
                imagen_png_2 = EXCLUDED.imagen_png_2,
                num_keypoints_2 = EXCLUDED.num_keypoints_2,
                imagen_png_3 = EXCLUDED.imagen_png_3,
                num_keypoints_3 = EXCLUDED.num_keypoints_3,
                actualizado_en = NOW()
            RETURNING id_huella
            """,
            (
                id_socio,
                psycopg2.Binary(raw_1), kp_1,
                psycopg2.Binary(raw_2) if raw_2 is not None else None, kp_2,
                psycopg2.Binary(raw_3) if raw_3 is not None else None, kp_3,
            )
        )
        id_huella = cur.fetchone()[0]

    total_muestras = sum(1 for raw, _ in muestras if raw is not None)
    return {
        "id_huella": id_huella,
        "id_socio": id_socio,
        "calidad_puntos": kp_1,
        "muestras_guardadas": total_muestras,
        "mensaje": f"Huella registrada exitosamente con {total_muestras} muestra(s)"
    }


@router.post("/validar-muestras")
def validar_muestras_huella(
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Corre la misma validación de calidad + consistencia entre capturas que
    usa /enrolar, pero SIN guardar nada ni necesitar un id_socio todavía.

    Se usa en Registro: como el socio recién se crea al final de todo el
    formulario, esto permite avisarle a la recepcionista de inmediato —
    apenas terminan los 3 toques del dedo — si algo salió mal (una
    captura de mala calidad, o que no coincida con las otras), en vez de
    que el error aparezca recién al final, cuando ya llenó el resto del
    formulario y tendría que repetir todo desde la huella.

    Recibe: { imagenes_base64: [str, str, str] }
    """
    muestras = _validar_y_preparar_muestras(data.get("imagenes_base64"))
    return {
        "valido": True,
        "muestras_validas": len(muestras),
        "mensaje": f"Las {len(muestras)} capturas coinciden entre sí y tienen buena calidad"
    }


def _evaluar_muestra(imagen_query, keypoints_q, descriptores_q, imagen_png_candidata, min_inliers, min_ratio_inliers):
    """
    Compara la huella recién capturada contra UNA muestra guardada de un
    candidato y dice si "pasa" (correlación + geometría), devolviendo
    también los números para debug. Se usa una vez por cada una de las
    hasta 3 muestras guardadas de cada socio (ver _identificar_desde_imagen).
    """
    arr = np.frombuffer(bytes(imagen_png_candidata), dtype=np.uint8)
    imagen_candidata = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if imagen_candidata is None:
        return None

    score = _comparar_correlacion(imagen_query, imagen_candidata)
    kp_c, desc_c = _extraer_descriptores(imagen_candidata)
    inliers, ratio_inliers, evaluado = _verificar_geometria(keypoints_q, descriptores_q, kp_c, desc_c)
    pasa_geometria = (not evaluado) or (inliers >= min_inliers) or (ratio_inliers >= min_ratio_inliers)

    return {
        "score": score,
        "inliers": inliers,
        "ratio_inliers": ratio_inliers,
        "evaluado": evaluado,
        "pasa_geometria": pasa_geometria,
    }


def _identificar_desde_imagen(conn, imagen_base64: str, umbral: float = None, min_inliers: int = None, min_ratio_inliers: float = None):
    """
    Lógica compartida de identificación 1:N. Recibe una conexión ya abierta
    (para que el caller pueda seguir usándola dentro de la misma
    transacción) y devuelve (mejor_candidato_o_None, mejor_score, debug_info).

    Cada socio puede tener hasta 3 muestras guardadas (ver /enrolar). Para
    aceptar a un candidato, la huella recién tocada debe "pasar" (superar
    el umbral de correlación Y la verificación geométrica) contra VARIAS
    de esas muestras, no basta con una sola coincidencia:
      - Si el socio tiene 3 muestras: se exige que pase contra al menos 2.
      - Si tiene 1 o 2 (huellas guardadas antes de este cambio, o
        enroladas con menos de 3 capturas): se exige que pase contra al
        menos 1 — no se penaliza a huellas antiguas por no tener las 3.

    Esto es lo que evita que una coincidencia de casualidad contra una
    sola imagen guardada haga que el sistema confunda a dos personas
    distintas: ahora tiene que repetirse la coincidencia en más de una
    muestra real del mismo socio.
    """
    umbral = umbral or UMBRAL_SIMILITUD_DEFAULT
    min_inliers = MIN_INLIERS_GEOMETRICOS_DEFAULT if min_inliers is None else min_inliers
    min_ratio_inliers = MIN_RATIO_INLIERS_DEFAULT if min_ratio_inliers is None else min_ratio_inliers

    imagen, _ = _decodificar_imagen(imagen_base64)
    keypoints_1, descriptores_1 = _extraer_descriptores(imagen)

    if not keypoints_1 or len(keypoints_1) < MIN_KEYPOINTS:
        raise HTTPException(
            status_code=422,
            detail="La calidad de la huella capturada es muy baja. Intente de nuevo."
        )

    cur = conn.cursor()
    cur.execute(
        """
        SELECT h.id_socio, h.imagen_png, h.imagen_png_2, h.imagen_png_3, s.nombres, s.apellidos, s.dni
        FROM huellas_biometricas h
        JOIN socios s ON s.id_socio = h.id_socio
        WHERE s.activo = true
        """
    )
    candidatos_db = cur.fetchall()

    resultados = []  # (id_socio, nombres, apellidos, dni, mejor_score_candidato, muestras_que_pasan, total_muestras, mejor_debug)

    for id_socio, imagen_png_1, imagen_png_2, imagen_png_3, nombres, apellidos, dni in candidatos_db:
        muestras_candidato = [m for m in (imagen_png_1, imagen_png_2, imagen_png_3) if m is not None]
        evaluaciones = []
        for muestra in muestras_candidato:
            r = _evaluar_muestra(imagen, keypoints_1, descriptores_1, muestra, min_inliers, min_ratio_inliers)
            if r is not None:
                evaluaciones.append(r)

        if not evaluaciones:
            continue

        # ¿Con cuántas de las muestras de este socio "pasa" la huella
        # recién tocada (score >= umbral Y verificación geométrica ok)?
        pasan = [e for e in evaluaciones if e["score"] >= umbral and e["pasa_geometria"]]
        total_muestras = len(evaluaciones)
        necesarias = 2 if total_muestras >= 3 else 1

        mejor_score_candidato = max(e["score"] for e in evaluaciones)
        mejor_eval = max(evaluaciones, key=lambda e: e["score"])

        print(
            f"[biometria] id_socio={id_socio}: {len(pasan)}/{total_muestras} muestra(s) coinciden "
            f"(necesita {necesarias}) — mejor score_correlacion={round(mejor_score_candidato, 4)}, "
            f"inliers={mejor_eval['inliers']}, proporcion={round(mejor_eval['ratio_inliers'], 3)}"
        )

        resultados.append({
            "id_socio": id_socio,
            "nombres": nombres,
            "apellidos": apellidos,
            "dni": dni,
            "score": mejor_score_candidato,
            "pasan": len(pasan),
            "necesarias": necesarias,
            "total_muestras": total_muestras,
            "mejor_eval": mejor_eval,
            "aceptado": len(pasan) >= necesarias,
        })

    mejor_score_correlacion = max((r["score"] for r in resultados), default=0.0)

    # De los candidatos que sí juntaron suficientes muestras coincidentes,
    # nos quedamos con el de mejor score (por si, en un caso raro, más de
    # uno califica).
    aceptados = [r for r in resultados if r["aceptado"]]
    aceptados.sort(key=lambda r: r["score"], reverse=True)
    mejor = aceptados[0] if aceptados else None

    debug_info = {
        "umbral_usado": umbral,
        "min_inliers_geometricos": min_inliers,
        "min_ratio_inliers": min_ratio_inliers,
        "total_huellas_guardadas": len(candidatos_db),
        "mejor_score_correlacion": round(mejor_score_correlacion, 4),
        "mejor_match": None if not mejor else {
            "score_correlacion": round(mejor["score"], 4),
            "muestras_coincidentes": f"{mejor['pasan']}/{mejor['total_muestras']} (necesitaba {mejor['necesarias']})",
            "inliers_geometricos": mejor["mejor_eval"]["inliers"],
            "proporcion_inliers": round(mejor["mejor_eval"]["ratio_inliers"], 3),
        },
    }

    if mejor:
        candidato = {
            "id_socio": mejor["id_socio"],
            "nombres": mejor["nombres"],
            "apellidos": mejor["apellidos"],
            "dni": mejor["dni"],
        }
        return candidato, mejor["score"], debug_info
    return None, mejor_score_correlacion, debug_info


@router.post("/identificar")
def identificar_huella(
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Compara una huella recién capturada contra TODAS las huellas guardadas
    y devuelve el socio con mayor similitud, si supera el umbral Y la
    verificación geométrica de seguridad (ver _verificar_geometria).
    Recibe: { imagen_base64, umbral (opcional, 0 a 1),
              min_inliers (opcional), min_ratio_inliers (opcional, 0 a 1) }
    """
    with get_db() as conn:
        candidato, score, debug_info = _identificar_desde_imagen(
            conn, data.get("imagen_base64"), data.get("umbral"),
            data.get("min_inliers"), data.get("min_ratio_inliers")
        )

    if candidato:
        return {
            "encontrado": True,
            "similitud": round(score, 3),
            "debug": debug_info,
            **candidato
        }

    return {
        "encontrado": False,
        "similitud": round(score, 3),
        "debug": debug_info,
        "mensaje": "No se encontró ninguna huella coincidente"
    }


@router.post("/marcar-asistencia")
def marcar_asistencia_biometrica(
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Punto de entrada único para el widget flotante de huella: identifica al
    socio y, en la misma llamada, decide si es una ENTRADA o una SALIDA:

    - Si el socio NO tiene un registro de asistencia abierto (fecha_salida
      IS NULL) hoy, esto es una ENTRADA: se crea el registro y, si el
      módulo de lockers está habilitado, se asigna un casillero
      automáticamente (si gym_config.asignacion_lockers_automatica) o se
      devuelve la lista de casilleros libres para que la recepcionista
      elija uno (POST /asignar-locker-asistencia).
    - Si el socio SÍ tiene un registro abierto, esto es una SALIDA: se
      cierra el registro (fecha_salida = NOW()) y, si tenía un casillero
      asignado, se libera automáticamente.

    Recibe: { imagen_base64, umbral (opcional), min_inliers (opcional),
              min_ratio_inliers (opcional) }
    """
    with get_db() as conn:
        candidato, score, debug_info = _identificar_desde_imagen(
            conn, data.get("imagen_base64"), data.get("umbral"),
            data.get("min_inliers"), data.get("min_ratio_inliers")
        )

        if not candidato:
            return {
                "encontrado": False,
                "similitud": round(score, 3),
                "debug": debug_info,
                "mensaje": "No se encontró ninguna huella coincidente"
            }

        id_socio = candidato["id_socio"]
        cur = conn.cursor()

        # ¿Tiene un registro de asistencia abierto (sin salida)?
        cur.execute(
            """
            SELECT id_log, id_locker
            FROM asistencias_log
            WHERE id_socio = %s AND fecha_salida IS NULL
            ORDER BY fecha_entrada DESC
            LIMIT 1
            """,
            (id_socio,)
        )
        abierto = cur.fetchone()

        if abierto:
            # ===== SALIDA =====
            id_log, id_locker = abierto
            cur.execute(
                "UPDATE asistencias_log SET fecha_salida = NOW() WHERE id_log = %s",
                (id_log,)
            )

            locker_liberado = None
            if id_locker:
                cur.execute(
                    "SELECT numero_locker FROM gestion_lockers WHERE id_locker = %s",
                    (id_locker,)
                )
                fila_locker = cur.fetchone()
                cur.execute(
                    "UPDATE gestion_lockers SET estado = 'Libre', id_socio_actual = NULL WHERE id_locker = %s",
                    (id_locker,)
                )
                if fila_locker:
                    locker_liberado = fila_locker[0]

            return {
                "encontrado": True,
                "similitud": round(score, 3),
                "tipo": "salida",
                "locker_liberado": locker_liberado,
                **candidato
            }

        # ===== ENTRADA =====
        cur.execute(
            """
            INSERT INTO asistencias_log (id_socio, id_hardware)
            VALUES (%s, 1)
            RETURNING id_log
            """,
            (id_socio,)
        )
        id_log = cur.fetchone()[0]

        cur.execute(
            "SELECT lockers_habilitados, asignacion_lockers_automatica FROM gym_config LIMIT 1"
        )
        config_row = cur.fetchone()
        lockers_habilitados = bool(config_row[0]) if config_row else False
        asignacion_automatica = bool(config_row[1]) if config_row else False

        # Info de membresía (para la pantalla de bienvenida opcional del socio):
        # días restantes y plan actual, si tiene una membresía activa.
        membresia_info = None
        cur.execute(
            """
            SELECT plan, fecha_vencimiento FROM membresias
            WHERE id_socio = %s AND estado IN ('activo', 'por-vencer')
            ORDER BY fecha_vencimiento DESC LIMIT 1
            """,
            (id_socio,)
        )
        fila_membresia = cur.fetchone()
        if fila_membresia:
            plan_actual, fecha_vencimiento = fila_membresia
            dias_restantes = (fecha_vencimiento.date() - datetime.now().date()).days if fecha_vencimiento else None
            membresia_info = {"plan": plan_actual, "dias_restantes": dias_restantes}

        resultado = {
            "encontrado": True,
            "similitud": round(score, 3),
            "tipo": "entrada",
            "id_log": id_log,
            "membresia": membresia_info,
            **candidato
        }

        if not lockers_habilitados:
            return resultado

        if asignacion_automatica:
            cur.execute(
                "SELECT id_locker, numero_locker, zona FROM gestion_lockers "
                "WHERE estado = 'Libre' ORDER BY numero_locker LIMIT 1 FOR UPDATE SKIP LOCKED"
            )
            libre = cur.fetchone()
            if not libre:
                resultado["sin_lockers_disponibles"] = True
                return resultado

            id_locker, numero_locker, zona = libre
            cur.execute(
                "UPDATE gestion_lockers SET estado = 'Ocupado', id_socio_actual = %s WHERE id_locker = %s",
                (id_socio, id_locker)
            )
            cur.execute(
                "UPDATE asistencias_log SET id_locker = %s WHERE id_log = %s",
                (id_locker, id_log)
            )
            resultado["locker_asignado"] = {"id_locker": id_locker, "numero_locker": numero_locker, "zona": zona}
            return resultado

        # Manual: la recepcionista elige el casillero desde el widget flotante
        cur.execute(
            "SELECT id_locker, numero_locker, zona FROM gestion_lockers "
            "WHERE estado = 'Libre' ORDER BY numero_locker"
        )
        libres = cur.fetchall()
        if not libres:
            resultado["sin_lockers_disponibles"] = True
            return resultado

        resultado["requiere_seleccion_locker"] = True
        resultado["lockers_disponibles"] = [
            {"id_locker": r[0], "numero_locker": r[1], "zona": r[2]} for r in libres
        ]
        return resultado


@router.post("/asignar-locker-asistencia")
def asignar_locker_asistencia(
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Confirma la asignación MANUAL de un casillero elegido por la
    recepcionista desde el widget flotante, para la entrada que se acaba
    de registrar con /marcar-asistencia.
    Recibe: { id_log, id_locker }
    """
    id_log = data.get("id_log")
    id_locker = data.get("id_locker")
    if not id_log or not id_locker:
        raise HTTPException(status_code=422, detail="Faltan id_log o id_locker")

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT id_socio, id_locker FROM asistencias_log WHERE id_log = %s", (id_log,))
        registro = cur.fetchone()
        if not registro:
            raise HTTPException(status_code=404, detail="Registro de asistencia no encontrado")
        id_socio, id_locker_previo = registro
        if id_locker_previo:
            raise HTTPException(status_code=409, detail="Esta entrada ya tiene un casillero asignado")

        cur.execute("SELECT estado, numero_locker, zona FROM gestion_lockers WHERE id_locker = %s", (id_locker,))
        locker = cur.fetchone()
        if not locker:
            raise HTTPException(status_code=404, detail="Casillero no encontrado")
        if locker[0] != "Libre":
            raise HTTPException(status_code=409, detail="Ese casillero ya no está disponible, elige otro")

        cur.execute(
            "UPDATE gestion_lockers SET estado = 'Ocupado', id_socio_actual = %s WHERE id_locker = %s",
            (id_socio, id_locker)
        )
        cur.execute("UPDATE asistencias_log SET id_locker = %s WHERE id_log = %s", (id_locker, id_log))

    return {
        "mensaje": f"Casillero #{locker[1]} ({locker[2]}) asignado correctamente",
        "numero_locker": locker[1],
        "zona": locker[2]
    }


@router.get("/estado/{id_socio}")
def estado_huella(
    id_socio: int,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """Indica si un socio ya tiene una huella registrada y con cuántas muestras."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_huella, num_keypoints, creado_en, imagen_png_2, imagen_png_3
            FROM huellas_biometricas WHERE id_socio = %s
            """,
            (id_socio,)
        )
        row = cur.fetchone()

    if not row:
        return {"registrada": False}

    muestras_guardadas = 1 + (1 if row[3] is not None else 0) + (1 if row[4] is not None else 0)

    return {
        "registrada": True,
        "id_huella": row[0],
        "calidad_puntos": row[1],
        "fecha_registro": row[2].isoformat() if row[2] else None,
        "muestras_guardadas": muestras_guardadas,
    }


@router.get("/debug/imagen/{id_socio}")
def debug_ver_imagen_huella(id_socio: int, muestra: int = 1):
    """
    SOLO PARA DEPURACIÓN durante el desarrollo: sirve una de las imágenes
    PNG crudas que quedaron guardadas para un socio (muestra=1, 2 o 3),
    para poder abrirla directo en el navegador
    (http://127.0.0.1:7000/api/biometria/debug/imagen/9?muestra=2) y ver
    a simple vista si lo que capturó el lector realmente se ve como una
    huella o si algo salió mal en la captura. A propósito sin
    autenticación (para poder abrirla en una pestaña nueva sin token) —
    quitar este endpoint antes de un despliegue real fuera de la tesis.
    """
    columna = {1: "imagen_png", 2: "imagen_png_2", 3: "imagen_png_3"}.get(muestra, "imagen_png")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT {columna} FROM huellas_biometricas WHERE id_socio = %s", (id_socio,))
        row = cur.fetchone()

    if not row or row[0] is None:
        raise HTTPException(status_code=404, detail=f"Este socio no tiene guardada la muestra {muestra}")

    return Response(content=bytes(row[0]), media_type="image/png")
