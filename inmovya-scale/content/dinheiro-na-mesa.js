// dinheiro-na-mesa.js — modo "DINHEIRO NA MESA" do Inmovya Scale (dentro do WhatsApp Web).
// Oferta ativa em cima de uma ETIQUETA do WhatsApp: escolhe a etiqueta, a extensão extrai os contatos
// (nome + telefone) sem abrir conversa por conversa e mostra um por vez, igual à Oferta Ativa do Inmovya:
//   📞 Ligar (abre o Vincular ao Celular) · 📋 Copiar número · 💬 Abrir conversa
//   classificação: Interessado (→ 20%) / Disparo (→ Lead e Nutrição) / Caixa Postal (fica) / Deny List (sai da etiqueta) + notas
//   SALVAR E PRÓXIMO → mostra o próximo. Quem não atendeu volta no fim da fila (até 3 tentativas).
// TEMPORÁRIO: nada vai para o banco do Inmovya. O progresso fica só neste Chrome e some quando você conclui a etiqueta.
// Não manda mensagem nenhuma. Só mexe na etiqueta do contato que você classificar (menos Caixa Postal).
window.IS = window.IS || {};

window.IS.DinheiroNaMesa = (() => {
  const CLASSIFICACOES = [
    // destinos: etiquetas para onde o contato vai (sai da etiqueta atual); cada uma com os nomes aceitos
    // sai: só tira da etiqueta atual
    { id: 'Cliente Interessado', rotulo: '🔥 Interessado → vai para a etiqueta 20%', cor: '#0a8f4e', destinos: [['20%']] },
    { id: 'Disparo', rotulo: '📣 Disparo → vai para as etiquetas Lead e Nutrição', cor: '#2563eb', destinos: [['Lead', 'Leads'], ['Nutrição', 'Nutricao']] },
    { id: 'Caixa Postal/Cliente Não Atendeu', rotulo: '📵 Caixa Postal → fica na etiqueta', cor: '#b7791f' },
    { id: 'Deny List', rotulo: '⛔ Deny List → sai da etiqueta', cor: '#c62838', sai: true },
  ];
  const normEt = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLowerCase();
  const CAIXA = 'Caixa Postal/Cliente Não Atendeu';
  const MAX_TENTATIVAS = 3;
  const CHAVE = 'dnmSessoes';
  const CHAVE_HOJE = 'dnmHoje';
  // quem já foi classificado como Interessado, Disparo ou Deny List nunca mais volta (lista só neste Chrome)
  const CHAVE_FINALIZADOS = 'dnmFinalizados';
  const hojeStr = () => new Date().toLocaleDateString('pt-BR');

  const st = {
    aberto: false,
    tela: 'inicio', // inicio | sessao | fim
    etiquetas: null, // [{id,nome,total}] ou null (sem acesso à memória do WhatsApp)
    sessoes: {},
    atual: null, // nome da etiqueta em andamento
    classificacao: '',
    etapa: '',
    nota: '',
    placar: null,
    ocupado: false,
    aviso: '',
    erro: '',
  };

  // ---------- utilidades ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const digitos = s => String(s || '').replace(/\D/g, '');
  const telInternacional = t => {
    let d = digitos(t);
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);
    if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d;
    return d;
  };
  const telBonito = t => {
    const d = telInternacional(t);
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
      const n = d.slice(4);
      return `(${d.slice(2, 4)}) ${n.length === 9 ? `${n.slice(0, 5)}-${n.slice(5)}` : `${n.slice(0, 4)}-${n.slice(4)}`}`;
    }
    return d ? `+${d}` : '';
  };
  const chaveDoContato = c => telInternacional(c.telefone) || c.chatId || String(c.nome || '').toLowerCase();

  async function carregarSessoes() {
    try {
      const r = await chrome.storage.local.get([CHAVE, CHAVE_FINALIZADOS]);
      st.sessoes = r[CHAVE] || {};
      st.finalizados = r[CHAVE_FINALIZADOS] || {};
    } catch (_) { st.sessoes = {}; st.finalizados = {}; }
  }
  const chavesDoContato = c => [telInternacional(c.telefone), c.chatId].filter(Boolean);
  const jaFinalizado = c => chavesDoContato(c).some(k => st.finalizados && st.finalizados[k]);
  async function marcarFinalizado(item, classificacao) {
    st.finalizados = st.finalizados || {};
    for (const k of chavesDoContato(item)) st.finalizados[k] = { c: classificacao, em: Date.now() };
    await chrome.storage.local.set({ [CHAVE_FINALIZADOS]: st.finalizados }).catch(() => {});
  }
  const salvarSessoes = () => chrome.storage.local.set({ [CHAVE]: st.sessoes }).catch(() => {});

  // ---------- memória do WhatsApp (dnm-store.js, no MAIN world) ----------
  let seq = 0;
  function loja(op, args = {}, timeout = 6000) {
    return new Promise(resolve => {
      const id = `dnm${Date.now()}_${++seq}`;
      const fim = setTimeout(() => { window.removeEventListener('message', ouvir); resolve({ ok: false, erro: 'sem resposta' }); }, timeout);
      function ouvir(ev) {
        if (ev.source !== window || !ev.data || ev.data.__isDnm !== 'resposta' || ev.data.id !== id) return;
        clearTimeout(fim);
        window.removeEventListener('message', ouvir);
        resolve(ev.data);
      }
      window.addEventListener('message', ouvir);
      window.postMessage({ __isDnm: 'pedido', id, op, args }, '*');
    });
  }

  // ---------- placar do dia (só neste Chrome) ----------
  async function atualizarPlacar() {
    try {
      const r = (await chrome.storage.local.get(CHAVE_HOJE))[CHAVE_HOJE];
      st.placar = r && r.data === hojeStr() ? r : { data: hojeStr(), ligacoes_hoje: 0, interacoes_hoje: 0 };
    } catch (_) { st.placar = { data: hojeStr(), ligacoes_hoje: 0, interacoes_hoje: 0 }; }
    render();
  }
  async function somarPlacar(interessado) {
    await atualizarPlacar();
    st.placar.ligacoes_hoje++;
    if (interessado) st.placar.interacoes_hoje++;
    chrome.storage.local.set({ [CHAVE_HOJE]: st.placar }).catch(() => {});
  }

  // ---------- fila ----------
  const sessao = () => (st.atual ? st.sessoes[st.atual] : null);

  function proximo(s) {
    if (!s) return null;
    const novos = s.itens.filter(i => i.estado === 'novo');
    if (novos.length) return novos[0];
    const caixa = s.itens.filter(i => i.estado === 'caixa').sort((a, b) => a.tentativas - b.tentativas || a.ordem - b.ordem);
    return caixa[0] || null;
  }

  function contagem(s) {
    const c = { total: s.itens.length, novos: 0, caixa: 0, feitos: 0, interessados: 0 };
    for (const i of s.itens) {
      if (i.estado === 'novo') c.novos++;
      else if (i.estado === 'caixa') c.caixa++;
      else c.feitos++;
      if (i.classificacao === 'Cliente Interessado') c.interessados++;
    }
    return c;
  }

  function montarSessao(nome, contatos) {
    const antiga = st.sessoes[nome];
    const porChave = new Map((antiga?.itens || []).map(i => [i.chave, i]));
    const vistos = new Set();
    const itens = [];
    let ordem = 0;
    let fora = 0;
    for (const c of contatos) {
      const chave = chaveDoContato(c);
      if (!chave || vistos.has(chave)) continue;
      if (jaFinalizado(c) && !(porChave.get(chave)?.estado === 'feito')) { fora++; vistos.add(chave); continue; }
      vistos.add(chave);
      const velho = porChave.get(chave);
      itens.push(velho
        ? { ...velho, nome: c.nome || velho.nome, telefone: c.telefone || velho.telefone, chatId: c.chatId || velho.chatId, ordem: ordem++ }
        : { chave, nome: c.nome || telBonito(c.telefone) || 'Sem nome', telefone: c.telefone || '', chatId: c.chatId || '', estado: 'novo', tentativas: 0, classificacao: '', ordem: ordem++ });
    }
    st.sessoes[nome] = { etiqueta: nome, criadaEm: antiga?.criadaEm || Date.now(), atualizadaEm: Date.now(), itens, fora };
    return st.sessoes[nome];
  }

  // ---------- ações ----------
  async function listarEtiquetas() {
    const r = await loja('etiquetas');
    st.etiquetas = r.ok && Array.isArray(r.dados) ? r.dados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) : null;
    render();
  }

  async function extrair(etiqueta) {
    st.ocupado = true; st.erro = ''; st.aviso = ''; render();
    try {
      let contatos = null;
      if (etiqueta.id) {
        const r = await loja('contatos', { labelId: etiqueta.id }, 15000);
        if (r.ok && Array.isArray(r.dados)) contatos = r.dados;
      }
      if (!contatos) {
        // reserva: lê a lista da etiqueta ABERTA na tela do WhatsApp (rolando a lista)
        if (!window.IS.Scraper?.captureOpenLabel) throw new Error('Não consegui ler as etiquetas deste WhatsApp.');
        const cap = await window.IS.Scraper.captureOpenLabel(etiqueta.nome);
        contatos = (cap.contacts || []).map(c => ({ nome: c.name, chatId: c.chatId || '', telefone: /@c\.us$/.test(c.chatId || '') ? digitos(c.chatId) : (/^\+?\d{8,}$/.test(c.chatId || '') ? digitos(c.chatId) : '') }));
      }
      if (!contatos.length) throw new Error(`A etiqueta ${etiqueta.nome} não tem contatos.`);
      const s = montarSessao(etiqueta.nome, contatos);
      if (!s.itens.length) {
        delete st.sessoes[etiqueta.nome];
        await salvarSessoes();
        st.atual = null;
        st.tela = 'inicio';
        st.aviso = `Ninguém para ligar em ${etiqueta.nome}: os ${s.fora} contato(s) já foram classificados antes (Interessado, Disparo ou Deny List).`;
        return;
      }
      await salvarSessoes();
      st.atual = etiqueta.nome;
      novoContato();
      st.tela = proximo(s) ? 'sessao' : 'fim';
      const semFone = s.itens.filter(i => !telInternacional(i.telefone)).length;
      st.aviso = `${s.itens.length} contato(s) extraído(s) de ${etiqueta.nome}.${s.fora ? ` ${s.fora} já classificado(s) antes (Interessado, Disparo ou Deny List) ficaram de fora.` : ''}${semFone ? ` ${semFone} sem número visível (use "Abrir conversa").` : ''}`;
    } catch (err) {
      st.erro = err.message || String(err);
    } finally {
      st.ocupado = false;
      render();
    }
  }

  function novoContato() {
    st.classificacao = '';
    st.etapa = '';
    st.nota = '';
  }

  function ligar(item) {
    const d = telInternacional(item.telefone);
    if (!d) { st.erro = 'Este contato não tem número visível. Abra a conversa para ver o número.'; return render(); }
    const a = document.createElement('a');
    a.href = `tel:+${d}`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    item.ligouEm = Date.now();
    salvarSessoes();
  }

  async function copiar(item) {
    const t = telBonito(item.telefone);
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      st.aviso = `Número copiado: ${t}`;
    } catch (_) {
      st.aviso = `Número: ${t}`;
    }
    render();
  }

  // ---------- empreendimento de interesse (lido da conversa / do anúncio) ----------
  const NOME = "[A-ZÀ-Ú0-9][\\wÀ-ú.'&-]*(?:\\s+(?:(?:da|do|de|dos|das|e|del)\\s+)?[A-ZÀ-Ú0-9][\\wÀ-ú.'&-]*){0,4}";
  const PADROES = [
    new RegExp(`interess(?:e|ad[oa]s?|ei|ou)\\s+(?:no|na|nos|nas|em|pelo|pela|pelos|pelas)\\s+(?:empreendimento\\s+|im[oó]vel\\s+|apartamento\\s+|apto\\s+|lan[cç]amento\\s+|residencial\\s+)?(${NOME})`),
    new RegExp(`(?:empreendimento|lan[cç]amento|residencial|condom[ií]nio)\\s*:?\\s+(${NOME})`),
    new RegExp(`(?:sobre|anúncio|anuncio)\\s+(?:o|a|do|da)\\s+\\*?(${NOME})`),
  ];
  const IGNORAR = /^(Eu|Ele|Ela|Sim|Não|Nao|Olá|Ola|Oi|Bom|Boa|Mais|Informações|Informacoes|Imóvel|Imovel|Apartamento|Valor|Whatsapp|Instagram|Facebook)$/i;
  const limparNome = n => String(n || '').replace(/[*_~]/g, '').replace(/[.,;:!?]+$/, '').replace(/\s+(e|de|da|do|que|para|com)$/i, '').trim();

  function acharInteresse(msgs) {
    if (!Array.isArray(msgs) || !msgs.length) return null;
    // 1) anúncio (clique para WhatsApp): o título costuma ter o nome do empreendimento
    for (const m of msgs) {
      const t = m.anuncio && (m.anuncio.titulo || m.anuncio.descricao);
      if (t) {
        for (const re of PADROES) { const x = t.match(re); if (x && !IGNORAR.test(x[1])) return { nome: limparNome(x[1]), fonte: 'anúncio' }; }
        return { nome: limparNome(t.split(/\s[|–—-]\s|\n/)[0]).slice(0, 60), fonte: 'anúncio' };
      }
    }
    // 2) mensagens do cliente e as suas (da mais antiga para a mais nova)
    for (const m of msgs) {
      for (const re of PADROES) {
        const x = (m.texto || '').match(re);
        if (x && x[1] && !IGNORAR.test(x[1].split(/\s+/)[0])) return { nome: limparNome(x[1]), fonte: m.deMim ? 'sua mensagem' : 'mensagem do cliente' };
      }
    }
    // 3) nome em negrito numa mensagem sua (ex.: "sobre o *Jardim da Hípica*")
    for (const m of msgs) {
      if (!m.deMim) continue;
      const x = (m.texto || '').match(/\b(?:no|na|do|da|pelo|pela|o|a)\s+\*([^*\n]{3,40})\*/);
      if (x) return { nome: limparNome(x[1]), fonte: 'sua mensagem' };
    }
    return null;
  }

  // ao mostrar um contato: abre a conversa no fundo e procura o empreendimento de interesse
  let preparando = '';
  async function prepararContato(item) {
    if (!item || preparando === item.chave) return;
    preparando = item.chave;
    const aberta = await abrirConversa(item, true);
    if (item.interesse === undefined && item.chatId) {
      let achado = null;
      for (let t = 0; t < 4 && !achado; t++) {
        await new Promise(r => setTimeout(r, t ? 900 : 600)); // espera o WhatsApp carregar as mensagens
        const r = await loja('mensagens', { chatId: item.chatId });
        achado = acharInteresse(r.ok ? r.dados : null);
        if (r.ok && Array.isArray(r.dados) && r.dados.length && !achado && t >= 1) break;
      }
      item.interesse = achado || null;
      salvarSessoes();
      if (preparando === item.chave) render();
    } else if (!aberta && item.interesse === undefined) {
      item.interesse = null;
      render();
    }
  }

  async function abrirConversa(item, silencioso = false) {
    let ok = false;
    if (item.chatId) {
      const r = await loja('abrir', { chatId: item.chatId });
      ok = !!(r.ok && r.dados);
    }
    if (!ok && window.IS.Scraper?.openContactBySearch) {
      try { ok = await window.IS.Scraper.openContactBySearch({ name: item.nome, chatId: item.chatId || (item.telefone ? `${telInternacional(item.telefone)}@c.us` : '') }); } catch (_) { ok = false; }
    }
    if (!ok && !silencioso) { st.erro = `Não consegui abrir a conversa de ${item.nome}. Procure pelo nome na lista do WhatsApp.`; render(); }
    return ok;
  }

  // muda a etiqueta da conversa no WhatsApp (usa o mesmo "Etiquetar conversa" do 1º contato, content.js)
  async function mudarEtiqueta(item, add, remove) {
    if (typeof agenteEtiquetar !== 'function') return { ok: false, erro: 'função de etiquetas indisponível — recarregue o WhatsApp (F5)' };
    const aberta = await abrirConversa(item, true);
    if (!aberta) return { ok: false, erro: `não consegui abrir a conversa de ${item.nome}` };
    await new Promise(r => setTimeout(r, 900));
    if (window.IS.Scraper?.isCurrentContact && !window.IS.Scraper.isCurrentContact({ name: item.nome, chatId: item.chatId })) {
      await new Promise(r => setTimeout(r, 1200));
    }
    try {
      const r = await agenteEtiquetar(add, remove);
      const naoExiste = (r?.alteracoes || []).find(a => /não existe/.test(a));
      if (!r?.ok) return { ok: false, erro: r?.error || 'não consegui mudar a etiqueta' };
      if (naoExiste) return { ok: false, erro: naoExiste };
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err.message || String(err) };
    }
  }

  async function salvarEProximo() {
    const s = sessao();
    const item = proximo(s);
    if (!item || st.ocupado) return;
    const classificacao = st.classificacao || CAIXA; // sem escolher = caixa postal (igual à Oferta Ativa)
    st.erro = '';
    let feitoNaEtiqueta = '';
    const regra = CLASSIFICACOES.find(k => k.id === classificacao) || {};
    if (regra.destinos || regra.sai) {
      // nome exato de cada etiqueta de destino como está no seu WhatsApp (ex.: "Lead" ou "Leads")
      const nomesWa = (st.etiquetas || []).map(l => l.nome);
      const destinos = (regra.destinos || []).map(aceitos => nomesWa.find(n => aceitos.some(d => normEt(d) === normEt(n))) || aceitos[0]);
      const jaNoDestino = destinos.some(d => normEt(d) === normEt(s.etiqueta));
      const destino = destinos.join(' e ');
      const add = destinos;
      const remove = jaNoDestino ? [] : [s.etiqueta];
      st.ocupado = true; st.aviso = '⏳ Mudando a etiqueta no WhatsApp…'; render();
      const r = await mudarEtiqueta(item, add, remove);
      st.ocupado = false;
      if (!r.ok) {
        st.aviso = '';
        st.erro = `Não mudei a etiqueta de ${item.nome}: ${r.erro}. Tente de novo, ou mude à mão no WhatsApp e clique em Pular.`;
        return render();
      }
      feitoNaEtiqueta = destinos.length
        ? (jaNoDestino ? ` (continua na ${destino})` : ` → saiu de ${s.etiqueta} e foi para ${destino}`)
        : ` → saiu da etiqueta ${s.etiqueta}`;
    }
    item.classificacao = classificacao;
    item.nota = st.nota.trim();
    item.tentativas = (item.tentativas || 0) + (classificacao === CAIXA ? 1 : 0);
    item.estado = classificacao === CAIXA && item.tentativas < MAX_TENTATIVAS ? 'caixa' : 'feito';
    if (classificacao === CAIXA) item.ordem = Math.max(...s.itens.map(i => i.ordem)) + 1; // vai para o fim da fila
    s.atualizadaEm = Date.now();
    await salvarSessoes();
    if (classificacao !== CAIXA) await marcarFinalizado(item, classificacao);
    await somarPlacar(classificacao === 'Cliente Interessado');
    st.aviso = `✅ ${item.nome}: ${classificacao === CAIXA ? 'caixa postal (fica na etiqueta)' : classificacao}${feitoNaEtiqueta}`;
    novoContato();
    if (!proximo(s)) st.tela = 'fim';
    render();
  }

  function resumoTexto(s) {
    const linhas = [`DINHEIRO NA MESA — etiqueta ${s.etiqueta} (${hojeStr()})`];
    for (const k of CLASSIFICACOES) {
      const lista = s.itens.filter(i => i.classificacao === k.id);
      if (!lista.length) continue;
      linhas.push('', `${k.rotulo} (${lista.length})`);
      for (const i of lista) linhas.push(`- ${i.nome} ${telBonito(i.telefone)}${i.nota ? ` — ${i.nota}` : ''}`);
    }
    return linhas.join('\n');
  }

  async function copiarResumo() {
    const s = sessao();
    if (!s) return;
    try {
      await navigator.clipboard.writeText(resumoTexto(s));
      st.aviso = 'Resumo copiado. Cole onde quiser (WhatsApp, bloco de notas…).';
    } catch (_) {
      st.erro = 'Não consegui copiar o resumo.';
    }
    render();
  }

  function concluirEVoltar() {
    // temporário: etiqueta concluída some deste Chrome
    if (st.atual && st.sessoes[st.atual] && !proximo(st.sessoes[st.atual])) {
      delete st.sessoes[st.atual];
      salvarSessoes();
    }
    st.atual = null;
    st.tela = 'inicio'; st.erro = ''; st.aviso = '';
    render();
    listarEtiquetas();
  }

  function pular() {
    const s = sessao();
    const item = proximo(s);
    if (!item) return;
    item.ordem = Math.max(...s.itens.map(i => i.ordem)) + 1;
    if (item.estado === 'novo') {
      // manda para o fim dos novos
      const idx = s.itens.indexOf(item);
      s.itens.splice(idx, 1);
      s.itens.push(item);
    }
    novoContato();
    salvarSessoes();
    render();
  }

  function excluirSessao(nome) {
    if (!confirm(`Apagar o progresso de "${nome}"?`)) return;
    delete st.sessoes[nome];
    salvarSessoes();
    render();
  }

  // ---------- tela ----------
  function estilos() {
    if (document.getElementById('is-dnm-style')) return;
    const css = document.createElement('style');
    css.id = 'is-dnm-style';
    css.textContent = `
      #is-dnm-botao{position:fixed;left:14px;bottom:14px;z-index:10002;display:flex;align-items:center;gap:6px;padding:9px 14px;border:none;border-radius:999px;
        background:linear-gradient(135deg,#0a8f4e,#076b3a);color:#fff;font:700 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;cursor:pointer;
        box-shadow:0 6px 18px rgba(7,107,58,.35)}
      #is-dnm-botao:hover{filter:brightness(1.08)}
      #is-dnm-fundo{position:fixed;inset:0;z-index:10003;background:rgba(11,20,26,.45)}
      #is-dnm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:460px;max-width:calc(100vw - 24px);max-height:92vh;z-index:10004;
        display:flex;flex-direction:column;overflow:hidden;border-radius:14px;
        background:var(--inmovya-background,#fff);color:var(--inmovya-text,#111b21);border:1px solid var(--inmovya-border,#d1d7db);
        box-shadow:0 18px 50px rgba(0,0,0,.35);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
      #is-dnm *{box-sizing:border-box}
      #is-dnm .dnm-top{padding:14px 16px;background:linear-gradient(135deg,#0a8f4e,#076b3a);color:#fff;display:flex;align-items:center;gap:10px}
      #is-dnm .dnm-top h2{margin:0;font-size:16px;flex:1;letter-spacing:.3px}
      #is-dnm .dnm-x{background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px}
      #is-dnm .dnm-corpo{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
      #is-dnm .dnm-placar{display:flex;gap:8px}
      #is-dnm .dnm-placar div{flex:1;padding:8px;border-radius:8px;background:var(--inmovya-surface,#f0f2f5);text-align:center}
      #is-dnm .dnm-placar b{display:block;font-size:18px}
      #is-dnm .dnm-placar span{font-size:11px;color:var(--inmovya-text-secondary,#667781)}
      #is-dnm .dnm-btn{border:none;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;font-size:13px}
      #is-dnm .dnm-btn:disabled{opacity:.5;cursor:default}
      #is-dnm .dnm-pri{background:#0a8f4e;color:#fff}
      #is-dnm .dnm-sec{background:var(--inmovya-surface,#f0f2f5);color:var(--inmovya-text,#111b21);border:1px solid var(--inmovya-border,#d1d7db)}
      #is-dnm .dnm-lista{display:flex;flex-direction:column;gap:6px}
      #is-dnm .dnm-et{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--inmovya-border,#d1d7db);border-radius:8px;cursor:pointer;background:transparent;color:inherit;text-align:left;width:100%}
      #is-dnm .dnm-et:hover{background:var(--inmovya-hover,#f5f6f6)}
      #is-dnm .dnm-bola{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
      #is-dnm .dnm-card{border:1px solid var(--inmovya-border,#d1d7db);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px}
      #is-dnm .dnm-nome{font-size:19px;font-weight:800;word-break:break-word}
      #is-dnm .dnm-tel{font-size:16px;font-weight:600;letter-spacing:.3px}
      #is-dnm .dnm-interesse{padding:7px 9px;border-radius:8px;background:#fff7e6;color:#7a4b00;font-size:13px}
      #is-dnm .dnm-top{cursor:move;user-select:none}
      #is-dnm .dnm-acoes{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
      #is-dnm .dnm-ligar{background:#0a8f4e;color:#fff;font-size:14px}
      #is-dnm .dnm-chips{display:flex;flex-direction:column;gap:6px}
      #is-dnm .dnm-chip{text-align:left;border:2px solid var(--inmovya-border,#d1d7db);background:transparent;color:inherit;border-radius:8px;padding:9px 10px;cursor:pointer;font-weight:600}
      #is-dnm .dnm-chip.on{color:#fff}
      #is-dnm textarea,#is-dnm select,#is-dnm input{width:100%;border:1px solid var(--inmovya-border,#d1d7db);border-radius:8px;padding:8px;font:inherit;background:var(--inmovya-background,#fff);color:inherit}
      #is-dnm .dnm-rodape{padding:12px 16px;border-top:1px solid var(--inmovya-border,#d1d7db);display:flex;gap:8px}
      #is-dnm .dnm-rodape .dnm-pri{flex:1;padding:13px;font-size:14px}
      #is-dnm .dnm-ok{padding:8px 10px;border-radius:8px;background:#e8f6ee;color:#0a6b3a;font-size:12px}
      #is-dnm .dnm-erro{padding:8px 10px;border-radius:8px;background:#fdecee;color:#a8212f;font-size:12px}
      #is-dnm .dnm-mini{font-size:11px;color:var(--inmovya-text-secondary,#667781)}
      #is-dnm .dnm-barra{height:6px;border-radius:3px;background:var(--inmovya-surface,#f0f2f5);overflow:hidden}
      #is-dnm .dnm-barra i{display:block;height:100%;background:#0a8f4e}
    `;
    document.head.appendChild(css);
  }

  function botao() {
    if (document.getElementById('is-dnm-botao')) return;
    const b = document.createElement('button');
    b.id = 'is-dnm-botao';
    b.type = 'button';
    b.title = 'Dinheiro na Mesa: oferta ativa nas etiquetas do WhatsApp';
    b.innerHTML = '💰 Dinheiro na Mesa';
    b.addEventListener('click', () => (st.aberto ? fechar() : abrir()));
    document.body.appendChild(b);
  }

  async function abrir() {
    st.aberto = true;
    await carregarSessoes();
    if (st.tela !== 'sessao' || !sessao()) st.tela = 'inicio';
    render();
    listarEtiquetas();
    atualizarPlacar();
  }

  function fechar() {
    st.aberto = false;
    document.getElementById('is-dnm')?.remove();
    document.getElementById('is-dnm-fundo')?.remove();
  }

  function htmlPlacar() {
    const p = st.placar;
    return `<div class="dnm-placar">
      <div><b>${p ? esc(p.ligacoes_hoje) : '–'}</b><span>ligações hoje</span></div>
      <div><b>${p ? esc(p.interacoes_hoje) : '–'}</b><span>interessados hoje</span></div>
    </div>`;
  }

  function htmlAvisos() {
    return `${st.erro ? `<div class="dnm-erro">${esc(st.erro)}</div>` : ''}${st.aviso ? `<div class="dnm-ok">${esc(st.aviso)}</div>` : ''}`;
  }

  function htmlInicio() {
    const andamento = Object.values(st.sessoes).filter(s => s.itens?.length && proximo(s)).sort((a, b) => b.atualizadaEm - a.atualizadaEm);
    const lista = st.etiquetas;
    return `
      ${htmlPlacar()}
      ${htmlAvisos()}
      ${andamento.length ? `<div><div style="font-weight:700;margin-bottom:6px">Continuar de onde parou</div><div class="dnm-lista">
        ${andamento.map(s => {
          const c = contagem(s);
          const pct = Math.round((c.feitos / Math.max(1, c.total)) * 100);
          return `<div style="display:flex;gap:6px;align-items:center">
            <button type="button" class="dnm-et" data-continuar="${esc(s.etiqueta)}">
              <span style="flex:1"><b>${esc(s.etiqueta)}</b><br><span class="dnm-mini">${c.feitos} de ${c.total} feitos · ${c.novos} novos · ${c.caixa} p/ religar</span>
              <span class="dnm-barra" style="display:block;margin-top:5px"><i style="width:${pct}%"></i></span></span>
            </button>
            <button type="button" class="dnm-btn dnm-sec" data-apagar="${esc(s.etiqueta)}" title="Apagar este progresso">🗑</button>
          </div>`;
        }).join('')}</div></div>` : ''}
      <div>
        <div style="font-weight:700;margin-bottom:6px">Escolha a etiqueta para ligar</div>
        ${lista === null
          ? `<div class="dnm-mini" style="margin-bottom:8px">Abra a etiqueta no WhatsApp (menu ⋮ → Etiquetas → clique na etiqueta) e escreva o nome dela aqui:</div>
             <div style="display:flex;gap:6px"><input id="dnm-nome-et" placeholder="Nome da etiqueta aberta (ex.: 20%)">
             <button type="button" class="dnm-btn dnm-pri" data-extrair-aberta ${st.ocupado ? 'disabled' : ''}>Extrair</button></div>`
          : lista.length
            ? `<div class="dnm-lista">${lista.map(l => `<button type="button" class="dnm-et" data-extrair="${esc(l.id)}" ${st.ocupado ? 'disabled' : ''}>
                <span class="dnm-bola" style="background:${esc(l.cor || '#0a8f4e')}"></span>
                <span style="flex:1;font-weight:600">${esc(l.nome)}</span>
                <span class="dnm-mini">${esc(l.total)} contato(s)</span></button>`).join('')}</div>
               <div class="dnm-mini" style="margin-top:6px">A extensão lê os contatos direto da memória do WhatsApp, sem abrir conversa por conversa. É temporário: nada é gravado no Inmovya.</div>`
            : `<div class="dnm-mini">Nenhuma etiqueta encontrada neste WhatsApp.</div>`}
        ${st.ocupado ? '<div class="dnm-mini" style="margin-top:8px">⏳ Extraindo contatos…</div>' : ''}
      </div>`;
  }

  function htmlSessao() {
    const s = sessao();
    const item = proximo(s);
    if (!item) return htmlFim();
    const c = contagem(s);
    const pct = Math.round((c.feitos / Math.max(1, c.total)) * 100);
    const tel = telBonito(item.telefone);
    const rodada = item.estado === 'caixa';
    return `
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="dnm-btn dnm-sec" data-voltar style="padding:6px 10px">← Etiquetas</button>
        <div style="flex:1"><b>${esc(s.etiqueta)}</b><div class="dnm-mini">${c.feitos} de ${c.total} feitos · ${c.novos} novos · ${c.caixa} p/ religar</div></div>
      </div>
      <div class="dnm-barra"><i style="width:${pct}%"></i></div>
      ${htmlPlacar()}
      ${htmlAvisos()}
      <div class="dnm-card">
        ${rodada ? `<div class="dnm-mini" style="color:#b7791f;font-weight:700">↻ Religando: ${item.tentativas}ª vez sem atender</div>` : ''}
        <div class="dnm-nome">${esc(item.nome)}</div>
        <div class="dnm-tel">${tel ? esc(tel) : '<span class="dnm-mini">sem número visível — abra a conversa</span>'}</div>
        <div class="dnm-interesse">🏢 Interesse: ${item.interesse === undefined
          ? '<span class="dnm-mini">procurando na conversa…</span>'
          : item.interesse
            ? `<b>${esc(item.interesse.nome)}</b> <span class="dnm-mini">(${esc(item.interesse.fonte)})</span>`
            : '<span class="dnm-mini">não identificado na conversa</span>'}</div>
        <div class="dnm-acoes">
          <button type="button" class="dnm-btn dnm-ligar" data-ligar ${tel ? '' : 'disabled'}>📞 Ligar</button>
          <button type="button" class="dnm-btn dnm-sec" data-copiar ${tel ? '' : 'disabled'}>📋 Copiar</button>
          <button type="button" class="dnm-btn dnm-sec" data-abrir>💬 Conversa</button>
        </div>
      </div>
      <div>
        <div style="font-weight:700;margin-bottom:6px">Classificação</div>
        <div class="dnm-chips">${CLASSIFICACOES.map(k => {
          const on = st.classificacao === k.id;
          return `<button type="button" class="dnm-chip ${on ? 'on' : ''}" data-classificar="${esc(k.id)}" style="${on ? `background:${k.cor};border-color:${k.cor}` : `border-color:${k.cor}33`}">${esc(k.rotulo)}</button>`;
        }).join('')}</div>
        <div class="dnm-mini" style="margin-top:6px">Sem escolher nada, conta como Caixa Postal: fica na etiqueta e volta no fim da fila (até 3 vezes).</div>
      </div>
      <div>
        <div style="font-weight:700;margin-bottom:6px">Notas</div>
        <textarea id="dnm-nota" rows="3" maxlength="500" placeholder="O que o cliente falou, melhor horário, interesse…">${esc(st.nota)}</textarea>
      </div>`;
  }

  function htmlFim() {
    const s = sessao();
    const c = s ? contagem(s) : null;
    return `
      ${htmlPlacar()}
      ${htmlAvisos()}
      <div class="dnm-card" style="text-align:center">
        <div style="font-size:34px">🎉</div>
        <div class="dnm-nome">Etiqueta concluída!</div>
        ${c ? `<div>${esc(s.etiqueta)}: ${c.total} contato(s) · ${c.interessados} interessado(s)</div>
        <pre style="text-align:left;white-space:pre-wrap;max-height:220px;overflow:auto;background:var(--inmovya-surface,#f0f2f5);border-radius:8px;padding:10px;font:12px/1.4 inherit;margin:0">${esc(resumoTexto(s))}</pre>
        <button type="button" class="dnm-btn dnm-sec" data-resumo>📋 Copiar resumo</button>
        <div class="dnm-mini">Isto é temporário: ao escolher outra etiqueta, este resumo é apagado.</div>` : ''}
        <button type="button" class="dnm-btn dnm-pri" data-concluir>Escolher outra etiqueta</button>
      </div>`;
  }

  function render() {
    if (!st.aberto) return;
    estilos();
    let raiz = document.getElementById('is-dnm');
    if (!raiz) {
      raiz = document.createElement('div');
      raiz.id = 'is-dnm';
      document.body.appendChild(raiz);
      raiz.addEventListener('click', aoClicar);
      raiz.addEventListener('input', ev => {
        if (ev.target.id === 'dnm-nota') st.nota = ev.target.value;
      });
            raiz.addEventListener('keydown', ev => ev.stopPropagation()); // não deixa o WhatsApp roubar o teclado
    }
    const rolagem = raiz.querySelector('.dnm-corpo')?.scrollTop || 0;
    const mesmaTela = raiz.dataset.tela === `${st.tela}:${st.atual}:${proximo(sessao())?.chave || ''}`;
    const naSessao = st.tela === 'sessao' && sessao() && proximo(sessao());
    const corpo = st.tela === 'sessao' ? (naSessao ? htmlSessao() : htmlFim()) : st.tela === 'fim' ? htmlFim() : htmlInicio();
    raiz.innerHTML = `
      <div class="dnm-top"><h2>💰 DINHEIRO NA MESA</h2><button type="button" class="dnm-x" data-fechar title="Fechar">✕</button></div>
      <div class="dnm-corpo">${corpo}</div>
      ${naSessao ? `<div class="dnm-rodape">
        <button type="button" class="dnm-btn dnm-sec" data-pular ${st.ocupado ? 'disabled' : ''} title="Deixa para depois, sem registrar">Pular</button>
        <button type="button" class="dnm-btn dnm-pri" data-salvar ${st.ocupado ? 'disabled' : ''}>${st.ocupado ? 'Salvando…' : 'SALVAR E PRÓXIMO ➜'}</button>
      </div>` : ''}`;
    raiz.dataset.tela = `${st.tela}:${st.atual}:${proximo(sessao())?.chave || ''}`;
    if (naSessao) prepararContato(proximo(sessao()));
    ativarArrastar(raiz);
    // mesma tela (ex.: escolheu a classificação): mantém a rolagem; contato novo: volta ao topo
    if (mesmaTela) raiz.querySelector('.dnm-corpo').scrollTop = rolagem;
  }

  // arrastar a janela pela barra verde (para ver melhor a conversa atrás)
  function ativarArrastar(raiz) {
    const topo = raiz.querySelector('.dnm-top');
    if (!topo || topo.dataset.arrasta) return;
    topo.dataset.arrasta = '1';
    topo.addEventListener('mousedown', ev => {
      if (ev.target.closest('button')) return;
      const r = raiz.getBoundingClientRect();
      const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      const mover = e => {
        raiz.style.left = `${Math.max(0, Math.min(window.innerWidth - 120, e.clientX - dx))}px`;
        raiz.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dy))}px`;
        raiz.style.transform = 'none';
      };
      const soltar = () => { document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar); };
      document.addEventListener('mousemove', mover);
      document.addEventListener('mouseup', soltar);
      ev.preventDefault();
    });
  }

  async function aoClicar(ev) {
    const alvo = ev.target.closest('button');
    if (!alvo) return;
    const d = alvo.dataset;
    const s = sessao();
    const item = s ? proximo(s) : null;
    if ('fechar' in d) return fechar();
    if ('voltar' in d) { st.tela = 'inicio'; st.erro = ''; st.aviso = ''; render(); return listarEtiquetas(); }
    if (d.extrair) {
      const et = (st.etiquetas || []).find(l => l.id === d.extrair);
      if (et) return extrair(et);
    }
    if ('extrairAberta' in d) {
      const nome = (document.getElementById('dnm-nome-et')?.value || '').trim();
      if (!nome) { st.erro = 'Escreva o nome da etiqueta que está aberta no WhatsApp.'; return render(); }
      return extrair({ nome });
    }
    if (d.continuar) {
      st.atual = d.continuar; st.erro = ''; st.aviso = ''; novoContato();
      st.tela = proximo(sessao()) ? 'sessao' : 'fim';
      return render();
    }
    if (d.apagar) return excluirSessao(d.apagar);
    if ('resumo' in d) return copiarResumo();
    if ('concluir' in d) return concluirEVoltar();
    if (!item) return;
    if ('ligar' in d) return ligar(item);
    if ('copiar' in d) return copiar(item);
    if ('abrir' in d) return abrirConversa(item);
    if (d.classificar) { st.classificacao = st.classificacao === d.classificar ? '' : d.classificar; if (st.classificacao !== 'Cliente Interessado') st.etapa = ''; return render(); }
    if ('pular' in d) return pular();
    if ('salvar' in d) return salvarEProximo();
  }

  function iniciar() {
    estilos();
    botao();
    // o WhatsApp às vezes refaz o <body>: garante o botão
    setInterval(botao, 5000);
  }

  return { iniciar, _st: st, _proximo: proximo, _montarSessao: montarSessao, _telBonito: telBonito, _telInternacional: telInternacional };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.IS.DinheiroNaMesa.iniciar());
else window.IS.DinheiroNaMesa.iniciar();
