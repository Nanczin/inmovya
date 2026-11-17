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

  // Varredura pedida pelo Inmovya: quem da esteira respondeu (inclusive enquanto o WhatsApp Web estava fechado)
  let seq = 0;
  const perguntar = (op, args, timeout = 20000) => new Promise(resolve => {
    const id = `resp${Date.now()}_${++seq}`;
    const fim = setTimeout(() => { window.removeEventListener('message', ouvir); resolve({ ok: false, erro: 'o WhatsApp não respondeu' }); }, timeout);
    function ouvir(ev) {
      if (ev.source !== window || !ev.data || ev.data.__isDnm !== 'resposta' || ev.data.id !== id) return;
      clearTimeout(fim);
      window.removeEventListener('message', ouvir);
      resolve(ev.data);
    }
    window.addEventListener('message', ouvir);
    window.postMessage({ __isDnm: 'pedido', id, op, args }, '*');
  });
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action !== 'varrer_respostas_aba') return;
    perguntar('respondeuDesde', { itens: msg.itens || [] }).then(r => sendResponse(r.ok ? { ok: true, respondidos: r.dados || [] } : { ok: false, error: r.erro || 'erro' }));
    return true;
  });
})();
