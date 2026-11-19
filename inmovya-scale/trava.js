// trava.js — TRAVA DE ENGAJAMENTO (roda no service worker, junto com o background.js).
// Protege o número de bloqueio por excesso de mensagens SEM RESPOSTA. Não burla o WhatsApp: só freia você.
//
// Registro: cada envio das ESTEIRAS (Inmovya) e do DISPARO (Scale) vira uma linha
//   { t: telefone, o: origem, e: quando enviou, r: quando respondeu (0 = ainda não), j: janela em min }
//   guardada neste Chrome (chrome.storage.local) por 30 dias. O 1º contato NÃO entra aqui.
// Trava 1 (termômetro, por esteira/disparo, medido a cada N envios do dia):
//   só conta mensagem enviada há mais de 1 h (janela). ≥40% respondeu = normal; 20–40% = intervalo dobrado;
//   <20% = aquela esteira/disparo pausa até amanhã. Menos de N mensagens "maduras" = "medindo…".
// Trava 2: soma de ignorados do dia (todas as esteiras + disparo) chegou no limite (15) = pausa TUDO até amanhã.
// Trava 3 (alarme): aviso de limite/restrição do WhatsApp, erro de envio ou 5 mensagens seguidas com 1 tracinho
//   há mais de 10 min = pausa TUDO na hora (inclusive o 1º contato) até você clicar em "Retomar".
// Modo de teste: as mesmas contas, em chaves separadas (travaLogTeste/travaEstadoTeste). Não envia nada.

const TRAVA_PADRAO = { ligada: true, verde: 40, amarelo: 20, cada: 10, janelaMin: 60 };
const TRAVA_LIMITE_PADRAO = 15;
const TRAVA_DIAS = 30;
const TRAVA_ALARME = 'trava-conferir';
const TRAVA_TICK_MIN = 10; // mensagem com 1 tracinho há mais de 10 min
const TRAVA_TICK_SEGUIDAS = 5;

const travaChaves = teste => (teste ? { log: 'travaLogTeste', est: 'travaEstadoTeste' } : { log: 'travaLog', est: 'travaEstado' });
const travaDig = t => String(t || '').replace(/\D/g, '');
const travaUlt8 = t => travaDig(t).slice(-8);
const travaInicioDia = (agora = Date.now()) => { const d = new Date(agora); d.setHours(0, 0, 0, 0); return d.getTime(); };
const travaMeiaNoite = (agora = Date.now()) => travaInicioDia(agora) + 864e5;

function travaCfg(c) {
  const n = (v, min, max, pad) => { const x = Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : pad; };
  const o = c || {};
  const cfg = {
    ligada: o.ligada !== false,
    verde: n(o.verde, 1, 100, TRAVA_PADRAO.verde),
    amarelo: n(o.amarelo, 0, 100, TRAVA_PADRAO.amarelo),
    cada: n(o.cada, 3, 100, TRAVA_PADRAO.cada),
    janelaMin: n(o.janelaMin, 10, 24 * 60, TRAVA_PADRAO.janelaMin),
  };
  if (cfg.amarelo > cfg.verde) cfg.amarelo = cfg.verde;
  return cfg;
}

const travaEstadoVazio = () => ({ pausas: {}, global: null, alarme: null, limiteDia: TRAVA_LIMITE_PADRAO, cfgs: {}, nomes: {}, aval: {} });

// uma operação por vez (o service worker recebe mensagens em paralelo)
let travaFila = Promise.resolve();
function travaVez(fn) {
  const p = travaFila.then(fn, fn);
  travaFila = p.catch(() => {});
  return p;
}

async function travaLer(teste) {
  const k = travaChaves(teste);
  const d = await chrome.storage.local.get([k.log, k.est]);
  const est = { ...travaEstadoVazio(), ...(d[k.est] || {}) };
  const corte = Date.now() - TRAVA_DIAS * 864e5;
  const log = (Array.isArray(d[k.log]) ? d[k.log] : []).filter(x => x && x.e > corte);
  // pausas vencidas (meia-noite) saem sozinhas; o alarme não
  const agora = Date.now();
  if (est.global && est.global.ate && est.global.ate <= agora) est.global = null;
  for (const [o, p] of Object.entries(est.pausas || {})) if (!p || (p.ate && p.ate <= agora)) delete est.pausas[o];
  for (const [o, a] of Object.entries(est.aval || {})) if (!a || a.dia !== travaInicioDia()) delete est.aval[o];
  return { log, est };
}
async function travaSalvar(teste, log, est) {
  const k = travaChaves(teste);
  await chrome.storage.local.set({ [k.log]: log.slice(-5000), [k.est]: est });
}

/** Números de uma origem (ou de todas) hoje. */
function travaNumeros(log, origem, agora = Date.now()) {
  const ini = travaInicioDia(agora);
  const hoje = log.filter(x => x.e >= ini && (!origem || x.o === origem));
  const maduras = hoje.filter(x => x.e <= agora - (x.j || 60) * 60000);
  const responderam = maduras.filter(x => x.r).length;
  return {
    enviados: hoje.length,
    respondeuTotal: hoje.filter(x => x.r).length,
    maduras: maduras.length,
    responderam,
    ignoraram: maduras.length - responderam,
    taxa: maduras.length ? Math.round((responderam / maduras.length) * 100) : null,
  };
}

function travaClassificar(num, cfg) {
  if (num.maduras < cfg.cada) return 'medindo';
  if (num.taxa >= cfg.verde) return 'verde';
  if (num.taxa >= cfg.amarelo) return 'amarelo';
  return 'vermelho';
}

const travaHora = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

async function travaNotificar(titulo, texto) {
  try {
    await chrome.notifications.create(`trava-${Date.now()}`, { type: 'basic', iconUrl: 'icons/icon128.png', title: titulo, message: texto, priority: 2 });
  } catch (_) { /* sem permissão de notificação: o aviso aparece no painel e no Inmovya */ }
}

/** Confere a Trava 2 (soma de ignorados do dia). Muda o estado; devolve true se acabou de pausar. */
function travaConferirLimite(log, est, agora = Date.now()) {
  if (est.global) return false;
  const num = travaNumeros(log, null, agora);
  // você clicou em "Retomar mesmo assim" hoje: só pausa de novo se mais 5 pessoas ignorarem
  const lib = est.liberado && est.liberado.dia === travaInicioDia(agora) ? est.liberado.ign + 5 : 0;
  if (num.ignoraram >= Math.max(est.limiteDia || TRAVA_LIMITE_PADRAO, lib)) {
    est.global = { ate: travaMeiaNoite(agora), motivo: `Pausado até amanhã: ${num.ignoraram} pessoas ignoraram mensagens hoje (limite de ${est.limiteDia}).`, em: agora };
    return true;
  }
  return false;
}

/**
 * Pode enviar agora? Ordem: alarme → pausa geral → pausa da origem → limite do dia → termômetro.
 * Devolve { pode, fator (1 ou 2), motivo, status, numeros }.
 */
async function travaPode({ origem, nome, cfg, teste, primeiroContato }) {
  return travaVez(async () => {
    const { log, est } = await travaLer(teste);
    const agora = Date.now();
    const c = travaCfg(cfg);
    if (origem) { est.cfgs[origem] = c; if (nome) est.nomes[origem] = nome; }
    const num = origem ? travaNumeros(log, origem, agora) : null;
    const sai = async (r) => { await travaSalvar(teste, log, est); return { ...r, numeros: num, status: est.aval[origem]?.status || 'medindo' }; };

    if (est.alarme) return sai({ pode: false, motivo: est.alarme.motivo, tipo: 'alarme' });
    if (primeiroContato) return sai({ pode: true, fator: 1 }); // o 1º contato só respeita o alarme
    if (!origem) return sai({ pode: true, fator: 1 });
    if (est.global) return sai({ pode: false, motivo: est.global.motivo, tipo: 'global' });
    if (est.pausas[origem]) return sai({ pode: false, motivo: est.pausas[origem].motivo, tipo: 'origem' });
    if (travaConferirLimite(log, est, agora)) {
      if (!teste) await travaNotificar('Trava de engajamento: tudo pausado', est.global.motivo);
      return sai({ pode: false, motivo: est.global.motivo, tipo: 'global' });
    }
    if (!c.ligada) return sai({ pode: true, fator: 1, desligada: true });

    // termômetro: mede a cada N envios do dia (10, 20, 30…)
    const marco = Math.floor(num.enviados / c.cada) * c.cada;
    const anterior = est.aval[origem];
    if (marco > 0 && (!anterior || anterior.marco !== marco)) {
      const status = travaClassificar(num, c);
      est.aval[origem] = { dia: travaInicioDia(agora), marco, status, taxa: num.taxa, maduras: num.maduras, responderam: num.responderam, em: agora };
      if (status === 'vermelho') {
        const motivo = `Pausado até amanhã: só ${num.responderam} de ${num.maduras} responderam (${num.taxa}%).`;
        est.pausas[origem] = { ate: travaMeiaNoite(agora), motivo, em: agora };
        if (!teste) await travaNotificar(`Trava: ${est.nomes[origem] || origem} pausado`, motivo);
        return sai({ pode: false, motivo, tipo: 'origem' });
      }
    }
    const st = est.aval[origem]?.status || 'medindo';
    return sai({ pode: true, fator: st === 'amarelo' ? 2 : 1 });
  });
}

async function travaRegistrar({ telefone, origem, nome, cfg, teste, quando }) {
  const tel = travaDig(telefone);
  if (!origem || tel.length < 8) return { ok: false };
  return travaVez(async () => {
    const { log, est } = await travaLer(teste);
    const c = travaCfg(cfg || est.cfgs[origem]);
    est.cfgs[origem] = c;
    if (nome) est.nomes[origem] = nome;
    log.push({ t: tel, o: origem, e: quando || Date.now(), r: 0, j: c.janelaMin });
    await travaSalvar(teste, log, est);
    return { ok: true };
  });
}

/** Marca "respondeu" nos envios para esse telefone feitos antes da resposta. */
async function travaMarcarResposta(telefone, t, teste) {
  const k8 = travaUlt8(telefone);
  if (k8.length < 8) return 0;
  return travaVez(async () => {
    const { log, est } = await travaLer(teste);
    const quando = t || Date.now();
    let n = 0;
    for (const x of log) if (!x.r && travaUlt8(x.t) === k8 && x.e < quando) { x.r = quando; n++; }
    if (n) await travaSalvar(teste, log, est);
    return n;
  });
}

async function travaDispararAlarme(motivo, teste) {
  return travaVez(async () => {
    const { log, est } = await travaLer(teste);
    if (!est.alarme) {
      est.alarme = { motivo: `Pausado por segurança: ${motivo}. Confira o WhatsApp e clique em "Retomar" quando estiver tudo certo.`, em: Date.now() };
      await travaSalvar(teste, log, est);
      if (!teste) await travaNotificar('⚠️ Trava de engajamento: TUDO pausado', motivo);
    }
    return est.alarme;
  });
}

/** Erro de envio que conta para o alarme (número sem WhatsApp e "WhatsApp fechado" não contam). */
function travaErroConta(erro, semWhatsapp) {
  if (semWhatsapp) return false;
  const m = String(erro || '');
  if (!m) return false;
  return !/não tem WhatsApp|sem WhatsApp|não está aberto|não está conectado|recarregad|cancelad|parou|desligad|não respondeu a tempo da extensão/i.test(m);
}

async function travaStatus(teste) {
  return travaVez(async () => {
    const { log, est } = await travaLer(teste);
    const agora = Date.now();
    const origens = {};
    const ini = travaInicioDia(agora);
    const ids = new Set([...Object.keys(est.cfgs || {}), ...log.filter(x => x.e >= ini).map(x => x.o)]);
    for (const o of ids) {
      const cfg = travaCfg(est.cfgs[o]);
      const num = travaNumeros(log, o, agora);
      const aval = est.aval[o];
      origens[o] = {
        nome: est.nomes[o] || o,
        cfg,
        numeros: num,
        status: est.pausas[o] ? 'vermelho' : aval?.status || 'medindo',
        proximaMedicao: (Math.floor(num.enviados / cfg.cada) + 1) * cfg.cada,
        pausa: est.pausas[o] || null,
      };
    }
    await travaSalvar(teste, log, est);
    const geral = travaNumeros(log, null, agora);
    return { ok: true, teste: !!teste, alarme: est.alarme, global: est.global, limiteDia: est.limiteDia, ignoradosHoje: geral.ignoraram, geral, origens, agora };
  });
}

async function travaRetomar({ alvo, teste }) {
  return travaVez(async () => {
    const { log, est } = await travaLer(teste);
    if (!alvo || alvo === 'tudo') {
      if (est.global) est.liberado = { dia: travaInicioDia(), ign: travaNumeros(log, null).ignoraram };
      est.alarme = null; est.global = null; est.pausas = {};
    }
    else if (alvo === 'alarme') est.alarme = null;
    else if (alvo === 'global') {
      est.global = null;
      est.liberado = { dia: travaInicioDia(), ign: travaNumeros(log, null).ignoraram };
    }
    else delete est.pausas[alvo];
    // retomar uma origem pausada pelo termômetro: começa a medir de novo a partir do próximo marco
    if (alvo && alvo !== 'alarme' && alvo !== 'global' && alvo !== 'tudo' && est.aval[alvo]) est.aval[alvo].status = 'medindo';
    await travaSalvar(teste, log, est);
    return { ok: true };
  });
}

async function travaMudarCfg({ origem, nome, cfg, limiteDia, teste }) {
  return travaVez(async () => {
    const { log, est } = await travaLer(teste);
    if (origem && cfg) { est.cfgs[origem] = travaCfg(cfg); if (nome) est.nomes[origem] = nome; }
    if (limiteDia != null) {
      const n = Math.round(Number(limiteDia));
      if (Number.isFinite(n)) est.limiteDia = Math.min(500, Math.max(3, n));
    }
    await travaSalvar(teste, log, est);
    return { ok: true };
  });
}

// ---------- Modo de teste: simula envios, respostas, aviso e tracinho — sem enviar nada ----------
async function travaTeste({ op, origem, nome, qtd, responder }) {
  const o = origem || 'teste-esteira';
  const nm = nome || (o === 'teste-disparo' ? 'Disparo (teste)' : 'Esteira (teste)');
  const n = Math.max(1, Math.min(60, Number(qtd) || 10));
  const telTeste = () => `55119${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  // um envio "de mentira": passa pelas travas como de verdade, registra com horário de 2 h atrás (já maduro)
  // e, se sorteado, marca como respondido
  async function simularEnvio(origemX, nomeX, respondeu, i) {
    const cfg = (await travaLer(true)).est.cfgs[origemX];
    const pode = await travaPode({ origem: origemX, nome: nomeX, cfg, teste: true });
    if (!pode.pode) return pode;
    const quando = Date.now() - 2 * 3600 * 1000 + i * 1000;
    const tel = telTeste();
    await travaRegistrar({ telefone: tel, origem: origemX, nome: nomeX, cfg, teste: true, quando });
    if (respondeu) await travaMarcarResposta(tel, quando + 5 * 60000, true);
    return pode;
  }
  if (op === 'zerar') {
    const k = travaChaves(true);
    await chrome.storage.local.remove([k.log, k.est]);
    // o teste usa o mesmo limite do dia que você configurou
    const real = (await travaLer(false)).est;
    await travaSalvar(true, [], { ...travaEstadoVazio(), limiteDia: real.limiteDia || TRAVA_LIMITE_PADRAO });
    return travaStatus(true);
  }
  // cada cenário recomeça do zero a(s) origem(ns) de teste que usa, para o resultado ser só dele
  async function recomecar(origens) {
    await travaVez(async () => {
      const { log, est } = await travaLer(true);
      for (const x of origens) { delete est.pausas[x]; delete est.aval[x]; }
      est.global = null;
      await travaSalvar(true, log.filter(x => !origens.includes(x.o)), est);
    });
  }
  if (op === 'envios') {
    await recomecar([o]);
    // N envios em que "responder"% respondem; no fim confere de novo (é aí que o termômetro mede)
    const pct = Math.max(0, Math.min(100, Number(responder) || 0));
    const quantosResp = Math.round((n * pct) / 100);
    const registro = [];
    let bloqueio = null;
    for (let i = 0; i < n; i++) {
      // espalha as respostas ao longo dos envios
      const resp = Math.floor(((i + 1) * quantosResp) / n) > Math.floor((i * quantosResp) / n);
      const r = await simularEnvio(o, nm, resp, i);
      if (!r.pode) { bloqueio = r; break; }
      registro.push(r.fator || 1);
    }
    const depois = bloqueio || (await travaPode({ origem: o, nome: nm, cfg: (await travaLer(true)).est.cfgs[o], teste: true }));
    return { ...(await travaStatus(true)), simulados: registro.length, depois };
  }
  if (op === 'limite') {
    await recomecar(['teste-esteira', 'teste-disparo']);
    // vários envios em 2 origens, metade responde (o termômetro fica verde), até a soma de ignorados bater o limite
    let depois = null;
    let i = 0;
    for (; i < 120; i++) {
      const origemX = i % 2 ? 'teste-disparo' : 'teste-esteira';
      const r = await simularEnvio(origemX, origemX === 'teste-disparo' ? 'Disparo (teste)' : 'Esteira (teste)', i % 4 < 2, i);
      if (!r.pode) { depois = r; break; }
    }
    return { ...(await travaStatus(true)), simulados: i, depois };
  }
  if (op === 'aviso') await travaDispararAlarme('o WhatsApp mostrou um aviso de limite de mensagens (simulado)', true);
  else if (op === 'tracinho') await travaDispararAlarme(`${TRAVA_TICK_SEGUIDAS} mensagens seguidas com 1 tracinho (não entregues) há mais de ${TRAVA_TICK_MIN} min (simulado)`, true);
  else if (op === 'erro') await travaDispararAlarme('erro ao enviar mensagem (simulado)', true);
  if (op === 'tentar') {
    // tenta "enviar" agora: mostra se a trava deixaria (inclusive o 1º contato, que só para no alarme)
    const pc = await travaPode({ primeiroContato: true, teste: true });
    const normal = await travaPode({ origem: o, nome: nm, cfg: (await travaLer(true)).est.cfgs[o], teste: true });
    return { ...(await travaStatus(true)), depois: normal, primeiroContato: pc };
  }
  return travaStatus(true);
}

// ---------- Conferência periódica (a cada 3 min) no WhatsApp Web aberto ----------
// 1) quem respondeu (marca no registro, mesmo sem o Inmovya aberto)
// 2) as últimas 5 mensagens com mais de 10 min: todas com 1 tracinho (não entregues)? → alarme
// 3) limite do dia (Trava 2)
async function travaPerguntarWA(op, args) {
  const abas = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  for (const aba of abas) {
    const r = await new Promise(res => chrome.tabs.sendMessage(aba.id, { action: 'trava_wa', op, args }, x => res(chrome.runtime.lastError ? null : x)));
    if (r?.ok) return r.dados;
  }
  return null;
}

let travaConferindo = false;
async function travaConferir() {
  if (travaConferindo) return;
  travaConferindo = true;
  try {
    const { log, est } = await travaLer(false);
    const agora = Date.now();
    const ini = travaInicioDia(agora);
    const hoje = log.filter(x => x.e >= ini);
    if (!hoje.length) return;

    const semResposta = hoje.filter(x => !x.r).slice(-200);
    if (semResposta.length) {
      const resp = await travaPerguntarWA('respondeuDesde', { itens: semResposta.map(x => ({ telefone: x.t, desde: x.e })) });
      if (Array.isArray(resp)) for (const r of resp) await travaMarcarResposta(r.telefone, r.quando, false);
    }

    if (!est.alarme) {
      const ultimos = hoje.filter(x => x.e <= agora - TRAVA_TICK_MIN * 60000).sort((a, b) => b.e - a.e).slice(0, TRAVA_TICK_SEGUIDAS);
      if (ultimos.length === TRAVA_TICK_SEGUIDAS && ultimos.every(x => !x.r)) {
        const acks = await travaPerguntarWA('acks', { itens: ultimos.map(x => ({ telefone: x.t, desde: x.e - 120000 })) });
        if (Array.isArray(acks) && acks.length === TRAVA_TICK_SEGUIDAS && acks.every(a => a.ack != null && a.ack <= 1)) {
          await travaDispararAlarme(`${TRAVA_TICK_SEGUIDAS} mensagens seguidas continuam com 1 tracinho (não entregues) há mais de ${TRAVA_TICK_MIN} min`, false);
        }
      }
    }

    await travaVez(async () => {
      const d = await travaLer(false);
      if (travaConferirLimite(d.log, d.est)) {
        await travaSalvar(false, d.log, d.est);
        await travaNotificar('Trava de engajamento: tudo pausado', d.est.global.motivo);
      }
    });
  } catch (err) {
    console.warn('[Inmovya trava] conferência:', err?.message || err);
  } finally {
    travaConferindo = false;
  }
}

function travaGarantirAlarme() {
  chrome.alarms.get(TRAVA_ALARME, a => { if (!a) chrome.alarms.create(TRAVA_ALARME, { periodInMinutes: 3, delayInMinutes: 1 }); });
}
travaGarantirAlarme();
chrome.alarms.onAlarm.addListener(a => { if (a?.name === TRAVA_ALARME) travaConferir(); });

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const a = request?.action;
  if (!a || !String(a).startsWith('trava_') || a === 'trava_wa') return;
  const r = request || {};
  const tarefa =
    a === 'trava_pode' ? travaPode(r) :
    a === 'trava_registrar' ? travaRegistrar(r) :
    a === 'trava_resposta' ? (async () => { let n = 0; for (const it of r.itens || [{ telefone: r.telefone, t: r.t }]) n += await travaMarcarResposta(it.telefone, it.t || it.quando, r.teste); return { ok: true, marcados: n }; })() :
    a === 'trava_status' ? travaStatus(r.teste) :
    a === 'trava_retomar' ? travaRetomar(r) :
    a === 'trava_cfg' ? travaMudarCfg(r) :
    a === 'trava_alarme' ? (async () => (travaErroConta(r.erro, r.semWhatsapp) || r.forcar ? { ok: true, alarme: await travaDispararAlarme(r.motivo || `erro ao enviar (${String(r.erro).slice(0, 80)})`, r.teste) } : { ok: true, ignorado: true }))() :
    a === 'trava_teste' ? travaTeste(r) :
    null;
  if (!tarefa) return;
  Promise.resolve(tarefa).then(x => sendResponse({ ok: true, ...x })).catch(e => sendResponse({ ok: false, error: e?.message || String(e) }));
  return true;
});
