// content/cartao-lead.js — CARTÃO DO LEAD dentro da conversa do WhatsApp Web.
// Um botão "Inmovya" no topo de cada conversa abre um cartão com o lead do Inmovya:
// etapa, esteira, etiquetas do WhatsApp, tags, observações — tudo com um clique, sem sair do WhatsApp.
// Quem grava no Inmovya é a própria página do Inmovya (com o seu login), pela ponte do background.
// Não envia mensagem para ninguém.
(() => {
  if (window.__isCartaoLead) return;
  window.__isCartaoLead = true;

  const ETAPAS_RAPIDAS = ['20%', '50%', '70%', 'Fechado', 'Perdido'];
  const ETIQUETAS_DE_ETAPA = ['20%', '50%', '70%', 'Fechado']; // etiquetas do WhatsApp que andam junto com a etapa
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dig = t => String(t || '').replace(/\D/g, '');
  const telBonito = t => {
    const d = dig(t).replace(/^55(?=\d{10,11}$)/, '');
    return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t;
  };

  // ---------- pontes ----------
  let seq = 0;
  const loja = (op, args, timeout = 15000) => new Promise(resolve => {
    const id = `cartao${Date.now()}_${++seq}`;
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
  const inmovya = (op, dados) => new Promise(res => {
    try {
      chrome.runtime.sendMessage({ action: 'inmovya_op', op, dados }, r => res(chrome.runtime.lastError ? { ok: false, erro: 'A extensão foi atualizada: aperte F5 nesta aba.' } : r || { ok: false, erro: 'sem resposta' }));
    } catch (_) { res({ ok: false, erro: 'A extensão foi atualizada: aperte F5 nesta aba.' }); }
  });

  // ---------- estilos ----------
  function estilos() {
    if (document.getElementById('is-cartao-style')) return;
    const css = document.createElement('style');
    css.id = 'is-cartao-style';
    css.textContent = `
      #is-cartao-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;margin:0 6px;border-radius:999px;border:1px solid var(--inmovya-border,#d1d7db);
        background:var(--inmovya-background,#fff);color:var(--inmovya-text,#111b21);font:600 12.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;cursor:pointer;white-space:nowrap;flex-shrink:0;max-width:240px}
      #is-cartao-btn:hover{border-color:#1e3a8a}
      #is-cartao-btn.sinc{border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.25);transition:box-shadow .3s}
      #is-cartao-btn.sinc .st::after{content:' · ✓ sincronizado';color:#16a34a;font-weight:600}
      #is-cartao-btn img{width:16px;height:16px;border-radius:4px}
      #is-cartao-btn .st{font-weight:700;color:#1e40af;overflow:hidden;text-overflow:ellipsis}
      body.dark #is-cartao-btn .st{color:#93c5fd}
      #is-cartao-btn .novo{font-weight:600;color:var(--inmovya-text-secondary,#667781)}
      #is-cartao{position:fixed;z-index:10000;width:350px;max-width:calc(100vw - 24px);background:var(--inmovya-background,#fff);color:var(--inmovya-text,#111b21);
        border:1px solid var(--inmovya-border,#d1d7db);border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.18);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
        display:flex;flex-direction:column;overflow:hidden}
      #is-cartao .topo{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#0b1f4d,#1e3a8a);color:#fff}
      #is-cartao .topo .nome{font-weight:800;font-size:14.5px;line-height:1.25}
      #is-cartao .topo .sub{font-size:11.5px;opacity:.85}
      #is-cartao .topo button{margin-left:auto;background:rgba(255,255,255,.14);border:0;color:#fff;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1;flex-shrink:0}
      #is-cartao .corpo{padding:12px 14px;display:flex;flex-direction:column;gap:12px;overflow-y:auto}
      #is-cartao .sec{display:flex;flex-direction:column;gap:6px}
      #is-cartao .rot{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--inmovya-text-secondary,#667781)}
      #is-cartao .chips{display:flex;flex-wrap:wrap;gap:6px}
      #is-cartao .chip{border:1px solid var(--inmovya-border,#d1d7db);background:var(--inmovya-surface,#f0f2f5);color:inherit;border-radius:999px;padding:5px 10px;font-weight:600;font-size:12px;line-height:1.1;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
      #is-cartao .chip:hover{border-color:#1e40af}
      #is-cartao .chip.on{background:#1e3a8a;border-color:#1e3a8a;color:#fff}
      #is-cartao .chip.verde.on{background:#0a8f4e;border-color:#0a8f4e}
      #is-cartao .chip .bola{width:9px;height:9px;border-radius:50%;flex-shrink:0}
      #is-cartao .chip .x{opacity:.7;font-weight:800}
      #is-cartao select,#is-cartao input,#is-cartao textarea{width:100%;box-sizing:border-box;border:1px solid var(--inmovya-border,#d1d7db);background:var(--inmovya-background,#fff);color:inherit;border-radius:10px;padding:7px 9px;font-size:13px;font-family:inherit}
      #is-cartao textarea{min-height:58px;resize:vertical}
      #is-cartao .linha{display:flex;gap:6px;align-items:center}
      #is-cartao .caixa{border:1px solid var(--inmovya-border,#d1d7db);border-radius:12px;padding:9px 10px;display:flex;flex-direction:column;gap:7px;background:var(--inmovya-surface,#f0f2f5)}
      #is-cartao .btn{border:0;border-radius:10px;padding:8px 12px;font-weight:700;font-size:12.5px;font-family:inherit;cursor:pointer;background:#1e3a8a;color:#fff;white-space:nowrap}
      #is-cartao .btn.verde{background:#0a8f4e}
      #is-cartao .btn.leve{background:transparent;color:#1e40af;border:1px solid var(--inmovya-border,#d1d7db)}
      body.dark #is-cartao .btn.leve{color:#93c5fd}
      #is-cartao .btn:disabled{opacity:.55;cursor:default}
      #is-cartao .aviso{font-size:12px;padding:8px 10px;border-radius:10px;background:rgba(10,143,78,.1);color:inherit}
      #is-cartao .aviso.erro{background:rgba(220,38,38,.1)}
      #is-cartao .mini{font-size:11.5px;color:var(--inmovya-text-secondary,#667781)}
      #is-cartao .rodape{padding:10px 14px;border-top:1px solid var(--inmovya-border,#d1d7db);display:flex;gap:8px;align-items:center}
      #is-cartao .carregando{padding:28px 14px;text-align:center;color:var(--inmovya-text-secondary,#667781)}
    `;
    document.head.appendChild(css);
  }

  // ---------- estado ----------
  const st = { chatId: '', telefone: '', nomeWA: '', dados: null, lead: null, etq: null, aviso: null, ocupado: false, aberto: false, tarefas: null };
  const resumoCache = new Map(); // telefone → { em, r }

  // ---------- botão no topo da conversa ----------
  function headerDaConversa() { return document.querySelector('#main header'); }
  function garantirBotao() {
    const h = headerDaConversa();
    if (!h) return null;
    let b = document.getElementById('is-cartao-btn');
    if (b && h.contains(b)) return b;
    b?.remove();
    estilos();
    b = document.createElement('button');
    b.id = 'is-cartao-btn';
    b.type = 'button';
    b.title = 'Inmovya: etapa, esteira, etiquetas e tags deste lead';
    let logo = '';
    try { logo = chrome.runtime.getURL('icons/inmovya-logo.png'); } catch (_) { /* recarregada */ }
    b.innerHTML = `${logo ? `<img src="${logo}" alt="">` : ''}<span>Inmovya</span><span class="st"></span>`;
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); st.aberto ? fechar() : abrir(); });
    for (const tipo of ['mousedown', 'pointerdown', 'mouseup', 'pointerup']) b.addEventListener(tipo, e => e.stopPropagation());
    // antes dos ícones da direita do cabeçalho
    const filhos = Array.from(h.children);
    const direita = filhos[filhos.length - 1];
    if (direita && filhos.length > 1) h.insertBefore(b, direita);
    else h.appendChild(b);
    return b;
  }
  function mostrarResumo(r) {
    const b = document.getElementById('is-cartao-btn');
    if (!b) return;
    const s = b.querySelector('.st');
    if (!r) { s.textContent = ''; s.className = 'st'; return; }
    if (!r.existe) { s.textContent = '· não cadastrado'; s.className = 'st novo'; return; }
    s.className = 'st';
    s.textContent = `· ${r.status || 'sem etapa'}${r.esteira ? ` · ${r.esteira.length > 16 ? r.esteira.slice(0, 15) + '…' : r.esteira} D${r.passo}` : ''}`;
  }

  function piscarSincronia(texto) {
    const b = document.getElementById('is-cartao-btn');
    if (!b) return;
    b.title = `Sincronizado com as etiquetas do WhatsApp: ${texto}`;
    b.classList.add('sinc');
    setTimeout(() => { b.classList.remove('sinc'); b.title = 'Inmovya: etapa, esteira, etiquetas e tags deste lead'; }, 6000);
  }

  // o botão redondo do Inmovya Scale fica "flutuando" sobre o topo do WhatsApp: afasta o nosso botão para a esquerda
  function desviarDoBotaoDoScale() {
    const b = document.getElementById('is-cartao-btn');
    if (!b) return;
    const t = document.getElementById('is-toggle-button');
    const vis = t && !t.classList.contains('is-hidden') && getComputedStyle(t).display !== 'none';
    const atual = parseFloat(b.style.marginRight) || 0;
    if (!vis) { if (atual) b.style.marginRight = ''; return; }
    const rb = b.getBoundingClientRect();
    const rt = t.getBoundingClientRect();
    const direitaSemMargem = rb.right + atual; // onde o botão ficaria sem o desvio
    const encosta = direitaSemMargem > rt.left - 8 && rb.left + atual < rt.right + 8 && rb.bottom > rt.top && rb.top < rt.bottom;
    const precisa = encosta ? Math.ceil(direitaSemMargem - rt.left + 10) : 0;
    if (Math.abs(precisa - atual) > 1) b.style.marginRight = precisa ? `${precisa}px` : '';
  }

  // troca de conversa: atualiza o botão (e o cartão, se aberto)
  let ultimaConversa = '';
  let timerResumo = null;
  async function vigiar() {
    if (!garantirBotao()) { if (st.aberto) fechar(); ultimaConversa = ''; return; }
    desviarDoBotaoDoScale();
    const a = await loja('ativa', {}, 4000);
    const c = a?.dados;
    const chave = c?.chatId || '';
    if (chave === ultimaConversa) return;
    ultimaConversa = chave;
    mostrarResumo(null);
    clearTimeout(timerResumo);
    if (!c?.telefone) return; // grupo ou sem número
    if (st.aberto) abrir();
    timerResumo = setTimeout(async () => {
      const k = dig(c.telefone);
      const cache = resumoCache.get(k);
      if (cache && Date.now() - cache.em < 60000) return mostrarResumo(cache.r);
      const r = await inmovya('resumo', { telefone: k });
      if (r?.ok) { resumoCache.set(k, { em: Date.now(), r: r.dados }); if (ultimaConversa === chave) mostrarResumo(r.dados); }
      if (r?.ok && r.dados?.existe && !st.aberto) {
        const feito = await sincronizarConversa(c.chatId, k, chave);
        if (feito && ultimaConversa === chave) {
          const r2 = await inmovya('resumo', { telefone: k });
          if (r2?.ok) { resumoCache.set(k, { em: Date.now(), r: r2.dados }); mostrarResumo(r2.dados); }
          piscarSincronia(feito);
        }
      }
    }, 700);
  }
  setInterval(vigiar, 1200);

  // ---------- cartão ----------
  function posicionar(el) {
    const main = document.getElementById('main');
    const h = headerDaConversa();
    const rm = main?.getBoundingClientRect();
    const rh = h?.getBoundingClientRect();
    const top = (rh ? rh.bottom : 60) + 8;
    el.style.top = `${top}px`;
    el.style.right = `${Math.max(12, window.innerWidth - (rm ? rm.right : window.innerWidth) + 12)}px`;
    el.style.maxHeight = `${Math.max(240, window.innerHeight - top - 16)}px`;
  }
  function caixa() {
    let el = document.getElementById('is-cartao');
    if (!el) {
      estilos();
      el = document.createElement('div');
      el.id = 'is-cartao';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Cartão do lead no Inmovya');
      document.body.appendChild(el);
      el.addEventListener('click', aoClicar);
      el.addEventListener('change', aoMudar);
      el.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target?.dataset?.novaTag != null) { ev.preventDefault(); adicionarTag(ev.target.value); } });
    }
    posicionar(el);
    return el;
  }
  function fechar() {
    st.aberto = false;
    document.getElementById('is-cartao')?.remove();
  }
  window.addEventListener('resize', () => { const el = document.getElementById('is-cartao'); if (el) posicionar(el); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && st.aberto) fechar(); });

  async function abrir() {
    st.aberto = true;
    st.aviso = null;
    const el = caixa();
    el.innerHTML = `<div class="topo"><div><div class="nome">Inmovya</div><div class="sub">carregando…</div></div><button type="button" data-a="fechar" aria-label="Fechar">×</button></div><div class="carregando">Buscando este contato no Inmovya…</div>`;
    const a = await loja('ativa', {}, 5000);
    const c = a?.dados;
    if (!c?.chatId) return desenharErro('Abra uma conversa primeiro.');
    if (!c.telefone) return desenharErro('Este é um grupo (ou um contato sem número). O cartão funciona em conversas com pessoas.');
    st.chatId = c.chatId;
    st.telefone = dig(c.telefone);
    const [r, e] = await Promise.all([inmovya('lead', { telefone: st.telefone }), loja('etiquetasConversa', { chatId: st.chatId }, 6000)]);
    if (!st.aberto || st.chatId !== c.chatId) return;
    st.etq = e?.ok ? e.dados : null;
    st.nomeWA = st.etq?.nomeConversa || document.querySelector('#main header span[dir="auto"]')?.textContent || '';
    if (!r?.ok) return desenharErro(r?.erro || 'Não consegui falar com o Inmovya.');
    st.dados = r.dados;
    st.lead = (r.dados.leads || [])[0] || null;
    try {
      const feito = await sincronizarCartao();
      if (feito) { avisar(`Sincronizado com as etiquetas do WhatsApp: ${feito}.`); resumoCache.delete(st.telefone); }
    } catch (err) { avisar(err?.message || String(err), true); }
    sincroniaFeita.set(st.telefone, Date.now());
    st.tarefas = null;
    desenhar();
    if (st.lead) { await carregarTarefas(); if (st.aberto && st.chatId === c.chatId) desenhar(); }
  }

  function desenharErro(msg) {
    const el = caixa();
    el.innerHTML = `<div class="topo"><div><div class="nome">Inmovya</div><div class="sub">${esc(telBonito(st.telefone))}</div></div><button type="button" data-a="fechar" aria-label="Fechar">×</button></div>
      <div class="corpo"><div class="aviso erro">${esc(msg)}</div><button type="button" class="btn leve" data-a="recarregar">Tentar de novo</button></div>`;
  }

  const etiquetaAtiva = nome => {
    if (!st.etq) return false;
    const e = st.etq.todas.find(x => norm(x.nome) === norm(nome));
    return !!(e && st.etq.ativas.includes(e.id));
  };

  function desenhar() {
    const el = caixa();
    const l = st.lead;
    const d = st.dados || {};
    const topo = `<div class="topo"><div><div class="nome">${esc(l ? l.nome : st.nomeWA || 'Contato')}</div><div class="sub">${esc(telBonito(st.telefone))}${l ? ` · ${esc(l.status || 'sem etapa')}` : ''}</div></div><button type="button" data-a="fechar" aria-label="Fechar">×</button></div>`;
    const aviso = st.aviso ? `<div class="aviso${st.aviso.erro ? ' erro' : ''}">${esc(st.aviso.texto)}</div>` : '';
    if (!l) {
      el.innerHTML = `${topo}<div class="corpo">${aviso}
        <div class="sec"><div class="rot">Não está no Inmovya</div>
          <div class="caixa">
            <label class="mini">Nome do lead<input data-campo="nomeNovo" value="${esc(st.nomeWA)}"></label>
            <label class="mini">Etapa<select data-campo="etapaNova">${['20%', '50%', '70%'].map(x => `<option ${etiquetaAtiva(x) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <button type="button" class="btn verde" data-a="cadastrar" ${st.ocupado ? 'disabled' : ''}>Cadastrar no Inmovya</button>
            <div class="mini">Cadastra com este telefone, origem "WhatsApp", e põe a etiqueta da etapa aqui no WhatsApp.</div>
          </div>
        </div>
        ${htmlEtiquetas()}
      </div>`;
      return;
    }
    const esteiras = d.esteiras || [];
    const est = esteiras.find(x => x.id === l.esteira_id);
    const passo = (Number(l.esteira_passo) || 0) + 1;
    const outras = (d.leads || []).slice(1);
    const tags = Array.isArray(l.tags) ? l.tags : [];
    const sugestoes = (d.tags || []).filter(t => !tags.includes(t));
    el.innerHTML = `${topo}<div class="corpo">${aviso}
      ${outras.length ? `<div class="aviso erro">Há ${outras.length + 1} leads com este telefone no Inmovya. Mostrando o mais recente.</div>` : ''}
      <div class="sec"><div class="rot">Etapa</div>
        <div class="chips">${ETAPAS_RAPIDAS.map(x => `<button type="button" class="chip${x === 'Fechado' ? ' verde' : ''}${norm(l.status) === norm(x) ? ' on' : ''}" data-etapa="${esc(x)}" ${st.ocupado ? 'disabled' : ''}>${esc(x)}</button>`).join('')}</div>
        <select data-campo="etapaOutra" aria-label="Outra etapa"><option value="">Outra etapa…${!ETAPAS_RAPIDAS.some(x => norm(x) === norm(l.status)) && l.status ? ` (agora: ${esc(l.status)})` : ''}</option>${(d.etapas || []).filter(x => !ETAPAS_RAPIDAS.some(y => norm(y) === norm(x.valor))).map(x => `<option value="${esc(x.valor)}" ${norm(x.valor) === norm(l.status) ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>
      </div>
      ${htmlTarefas()}
      <div class="sec"><div class="rot">Esteira</div>
        ${est ? `<div class="caixa"><div class="linha"><b style="flex:1">${esc(est.nome)}</b><span class="mini">D${passo}${est.passos ? ` de ${est.passos}` : ''}</span></div>
          <div class="linha"><button type="button" class="btn leve" data-a="tirarEsteira" ${st.ocupado ? 'disabled' : ''}>Tirar da esteira</button></div></div>` : '<div class="mini">Não está em nenhuma esteira.</div>'}
        <select data-campo="esteira" aria-label="Colocar em uma esteira"><option value="">${est ? 'Trocar para outra esteira…' : 'Colocar em uma esteira…'}</option>${esteiras.filter(x => x.id !== l.esteira_id).map(x => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join('')}</select>
        <div class="mini">Entra no D1, com o envio para hoje (a esteira manda quando você rodar).</div>
      </div>
      ${htmlEtiquetas()}
      <div class="sec"><div class="rot">Tags do Inmovya</div>
        <div class="chips">${tags.length ? tags.map(t => `<button type="button" class="chip on" data-tirar-tag="${esc(t)}" title="Tirar a tag">${esc(t)} <span class="x">×</span></button>`).join('') : '<span class="mini">Sem tags.</span>'}</div>
        <div class="linha"><input data-nova-tag list="is-cartao-tags" placeholder="Nova tag (Enter)"><button type="button" class="btn leve" data-a="addTag">Adicionar</button></div>
        <datalist id="is-cartao-tags">${sugestoes.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
        ${sugestoes.length ? `<div class="chips">${sugestoes.slice(0, 8).map(t => `<button type="button" class="chip" data-por-tag="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="sec"><div class="rot">Observações</div>
        <textarea data-campo="obs" placeholder="Anotações deste lead no Inmovya">${esc(l.observacoes || '')}</textarea>
        <div class="linha"><button type="button" class="btn leve" data-a="salvarObs" ${st.ocupado ? 'disabled' : ''}>Salvar observações</button></div>
      </div>
    </div>
    <div class="rodape"><button type="button" class="btn" data-a="abrirFicha">Abrir ficha no Inmovya</button><span class="mini">${st.ocupado ? 'Salvando…' : ''}</span></div>`;
  }

  // ---------- agendar tarefa (vai para a Agenda do Inmovya) ----------
  const pad = n => String(n).padStart(2, '0');
  const paraInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  function sugestaoDeHora(chave) {
    const d = new Date();
    d.setSeconds(0, 0);
    const em = (dias, h, m = 0) => { const x = new Date(d); x.setDate(x.getDate() + dias); x.setHours(h, m, 0, 0); return x; };
    if (chave === 'hoje') return d.getHours() < 18 ? em(0, 18) : em(0, d.getHours() + 1);
    if (chave === 'amanha9') return em(1, 9);
    if (chave === 'amanha14') return em(1, 14);
    if (chave === '2dias') return em(2, 10);
    if (chave === 'semana') return em(7, 10);
    return em(1, 9);
  }
  const ATALHOS_HORA = [['hoje', 'Hoje'], ['amanha9', 'Amanhã 9h'], ['amanha14', 'Amanhã 14h'], ['2dias', 'Em 2 dias'], ['semana', 'Em 1 semana']];
  const quandoTxt = iso => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  function htmlTarefas() {
    const lista = st.tarefas || [];
    const agora = Date.now();
    const itens = lista.map(t => {
      const atrasada = new Date(t.due_date).getTime() < agora;
      return `<div class="linha" style="justify-content:space-between"><span class="mini" style="color:${atrasada ? '#dc2626' : 'inherit'}">📅 <b>${esc(quandoTxt(t.due_date))}</b> · ${esc(t.title)}${atrasada ? ' (atrasada)' : ''}</span>
        <button type="button" class="btn leve" style="padding:3px 8px" data-feita="${esc(t.id)}" title="Marcar como feita" ${st.ocupado ? 'disabled' : ''}>✓</button></div>`;
    }).join('');
    const sugest = paraInput(sugestaoDeHora('amanha9'));
    return `<div class="sec"><div class="rot">Agendar tarefa</div>
      ${st.tarefas === null ? '<div class="mini">Carregando tarefas…</div>' : itens || '<div class="mini">Nenhuma tarefa pendente para este lead.</div>'}
      <div class="caixa">
        <input data-campo="tarefaTitulo" value="Retornar contato" placeholder="O que fazer (ex.: ligar, mandar proposta)">
        <div class="chips">${ATALHOS_HORA.map(([k, n]) => `<button type="button" class="chip" data-hora="${k}">${n}</button>`).join('')}</div>
        <div class="linha"><input type="datetime-local" data-campo="tarefaQuando" value="${sugest}"><button type="button" class="btn verde" data-a="agendar" ${st.ocupado ? 'disabled' : ''}>Agendar</button></div>
        <div class="mini">Vai para a Agenda do Inmovya, com o "Ir para" abrindo o WhatsApp deste lead.</div>
      </div>
    </div>`;
  }
  async function carregarTarefas() {
    if (!st.lead) { st.tarefas = []; return; }
    const r = await inmovya('tarefas', { id: st.lead.id });
    st.tarefas = r?.ok ? r.dados?.tarefas || [] : [];
  }
  const agendarTarefa = () => {
    // lê os campos antes de redesenhar o cartão (o redesenho volta os campos ao padrão)
    const el = document.getElementById('is-cartao');
    const titulo = (el?.querySelector('[data-campo="tarefaTitulo"]')?.value || '').trim();
    const v = el?.querySelector('[data-campo="tarefaQuando"]')?.value || '';
    return fazer(async () => {
    const quando = v ? new Date(v) : null;
    if (!titulo) throw new Error('Escreva o que é para fazer.');
    if (!quando || isNaN(quando.getTime())) throw new Error('Escolha a data e a hora.');
    const d = await op('tarefa', { id: st.lead.id, titulo, quando: quando.toISOString() });
    st.tarefas = d?.tarefas || st.tarefas;
    avisar(`Tarefa agendada para ${quandoTxt(quando.toISOString())}: ${titulo}.`);
    });
  };
  const concluirTarefa = id => fazer(async () => {
    const d = await op('tarefaFeita', { id: st.lead.id, tarefaId: id });
    st.tarefas = d?.tarefas || (st.tarefas || []).filter(t => t.id !== id);
    avisar('Tarefa marcada como feita.');
  });

  function htmlEtiquetas() {
    if (!st.etq) return `<div class="sec"><div class="rot">Etiquetas do WhatsApp</div><div class="mini">Não consegui ler as etiquetas desta conversa.</div></div>`;
    const todas = st.etq.todas || [];
    if (!todas.length) return '';
    return `<div class="sec"><div class="rot">Etiquetas do WhatsApp</div>
      <div class="chips">${todas.map(e => `<button type="button" class="chip${st.etq.ativas.includes(e.id) ? ' on' : ''}" data-etiqueta="${esc(e.nome)}" ${st.ocupado ? 'disabled' : ''}><span class="bola" style="background:${esc(e.cor || '#8696a0')}"></span>${esc(e.nome)}</button>`).join('')}</div>
      <div class="mini">Clique para pôr ou tirar. 20%, 50%, 70% e Fechado mudam a etapa no Inmovya junto.</div></div>`;
  }

  // ---------- ações ----------
  function avisar(texto, erro = false) { st.aviso = { texto, erro }; }
  async function fazer(fn) {
    if (st.ocupado) return;
    st.ocupado = true;
    desenhar();
    try { await fn(); } catch (e) { avisar(e?.message || String(e), true); }
    st.ocupado = false;
    resumoCache.delete(st.telefone);
    if (st.aberto) desenhar();
    const r = st.lead ? { existe: true, status: st.lead.status, esteira: (st.dados?.esteiras || []).find(x => x.id === st.lead.esteira_id)?.nome || null, passo: (Number(st.lead.esteira_passo) || 0) + 1 } : null;
    if (r) mostrarResumo(r);
  }
  async function op(nome, dados) {
    const r = await inmovya(nome, dados);
    if (!r?.ok) throw new Error(r?.erro || 'Não consegui salvar no Inmovya.');
    if (r.dados?.lead) st.lead = r.dados.lead;
    return r.dados;
  }
  async function lerEtiquetas() {
    const e = await loja('etiquetasConversa', { chatId: st.chatId }, 6000);
    if (e?.ok) st.etq = e.dados;
  }
  // ---------- sincronização: o WhatsApp manda, o Inmovya acompanha ----------
  // Regras (as mesmas da auditoria):
  // - etiqueta de etapa (Fechado > 70% > 50% > 20%) = etapa do lead no Inmovya;
  // - "Lead" (sem etiqueta de etapa) = etapa Nenhuma + tag disparo; "Nutrição" = tag nutrição;
  // - Bitrix/Midrah sozinhas não mudam a etapa (prospecção);
  // - as outras etiquetas (projeto e soltas: ZO, ZS, Doc, Meta Ads, Midrah, Tom Paraíso…) viram tag;
  //   tag com nome de etiqueta do WhatsApp que saiu do contato é tirada. Tags que não são etiquetas (roleta, base…) ficam.
  // - contato sem nenhuma etiqueta: não mexe em nada (nunca apaga lead).
  const ORDEM_ETAPA = ['Fechado', '70%', '50%', '20%'];
  const NAO_VIRA_TAG = ['20%', '50%', '70%', '75%', 'Fechado', 'Lead', 'Nutrição', 'Bitrix', 'Nao lidas', 'Favoritos', 'Grupos'].map(norm);
  function planoDeSincronia(lead, etq) {
    if (!lead || !etq || !Array.isArray(etq.todas) || !etq.todas.length) return null;
    const ativas = etq.todas.filter(x => etq.ativas.includes(x.id)).map(x => x.nome);
    if (!ativas.length) return null;
    const tem = n => ativas.some(a => norm(a) === norm(n));
    let status = null;
    const etapa = ORDEM_ETAPA.find(tem) || (tem('75%') ? '70%' : null);
    if (etapa) status = etapa;
    else if (tem('Lead')) status = 'Nenhuma';
    if (status && norm(status) === norm(lead.status)) status = null;

    const atuais = Array.isArray(lead.tags) ? lead.tags.map(String) : [];
    const temTag = t => atuais.some(x => norm(x) === norm(t));
    const querTags = ativas.filter(a => !NAO_VIRA_TAG.includes(norm(a)));
    if (tem('Lead')) querTags.push('disparo');
    if (tem('Nutrição')) querTags.push('nutrição');
    const nomesWA = etq.todas.map(x => norm(x.nome));
    const tirar = atuais.filter(t => nomesWA.includes(norm(t)) && !NAO_VIRA_TAG.includes(norm(t)) && !querTags.some(q => norm(q) === norm(t)));
    const por = querTags.filter(q => !temTag(q)).filter((q, i, arr) => arr.findIndex(x => norm(x) === norm(q)) === i);
    if (!status && !por.length && !tirar.length) return null;
    const tags = [...atuais.filter(t => !tirar.includes(t)), ...por];
    return { status, por, tirar, tags };
  }
  const textoDoPlano = pl => [pl.status ? `etapa ${pl.status}` : '', pl.por.length ? `+ tag ${pl.por.join(', ')}` : '', pl.tirar.length ? `− tag ${pl.tirar.join(', ')}` : ''].filter(Boolean).join(' · ');
  // aplica o plano no Inmovya (não mexe nas etiquetas do WhatsApp)
  async function aplicarSincronia(lead, pl) {
    if (pl.status) {
      const r = await inmovya('etapa', { id: lead.id, status: pl.status });
      if (!r?.ok) throw new Error(r?.erro || 'Não consegui sincronizar a etapa.');
      if (r.dados?.lead) Object.assign(lead, r.dados.lead); else lead.status = pl.status;
    }
    if (pl.por.length || pl.tirar.length) {
      const r = await inmovya('tags', { id: lead.id, tags: pl.tags });
      if (!r?.ok) throw new Error(r?.erro || 'Não consegui sincronizar as tags.');
      if (r.dados?.lead) Object.assign(lead, r.dados.lead); else lead.tags = pl.tags;
    }
  }
  // dentro do cartão aberto
  async function sincronizarCartao() {
    const pl = planoDeSincronia(st.lead, st.etq);
    if (!pl) return '';
    await aplicarSincronia(st.lead, pl);
    if (st.dados && pl.por.length) st.dados.tags = Array.from(new Set([...(st.dados.tags || []), ...pl.por])).sort();
    return textoDoPlano(pl);
  }
  // ao abrir uma conversa (cartão fechado): confere e sincroniza em silêncio, no máximo 1x por minuto por contato
  const sincroniaFeita = new Map();
  async function sincronizarConversa(chatId, telefone, chave) {
    const k = dig(telefone);
    if (Date.now() - (sincroniaFeita.get(k) || 0) < 60000) return null;
    sincroniaFeita.set(k, Date.now());
    const [r, e] = await Promise.all([inmovya('lead', { telefone: k }), loja('etiquetasConversa', { chatId }, 6000)]);
    if (!r?.ok || !e?.ok || ultimaConversa !== chave) return null;
    const lead = (r.dados?.leads || [])[0];
    const pl = planoDeSincronia(lead, e.dados);
    if (!pl) return null;
    try {
      await aplicarSincronia(lead, pl);
      resumoCache.delete(k);
      return textoDoPlano(pl);
    } catch (err) {
      console.warn('[Inmovya cartão] sincronia', err);
      return null;
    }
  }

  // etiqueta de etapa no WhatsApp: deixa só a da etapa nova (Perdido tira as de etapa)
  async function etiquetaDaEtapa(status) {
    if (!st.etq) return '';
    const existe = n => st.etq.todas.some(x => norm(x.nome) === norm(n));
    const alvo = ETIQUETAS_DE_ETAPA.find(x => norm(x) === norm(status));
    const ehPerdido = norm(status) === 'perdido';
    if (!alvo && !ehPerdido) return '';
    const adicionar = alvo && existe(alvo) ? [alvo] : [];
    const remover = ETIQUETAS_DE_ETAPA.filter(x => norm(x) !== norm(alvo || '') && existe(x));
    const r = await loja('mudarEtiquetas', { chatId: st.chatId, adicionar, remover }, 10000);
    await lerEtiquetas();
    if (!r?.ok || r.dados?.ok === false) return ' (a etiqueta do WhatsApp não mudou: mude manualmente)';
    return adicionar.length ? ` e etiqueta ${alvo} no WhatsApp` : ehPerdido ? ' e tirei as etiquetas de etapa do WhatsApp' : '';
  }
  const mudarEtapa = status => fazer(async () => {
    await op('etapa', { id: st.lead.id, status });
    const extra = await etiquetaDaEtapa(status);
    avisar(`Etapa ${status} salva no Inmovya${extra}.`);
  });
  const colocarEsteira = esteiraId => fazer(async () => {
    await op('esteira', { id: st.lead.id, esteiraId: esteiraId || null });
    const nome = (st.dados?.esteiras || []).find(x => x.id === esteiraId)?.nome;
    avisar(esteiraId ? `Colocado na esteira ${nome || ''} (D1).` : 'Tirado da esteira.');
  });
  const salvarTags = tags => fazer(async () => {
    await op('tags', { id: st.lead.id, tags });
    if (st.dados) st.dados.tags = Array.from(new Set([...(st.dados.tags || []), ...tags])).sort();
    avisar('Tags salvas.');
  });
  function adicionarTag(t) {
    const tag = String(t || '').trim();
    if (!tag || !st.lead) return;
    const atuais = Array.isArray(st.lead.tags) ? st.lead.tags : [];
    if (atuais.some(x => norm(x) === norm(tag))) return;
    salvarTags([...atuais, tag]);
  }
  const alternarEtiqueta = nome => fazer(async () => {
    const ligada = etiquetaAtiva(nome);
    const ehEtapa = ETIQUETAS_DE_ETAPA.find(x => norm(x) === norm(nome));
    if (ehEtapa && !ligada && st.lead) {
      // ligar uma etiqueta de etapa = mudar a etapa (Inmovya + WhatsApp)
      await op('etapa', { id: st.lead.id, status: ehEtapa });
      const extra = await etiquetaDaEtapa(ehEtapa);
      avisar(`Etapa ${ehEtapa} salva no Inmovya${extra}.`);
      return;
    }
    const r = await loja('mudarEtiquetas', { chatId: st.chatId, adicionar: ligada ? [] : [nome], remover: ligada ? [nome] : [] }, 10000);
    await lerEtiquetas();
    if (!r?.ok || r.dados?.ok === false) throw new Error(r?.dados?.erro || r?.erro || 'Não consegui mudar a etiqueta.');
    const feito = st.lead ? await sincronizarCartao() : '';
    avisar(`${ligada ? `Etiqueta ${nome} tirada` : `Etiqueta ${nome} colocada`}${feito ? ` · Inmovya: ${feito}` : ''}.`);
  });
  const cadastrar = () => fazer(async () => {
    const el = document.getElementById('is-cartao');
    const nome = el?.querySelector('[data-campo="nomeNovo"]')?.value || st.nomeWA;
    const status = el?.querySelector('[data-campo="etapaNova"]')?.value || '20%';
    const d = await op('cadastrar', { nome, telefone: st.telefone, status });
    const extra = await etiquetaDaEtapa(status);
    avisar(d?.jaExistia ? 'Este telefone já estava no Inmovya.' : `Cadastrado no Inmovya em ${status}${extra}.`);
    // recarrega esteiras/tags para mostrar o cartão completo
    const r = await inmovya('lead', { telefone: st.telefone });
    if (r?.ok) { st.dados = r.dados; st.lead = (r.dados.leads || [])[0] || st.lead; }
  });

  function aoClicar(ev) {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    ev.preventDefault();
    ev.stopPropagation();
    const a = b.dataset.a;
    if (a === 'fechar') return fechar();
    if (a === 'recarregar') return abrir();
    if (a === 'cadastrar') return cadastrar();
    if (a === 'agendar') return agendarTarefa();
    if (b.dataset.feita) return concluirTarefa(b.dataset.feita);
    if (b.dataset.hora) {
      const inp = document.querySelector('#is-cartao [data-campo="tarefaQuando"]');
      if (inp) inp.value = paraInput(sugestaoDeHora(b.dataset.hora));
      document.querySelectorAll('#is-cartao [data-hora]').forEach(x => x.classList.toggle('on', x === b));
      return;
    }
    if (a === 'tirarEsteira') return colocarEsteira(null);
    if (a === 'addTag') return adicionarTag(document.querySelector('#is-cartao [data-nova-tag]')?.value);
    if (a === 'salvarObs') {
      const v = document.querySelector('#is-cartao [data-campo="obs"]')?.value ?? '';
      return fazer(async () => { await op('observacao', { id: st.lead.id, observacoes: v }); avisar('Observações salvas.'); });
    }
    if (a === 'abrirFicha') return inmovya('abrir', { id: st.lead.id }).then(r => { if (!r?.ok) { avisar(r?.erro || 'Não abri a ficha.', true); desenhar(); } });
    if (b.dataset.etapa) return mudarEtapa(b.dataset.etapa);
    if (b.dataset.etiqueta) return alternarEtiqueta(b.dataset.etiqueta);
    if (b.dataset.tirarTag) return salvarTags((st.lead.tags || []).filter(t => t !== b.dataset.tirarTag));
    if (b.dataset.porTag) return adicionarTag(b.dataset.porTag);
  }
  function aoMudar(ev) {
    const el = ev.target;
    if (el.dataset.campo === 'etapaOutra' && el.value) return mudarEtapa(el.value);
    if (el.dataset.campo === 'esteira' && el.value) {
      const nome = el.options[el.selectedIndex]?.text || '';
      if (st.lead?.esteira_id && !confirmarTroca(nome)) { el.value = ''; return; }
      return colocarEsteira(el.value);
    }
  }
  // trocar de esteira reinicia no D1: confirma dentro do cartão (sem janelas do navegador)
  let trocaConfirmada = '';
  function confirmarTroca(nome) {
    if (trocaConfirmada === nome) { trocaConfirmada = ''; return true; }
    trocaConfirmada = nome;
    avisar(`Trocar para "${nome}" começa do D1. Escolha de novo para confirmar.`, true);
    desenhar();
    return false;
  }
})();
