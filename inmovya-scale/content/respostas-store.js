// respostas-store.js — roda no "MAIN world" do WhatsApp Web.
// Fica de olho nas mensagens que CHEGAM (do lead para você), sem abrir conversa nenhuma.
// Quando chega mensagem nova de uma pessoa, avisa o content script (respostas.js) com o telefone,
// para o Inmovya tirar esse lead da esteira na hora. Só leitura: não manda nada, não marca como lida.
(() => {
  if (window.__isRespostasStore) return;
  window.__isRespostasStore = true;

  const exigir = nome => {
    try {
      return typeof window.require === 'function' ? window.require(nome) : null;
    } catch (_) {
      return null;
    }
  };
  const colecoes = () => exigir('WAWebCollections') || {};
  const pegar = (obj, campo) => {
    if (!obj) return undefined;
    const v = obj[campo];
    if (v !== undefined) return v;
    return obj[`__x_${campo}`];
  };
  const lista = col => {
    if (!col) return [];
    try {
      if (typeof col.getModelsArray === 'function') return col.getModelsArray();
      if (Array.isArray(col.models)) return col.models;
      if (Array.isArray(col._models)) return col._models;
    } catch (_) { /* carregando */ }
    return [];
  };
  const servidor = id => id && (id.server || pegar(id, 'server'));
  const usuario = id => id && (id.user || pegar(id, 'user'));
  const idTexto = id => {
    if (!id) return '';
    if (typeof id === 'string') return id;
    return id._serialized || pegar(id, '_serialized') || (usuario(id) && servidor(id) ? `${usuario(id)}@${servidor(id)}` : '');
  };

  // telefone (só dígitos) de uma conversa individual; null em grupo, canal, status
  function telefoneDaConversa(chatId) {
    const srv = servidor(chatId) || String(idTexto(chatId)).split('@')[1];
    if (srv === 'g.us' || srv === 'broadcast' || srv === 'newsletter') return null;
    if (srv === 'c.us') return String(usuario(chatId) || idTexto(chatId).split('@')[0]).replace(/\D/g, '') || null;
    // conversa com id "lid": o telefone vem do contato
    const texto = idTexto(chatId);
    const chat = lista(colecoes().Chat).find(c => idTexto(pegar(c, 'id')) === texto);
    const contato = chat && pegar(chat, 'contact');
    const cand = [contato && pegar(contato, 'phoneNumber'), chat && pegar(chat, 'phoneNumber')];
    for (const c of cand) {
      const d = String(usuario(c) || idTexto(c) || '').split('@')[0].replace(/\D/g, '');
      if (d.length >= 10) return d;
    }
    return null;
  }

  const IGNORAR = new Set(['e2e_notification', 'notification', 'notification_template', 'gp2', 'call_log', 'protocol', 'revoked', 'ciphertext_failed', 'broadcast_notification']);
  const vistos = new Set();
  const inicio = Date.now();

  function avisar(msg) {
    try {
      const id = pegar(msg, 'id');
      if (!id || id.fromMe || pegar(id, 'fromMe')) return; // só mensagem que CHEGA
      const chave = idTexto(id) || `${idTexto(pegar(id, 'remote'))}:${pegar(msg, 't')}`;
      if (vistos.has(chave)) return;
      const tipo = String(pegar(msg, 'type') || '');
      if (IGNORAR.has(tipo)) return;
      const t = Number(pegar(msg, 't') || 0) * 1000;
      // só mensagem nova (não o histórico que o WhatsApp carrega ao abrir)
      if (!pegar(msg, 'isNewMsg') && !(t && t >= inicio - 60000)) return;
      if (t && Date.now() - t > 30 * 60 * 1000) return;
      const telefone = telefoneDaConversa(pegar(id, 'remote') || pegar(msg, 'from'));
      if (!telefone) return;
      vistos.add(chave);
      if (vistos.size > 2000) vistos.clear();
      window.postMessage({ __inmovyaResposta: true, telefone, t: t || Date.now() }, '*');
    } catch (_) { /* nunca atrapalha o WhatsApp */ }
  }

  // liga no evento de mensagem nova quando o WhatsApp terminar de carregar
  let ligado = false;
  const ligar = () => {
    if (ligado) return true;
    const msgs = colecoes().Msg;
    if (!msgs || typeof msgs.on !== 'function') return false;
    msgs.on('add', avisar);
    ligado = true;
    return true;
  };
  const tentar = setInterval(() => { if (ligar()) clearInterval(tentar); }, 3000);

  // reserva: a cada 20 s confere as conversas cuja última mensagem é do lead e chegou depois da última olhada
  let ultimaOlhada = Date.now();
  setInterval(() => {
    try {
      const agora = Date.now();
      for (const c of lista(colecoes().Chat)) {
        const t = Number(pegar(c, 't') || 0) * 1000;
        if (!t || t < ultimaOlhada - 5000) continue;
        const msgs = lista(pegar(c, 'msgs'));
        const ultima = msgs[msgs.length - 1];
        if (ultima) avisar(ultima);
      }
      ultimaOlhada = agora;
    } catch (_) { /* ignore */ }
  }, 20000);
})();
