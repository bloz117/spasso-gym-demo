# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The public-facing site + member portal for Spasso Sauna & Gym: plain static HTML/CSS/JS, no build step, no bundler, no `package.json`. Everything is one big `index.html` with all sections and modals inline, plus a handful of script files.

It is the frontend half of a two-repo pair. The backend is the sibling FastAPI project `../proyecto_gym` (see that repo's `CLAUDE.md`), which also mounts this folder read-only at `/portal-static` in production. `portal-client.js` talks to it via a hardcoded base URL:

```js
BASE_URL: 'http://127.0.0.1:7000'
```

## Commands

There is nothing to build or install. Either open `index.html` directly, or serve the folder with a static server (VS Code Live Server/Five Server) so relative paths resolve — the backend must be running separately (`python main.py` in `../proyecto_gym`) for login/portal data to work; without it, everything except the member login/dashboard still renders.

There's no test runner or linter configured. The verification loop used in this repo is: `node --check <file>.js` for syntax, plus a brace-balance / div-balance check for CSS/HTML edits (large single files make an unbalanced brace or tag easy to introduce and hard to spot by eye):

```bash
node --check funciones.js
node -e "const s=require('fs').readFileSync('styles.css','utf8'); let d=0; for (const c of s){if(c==='{')d++; if(c==='}')d--;} console.log(d);"
```

## Architecture

### File responsibilities

- **`index.html`** — the entire site: marketing sections, login/register modals, and `#profileModal` (the "Mi Cuenta" member dashboard: sidebar nav + panels for Resumen/Perfil/Ejercicios/Rutinas/Alimentación).
- **`funciones.js`** (~1800 lines) — everything wrapped in a single `DOMContentLoaded` closure: nav/hamburger menu, session button state, the `#profileModal` panel-switching logic, and `window.aplicarSesionSocio(perfil, plan)`.
- **`portal-client.js`** — all backend API calls (`portalFetch`, `getSocioProfile`, `getSocioPlan`, `getSocioVisits`, `getSocioLocker`, ...) and `loginSocio`/`logoutSocio`. Defines plain global functions (not an IIFE), and also exposes a subset via `window.PORTAL`.
- **`ejercicios.js`** — the exercise-library tab/subcategory/search/lightbox logic, driven by `window.EJERCICIOS_DATA` from `data/exercises-data.js`.
- **`data/exercises-data.js`** — the exercise dataset (~1300 rows), loaded before `ejercicios.js`.

### Script load order matters

In `index.html`, `funciones.js` loads **before** `portal-client.js`. This is safe only because `funciones.js` never calls a `portal-client.js` function at parse time — only later, from inside event handlers or `DOMContentLoaded`-deferred code, by which point both scripts have finished loading. Don't call a `portal-client.js` global from top-level code in `funciones.js`.

### Session/profile data flow — one entry point

`window.aplicarSesionSocio(perfil, plan)` (in `funciones.js`) is the **only** place that builds `currentUser` and paints `#profileModal` from backend data. `portal-client.js` fetches data and calls this bridge; it must never write to `#profileModal`'s DOM directly. Panel switching (`Resumen`/`Perfil`/`Ejercicios`/...) is driven by a shared `data-panel` attribute read by both the sidebar (`.profile-nav__item`) and the mobile bottom nav (`.profile-bottomnav__item`) — `cambiarPanelPerfil()` keeps both in sync from a single call.

### Conventions

- **Cache-busting via query string**: `<script src="funciones.js?v=20260827-resumen">` — there's no build hash, so bump the `?v=` suffix by hand whenever you edit a file that's already been shipped, or the browser may serve a stale cached copy.
- **`--fuente-ios`**: a CSS custom property scoped to `.profile-page-content` that swaps in a system/iOS-style font stack for only the "Mi Cuenta" section, without changing the site's global typography.
- **Icon packs** under `img/iconos/` are all fit to a 512×512 canvas with transparent backgrounds, cropped/margined to match visually regardless of source.
- Body-part icons for the Ejercicios tab (`ICONOS_IMG`) and the finer muscle-subcategory icons (`ICONOS_SUB`) in `ejercicios.js` are two separate maps — a body part only gets a subcategory row if it has more than one distinct `objetivo_es` value in the dataset (see `subcategoriasPorParte`).

### Environment constraint

Chrome MCP / browser automation in this environment cannot load `file://` pages, so there is no live-render verification available here — changes are checked via `node --check`, the brace/div-balance scripts above, and user-provided screenshots.

## Versión móvil del portal (celulares y tablets)
- Condición única en todos los bloques móviles de `css/styles.css` (y `entrenador-portal.css`):
  `@media (max-width: 1024px), (hover: none) and (pointer: coarse)`.
- Móvil/tablet: hamburguesa, píldora "Hola, nombre", Mi Cuenta con barra inferior fija, X flotante,
  Ejercicios en grilla de 3 columnas, hoja inferior para el detalle, Ubicaciones y Contacto compacta.
- Ventana de navegador de computadora (ancha) = versión de escritorio sin cambios.
- Los bloques "Ronda N" al final de styles.css son los ajustes móviles; mantener ahí lo nuevo.

## Interfaz del entrenador en móvil (aprobada, no modificar sin pedirlo)
Diseño móvil/tablet del panel de entrenador (js/entrenador-portal.js + css/entrenador-portal.css, bloques v4–v9, breakpoint ≤860px): barra superior con menú hamburguesa + título + nombre del entrenador, cajón con lista de socios y cerrar sesión, pestañas Perfil e IA / Rutina, ejercicios compactos desplegables y barra de acciones inferior. Sin selector Hombre/Mujer (biblioteca única).

## Biblioteca de ejercicios en video (oct 2026)
- Reemplaza a los GIFs antiguos (respaldo en `Animaciones_Spasso/_respaldo_gifs_antiguos`). Sin instrucciones (`pasos`) en ningún lado.
- Datos: `data/exercises-data.js` (hombres, ids `hg-NNN`) y `data/exercises-data-mujer.js` (`window.EJERCICIOS_DATA_MUJER`, vacío hasta que lleguen los videos; mismo esquema, ids `mg-NNN`, carpetas `vid|img/ejercicios/mujer/gym/`). El selector Hombres/Mujeres aparece solo cuando ambas tienen datos.
- Campos: `id, nombre (ES corto), parte_es, objetivo_es (subgrupo), detalle, equipo_es:'Gimnasio', genero, modalidad, video, poster, imagen(=poster)`.
- Cada video es una lección (varios ejercicios); la tarjeta = un video. Portada = cuadro capturado del video (`img/ejercicios/<genero>/gym/NNN.jpg`, 360x640).
- Reproductor compartido: `js/ejercicio-video.js` (`EjVideo.abrir(ref)`): bucle, tocar = pausa, barra de tiempo, velocidad 1x/0.5x/0.25x. Lo usan la biblioteca (`ejercicios.js`), el detalle de rutina (`abrirDetalle` en `entrenador-portal.js`) y el modo GO (`rutina-go.js`, miniatura en bucle).
- Rutinas viejas con ids antiguos ("0001"…) ya no resuelven: se muestran con ícono + nombre guardado (los renderers son null-safe).
- Pipeline de compresión/portadas/títulos: `Animaciones_Spasso/_herramientas/` (`enc.py`, `repick.py`, `titulos_hombre_gym.py`). Encode: 540x960, H.264 CRF 31, sin audio, faststart.
- Los videos originales traen marca FITONOMY y algunos avisos/promos dentro del propio video.
