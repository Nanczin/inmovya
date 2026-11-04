// dnm-store.js — roda no "MAIN world" do WhatsApp Web (mesmo lugar do código do próprio WhatsApp).
// Lê, SEM abrir conversa nenhuma, as etiquetas do WhatsApp Business e os contatos de cada etiqueta
// (nome + telefone), direto da memória do WhatsApp Web. Usado pelo modo "Dinheiro na Mesa".
// Só leitura: não manda mensagem, não muda etiqueta, não mexe em nada.
// Conversa com o content script (dinheiro-na-mesa.js) por window.postMessage.
(() => {
  if (window.__isDnmStore) return;
  window.__isDnmStore = true;

  const exigir = nome => {
    try {
      return typeof window.require === 'function' ? window.require(nome) : null;
    } catch (_) {
      return null;
    }
  };
  const colecoes = () => exigir('WAWebCollections') || {};
  const lista = col => {
    if (!col) return [];
    try {
      if (typeof col.getModelsArray === 'function') return col.getModelsArray();
      if (Array.isArray(col.models)) return col.models;
      if (Array.isArray(col._models)) return col._models;
    } catch (_) { /* coleção ainda carregando */ }
    return [];
  };
  const pegar = (obj, campo) => {
    if (!obj) return undefined;
    const v = obj[campo];
    if (v !== undefined) return v;
    return obj[`__x_${campo}`];
  };

  const ehPessoa = c => {
    const id = pegar(c, 'id');
    const server = id && (id.server || pegar(id, 'server'));
    return server !== 'g.us' && server !== 'broadcast' && server !== 'newsletter';
  };

  function etiquetas() {
    const labels = lista(colecoes().Label);
    if (!labels.length) return null;
    const chats = lista(colecoes().Chat);
    return labels.map(l => {
      const id = String(pegar(l, 'id'));
      const total = chats.filter(c => (pegar(c, 'labels') || []).map(String).includes(id) && ehPessoa(c)).length;
      return { id, nome: String(pegar(l, 'name') || '').trim(), cor: pegar(l, 'hexColor') || null, total };
    }).filter(l => l.nome);
  }

  function telefoneDoChat(chat) {
    const id = pegar(chat, 'id');
    const server = id && (id.server || pegar(id, 'server'));
    const user = id && (id.user || pegar(id, 'user'));
    if (server === 'c.us' && user) return String(user);
    const contato = pegar(chat, 'contact');
    const candidatos = [
      contato && pegar(contato, 'phoneNumber'),
      pegar(chat, 'phoneNumber'),
    ];
    try {
      const api = exigir('WAWebApiContact');
      if (api && typeof api.getPhoneNumber === 'function') candidatos.push(api.getPhoneNumber(id));
    } catch (_) { /* sem esse módulo nesta versão */ }
    for (const c of candidatos) {
      const u = c && (c.user || pegar(c, 'user') || (typeof c === 'string' ? c.split('@')[0] : null));
      if (u && /^\d{8,15}$/.test(String(u))) return String(u);
    }
    return '';
  }

  function nomeDoChat(chat) {
    const contato = pegar(chat, 'contact');
    return String(
      pegar(chat, 'formattedTitle') ||
      (contato && (pegar(contato, 'name') || pegar(contato, 'verifiedName') || pegar(contato, 'pushname'))) ||
      pegar(chat, 'name') ||
      ''
    ).trim();
  }

  function contatosDaEtiqueta(labelId) {
    const chats = lista(colecoes().Chat);
    if (!chats.length) return null;
    return chats
      .filter(c => (pegar(c, 'labels') || []).map(String).includes(String(labelId)))
      .filter(ehPessoa)
      .map(c => {
        const id = pegar(c, 'id');
        return {
          chatId: id ? String(id._serialized || pegar(id, '_serialized') || id) : '',
          nome: nomeDoChat(c),
          telefone: telefoneDoChat(c),
          ultimaMsg: Number(pegar(c, 't') || 0) * 1000 || null,
        };
      });
  }

  async function abrirConversa(chatId) {
    const chat = lista(colecoes().Chat).find(c => {
      const id = pegar(c, 'id');
      return id && String(id._serialized || pegar(id, '_serialized') || id) === chatId;
    });
    if (!chat) return false;
    const cmdMod = exigir('WAWebCmd');
    const cmd = cmdMod && (cmdMod.Cmd || cmdMod.default || cmdMod);
    if (!cmd) return false;
    for (const tentar of [
      () => cmd.openChatBottom && cmd.openChatBottom({ chat }),
      () => cmd.openChatBottom && cmd.openChatBottom(chat),
      () => cmd.openChatAt && cmd.openChatAt({ chat }),
      () => cmd.openChatAt && cmd.openChatAt(chat),
    ]) {
      try {
        const r = tentar();
        if (r === undefined) continue;
        await r;
        return true;
      } catch (_) { /* tenta o próximo jeito */ }
    }
    return false;
  }

  // Mensagens já carregadas da conversa (para achar o empreendimento de interesse). Só leitura.
  function mensagens(chatId) {
    const chat = lista(colecoes().Chat).find(c => {
      const id = pegar(c, 'id');
      return id && String(id._serialized || pegar(id, '_serialized') || id) === chatId;
    });
    if (!chat) return null;
    const msgs = lista(pegar(chat, 'msgs')).slice(-120);
    return msgs.map(m => {
      const id = pegar(m, 'id');
      const ctwa = pegar(m, 'ctwaContext') || pegar(m, 'externalAdReply') || null;
      return {
        texto: String(pegar(m, 'body') || pegar(m, 'caption') || '').slice(0, 1500),
        deMim: !!(id && (id.fromMe ?? pegar(id, 'fromMe'))),
        anuncio: ctwa ? {
          titulo: String(ctwa.title || pegar(ctwa, 'title') || ''),
          descricao: String(ctwa.description || pegar(ctwa, 'description') || ctwa.body || ''),
        } : null,
      };
    }).filter(m => (m.texto && !/^data:|^\/9j\//.test(m.texto)) || m.anuncio);
  }

  // ---------- Etiqueta do projeto (usada pelo 1º contato e pela captura do Midrah) ----------
  const normal = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const espera = ms => new Promise(r => setTimeout(r, ms));
  function moduloCriarEtiqueta() {
    for (const n of ['WAWebBizLabelEditingAction', 'WAWebLabelEditingAction', 'WAWebBizLabelActions']) {
      const m = exigir(n);
      if (m && typeof m.labelAddAction === 'function') return m;
    }
    try {
      const mapa = (exigir('__debug') || {}).modulesMap || {};
      for (const nome of Object.keys(mapa).filter(n => /label/i.test(n) && /action|edit/i.test(n))) {
        const m = exigir(nome);
        if (m && typeof m.labelAddAction === 'function') return m;
      }
    } catch (_) { /* sem mapa de módulos nesta versão */ }
    return null;
  }
  const etiquetaPeloNome = nome => lista(colecoes().Label).find(l => normal(pegar(l, 'name')) === normal(nome));

  async function garantirEtiqueta(nome, limite = 20) {
    nome = String(nome || '').trim().slice(0, 25);
    if (!nome) return { ok: false, erro: 'sem nome' };
    const labels = lista(colecoes().Label);
    if (!labels.length) return { ok: false, erro: 'as etiquetas do WhatsApp ainda não carregaram' };
    if (etiquetaPeloNome(nome)) return { ok: true, existe: true };
    if (labels.length >= limite) return { ok: false, cheio: true, total: labels.length };
    const mod = moduloCriarEtiqueta();
    if (!mod) return { ok: false, erro: 'não achei como criar etiqueta nesta versão do WhatsApp Web' };
    await mod.labelAddAction(nome, labels.length % 20);
    for (let i = 0; i < 30; i++) {
      if (etiquetaPeloNome(nome)) return { ok: true, criada: true };
      await espera(300);
    }
    return { ok: false, erro: 'pedi para criar, mas a etiqueta não apareceu' };
  }

  // ---------- Etiquetas de projeto: achar a conversa pelo número e SÓ ADICIONAR uma etiqueta ----------
  const idTexto = c => {
    const id = pegar(c, 'id');
    return id ? String(id._serialized || pegar(id, '_serialized') || id) : '';
  };
  const ultimos8 = t => String(t || '').replace(/\D/g, '').slice(-8);
  function nomesDasEtiquetas(chat) {
    const ids = (pegar(chat, 'labels') || []).map(String);
    if (!ids.length) return [];
    return lista(colecoes().Label).filter(l => ids.includes(String(pegar(l, 'id')))).map(l => String(pegar(l, 'name') || '').trim());
  }
  // só conversas que JÁ existem na sua lista (nunca cria conversa)
  function acharConversa(telefone) {
    const alvo = ultimos8(telefone);
    if (alvo.length < 8) return null;
    const chats = lista(colecoes().Chat);
    if (!chats.length) throw new Error('as conversas do WhatsApp ainda não carregaram');
    const chat = chats.filter(ehPessoa).find(c => ultimos8(telefoneDoChat(c)) === alvo);
    if (!chat) return null;
    return { chatId: idTexto(chat), etiquetas: nomesDasEtiquetas(chat) };
  }
  async function adicionarEtiqueta(chatId, nome) {
    const chat = lista(colecoes().Chat).find(c => idTexto(c) === chatId);
    if (!chat) return { ok: false, erro: 'conversa não encontrada' };
    const etq = etiquetaPeloNome(nome);
    if (!etq) return { ok: false, erro: `etiqueta "${nome}" não existe` };
    const idEtq = String(pegar(etq, 'id'));
    if ((pegar(chat, 'labels') || []).map(String).includes(idEtq)) return { ok: true, jaEstava: true };
    const L = colecoes().Label;
    if (!L || typeof L.addOrRemoveLabels !== 'function') return { ok: false, semApi: true };
    try {
      await L.addOrRemoveLabels([{ id: idEtq, type: 'add' }], [chat]);
    } catch (err) {
      return { ok: false, semApi: true, erro: String(err && err.message || err) };
    }
    for (let i = 0; i < 20; i++) {
      if ((pegar(chat, 'labels') || []).map(String).includes(idEtq)) return { ok: true };
      await espera(250);
    }
    return { ok: false, semApi: true, erro: 'a etiqueta não apareceu na conversa' };
  }

  window.addEventListener('message', async ev => {
    if (ev.source !== window || !ev.data || ev.data.__isDnm !== 'pedido') return;
    const { id, op, args = {} } = ev.data;
    let resposta;
    try {
      if (op === 'etiquetas') resposta = { ok: true, dados: etiquetas() };
      else if (op === 'contatos') resposta = { ok: true, dados: contatosDaEtiqueta(args.labelId) };
      else if (op === 'abrir') resposta = { ok: true, dados: await abrirConversa(args.chatId) };
      else if (op === 'mensagens') resposta = { ok: true, dados: mensagens(args.chatId) };
      else if (op === 'acharConversa') resposta = { ok: true, dados: acharConversa(args.telefone) };
      else if (op === 'adicionarEtiqueta') resposta = { ok: true, dados: await adicionarEtiqueta(args.chatId, args.nome) };
      else if (op === 'garantirEtiqueta') resposta = { ok: true, dados: await garantirEtiqueta(args.nome, args.limite) };
      else resposta = { ok: false, erro: 'operação desconhecida' };
    } catch (err) {
      resposta = { ok: false, erro: String(err && err.message || err) };
    }
    window.postMessage({ __isDnm: 'resposta', id, ...resposta }, '*');
  });
})();
