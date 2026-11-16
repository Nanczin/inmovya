// disparo.js — DISPARO de WhatsApp do Inmovya Scale (dentro do WhatsApp Web).
// Lista por ETIQUETA do WhatsApp ou por PLANILHA (colar/CSV), mensagem com variações {Oi|Olá} e {{nome}},
// várias mensagens separadas por ===, anexos (PDF/imagem/vídeo) e proteção anti-bloqueio:
// intervalo aleatório entre envios, pausa a cada lote, limite por dia, horário permitido e
// "não mandar de novo para quem recebeu nos últimos N dias".
// Cada envio usa o mesmo envio das esteiras (janela pequena em segundo plano) e respeita a prioridade
// do 1º contato. O progresso fica guardado neste Chrome: dá para pausar, fechar e continuar depois.
window.IS = window.IS || {};

window.IS.Disparo = (() => {
  const CHAVE = 'disparoAtual';
  const CHAVE_ANEXOS = 'disparoAnexos';
  const CHAVE_HIST = 'disparoHistorico'; // telefone → quando recebeu o último disparo
  const CHAVE_HOJE = 'disparoHoje';
  const CHAVE_CFG = 'disparoConfig';
  const MAX_ANEXO_MB = 16;

  const CFG_PADRAO = {
    intervaloMin: 120, // segundos entre um contato e outro
    intervaloMax: 180,
    lote: 20, // a cada N envios...
    pausaLote: 15, // ...pausa N minutos
    limiteDia: 100,
    horaIni: '08:00',
    horaFim: '20:00',
    evitarDias: 7, // não manda para quem recebeu disparo nos últimos N dias (0 = desliga)
  };

  const st = {
    aberto: false,
    tela: 'novo', // novo | rodando | fim
    fonte: 'etiqueta', // etiqueta | planilha
    etiquetas: undefined, // undefined = carregando · null = sem acesso
    marcadas: {},
    textoPlanilha: '',
    contatos: [], // lista montada antes de começar
    mensagem: '',
    anexos: [], // { id, name, type, size, data, legenda }
    cfg: { ...CFG_PADRAO },
    campanha: null,
    previa: '',
    ocupado: false,
    aviso: '',
    erro: '',
    espera: '', // texto do que está esperando (intervalo, pausa, horário…)
    proximoEm: 0,
  };
  let rodandoLoop = false;
  let seq = 0;

  // ---------- utilidades ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const digitos = s => String(s || '').replace(/\D/g, '');
  const telInternacional = t => {
    let d = digitos(t);
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);
    if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d;
    return d.length >= 12 ? d : '';
  };
  const telBonito = t => {
    const d = telInternacional(t);
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
      const n = d.slice(4);
      return `(${d.slice(2, 4)}) ${n.length === 9 ? `${n.slice(0, 5)}-${n.slice(5)}` : `${n.slice(0, 4)}-${n.slice(4)}`}`;
    }
    return d ? `+${d}` : String(t || '');
  };
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const hojeStr = () => new Date().toLocaleDateString('pt-BR');
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const sorteio = (a, b) => Math.round(Math.min(a, b) + Math.random() * Math.abs(b - a));
  const mmss = ms => {
    const s = Math.max(0, Math.round(ms / 1000));
    return s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const primeiroNome = nome => {
    const p = String(nome || '').replace(/[^\p{L}\s'-]/gu, ' ').trim().split(/\s+/)[0] || '';
    return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '';
  };
  const saudacao = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  };

  // spintax {Oi|Olá|Oii} (aceita um dentro do outro); {{variáveis}} ficam protegidas
  function spin(texto) {
    const vars = [];
    let t = String(texto || '').replace(/\{\{[^{}]*\}\}/g, m => `\u0000${vars.push(m) - 1}\u0000`);
    for (let i = 0; i < 20; i++) {
      const antes = t;
      t = t.replace(/\{([^{}]*)\}/g, (_, dentro) => {
        const op = dentro.split('|');
        return op[Math.floor(Math.random() * op.length)];
      });
      if (t === antes) break;
    }
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => vars[+i]);
  }
  function combinacoes(texto) {
    let total = 1;
    const t = String(texto || '').replace(/\{\{[^{}]*\}\}/g, '');
    const re = /\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(t))) total *= Math.max(1, m[1].split('|').length);
    return total;
  }
  function montarTexto(modelo, contato) {
    const nome = primeiroNome(contato.nome);
    return spin(modelo)
      .replace(/\{\{\s*nome\s*\}\}/gi, nome)
      .replace(/\{\{\s*nome_completo\s*\}\}/gi, String(contato.nome || '').trim() || nome)
      .replace(/\{\{\s*saudacao\s*\}\}/gi, (m, pos, tudo) => (/^\s*$|[.!?\n]\s*$/.test(tudo.slice(0, pos)) ? saudacao() : saudacao().toLowerCase()))
      .replace(/\s+([,.!?])/g, '$1') // "Oi , tudo bem" quando não tem nome
      .replace(/^[,\s]+/, '');
  }

  // ---------- memória do WhatsApp (mesma ponte do Dinheiro na Mesa: dnm-store.js) ----------
  function loja(op, args = {}, timeout = 8000) {
    return new Promise(resolve => {
      const id = `dsp${Date.now()}_${++seq}`;
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

  // ---------- guardar / carregar ----------
  const salvarCampanha = () => chrome.storage.local.set({ [CHAVE]: st.campanha }).catch(() => {});
  async function carregar() {
    try {
      const r = await chrome.storage.local.get([CHAVE, CHAVE_ANEXOS, CHAVE_CFG]);
      st.campanha = r[CHAVE] || null;
      if (r[CHAVE_CFG]) st.cfg = { ...CFG_PADRAO, ...r[CHAVE_CFG] };
      if (st.campanha) {
        st.anexos = r[CHAVE_ANEXOS] || [];
        // a página foi recarregada no meio: fica pausado até você continuar
        if (st.campanha.status === 'rodando' && !rodandoLoop) st.campanha.status = 'pausado';
        st.tela = st.campanha.status === 'concluido' ? 'fim' : 'rodando';
      }
    } catch (_) { /* sem armazenamento */ }
  }
  async function contadorHoje() {
    const r = (await chrome.storage.local.get(CHAVE_HOJE).catch(() => ({})))[CHAVE_HOJE];
    return r && r.dia === hojeStr() ? r.n : 0;
  }
  async function somarHoje() {
    const n = (await contadorHoje()) + 1;
    await chrome.storage.local.set({ [CHAVE_HOJE]: { dia: hojeStr(), n } }).catch(() => {});
    return n;
  }
  async function historico() {
    return (await chrome.storage.local.get(CHAVE_HIST).catch(() => ({})))[CHAVE_HIST] || {};
  }
  async function marcarHistorico(tel) {
    const h = await historico();
    h[tel] = Date.now();
    // guarda só os últimos 120 dias
    const corte = Date.now() - 120 * 864e5;
    for (const k of Object.keys(h)) if (h[k] < corte) delete h[k];
    await chrome.storage.local.set({ [CHAVE_HIST]: h }).catch(() => {});
  }

  // ---------- montar a lista ----------
  async function listarEtiquetas() {
    const r = await loja('etiquetas');
    st.etiquetas = r.ok && Array.isArray(r.dados) ? r.dados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) : null;
    render();
  }

  function deduplicar(lista) {
    const vistos = new Set();
    const out = [];
    let semNumero = 0;
    for (const c of lista) {
      const tel = telInternacional(c.telefone);
      if (!tel) { semNumero++; continue; }
      if (vistos.has(tel)) continue;
      vistos.add(tel);
      out.push({ nome: String(c.nome || '').trim(), telefone: tel });
    }
    return { contatos: out, semNumero };
  }

  async function carregarDasEtiquetas() {
    const ids = Object.keys(st.marcadas).filter(k => st.marcadas[k]);
    if (!ids.length) { st.erro = 'Marque pelo menos uma etiqueta.'; return render(); }
    st.ocupado = true; st.erro = ''; st.aviso = ''; render();
    try {
      const todos = [];
      for (const id of ids) {
        const r = await loja('contatos', { labelId: id }, 20000);
        if (r.ok && Array.isArray(r.dados)) todos.push(...r.dados);
      }
      const { contatos, semNumero } = deduplicar(todos);
      st.contatos = contatos;
      const nomes = (st.etiquetas || []).filter(e => st.marcadas[e.id]).map(e => e.nome).join(', ');
      st.aviso = `${contatos.length} contato(s) de ${nomes}.${semNumero ? ` ${semNumero} sem número visível ficaram de fora.` : ''}`;
    } catch (e) {
      st.erro = e.message || String(e);
    } finally {
      st.ocupado = false;
      render();
    }
  }

  // planilha: uma pessoa por linha — "Nome;Telefone", "Telefone,Nome", só o telefone, ou CSV com cabeçalho
  function lerPlanilha(texto) {
    const linhas = String(texto || '').split(/\r?\n/);
    const lista = [];
    for (const linha of linhas) {
      if (!linha.trim()) continue;
      const partes = linha.split(/[;\t,|]/).map(p => p.replace(/^"|"$/g, '').trim()).filter(Boolean);
      const idx = partes.findIndex(p => digitos(p).length >= 10 && digitos(p).length <= 15 && /^[\d\s()+.-]+$/.test(p));
      if (idx < 0) continue; // cabeçalho ou linha sem telefone
      const nome = partes.filter((p, i) => i !== idx && !/@/.test(p) && !/^\d+$/.test(p))[0] || '';
      lista.push({ nome, telefone: partes[idx] });
    }
    return lista;
  }
  function carregarDaPlanilha() {
    const bruto = lerPlanilha(st.textoPlanilha);
    const { contatos, semNumero } = deduplicar(bruto);
    st.contatos = contatos;
    st.erro = contatos.length ? '' : 'Não achei nenhum telefone. Use uma pessoa por linha: Nome;Telefone (ou só o telefone).';
    st.aviso = contatos.length ? `${contatos.length} contato(s) da planilha.${semNumero ? ` ${semNumero} número(s) inválido(s) ficaram de fora.` : ''}` : '';
    render();
  }

  // ---------- anexos ----------
  function escolherAnexos() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.mp4,application/pdf,image/*,video/mp4';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      input.remove();
      for (const f of files) {
        if (f.size > MAX_ANEXO_MB * 1024 * 1024) { st.erro = `${f.name} tem mais de ${MAX_ANEXO_MB} MB.`; continue; }
        const data = await new Promise((ok, falha) => {
          const r = new FileReader();
          r.onload = () => ok(r.result);
          r.onerror = () => falha(r.error);
          r.readAsDataURL(f);
        }).catch(() => null);
        if (!data) { st.erro = `Não consegui ler ${f.name}.`; continue; }
        st.anexos.push({ id: uuid(), name: f.name, type: f.type || 'application/octet-stream', size: f.size, data, legenda: false });
      }
      st.aviso = files.length ? `${files.length} arquivo(s) anexado(s).` : '';
      render();
    });
    document.body.appendChild(input);
    input.click();
  }
  function lerCsv() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,text/csv,text/plain';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      st.textoPlanilha = await f.text();
      carregarDaPlanilha();
    });
    document.body.appendChild(input);
    input.click();
  }

  // ---------- rodar ----------
  function dentroDoHorario(cfg, agora = new Date()) {
    const m = agora.getHours() * 60 + agora.getMinutes();
    const [hi, mi] = String(cfg.horaIni || '00:00').split(':').map(Number);
    const [hf, mf] = String(cfg.horaFim || '23:59').split(':').map(Number);
    return m >= hi * 60 + mi && m < hf * 60 + mf;
  }

  // espera mostrando a contagem; para na hora se você pausar/parar
  async function esperar(ms, texto) {
    const fim = Date.now() + ms;
    st.proximoEm = fim;
    st.espera = texto;
    while (Date.now() < fim) {
      if (!st.campanha || st.campanha.status !== 'rodando') break;
      atualizarContagem();
      await dormir(1000);
    }
    st.espera = '';
    st.proximoEm = 0;
  }

  function enviarUm(contato) {
    const partes = String(st.campanha.mensagem || '');
    const texto = montarTexto(partes, contato);
    const nPartes = texto.split(/^\s*===\s*$/m).length;
    const anexos = (st.anexos || []).map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      size: a.size,
      data: a.data,
      messageIndex: nPartes - 1, // depois da última mensagem
      useCaption: !!a.legenda && (a.type || '').startsWith('image/'),
    }));
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(
          { action: 'campaign_send', phone: contato.telefone, text: texto, attachments: anexos, background: true, envioId: contato.envioId, gapMinMs: 1500, gapMaxMs: 4000 },
          r => resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : r || { ok: false, error: 'sem resposta' })
        );
      } catch (e) {
        resolve({ ok: false, error: 'A extensão foi recarregada. Recarregue o WhatsApp (F5) e clique em Continuar.' });
      }
    });
  }

  async function rodar() {
    if (rodandoLoop || !st.campanha) return;
    rodandoLoop = true;
    st.campanha.status = 'rodando';
    await salvarCampanha();
    render();
    try {
      const c = st.campanha;
      const cfg = c.cfg;
      while (c.status === 'rodando') {
        const item = c.contatos.find(x => x.status === 'pendente');
        if (!item) { c.status = 'concluido'; break; }
        if (!dentroDoHorario(cfg)) { await esperar(60000, `Fora do horário (${cfg.horaIni} às ${cfg.horaFim}). Continua sozinho no horário.`); continue; }
        if ((await contadorHoje()) >= cfg.limiteDia) { await esperar(5 * 60000, `Limite de ${cfg.limiteDia} envios por dia atingido. Continua amanhã.`); continue; }
        if (cfg.lote > 0 && (c.noLote || 0) >= cfg.lote) {
          await esperar(cfg.pausaLote * 60000, `Pausa de segurança de ${cfg.pausaLote} min (a cada ${cfg.lote} envios).`);
          if (c.status !== 'rodando') break;
          c.noLote = 0;
          await salvarCampanha();
          continue;
        }
        if (cfg.evitarDias > 0) {
          const h = await historico();
          if (h[item.telefone] && Date.now() - h[item.telefone] < cfg.evitarDias * 864e5) {
            item.status = 'pulado';
            item.erro = `recebeu disparo há menos de ${cfg.evitarDias} dia(s)`;
            await salvarCampanha();
            render();
            continue;
          }
        }
        item.status = 'enviando';
        st.atual = item;
        render();
        const r = await enviarUm(item);
        item.em = Date.now();
        if (r && r.ok) {
          item.status = 'enviado';
          item.erro = '';
          c.noLote = (c.noLote || 0) + 1;
          await somarHoje();
          await marcarHistorico(item.telefone);
        } else {
          item.status = 'erro';
          item.erro = (r && r.error) || 'não enviado';
        }
        st.atual = null;
        await salvarCampanha();
        render();
        if (c.status === 'rodando' && c.contatos.some(x => x.status === 'pendente')) {
          await esperar(sorteio(cfg.intervaloMin, cfg.intervaloMax) * 1000, 'Próximo envio em');
        }
      }
      if (st.campanha && st.campanha.status === 'concluido') {
        st.tela = 'fim';
        st.campanha.fim = Date.now();
      }
      // "parar" devolve quem estava enviando para a fila
      for (const x of (st.campanha?.contatos || [])) if (x.status === 'enviando') x.status = 'pendente';
      await salvarCampanha();
    } finally {
      rodandoLoop = false;
      render();
    }
  }

  async function iniciar() {
    if (!st.contatos.length) { st.erro = 'Monte a lista primeiro (etiqueta ou planilha).'; return render(); }
    if (!st.mensagem.trim() && !st.anexos.length) { st.erro = 'Escreva a mensagem ou anexe um arquivo.'; return render(); }
    const cfg = normalizarCfg(st.cfg);
    st.cfg = cfg;
    await chrome.storage.local.set({ [CHAVE_CFG]: cfg, [CHAVE_ANEXOS]: st.anexos }).catch(() => {});
    st.campanha = {
      id: uuid(),
      criada: Date.now(),
      origem: st.fonte === 'etiqueta' ? `Etiqueta: ${(st.etiquetas || []).filter(e => st.marcadas[e.id]).map(e => e.nome).join(', ')}` : 'Planilha',
      mensagem: st.mensagem,
      cfg,
      noLote: 0,
      status: 'pausado',
      contatos: st.contatos.map(c => ({ ...c, status: 'pendente', erro: '', envioId: uuid() })),
    };
    st.tela = 'rodando';
    st.erro = ''; st.aviso = '';
    await salvarCampanha();
    rodar();
  }

  function normalizarCfg(c) {
    const n = (v, min, max, pad) => {
      const x = Number(v);
      return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : pad;
    };
    const out = {
      intervaloMin: n(c.intervaloMin, 20, 3600, CFG_PADRAO.intervaloMin),
      intervaloMax: n(c.intervaloMax, 20, 3600, CFG_PADRAO.intervaloMax),
      lote: n(c.lote, 0, 500, CFG_PADRAO.lote),
      pausaLote: n(c.pausaLote, 1, 600, CFG_PADRAO.pausaLote),
      limiteDia: n(c.limiteDia, 1, 1000, CFG_PADRAO.limiteDia),
      horaIni: /^\d{2}:\d{2}$/.test(c.horaIni) ? c.horaIni : CFG_PADRAO.horaIni,
      horaFim: /^\d{2}:\d{2}$/.test(c.horaFim) ? c.horaFim : CFG_PADRAO.horaFim,
      evitarDias: n(c.evitarDias, 0, 90, CFG_PADRAO.evitarDias),
    };
    if (out.intervaloMax < out.intervaloMin) out.intervaloMax = out.intervaloMin;
    return out;
  }

  function contagem(c) {
    const t = { total: 0, enviado: 0, erro: 0, pulado: 0, pendente: 0 };
    for (const x of c?.contatos || []) {
      t.total++;
      if (x.status === 'enviado') t.enviado++;
      else if (x.status === 'erro') t.erro++;
      else if (x.status === 'pulado') t.pulado++;
      else t.pendente++;
    }
    return t;
  }

  function baixarRelatorio() {
    const c = st.campanha;
    if (!c) return;
    const linhas = [['Nome', 'Telefone', 'Situação', 'Motivo', 'Quando'].join(';')];
    for (const x of c.contatos) {
      linhas.push([x.nome, telBonito(x.telefone), x.status, x.erro || '', x.em ? new Date(x.em).toLocaleString('pt-BR') : ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    }
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `disparo-${new Date(c.criada).toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function novaCampanha() {
    if (st.campanha && st.campanha.status === 'rodando') return;
    st.campanha = null;
    st.contatos = [];
    st.tela = 'novo';
    st.erro = ''; st.aviso = '';
    await chrome.storage.local.remove([CHAVE]).catch(() => {});
    render();
    listarEtiquetas();
  }

  // ---------- tela ----------
  function estilos() {
    if (document.getElementById('is-dsp-style')) return;
    const css = document.createElement('style');
    css.id = 'is-dsp-style';
    css.textContent = `
      #is-dsp-botao{position:fixed;left:14px;bottom:60px;z-index:10002;display:flex;align-items:center;gap:6px;padding:9px 14px;border:none;border-radius:999px;
        background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font:700 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;cursor:pointer;
        box-shadow:0 6px 18px rgba(29,78,216,.35)}
      #is-dsp-botao:hover{filter:brightness(1.08)}
      #is-dsp-botao .dsp-ponto{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 3px rgba(74,222,128,.35)}
      #is-dsp{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:520px;max-width:calc(100vw - 24px);max-height:92vh;z-index:10004;
        display:flex;flex-direction:column;overflow:hidden;border-radius:14px;
        background:var(--inmovya-background,#fff);color:var(--inmovya-text,#111b21);border:1px solid var(--inmovya-border,#d1d7db);
        box-shadow:0 18px 50px rgba(0,0,0,.35);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
      #is-dsp *{box-sizing:border-box}
      #is-dsp .dsp-top{padding:14px 16px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;display:flex;align-items:center;gap:10px;cursor:move;user-select:none}
      #is-dsp .dsp-top h2{margin:0;font-size:16px;flex:1;letter-spacing:.3px}
      #is-dsp .dsp-x{background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px}
      #is-dsp .dsp-corpo{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:14px}
      #is-dsp .dsp-sec{display:flex;flex-direction:column;gap:8px}
      #is-dsp .dsp-tit{font-weight:800;font-size:13px;display:flex;align-items:center;gap:6px}
      #is-dsp .dsp-num{width:20px;height:20px;border-radius:50%;background:#2563eb;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px}
      #is-dsp .dsp-btn{border:none;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer;font-size:13px}
      #is-dsp .dsp-btn:disabled{opacity:.5;cursor:default}
      #is-dsp .dsp-pri{background:#2563eb;color:#fff}
      #is-dsp .dsp-ver{background:#0a8f4e;color:#fff}
      #is-dsp .dsp-perigo{background:#c62838;color:#fff}
      #is-dsp .dsp-sec2{background:var(--inmovya-surface,#f0f2f5);color:var(--inmovya-text,#111b21);border:1px solid var(--inmovya-border,#d1d7db)}
      #is-dsp .dsp-abas{display:flex;gap:6px}
      #is-dsp .dsp-aba{flex:1;padding:8px;border-radius:8px;border:2px solid var(--inmovya-border,#d1d7db);background:transparent;color:inherit;font-weight:700;cursor:pointer}
      #is-dsp .dsp-aba.on{border-color:#2563eb;background:rgba(37,99,235,.08);color:#1d4ed8}
      #is-dsp .dsp-ets{display:flex;flex-direction:column;gap:4px;max-height:170px;overflow-y:auto;border:1px solid var(--inmovya-border,#d1d7db);border-radius:8px;padding:6px}
      #is-dsp .dsp-et{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer}
      #is-dsp .dsp-et:hover{background:var(--inmovya-hover,#f5f6f6)}
      #is-dsp .dsp-et input{width:auto;margin:0}
      #is-dsp .dsp-bola{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
      #is-dsp textarea,#is-dsp input,#is-dsp select{width:100%;border:1px solid var(--inmovya-border,#d1d7db);border-radius:8px;padding:8px;font:inherit;background:var(--inmovya-background,#fff);color:inherit}
      #is-dsp .dsp-grade{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #is-dsp .dsp-grade label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600}
      #is-dsp .dsp-mini{font-size:11px;color:var(--inmovya-text-secondary,#667781)}
      #is-dsp .dsp-ok{padding:8px 10px;border-radius:8px;background:#e8f6ee;color:#0a6b3a;font-size:12px}
      #is-dsp .dsp-erro{padding:8px 10px;border-radius:8px;background:#fdecee;color:#a8212f;font-size:12px}
      #is-dsp .dsp-alerta{padding:8px 10px;border-radius:8px;background:#fff7e6;color:#7a4b00;font-size:12px}
      #is-dsp .dsp-previa{white-space:pre-wrap;background:#d9fdd3;color:#111b21;border-radius:8px;padding:8px 10px;font-size:13px}
      #is-dsp .dsp-anexo{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--inmovya-border,#d1d7db);border-radius:8px}
      #is-dsp .dsp-anexo span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #is-dsp .dsp-placar{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
      #is-dsp .dsp-placar div{padding:8px;border-radius:8px;background:var(--inmovya-surface,#f0f2f5);text-align:center}
      #is-dsp .dsp-placar b{display:block;font-size:18px}
      #is-dsp .dsp-placar span{font-size:11px;color:var(--inmovya-text-secondary,#667781)}
      #is-dsp .dsp-barra{height:8px;border-radius:4px;background:var(--inmovya-surface,#f0f2f5);overflow:hidden}
      #is-dsp .dsp-barra i{display:block;height:100%;background:#2563eb}
      #is-dsp .dsp-log{display:flex;flex-direction:column;gap:2px;max-height:200px;overflow-y:auto;font-size:12px}
      #is-dsp .dsp-log div{display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--inmovya-border,#eef0f2)}
      #is-dsp .dsp-log b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
      #is-dsp .dsp-rodape{padding:12px 16px;border-top:1px solid var(--inmovya-border,#d1d7db);display:flex;gap:8px}
      #is-dsp .dsp-rodape .dsp-btn{flex:1;padding:12px;font-size:14px}
      #is-dsp .dsp-contagem{font-size:22px;font-weight:800;text-align:center;letter-spacing:.5px}
    `;
    document.head.appendChild(css);
  }

  // aparece só se estiver ligado em Configurações do Inmovya (ou com um disparo rodando)
  let ligado = false;
  async function lerLigado() {
    try {
      const d = await chrome.storage.local.get('ferramentasWA');
      ligado = !!(d.ferramentasWA && d.ferramentasWA.disparo);
    } catch (_) { ligado = false; }
    if (!ligado && !(st.campanha && st.campanha.status === 'rodando') && st.aberto) fechar();
    botao();
  }

  function botao() {
    let b = document.getElementById('is-dsp-botao');
    if (!ligado && !(st.campanha && st.campanha.status === 'rodando')) {
      b?.remove();
      return;
    }
    if (!b) {
      b = document.createElement('button');
      b.id = 'is-dsp-botao';
      b.type = 'button';
      b.title = 'Disparo de mensagens do Inmovya Scale';
      b.addEventListener('click', () => (st.aberto ? fechar() : abrir()));
      document.body.appendChild(b);
    }
    const ativo = st.campanha && st.campanha.status === 'rodando';
    const html = `${ativo ? '<span class="dsp-ponto"></span>' : ''}📣 Disparo${ativo ? ` ${contagem(st.campanha).enviado}/${contagem(st.campanha).total}` : ''}`;
    if (b.innerHTML !== html) b.innerHTML = html;
  }

  async function abrir() {
    st.aberto = true;
    if (!st.campanha) await carregar();
    render();
    if (st.tela === 'novo') listarEtiquetas();
  }
  function fechar() {
    st.aberto = false;
    document.getElementById('is-dsp')?.remove();
  }

  const avisos = () => `${st.erro ? `<div class="dsp-erro">${esc(st.erro)}</div>` : ''}${st.aviso ? `<div class="dsp-ok">${esc(st.aviso)}</div>` : ''}`;

  function htmlNovo() {
    const cfg = st.cfg;
    const comb = combinacoes(st.mensagem);
    const partes = st.mensagem.trim() ? st.mensagem.split(/^\s*===\s*$/m).length : 0;
    const tempoMedio = ((cfg.intervaloMin + cfg.intervaloMax) / 2) * Math.max(0, st.contatos.length - 1);
    const pausas = cfg.lote > 0 ? Math.floor(Math.max(0, st.contatos.length - 1) / cfg.lote) * cfg.pausaLote * 60 : 0;
    const etiquetas = st.etiquetas === undefined
      ? '<div class="dsp-mini">Carregando etiquetas…</div>'
      : st.etiquetas === null
      ? '<div class="dsp-alerta">Não consegui ler as etiquetas deste WhatsApp. Espere ele carregar e clique em Atualizar, ou use a planilha.</div>'
      : st.etiquetas.length
        ? `<div class="dsp-ets">${st.etiquetas.map(e => `<label class="dsp-et"><input type="checkbox" data-et="${esc(e.id)}" ${st.marcadas[e.id] ? 'checked' : ''}><span class="dsp-bola" style="background:${esc(e.cor || '#8696a0')}"></span><span style="flex:1">${esc(e.nome)}</span><span class="dsp-mini">${e.total ?? ''}</span></label>`).join('')}</div>`
        : '<div class="dsp-mini">Este WhatsApp não tem etiquetas.</div>';
    return `
      ${avisos()}
      <div class="dsp-sec">
        <div class="dsp-tit"><span class="dsp-num">1</span> Para quem</div>
        <div class="dsp-abas">
          <button type="button" class="dsp-aba ${st.fonte === 'etiqueta' ? 'on' : ''}" data-fonte="etiqueta">🏷️ Etiqueta do WhatsApp</button>
          <button type="button" class="dsp-aba ${st.fonte === 'planilha' ? 'on' : ''}" data-fonte="planilha">📄 Planilha</button>
        </div>
        ${st.fonte === 'etiqueta' ? `
          ${etiquetas}
          <div style="display:flex;gap:6px"><button type="button" class="dsp-btn dsp-pri" data-carregar-et ${st.ocupado ? 'disabled' : ''} style="flex:1">${st.ocupado ? 'Lendo contatos…' : 'Usar estas etiquetas'}</button>
          <button type="button" class="dsp-btn dsp-sec2" data-atualizar-et>Atualizar</button></div>
        ` : `
          <textarea id="dsp-planilha" rows="5" placeholder="Uma pessoa por linha:&#10;Maria Silva;11999998888&#10;João;(11) 98888-7777&#10;ou só o telefone">${esc(st.textoPlanilha)}</textarea>
          <div style="display:flex;gap:6px"><button type="button" class="dsp-btn dsp-pri" data-carregar-pl style="flex:1">Usar esta lista</button>
          <button type="button" class="dsp-btn dsp-sec2" data-csv>Abrir CSV</button></div>
          <div class="dsp-mini">Do Excel/Google Planilhas: copie as colunas Nome e Telefone e cole aqui, ou salve como CSV.</div>
        `}
        ${st.contatos.length ? `<div class="dsp-mini"><b>${st.contatos.length}</b> na lista: ${st.contatos.slice(0, 4).map(c => esc(c.nome || telBonito(c.telefone))).join(', ')}${st.contatos.length > 4 ? '…' : ''}</div>` : ''}
      </div>

      <div class="dsp-sec">
        <div class="dsp-tit"><span class="dsp-num">2</span> Mensagem</div>
        <textarea id="dsp-msg" rows="6" placeholder="{Oi|Olá|Oii} {{nome}}, {{saudacao}}! Tudo bem?&#10;===&#10;Separei uma oportunidade que combina com você…">${esc(st.mensagem)}</textarea>
        <div class="dsp-mini">{{nome}} = primeiro nome · {{saudacao}} = Bom dia/Boa tarde/Boa noite · {Oi|Olá} = cada um recebe uma opção · uma linha só com === separa em várias mensagens</div>
        ${st.mensagem.trim()
          ? comb > 1
            ? `<div class="dsp-ok">✓ Variação ativa: ${comb.toLocaleString('pt-BR')} combinações${partes > 1 ? ` · ${partes} mensagens` : ''}</div>`
            : '<div class="dsp-alerta">Sem variação: todos recebem o mesmo texto, o que aumenta o risco de bloqueio. Use {Oi|Olá|Oii}.</div>'
          : ''}
        <div style="display:flex;gap:6px;align-items:center"><button type="button" class="dsp-btn dsp-sec2" data-previa>👁️ Ver prévia</button><span class="dsp-mini">com ${esc(st.contatos[0]?.nome || 'Maria Silva')}</span></div>
        ${st.previa ? `<div class="dsp-previa">${esc(st.previa)}</div>` : ''}
      </div>

      <div class="dsp-sec">
        <div class="dsp-tit"><span class="dsp-num">3</span> Anexos <span class="dsp-mini" style="font-weight:400">(opcional · vão depois da mensagem)</span></div>
        ${st.anexos.map(a => `<div class="dsp-anexo"><span>${(a.type || '').startsWith('image/') ? '🖼️' : (a.type || '').includes('pdf') ? '📄' : '📎'} ${esc(a.name)}</span>
          ${(a.type || '').startsWith('image/') ? `<label class="dsp-mini" style="display:flex;align-items:center;gap:4px"><input type="checkbox" data-legenda="${esc(a.id)}" ${a.legenda ? 'checked' : ''} style="width:auto"> texto como legenda</label>` : ''}
          <button type="button" class="dsp-btn dsp-sec2" data-tirar-anexo="${esc(a.id)}" title="Tirar">✕</button></div>`).join('')}
        <button type="button" class="dsp-btn dsp-sec2" data-anexar>📎 Anexar PDF ou imagem</button>
      </div>

      <div class="dsp-sec">
        <div class="dsp-tit"><span class="dsp-num">4</span> Proteção contra bloqueio</div>
        <div class="dsp-grade">
          <label>Intervalo mínimo (segundos)<input type="number" min="20" data-cfg="intervaloMin" value="${cfg.intervaloMin}"></label>
          <label>Intervalo máximo (segundos)<input type="number" min="20" data-cfg="intervaloMax" value="${cfg.intervaloMax}"></label>
          <label>Pausar a cada (envios)<input type="number" min="0" data-cfg="lote" value="${cfg.lote}"></label>
          <label>Pausa de (minutos)<input type="number" min="1" data-cfg="pausaLote" value="${cfg.pausaLote}"></label>
          <label>Limite por dia<input type="number" min="1" data-cfg="limiteDia" value="${cfg.limiteDia}"></label>
          <label>Não repetir por (dias)<input type="number" min="0" data-cfg="evitarDias" value="${cfg.evitarDias}"></label>
          <label>Enviar a partir de<input type="time" data-cfg="horaIni" value="${esc(cfg.horaIni)}"></label>
          <label>Até<input type="time" data-cfg="horaFim" value="${esc(cfg.horaFim)}"></label>
        </div>
        ${cfg.intervaloMin < 60 ? '<div class="dsp-alerta">Intervalo abaixo de 1 minuto aumenta muito o risco de bloqueio.</div>' : ''}
        ${st.contatos.length ? `<div class="dsp-mini">Tempo estimado: <b>${mmss((tempoMedio + pausas) * 1000)}</b> para ${st.contatos.length} contato(s)${st.contatos.length > cfg.limiteDia ? `, em ${Math.ceil(st.contatos.length / cfg.limiteDia)} dias (limite de ${cfg.limiteDia}/dia)` : ''}.</div>` : ''}
      </div>`;
  }

  function htmlRodando() {
    const c = st.campanha;
    const t = contagem(c);
    const pct = t.total ? Math.round(((t.enviado + t.erro + t.pulado) / t.total) * 100) : 0;
    const ultimos = c.contatos.filter(x => x.status !== 'pendente').sort((a, b) => (b.em || 0) - (a.em || 0)).slice(0, 40);
    const marca = { enviado: '✅', erro: '⚠️', pulado: '⏭️', enviando: '⏳' };
    return `
      ${avisos()}
      <div class="dsp-mini">${esc(c.origem)} · criado em ${new Date(c.criada).toLocaleString('pt-BR')}</div>
      <div class="dsp-placar">
        <div><b>${t.enviado}</b><span>enviados</span></div>
        <div><b>${t.pendente}</b><span>na fila</span></div>
        <div><b>${t.erro}</b><span>com erro</span></div>
        <div><b>${t.pulado}</b><span>pulados</span></div>
      </div>
      <div class="dsp-barra"><i style="width:${pct}%"></i></div>
      ${c.status === 'rodando'
        ? st.atual
          ? `<div class="dsp-ok">⏳ Enviando para <b>${esc(st.atual.nome || telBonito(st.atual.telefone))}</b>…</div>`
          : st.espera
            ? `<div class="dsp-sec"><div class="dsp-mini" style="text-align:center">${esc(st.espera)}</div>${st.proximoEm ? `<div class="dsp-contagem" id="dsp-contagem">${mmss(st.proximoEm - Date.now())}</div>` : ''}</div>`
            : '<div class="dsp-mini">Preparando…</div>'
        : `<div class="dsp-alerta">⏸️ Pausado. ${t.pendente ? `Faltam ${t.pendente}.` : ''} Deixe o WhatsApp Web aberto e clique em Continuar.</div>`}
      <div class="dsp-mini">Deixe esta aba do WhatsApp aberta. Cada envio abre uma janelinha no canto da tela e fecha sozinha. Se chegar um lead novo, o 1º contato passa na frente.</div>
      ${ultimos.length ? `<div class="dsp-log">${ultimos.map(x => `<div><span>${marca[x.status] || ''}</span><b>${esc(x.nome || telBonito(x.telefone))}</b><span class="dsp-mini">${esc(x.status === 'enviado' ? (x.em ? new Date(x.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '') : x.erro || '')}</span></div>`).join('')}</div>` : ''}`;
  }

  function htmlFim() {
    const c = st.campanha;
    const t = contagem(c);
    return `
      <div class="dsp-ok" style="font-size:14px">✅ Disparo concluído: <b>${t.enviado}</b> enviado(s)${t.erro ? `, ${t.erro} com erro` : ''}${t.pulado ? `, ${t.pulado} pulado(s)` : ''}.</div>
      <div class="dsp-mini">${esc(c.origem)}</div>
      ${t.erro ? `<div class="dsp-sec"><div class="dsp-tit">Com erro</div><div class="dsp-log">${c.contatos.filter(x => x.status === 'erro').map(x => `<div><span>⚠️</span><b>${esc(x.nome || telBonito(x.telefone))}</b><span class="dsp-mini">${esc(x.erro)}</span></div>`).join('')}</div>
        <button type="button" class="dsp-btn dsp-sec2" data-reenviar-erros>Tentar de novo os com erro</button></div>` : ''}`;
  }

  function render() {
    botao();
    if (!st.aberto) return;
    estilos();
    let raiz = document.getElementById('is-dsp');
    if (!raiz) {
      raiz = document.createElement('div');
      raiz.id = 'is-dsp';
      document.body.appendChild(raiz);
      raiz.addEventListener('click', aoClicar);
      raiz.addEventListener('input', aoDigitar);
      raiz.addEventListener('change', aoMudar);
      raiz.addEventListener('keydown', ev => ev.stopPropagation()); // o WhatsApp não rouba o teclado
      ativarArrastar(raiz);
    }
    const rolagem = raiz.querySelector('.dsp-corpo')?.scrollTop || 0;
    const corpo = st.tela === 'fim' ? htmlFim() : st.tela === 'rodando' ? htmlRodando() : htmlNovo();
    const c = st.campanha;
    let rodape = '';
    if (st.tela === 'novo') rodape = `<button type="button" class="dsp-btn dsp-ver" data-iniciar ${st.contatos.length ? '' : 'disabled'}>▶ Iniciar disparo para ${st.contatos.length} contato(s)</button>`;
    else if (st.tela === 'rodando') rodape = c.status === 'rodando'
      ? `<button type="button" class="dsp-btn dsp-sec2" data-pausar>⏸ Pausar</button><button type="button" class="dsp-btn dsp-perigo" data-parar>⏹ Encerrar</button>`
      : `<button type="button" class="dsp-btn dsp-ver" data-continuar ${rodandoLoop ? 'disabled' : ''}>▶ Continuar</button><button type="button" class="dsp-btn dsp-sec2" data-relatorio>⬇ Relatório</button><button type="button" class="dsp-btn dsp-perigo" data-parar>⏹ Encerrar</button>`;
    else rodape = `<button type="button" class="dsp-btn dsp-sec2" data-relatorio>⬇ Baixar relatório</button><button type="button" class="dsp-btn dsp-pri" data-nova>Novo disparo</button>`;
    // não redesenha por cima de um campo que está sendo digitado
    const foco = document.activeElement && raiz.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName) ? document.activeElement : null;
    if (foco && st.tela === 'novo' && !raiz.dataset.forcar) return;
    delete raiz.dataset.forcar;
    raiz.innerHTML = `
      <div class="dsp-top"><h2>📣 DISPARO</h2><button type="button" class="dsp-x" data-fechar title="Fechar (o disparo continua)">✕</button></div>
      <div class="dsp-corpo">${corpo}</div>
      <div class="dsp-rodape">${rodape}</div>`;
    raiz.querySelector('.dsp-corpo').scrollTop = rolagem;
  }
  const redesenhar = () => {
    const raiz = document.getElementById('is-dsp');
    if (raiz) raiz.dataset.forcar = '1';
    render();
  };

  function atualizarContagem() {
    botao();
    const el = document.getElementById('dsp-contagem');
    if (el && st.proximoEm) el.textContent = mmss(st.proximoEm - Date.now());
    else if (st.aberto && st.tela === 'rodando' && !document.getElementById('dsp-contagem') && st.proximoEm) render();
  }

  function ativarArrastar(raiz) {
    raiz.addEventListener('mousedown', ev => {
      const topo = ev.target.closest('.dsp-top');
      if (!topo || ev.target.closest('button')) return;
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

  function aoDigitar(ev) {
    const el = ev.target;
    if (el.id === 'dsp-msg') { st.mensagem = el.value; st.previa = ''; }
    else if (el.id === 'dsp-planilha') st.textoPlanilha = el.value;
    else if (el.dataset.cfg) st.cfg[el.dataset.cfg] = el.type === 'time' ? el.value : Number(el.value);
  }
  function aoMudar(ev) {
    const el = ev.target;
    if (el.dataset.et) { st.marcadas[el.dataset.et] = el.checked; return; }
    if (el.dataset.legenda) {
      const a = st.anexos.find(x => x.id === el.dataset.legenda);
      if (a) a.legenda = el.checked;
      return;
    }
    if (el.dataset.cfg || el.id === 'dsp-msg') redesenhar(); // atualiza avisos e estimativa ao sair do campo
  }

  async function aoClicar(ev) {
    const alvo = ev.target.closest('button');
    if (!alvo) return;
    const d = alvo.dataset;
    if ('fechar' in d) return fechar();
    st.erro = ''; st.aviso = '';
    if (d.fonte) { st.fonte = d.fonte; return redesenhar(); }
    if ('atualizarEt' in d) { st.etiquetas = undefined; redesenhar(); return listarEtiquetas(); }
    if ('carregarEt' in d) return carregarDasEtiquetas();
    if ('carregarPl' in d) return carregarDaPlanilha();
    if ('csv' in d) return lerCsv();
    if ('anexar' in d) return escolherAnexos();
    if (d.tirarAnexo) { st.anexos = st.anexos.filter(a => a.id !== d.tirarAnexo); return redesenhar(); }
    if ('previa' in d) {
      const exemplo = st.contatos[0] || { nome: 'Maria Silva' };
      st.previa = st.mensagem.trim() ? montarTexto(st.mensagem, exemplo).replace(/^\s*===\s*$/gm, '— — —') : '';
      if (!st.previa) st.erro = 'Escreva a mensagem primeiro.';
      return redesenhar();
    }
    if ('iniciar' in d) return iniciar();
    if ('pausar' in d) { if (st.campanha) { st.campanha.status = 'pausado'; await salvarCampanha(); } return redesenhar(); }
    if ('continuar' in d) { st.tela = 'rodando'; return rodar(); }
    if ('parar' in d) {
      if (!st.campanha) return;
      st.campanha.status = 'concluido';
      for (const x of st.campanha.contatos) if (x.status === 'pendente' || x.status === 'enviando') { x.status = 'pulado'; x.erro = 'disparo encerrado'; }
      st.tela = 'fim';
      await salvarCampanha();
      return redesenhar();
    }
    if ('reenviar-erros' in d || 'reenviarErros' in d) {
      for (const x of st.campanha.contatos) if (x.status === 'erro') { x.status = 'pendente'; x.erro = ''; x.envioId = uuid(); }
      st.campanha.status = 'pausado';
      st.tela = 'rodando';
      await salvarCampanha();
      return rodar();
    }
    if ('relatorio' in d) return baixarRelatorio();
    if ('nova' in d) return novaCampanha();
  }

  function iniciarModulo() {
    estilos();
    carregar().then(() => lerLigado());
    try {
      chrome.storage.onChanged.addListener((mud, area) => { if (area === 'local' && mud.ferramentasWA) lerLigado(); });
    } catch (_) { /* extensão recarregada */ }
    setInterval(botao, 5000); // o WhatsApp às vezes refaz o <body>
  }

  return { iniciar: iniciarModulo, _st: st, _lerPlanilha: lerPlanilha, _montarTexto: montarTexto, _combinacoes: combinacoes, _telInternacional: telInternacional };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.IS.Disparo.iniciar());
else window.IS.Disparo.iniciar();
