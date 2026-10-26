/* Diálogos propios del sistema (reemplazan alert / confirm / prompt del navegador).
   uiConfirm(msg, {titulo, aceptar, cancelar, peligro}) -> Promise<boolean>
   uiPrompt(msg, {titulo, placeholder, valor, tipo, aceptar}) -> Promise<string|null>
   uiAlert(msg, {titulo}) -> Promise<void> */
(function () {
  const st=document.createElement("style");st.textContent=`/* ===== Diálogos del sistema (uiConfirm / uiPrompt / uiAlert) ===== */
.ui-dlg-overlay{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .16s ease}
.ui-dlg-overlay.ui-dlg-in{opacity:1}
.ui-dlg{width:min(420px,100%);padding:26px 26px 22px;border-radius:24px;text-align:center;background:rgba(25,25,35,.94);color:#fff;border:1px solid var(--border,rgba(255,255,255,.14));box-shadow:0 24px 60px rgba(0,0,0,.45);backdrop-filter:blur(var(--glass-blur,20px)) saturate(160%);transform:translateY(14px) scale(.94);opacity:0;transition:transform .32s cubic-bezier(.34,1.56,.64,1),opacity .2s ease}
.ui-dlg-in .ui-dlg{transform:none;opacity:1}
.ui-dlg-out .ui-dlg{transform:scale(.96);opacity:0;transition:transform .16s ease,opacity .16s ease}
.ui-dlg-ico{width:58px;height:58px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;font-size:25px;color:var(--accent,#e11d74);background:color-mix(in srgb,var(--accent,#e11d74) 16%,transparent)}
.ui-dlg--peligro .ui-dlg-ico{color:var(--danger,#ef4444);background:color-mix(in srgb,var(--danger,#ef4444) 16%,transparent);animation:uiDlgShake .45s .15s}
@keyframes uiDlgShake{0%,100%{transform:none}25%{transform:rotate(-8deg)}60%{transform:rotate(7deg)}}
.ui-dlg h3{margin:0 0 8px;font-size:19px}
.ui-dlg-msg p{margin:0 0 4px;font-size:14.5px;line-height:1.45}
.ui-dlg-msg .ui-dlg-sec{font-size:13px;color:var(--gray);margin-top:8px}
.ui-dlg-input{width:100%;margin-top:14px;padding:12px 14px;border-radius:12px;font-size:16px;text-align:center;color:inherit;background:var(--card-bg,rgba(255,255,255,.06));border:1.5px solid var(--border,rgba(255,255,255,.18));outline:none;transition:border-color .2s,box-shadow .2s}
.ui-dlg-input:focus{border-color:var(--accent,#e11d74);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent,#e11d74) 22%,transparent)}
.ui-dlg-btns{display:flex;gap:10px;margin-top:20px}
.ui-dlg-btn{flex:1;padding:11px 14px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;border:1.5px solid transparent;transition:transform .12s,filter .2s,background .2s}
.ui-dlg-btn:active{transform:scale(.96)}
.ui-dlg-no{background:transparent;color:inherit;border-color:var(--border,rgba(255,255,255,.22))}
.ui-dlg-no:hover{background:var(--card-bg,rgba(255,255,255,.08))}
.ui-dlg-si{background:var(--accent,#e11d74);color:#fff}
.ui-dlg-si:hover{filter:brightness(1.12)}
.ui-dlg--peligro .ui-dlg-si{background:var(--danger,#ef4444)}
.ui-dlg-btn:focus-visible{outline:2px solid var(--accent,#e11d74);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.ui-dlg,.ui-dlg-overlay{transition:none}.ui-dlg--peligro .ui-dlg-ico{animation:none}}
`;document.head.appendChild(st);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const cola = [];
  let activo = false;

  function abrir(cfg) {
    return new Promise(resolve => { cola.push({ cfg, resolve }); if (!activo) siguiente(); });
  }

  function siguiente() {
    const it = cola.shift();
    if (!it) { activo = false; return; }
    activo = true;
    const { cfg, resolve } = it;
    const previo = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'ui-dlg-overlay';
    const icono = cfg.icono || (cfg.peligro ? 'fa-triangle-exclamation' : cfg.tipoDlg === 'prompt' ? 'fa-keyboard' : cfg.tipoDlg === 'alert' ? 'fa-circle-info' : 'fa-circle-question');
    const lineas = String(cfg.mensaje || '').split('\n').filter(x => x.trim());
    const titulo = cfg.titulo || (cfg.peligro ? 'Confirmar acción' : cfg.tipoDlg === 'prompt' ? 'Ingresar dato' : cfg.tipoDlg === 'alert' ? 'Aviso' : 'Confirmación');
    ov.innerHTML = `
      <div class="ui-dlg ${cfg.peligro ? 'ui-dlg--peligro' : ''}" role="dialog" aria-modal="true">
        <div class="ui-dlg-ico"><i class="fas ${icono}"></i></div>
        <h3>${esc(titulo)}</h3>
        <div class="ui-dlg-msg">${lineas.map((l, i) => `<p class="${i ? 'ui-dlg-sec' : ''}">${esc(l)}</p>`).join('')}</div>
        ${cfg.tipoDlg === 'prompt' ? `<input class="ui-dlg-input" type="${cfg.tipo || 'text'}" placeholder="${esc(cfg.placeholder || '')}" value="${esc(cfg.valor || '')}" autocomplete="off">` : ''}
        <div class="ui-dlg-btns">
          ${cfg.tipoDlg === 'alert' ? '' : `<button type="button" class="ui-dlg-btn ui-dlg-no">${esc(cfg.cancelar || 'Cancelar')}</button>`}
          <button type="button" class="ui-dlg-btn ui-dlg-si">${esc(cfg.aceptar || (cfg.peligro ? 'Eliminar' : 'Aceptar'))}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const input = ov.querySelector('.ui-dlg-input');
    const si = ov.querySelector('.ui-dlg-si');
    const no = ov.querySelector('.ui-dlg-no');
    requestAnimationFrame(() => ov.classList.add('ui-dlg-in'));
    setTimeout(() => (input || si).focus(), 40);

    let cerrado = false;
    const cerrar = valor => {
      if (cerrado) return; cerrado = true;
      document.removeEventListener('keydown', tecla, true);
      ov.classList.remove('ui-dlg-in'); ov.classList.add('ui-dlg-out');
      setTimeout(() => { ov.remove(); if (previo && previo.focus) try { previo.focus(); } catch (e) {} resolve(valor); siguiente(); }, 160);
    };
    const aceptar = () => cerrar(cfg.tipoDlg === 'prompt' ? input.value : cfg.tipoDlg === 'alert' ? undefined : true);
    const cancelar = () => cerrar(cfg.tipoDlg === 'prompt' ? null : cfg.tipoDlg === 'alert' ? undefined : false);
    function tecla(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelar(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); aceptar(); }
      else if (e.key === 'Tab') { // atrapar el foco dentro del diálogo
        const f = [...ov.querySelectorAll('input,button')]; const i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }
    document.addEventListener('keydown', tecla, true);
    si.onclick = aceptar; if (no) no.onclick = cancelar;
    ov.addEventListener('mousedown', e => { if (e.target === ov) cancelar(); });
  }

  window.uiConfirm = (mensaje, o) => abrir(Object.assign({ tipoDlg: 'confirm', mensaje }, o));
  window.uiPrompt = (mensaje, o) => abrir(Object.assign({ tipoDlg: 'prompt', mensaje }, o));
  window.uiAlert = (mensaje, o) => abrir(Object.assign({ tipoDlg: 'alert', mensaje }, o));
  // Cualquier alert() residual también usa el diseño del sistema
  window.alert = m => { window.uiAlert(m); };
})();
