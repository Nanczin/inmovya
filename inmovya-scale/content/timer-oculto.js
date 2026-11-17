// timer-oculto.js — primeiro script da extensão no WhatsApp Web (mundo isolado).
// Com a aba escondida (você está no Inmovya, na mesma janela), o Chrome atrasa os timers da página
// para até 1 vez por minuto: um envio que leva segundos levaria vários minutos.
// Aqui, enquanto a aba estiver escondida, as esperas dos scripts da extensão são "acordadas" pelo
// background da extensão (que não sofre esse atraso). Não mexe nos timers do próprio WhatsApp.
(() => {
  if (window.__isTimerOculto) return;
  window.__isTimerOculto = true;
  const nativoSet = window.setTimeout.bind(window);
  const nativoClear = window.clearTimeout.bind(window);
  const cancelados = new Set();
  let seq = 0;
  window.setTimeout = function (fn, ms, ...args) {
    const espera = Number(ms) || 0;
    if (!document.hidden || espera < 20 || typeof fn !== 'function') return nativoSet(fn, ms, ...args);
    const id = `isto_${++seq}`;
    try {
      chrome.runtime.sendMessage({ action: 'acordar', ms: espera }, () => {
        void chrome.runtime.lastError;
        if (cancelados.delete(id)) return;
        try { fn(...args); } catch (e) { console.error(e); }
      });
    } catch (_) {
      return nativoSet(fn, ms, ...args); // extensão recarregada: timer normal
    }
    return id;
  };
  window.clearTimeout = function (id) {
    if (typeof id === 'string' && id.startsWith('isto_')) { cancelados.add(id); return; }
    return nativoClear(id);
  };
})();
