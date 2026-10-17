// agente-primeiro-contato.js — 1º contato automático rodando DENTRO do Inmovya Scale.
// Funciona com o Inmovya fechado (basta o Chrome aberto, mesmo minimizado, e o WhatsApp Web conectado).
//
// A cada minuto (chrome.alarms): pergunta ao banco (funções agente_* com o token do agente) se há lead novo,
// atende UM por vez (o intervalo entre envios é o próprio minuto do alarme):
//   reserva no banco (só um envio por lead) → mesmo número já recebeu? pula → lê a conversa no WhatsApp
//   (mensagem sua? pula) → monta a SUA mensagem pronta com spintax (sem IA) → envia → grava o resultado.
// Usa as funções do background.js: naVezWA, agenteNaConversa, sendCampaignMessage.

const AGENTE_ALARME = 'inmovya-primeiro-contato';
const AGENTE_INTERVALO_MIN_MS = 60 * 1000; // no mínimo 1 minuto entre um 1º contato e outro

function agenteGarantirAlarme() {
  chrome.alarms.get(AGENTE_ALARME, alarme => {
    if (!alarme) chrome.alarms.create(AGENTE_ALARME, { periodInMinutes: 1, delayInMinutes: 0.2 });
  });
}
agenteGarantirAlarme();
chrome.runtime.onStartup.addListener(agenteGarantirAlarme);
chrome.runtime.onInstalled.addListener(agenteGarantirAlarme);
chrome.alarms.onAlarm.addListener(alarme => {
  if (alarme.name === AGENTE_ALARME) agenteRodada().catch(err => console.error('[Inmovya agente]', err));
});

// ---------- Banco (Supabase, via funções com o token do agente) ----------
async function agenteCredenciais() {
  const { agentePrimeiroContato } = await chrome.storage.local.get('agentePrimeiroContato');
  const c = agentePrimeiroContato || {};
  return c.url && c.anonKey && c.token ? c : null;
}

async function agenteRpc(cred, nome, args) {
  const resp = await fetch(`${cred.url}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: cred.anonKey, Authorization: `Bearer ${cred.anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const texto = await resp.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch (_) { /* resposta sem JSON */ }
  if (!resp.ok) {
    const msg = json?.message || texto || `erro ${resp.status}`;
    const erro = new Error(/function .* does not exist|PGRST202/i.test(msg) ? 'Falta rodar o SQL supabase/agente_extensao.sql no Supabase.' : msg);
    erro.status = resp.status;
    throw erro;
  }
  return json;
}

async function agenteAviso(cred, aviso) {
  try {
    await agenteRpc(cred, 'agente_aviso', { p_token: cred.token, p_aviso: aviso || null });
  } catch (_) { /* sem conexão: tenta no próximo minuto */ }
}

// ---------- Mensagem (mesmas variáveis do Inmovya) ----------
const agenteSemAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').toLowerCase().trim();

function agentePrimeiroNome(nome) {
  const n = String(nome || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!n) return '';
  const p = n.split(' ').map(x => x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, '')).find(x => /\p{L}/u.test(x)) || n.split(' ')[0];
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function agenteSaudacao(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'bom dia';
  if (h >= 12 && h < 18) return 'boa tarde';
  return 'boa noite';
}

function agenteNaoEhProjeto(texto) {
  const t = agenteSemAcento(texto);
  if (!t) return true;
  if (/^(informar|informe|preencher|definir|a definir|sem|nenhum|qual|cadastrar)( o| um)? (empreendimento|empreendimentos|projeto|imovel|produto)$/.test(t)) return true;
  if (/^(empreendimento|projeto|imovel) (nao informado|a definir|indefinido)$/.test(t)) return true;
  return /^(n a|na|nao informado|nao informou|a definir|indefinido|nenhum|sem|null|undefined|empreendimento|projeto)$/.test(t);
}

function agenteEmpreendimento(observacoes, leadNome) {
  const linhas = String(observacoes || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const l of linhas) {
    const m = l.match(/^(?:empreendimento|empreendimentos|projeto|im[óo]vel|interesse)\s*[:\-–]\s*(.+)$/i);
    if (m && m[1].trim() && !agenteNaoEhProjeto(m[1])) return m[1].trim();
  }
  const primeira = linhas[0] || '';
  if (!primeira || /^lead criado automaticamente/i.test(primeira)) return '';
  if (primeira.includes('|')) {
    const nome = agenteSemAcento(leadNome);
    const partes = primeira.split('|').map(p => p.trim().replace(/[.;,]+$/, '').trim()).filter(Boolean)
      .filter(p => !/^\d+\s*:/.test(p)).filter(p => !/\bbitrix\b/i.test(p) && !/#\s*\d+/.test(p)).filter(p => !/^\d+$/.test(p))
      .filter(p => !nome || agenteSemAcento(p) !== nome).filter(p => !agenteNaoEhProjeto(p));
    return partes[0] || '';
  }
  const projeto = primeira.replace(/[.;,]+$/, '');
  return agenteNaoEhProjeto(projeto) ? '' : projeto;
}

// Spintax: {Oi|Olá|Oii} escolhe uma opção ao acaso (aceita um dentro do outro).
// As variáveis {{nome}}, {{saudacao}}... (chaves duplas) não são mexidas.
function agenteSpin(texto) {
  const vars = [];
  let t = String(texto || '').replace(/\{\{[^{}]*\}\}/g, m => `\u0000${vars.push(m) - 1}\u0000`);
  for (let i = 0; i < 20; i++) {
    const antes = t;
    t = t.replace(/\{([^{}]*)\}/g, (_, dentro) => {
      const opcoes = dentro.split('|');
      return opcoes[Math.floor(Math.random() * opcoes.length)];
    });
    if (t === antes) break;
  }
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => vars[+i]);
}

function agenteMontar(template, lead, meuNome) {
  const agora = new Date();
  const projeto = agenteEmpreendimento(lead.observacoes, lead.nome);
  let t = agenteSpin(template);
  t = projeto
    ? t.replace(/\{\{\s*empreendimento\s*\}\}/gi, projeto)
    : t.replace(/\b(n[oa]s?)\s+\{\{\s*empreendimento\s*\}\}/gi, 'buscando imóveis')
       .replace(/\b(d[oa]s?)\s+\{\{\s*empreendimento\s*\}\}/gi, 'de imóveis')
       .replace(/\b(pel[oa]s?)\s+\{\{\s*empreendimento\s*\}\}/gi, 'por imóveis')
       .replace(/(^|[^\p{L}])([oa]s?)\s+\{\{\s*empreendimento\s*\}\}/giu, '$1imóveis')
       .replace(/\{\{\s*empreendimento\s*\}\}/gi, 'imóveis');
  return t
    .replace(/\{\{\s*(nome|primeiro_nome)\s*\}\}/gi, agentePrimeiroNome(lead.nome))
    .replace(/\{\{\s*nome_completo\s*\}\}/gi, lead.nome || '')
    .replace(/\{\{\s*saudacao\s*\}\}/gi, agenteSaudacao(agora))
    .replace(/\{\{\s*meu_nome\s*\}\}/gi, meuNome || '')
    .replace(/\{\{\s*data\s*\}\}/gi, agora.toLocaleDateString('pt-BR'))
    .replace(/\{\{\s*hora\s*\}\}/gi, agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/,(\s*,)+/g, ',')
    .trim();
}

// 1º contato SEM IA: sempre a sua mensagem pronta, com spintax ({Oi|Olá}) para cada lead receber um texto diferente.
async function agenteGerarMensagem(lead, cfg) {
  const texto = agenteMontar(cfg.mensagem_reserva, lead, cfg.meu_nome);
  if (!texto) throw new Error('a mensagem do 1º contato está vazia — escreva a sua no Inmovya (Esteiras → 1º contato)');
  return { texto, via: 'sua mensagem (spintax)' };
}

function agenteTelefone(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d;
  return d;
}

// ---------- Depois do envio: salvar o contato e marcar a etiqueta da origem ----------
// Bitrix (tag Bitrix ou origem roleta) → etiqueta "Bitrix"; Meta Ads → etiqueta "Meta Ads".
// No Inmovya o lead já tem a tag da origem (a captura automática põe), que é de onde sai a etiqueta.
function agenteEtiquetaDaOrigem(lead) {
  const tags = (lead.tags || []).map(t => String(t).toLowerCase());
  const origem = String(lead.origem || '').toLowerCase();
  if (tags.includes('bitrix') || tags.includes('roleta') || origem === 'roleta') return 'Bitrix';
  if (tags.includes('meta ads') || origem === 'facebook' || origem === 'instagram') return 'Meta Ads';
  return null;
}

/** Devolve um aviso para a tela do Inmovya quando algo não deu certo (ou null). Nunca desfaz o envio. */
async function agenteSalvarEEtiquetar(tel, lead) {
  const etiqueta = agenteEtiquetaDaOrigem(lead);
  try {
    let r = null;
    try {
      r = await naVezWA(() => agenteNaConversa({ phone: tel, background: true, nome: lead.nome || '', etiqueta }, 'agent_save_and_label_tab'));
    } catch (_) { r = null; }
    const etiquetaOk = r?.etiqueta && r.etiqueta.ok !== false;
    // não salvou na janelinha do canto? tenta de novo numa aba normal (o WhatsApp estreito às vezes esconde o botão)
    if (!r || (r.contato && !r.contato.salvo && !r.contato.jaEstava)) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const r2 = await naVezWA(() => agenteNaConversa({ phone: tel, background: false, nome: lead.nome || '', etiqueta: etiquetaOk ? null : etiqueta }, 'agent_save_and_label_tab'));
      r = { contato: r2?.contato || r?.contato, etiqueta: etiquetaOk ? r.etiqueta : (r2?.etiqueta || r?.etiqueta) };
    }
    const problemas = [];
    if (r?.contato && !r.contato.salvo) problemas.push(`contato de ${lead.nome || tel} não foi salvo (${r.contato.motivo})`);
    else if (r?.contato?.salvo && r.contato.sincronizado === false && !r.contato.jaEstava)
      problemas.push(`contato de ${lead.nome || tel} salvo no WhatsApp, mas não achei a opção de sincronizar com a agenda do celular`);
    const naoExiste = (r?.etiqueta?.alteracoes || []).find(a => /não existe/.test(a));
    if (etiqueta && naoExiste) problemas.push(`${naoExiste} — crie a etiqueta "${etiqueta}" no WhatsApp Business para o agente marcar`);
    else if (etiqueta && r?.etiqueta && r.etiqueta.ok === false) problemas.push(`não consegui marcar a etiqueta ${etiqueta} (${r.etiqueta.error || 'erro'})`);
    return problemas.length ? `1º contato enviado, mas: ${problemas.join('; ')}.` : null;
  } catch (err) {
    return `1º contato enviado, mas não consegui salvar o contato/etiqueta de ${lead.nome || tel}: ${err.message}`;
  }
}

// ---------- Rodada (1 lead por minuto) ----------
let agenteEmCurso = false;
async function agenteRodada() {
  if (agenteEmCurso) return; // alarme e "Conferir agora" juntos
  agenteEmCurso = true;
  try {
    await agenteRodadaAgora();
  } finally {
    agenteEmCurso = false;
  }
}

async function agenteRodadaAgora() {
  const cred = await agenteCredenciais();
  if (!cred) return; // agente nunca configurado neste Chrome
  // uma rodada por vez, mesmo se o service worker reiniciar no meio (trava vence em 12 min)
  const { agenteOcupadoAte = 0, agenteUltimoEnvio = 0 } = await chrome.storage.local.get(['agenteOcupadoAte', 'agenteUltimoEnvio']);
  if (Date.now() < agenteOcupadoAte) return;
  if (Date.now() - agenteUltimoEnvio < AGENTE_INTERVALO_MIN_MS - 5000) return;

  let dados;
  try {
    dados = await agenteRpc(cred, 'agente_pendentes', { p_token: cred.token });
  } catch (err) {
    console.warn('[Inmovya agente] sem acesso ao banco:', err.message);
    return;
  }
  if (!dados?.ativo || !Array.isArray(dados.leads) || !dados.leads.length) return;
  const cfg = dados.config || {};
  if (!String(cfg.meu_nome || '').trim()) return agenteAviso(cred, 'Preencha o seu nome no agente de 1º contato.');

  await chrome.storage.local.set({ agenteOcupadoAte: Date.now() + 12 * 60 * 1000 });
  try {
    for (const lead of dados.leads) {
      const r = await agenteAtender(cred, cfg, lead);
      if (r === 'enviado' || r === 'erro') {
        await chrome.storage.local.set({ agenteUltimoEnvio: Date.now() });
        break; // um envio por minuto; o próximo vai no próximo alarme
      }
    }
  } finally {
    await chrome.storage.local.set({ agenteOcupadoAte: 0 });
  }
}

async function agenteAtender(cred, cfg, lead) {
  const reserva = await agenteRpc(cred, 'agente_reservar', { p_token: cred.token, p_lead: lead.id });
  if (!reserva?.ok) return 'ignorado'; // outro computador/aba já pegou

  const resultado = (status, extra = {}) =>
    agenteRpc(cred, 'agente_resultado', { p_token: cred.token, p_lead: lead.id, p_status: status, p_msg: extra.msg || null, p_erro: extra.erro || null, p_via: extra.via || null });

  const tel = agenteTelefone(lead.telefone);
  if (!tel || tel.length < 12) { await resultado('pulado', { erro: 'telefone inválido para WhatsApp' }); return 'pulado'; }
  if (reserva.outro) { await resultado('pulado', { erro: `este número já recebeu o 1º contato (lead ${reserva.outro})` }); return 'pulado'; }

  try {
    const feito = await naVezWA(async () => {
      // conversa já tem mensagem sua? não envia
      const leitura = await agenteNaConversa({ phone: tel, background: true }, 'agent_read_chat_tab');
      const conversa = Array.isArray(leitura?.mensagens) ? leitura.mensagens : [];
      if (conversa.some(m => m.dir === 'out')) return { pulou: 'já existe mensagem sua nesta conversa do WhatsApp' };
      const msg = await agenteGerarMensagem(lead, cfg);
      await sendCampaignMessage({ phone: tel, text: msg.texto, background: true, gapMinMs: 0, gapMaxMs: 0 });
      return { msg };
    });
    if (feito.pulou) { await resultado('pulado', { erro: feito.pulou }); return 'pulado'; }
    const via = feito.msg.aviso ? `${feito.msg.via} (${feito.msg.aviso})` : feito.msg.via;
    // grava o envio JÁ (é o que impede mandar de novo); salvar contato e etiqueta vêm depois
    await resultado('enviado', { msg: feito.msg.texto, via });
    const aviso = await agenteSalvarEEtiquetar(tel, lead);
    await agenteAviso(cred, aviso);
    return 'enviado';
  } catch (err) {
    const erro = err?.message || 'falha no envio';
    await resultado('erro', { erro }).catch(() => {});
    if (/não abriu|não ficou pronta|carregando|Tempo esgotado ao abrir/i.test(erro)) {
      await agenteAviso(cred, `Não consegui abrir o WhatsApp Web (${erro}). Confira se ele está conectado neste Chrome.`);
    }
    return 'erro';
  }
}

// ---------- Captura do CRM Midrah (a aba do Midrah manda os negócios novos; aqui cadastra no Inmovya) ----------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== 'midrah_capturar') return;
  (async () => {
    const cred = await agenteCredenciais();
    if (!cred) throw new Error('Abra o Inmovya uma vez neste Chrome (Esteiras → 1º contato) para ligar a captura.');
    const resultados = [];
    for (const l of request.leads || []) {
      try {
        const r = await agenteRpc(cred, 'agente_cadastrar_lead', {
          p_token: cred.token,
          p_fonte: 'Midrah',
          p_externo: String(l.id),
          p_nome: l.nome || '',
          p_telefone: l.telefone || '',
          p_email: l.email || '',
          p_empreendimento: l.empreendimento || ''
        });
        resultados.push({ id: l.id, ok: true, acao: r?.acao });
      } catch (err) {
        resultados.push({ id: l.id, ok: false, erro: err.message });
      }
    }
    // lead novo entrou: o 1º contato já pode atender
    if (resultados.some(x => x.acao === 'criado')) agenteRodada().catch(() => {});
    return { resultados };
  })()
    .then(r => sendResponse({ ok: true, ...r }))
    .catch(err => sendResponse({ ok: false, error: err.message }));
  return true;
});
