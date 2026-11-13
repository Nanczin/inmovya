// respostas.js — content script do WhatsApp Web: repassa para a extensão o telefone de quem
// acabou de mandar mensagem (detectado pelo respostas-store.js), para o lead sair da esteira na hora.
(() => {
  if (window.__isRespostasRelay) return;
  window.__isRespostasRelay = true;
  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__inmovyaResposta !== true || !d.telefone) return;
    try {
      chrome.runtime.sendMessage({ action: 'lead_respondeu', telefone: String(d.telefone), t: Number(d.t) || Date.now() }, () => void chrome.runtime.lastError);
    } catch (_) { /* extensão recarregada: ignora */ }
  });
})();
