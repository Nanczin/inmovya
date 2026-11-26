// Inmovya — 1º contato NA NUVEM (reserva do computador).
// Roda num servidor gratuito, junto da Evolution API (que liga ao seu WhatsApp como "aparelho conectado").
// Só trabalha quando o seu PC está DESLIGADO: se a extensão Inmovya Scale deu sinal nos últimos 3 minutos,
// a nuvem não faz nada. A reserva no banco garante uma mensagem só por lead, mesmo se os dois tentarem juntos.
//
// A cada minuto:
//   1) fila da captura (Bitrix / Meta Ads): confere no WhatsApp se o número existe e cria o lead;
//   2) 1º contato: um lead por vez, intervalo sorteado de 2 a 5 min, a SUA mensagem com spintax,
//      e as etiquetas do WhatsApp que você escolheu para a origem.
//
// Variáveis: EVO_URL, EVO_KEY, EVO_INSTANCIA, QR_PATH. A "chave da nuvem" (banco + token do agente) você cola
// na página secreta do QR Code (botão "Copiar chave da nuvem" no Inmovya); fica salva em /data/chave.json.

import fs from 'node:fs';
const ENV = process.env;
const ARQ_CHAVE = '/data/chave.json';
let CHAVE = null; // { u: url do banco, a: chave pública, t: token do agente }
try { CHAVE = JSON.parse(fs.readFileSync(ARQ_CHAVE, 'utf8')); } catch { CHAVE = null; }
function salvarChave(texto) {
  const j = JSON.parse(Buffer.from(String(texto).trim(), 'base64').toString('utf8'));
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(j.u || '') || !j.a || !j.t || String(j.t).length < 32) throw new Error('chave inválida');
  fs.mkdirSync('/data', { recursive: true });
  fs.writeFileSync(ARQ_CHAVE, JSON.stringify(j), { mode: 0o600 });
  CHAVE = j;
}
const EVO_URL = (ENV.EVO_URL || 'http://evolution:8080').replace(/\/+$/, '');
const INST = ENV.EVO_INSTANCIA || 'inmovya';
const INTERVALO_MIN = 2 * 60 * 1000;
const INTERVALO_MAX = 5 * 60 * 1000;
const sortear = (a, b) => Math.round(a + Math.random() * (b - a));
const dormir = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), ...a);

if (!ENV.EVO_KEY) { console.error('Falta a variável EVO_KEY'); process.exit(1); }

// ---------- banco (mesmas funções da extensão, com o token do agente) ----------
async function rpc(nome, args) {
  if (!CHAVE) throw new Error('falta colar a chave da nuvem');
  const r = await fetch(`${CHAVE.u}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: CHAVE.a, Authorization: `Bearer ${CHAVE.a}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: CHAVE.t, ...args }),
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) throw new Error(`${nome}: ${(j && j.message) || t || r.status}`);
  return j;
}
const aviso = a => rpc('agente_aviso', { p_aviso: a ? `Nuvem: ${a}` : null }).catch(() => {});

// ---------- WhatsApp (Evolution API) ----------
async function evo(metodo, caminho, corpo) {
  const r = await fetch(`${EVO_URL}${caminho}`, {
    method: metodo,
    headers: { apikey: ENV.EVO_KEY, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) throw new Error(`WhatsApp (${caminho}): ${(j && (j.response?.message || j.message)) || r.status}`);
  return j;
}
async function conectado() {
  try {
    const r = await evo('GET', `/instance/connectionState/${INST}`);
    return (r?.instance?.state || r?.state) === 'open';
  } catch { return false; }
}
async function temWhatsapp(tel) {
  const r = await evo('POST', `/chat/whatsappNumbers/${INST}`, { numbers: [tel] });
  const x = Array.isArray(r) ? r[0] : null;
  return x ? !!x.exists : null;
}
async function jaConversei(tel) {
  // alguma mensagem SUA para esse número? (então não é 1º contato)
  try {
    const r = await evo('POST', `/chat/findMessages/${INST}`, { where: { key: { remoteJid: `${tel}@s.whatsapp.net`, fromMe: true } }, limit: 1 });
    const lista = r?.messages?.records || r?.records || (Array.isArray(r) ? r : []);
    return lista.length > 0;
  } catch { return false; }
}
let etiquetasCache = { em: 0, v: [] };
async function etiquetasDoWhatsapp() {
  if (Date.now() - etiquetasCache.em < 10 * 60 * 1000) return etiquetasCache.v;
  const r = await evo('GET', `/label/findLabels/${INST}`);
  etiquetasCache = { em: Date.now(), v: Array.isArray(r) ? r : [] };
  return etiquetasCache.v;
}
async function etiquetar(tel, nomes) {
  if (!nomes.length) return [];
  const todas = await etiquetasDoWhatsapp();
  const feitas = [];
  for (const n of nomes) {
    const e = todas.find(x => String(x.name || '').trim().toLowerCase() === n.trim().toLowerCase());
    if (!e) continue;
    try {
      await evo('POST', `/label/handleLabel/${INST}`, { number: tel, labelId: String(e.id), action: 'add' });
      feitas.push(n);
    } catch (err) { log('etiqueta', n, 'falhou:', err.message); }
  }
  return feitas;
}

// ---------- mensagem (igual à extensão) ----------
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').toLowerCase().trim();
function primeiroNome(nome) {
  const n = String(nome || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!n) return '';
  const p = n.split(' ').map(x => x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, '')).find(x => /\p{L}/u.test(x)) || n.split(' ')[0];
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}
function horaSP() { return Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false })) % 24; }
function saudacao() { const h = horaSP(); return h >= 5 && h < 12 ? 'bom dia' : h >= 12 && h < 18 ? 'boa tarde' : 'boa noite'; }
function naoEhProjeto(texto) {
  const t = semAcento(texto);
  if (!t) return true;
  if (/^(informar|informe|preencher|definir|a definir|sem|nenhum|qual|cadastrar)( o| um)? (empreendimento|empreendimentos|projeto|imovel|produto)$/.test(t)) return true;
  if (/^(empreendimento|projeto|imovel) (nao informado|a definir|indefinido)$/.test(t)) return true;
  return /^(n a|na|nao informado|nao informou|a definir|indefinido|nenhum|sem|null|undefined|empreendimento|projeto)$/.test(t);
}
function empreendimento(obs, leadNome) {
  const linhas = String(obs || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const l of linhas) {
    const m = l.match(/^(?:empreendimento|empreendimentos|projeto|im[óo]vel|interesse)\s*[:\-–]\s*(.+)$/i);
    if (m && m[1].trim() && !naoEhProjeto(m[1])) return m[1].trim();
  }
  const primeira = linhas[0] || '';
  if (!primeira || /^lead criado automaticamente/i.test(primeira)) return '';
  if (primeira.includes('|')) {
    const nome = semAcento(leadNome);
    const partes = primeira.split('|').map(p => p.trim().replace(/[.;,]+$/, '').trim()).filter(Boolean)
      .filter(p => !/^\d+\s*:/.test(p)).filter(p => !/\bbitrix\b/i.test(p) && !/#\s*\d+/.test(p)).filter(p => !/^\d+$/.test(p))
      .filter(p => !nome || semAcento(p) !== nome).filter(p => !naoEhProjeto(p));
    return partes[0] || '';
  }
  const projeto = primeira.replace(/[.;,]+$/, '');
  return naoEhProjeto(projeto) ? '' : projeto;
}
function spin(texto) {
  const vars = [];
  let t = String(texto || '').replace(/\{\{[^{}]*\}\}/g, m => `\u0000${vars.push(m) - 1}\u0000`);
  for (let i = 0; i < 20; i++) {
    const antes = t;
    t = t.replace(/\{([^{}]*)\}/g, (_, d) => { const o = d.split('|'); return o[Math.floor(Math.random() * o.length)]; });
    if (t === antes) break;
  }
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => vars[+i]);
}
function montar(template, lead, meuNome) {
  const projeto = empreendimento(lead.observacoes, lead.nome);
  let t = spin(template);
  t = projeto
    ? t.replace(/\{\{\s*empreendimento\s*\}\}/gi, projeto)
    : t.replace(/\b(n[oa]s?)\s+\{\{\s*empreendimento\s*\}\}/gi, 'buscando imóveis')
       .replace(/\b(d[oa]s?)\s+\{\{\s*empreendimento\s*\}\}/gi, 'de imóveis')
       .replace(/\b(pel[oa]s?)\s+\{\{\s*empreendimento\s*\}\}/gi, 'por imóveis')
       .replace(/(^|[^\p{L}])([oa]s?)\s+\{\{\s*empreendimento\s*\}\}/giu, '$1imóveis')
       .replace(/\{\{\s*empreendimento\s*\}\}/gi, 'imóveis');
  const agora = new Date();
  return t
    .replace(/\{\{\s*(nome|primeiro_nome)\s*\}\}/gi, primeiroNome(lead.nome))
    .replace(/\{\{\s*nome_completo\s*\}\}/gi, lead.nome || '')
    .replace(/\{\{\s*saudacao\s*\}\}/gi, saudacao())
    .replace(/\{\{\s*meu_nome\s*\}\}/gi, meuNome || '')
    .replace(/\{\{\s*data\s*\}\}/gi, agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }))
    .replace(/\{\{\s*hora\s*\}\}/gi, agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }))
    .replace(/\s+([,.!?])/g, '$1').replace(/,(\s*,)+/g, ',').trim();
}
function telefone(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d;
  return d;
}
// origem do lead → etiquetas escolhidas no Inmovya (padrão: Bitrix / Meta Ads / Midrah)
const PADRAO = { bitrix: ['Bitrix'], meta: ['Meta Ads'], midrah: ['Midrah'], outros: [], todos: [] };
function etiquetasDoLead(lead, cfgEtq) {
  const c = { ...PADRAO, ...(cfgEtq || {}) };
  const tags = (lead.tags || []).map(t => String(t).toLowerCase());
  const o = String(lead.origem || '').toLowerCase();
  const k = tags.includes('bitrix') || tags.includes('roleta') || o === 'roleta' ? 'bitrix'
    : tags.includes('meta ads') || o === 'facebook' || o === 'instagram' ? 'meta'
    : tags.includes('midrah') || o === 'midrah' ? 'midrah' : 'outros';
  const vistos = new Set();
  return [...(c[k] || []), ...(c.todos || [])].filter(n => { const x = String(n).toLowerCase(); if (vistos.has(x)) return false; vistos.add(x); return true; });
}

// ---------- 1) fila da captura ----------
async function filaCaptura() {
  let fila;
  try { fila = await rpc('agente_fila_captura', {}); } catch { return; }
  if (!Array.isArray(fila) || !fila.length) return;
  for (const l of fila) {
    const tel = telefone(l.telefone);
    let tem = null;
    if (!tel || tel.length < 12) tem = false;
    else { try { tem = await temWhatsapp(tel); } catch { tem = null; } }
    const r = await rpc('agente_resolver_captura', { p_id: l.id, p_tem_whatsapp: tem });
    log('captura', l.fonte, l.nome, '→', r?.acao);
    if (tem === null) break;
  }
}

// ---------- 2) 1º contato ----------
let proximoEnvio = 0;
async function atender(lead, cfg, cfgEtq) {
  const res = (status, extra = {}) => rpc('agente_resultado', { p_lead: lead.id, p_status: status, p_msg: extra.msg || null, p_erro: extra.erro || null, p_via: extra.via || null });
  const reserva = await rpc('agente_reservar', { p_lead: lead.id });
  if (!reserva?.ok) return 'ocupado';
  if (reserva.outro) { await res('pulado', { erro: `mesmo número já recebeu o 1º contato (${reserva.outro})` }); return 'pulado'; }
  const tel = telefone(lead.telefone);
  if (!tel || tel.length < 12) { await res('erro', { erro: 'telefone inválido' }); return 'erro'; }
  const existe = await temWhatsapp(tel).catch(() => null);
  if (existe === false) { await res('pulado', { erro: 'número sem WhatsApp' }); return 'pulado'; }
  if (await jaConversei(tel)) { await res('pulado', { erro: 'você já tinha conversado com esse número' }); return 'pulado'; }
  const texto = montar(cfg.mensagem_reserva, lead, cfg.meu_nome);
  if (!texto) { await res('erro', { erro: 'a mensagem do 1º contato está vazia' }); return 'erro'; }
  try {
    await evo('POST', `/message/sendText/${INST}`, { number: tel, text: texto, delay: sortear(1500, 4000) });
  } catch (err) {
    await res('erro', { erro: err.message });
    return 'erro';
  }
  const feitas = await etiquetar(tel, etiquetasDoLead(lead, cfgEtq)).catch(() => []);
  await res('enviado', { msg: texto, via: `nuvem (PC desligado)${feitas.length ? ` · etiquetas: ${feitas.join(', ')}` : ''}` });
  log('1º contato enviado:', lead.nome, feitas.length ? `(etiquetas ${feitas.join(', ')})` : '');
  return 'enviado';
}

let rodando = false;
async function rodada() {
  if (rodando || !CHAVE) return;
  rodando = true;
  try {
    const d = await rpc('agente_pendentes_nuvem', {});
    if (d?.pc_online) return; // o computador está ligado: a extensão cuida
    if (!(await conectado())) { await aviso('o WhatsApp da nuvem está desconectado (escaneie o QR Code de novo).'); return; }
    await filaCaptura();
    if (!d?.ativo || !Array.isArray(d.leads) || !d.leads.length) return;
    const cfg = d.config || {};
    if (!String(cfg.meu_nome || '').trim()) return;
    if (Date.now() < proximoEnvio) return;
    await dormir(sortear(3000, 25000));
    for (const lead of d.leads) {
      const r = await atender(lead, cfg, d.etiquetas);
      if (r === 'enviado' || r === 'erro') { proximoEnvio = Date.now() + sortear(INTERVALO_MIN, INTERVALO_MAX); break; }
    }
  } catch (err) {
    log('erro:', err.message);
  } finally {
    rodando = false;
  }
}

// ---------- conexão com o WhatsApp: cria a instância e mostra o QR Code numa página secreta ----------
import http from 'node:http';
async function garantirInstancia() {
  for (let i = 0; i < 30; i++) {
    try {
      const lista = await evo('GET', '/instance/fetchInstances');
      const tem = (Array.isArray(lista) ? lista : []).some(x => (x.name || x.instance?.instanceName) === INST);
      if (!tem) {
        await evo('POST', '/instance/create', { instanceName: INST, integration: 'WHATSAPP-BAILEYS', qrcode: true });
        log('instância criada:', INST);
      }
      return;
    } catch (err) {
      await dormir(5000); // a Evolution ainda está subindo
    }
  }
}
const QR_PATH = ENV.QR_PATH ? `/${ENV.QR_PATH.replace(/^\/+/, '')}` : '';
if (QR_PATH) {
  http.createServer(async (req, res) => {
    if (!req.url || !req.url.startsWith(QR_PATH)) { res.writeHead(404); return res.end(); }
    let corpo = '';
    let msgChave = '';
    if (req.method === 'POST') {
      // recebe a chave colada no formulário
      let dados = '';
      for await (const pedaco of req) { dados += pedaco; if (dados.length > 5000) break; }
      try { salvarChave(new URLSearchParams(dados).get('chave') || ''); msgChave = '✅ Chave salva.'; rodada(); }
      catch { msgChave = '❌ Chave inválida. No Inmovya: Esteiras → 1º contato → "Copiar chave da nuvem", e cole aqui.'; }
    }
    const formChave = `<form method="post" style="margin:16px auto;max-width:420px"><p><b>1.</b> No Inmovya: Esteiras → 1º contato → <b>Copiar chave da nuvem</b>. Cole aqui:</p><textarea name="chave" rows="3" style="width:100%" required></textarea><br><button style="margin-top:8px;padding:8px 16px">Salvar chave</button></form>`;
    try {
      if (!CHAVE) corpo = `<h1>Ligar o 1º contato na nuvem</h1>${msgChave ? `<p>${msgChave}</p>` : ''}${formChave}`;
      else if (await conectado()) corpo = '<h1>✅ WhatsApp conectado à nuvem</h1><p>Pode fechar esta página. O 1º contato na nuvem só age quando o seu computador estiver desligado.</p>';
      else {
        const r = await evo('GET', `/instance/connect/${INST}`);
        const img = r?.base64 || (r?.code ? null : null);
        corpo = img
          ? `${msgChave ? `<p>${msgChave}</p>` : ''}<h1>Escaneie com o WhatsApp do celular</h1><p>WhatsApp → ⋮ (ou Configurações) → <b>Dispositivos conectados</b> → <b>Conectar dispositivo</b>.</p><img src="${img}" style="width:300px;height:300px"><p>O código troca sozinho a cada 20 segundos.</p>`
          : '<h1>Gerando o QR Code…</h1><p>Aguarde alguns segundos.</p>';
      }
    } catch (err) {
      corpo = `<h1>Ainda iniciando…</h1><p>${String(err.message).replace(/[<>&]/g, '')}</p>`;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">${CHAVE ? '<meta http-equiv="refresh" content="20">' : ''}<title>Inmovya Nuvem</title><body style="font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#0b1f4d">${corpo}</body>`);
  }).listen(8081, () => log('página do QR Code pronta na porta 8081'));
}
await garantirInstancia();

log(`Inmovya 1º contato na nuvem: instância "${INST}". Conferindo a cada minuto (só age com o PC desligado).`);
rodada();
setInterval(rodada, 60 * 1000);
