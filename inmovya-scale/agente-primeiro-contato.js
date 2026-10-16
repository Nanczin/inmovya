// agente-primeiro-contato.js — 1º contato automático rodando DENTRO do Inmovya Scale.
// Funciona com o Inmovya fechado (basta o Chrome aberto, mesmo minimizado, e o WhatsApp Web conectado).
//
// A cada minuto (chrome.alarms): pergunta ao banco (funções agente_* com o token do agente) se há lead novo,
// atende UM por vez (o intervalo entre envios é o próprio minuto do alarme):
//   reserva no banco (só um envio por lead) → mesmo número já recebeu? pula → lê a conversa no WhatsApp
//   (mensagem sua? pula) → escreve com o Gemini (grátis) ou usa a mensagem reserva → envia → grava o resultado.
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

function agenteMontar(template, lead, meuNome) {
  const agora = new Date();
  const projeto = agenteEmpreendimento(lead.observacoes, lead.nome);
  let t = String(template || '');
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

function agenteFonte(lead) {
  const tags = (lead.tags || []).map(t => String(t).toLowerCase());
  if (tags.includes('meta ads')) return `anúncio no ${lead.origem || 'Facebook/Instagram'}`;
  if (tags.includes('bitrix') || String(lead.origem || '').toLowerCase() === 'roleta') return 'cadastro recebido pelo Bitrix';
  return lead.origem || 'cadastro';
}

const AGENTE_MODELOS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest'];

async function agenteGemini(chave, prompt) {
  let ultimoErro = '';
  for (const modelo of AGENTE_MODELOS) {
    let resp;
    try {
      resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, responseMimeType: 'application/json' } })
      });
    } catch (_) { ultimoErro = 'sem conexão com o Gemini'; continue; }
    if (resp.status === 404 || resp.status === 429 || resp.status >= 500) {
      ultimoErro = resp.status === 404 ? `modelo ${modelo} indisponível` : resp.status === 429 ? 'limite grátis do Gemini atingido por agora' : 'Gemini sobrecarregado';
      continue;
    }
    if (!resp.ok) throw new Error(resp.status === 400 || resp.status === 403 ? 'chave do Gemini inválida' : `Gemini indisponível (${resp.status})`);
    const json = await resp.json();
    const texto = (json.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    try { return JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, '') || '{}'); } catch (_) { ultimoErro = 'resposta do Gemini fora do formato'; }
  }
  throw new Error(ultimoErro || 'Gemini indisponível');
}

async function agenteGerarMensagem(lead, cfg, conversa) {
  const reserva = () => ({ texto: agenteMontar(cfg.mensagem_reserva, lead, cfg.meu_nome), via: 'mensagem reserva' });
  if (!cfg.usar_ia) return reserva();
  if (!cfg.gemini_key) return { ...reserva(), aviso: 'sem chave do Gemini' };
  const agora = new Date();
  const doLead = (conversa || []).filter(m => m.dir === 'in').map(m => m.texto || `(${m.tipo || 'mídia'})`).slice(-5);
  const projeto = agenteEmpreendimento(lead.observacoes, lead.nome);
  const prompt = [
    'Você escreve a PRIMEIRA mensagem de WhatsApp de um corretor de imóveis para um lead que acabou de chegar.',
    '',
    'Instruções do corretor:',
    String(cfg.instrucoes || '').trim(),
    '',
    'Dados:',
    `- Nome do corretor: ${cfg.meu_nome || '(não informado — não invente um nome)'}`,
    `- Primeiro nome do lead: ${agentePrimeiroNome(lead.nome) || '(sem nome — cumprimente sem usar nome)'}`,
    `- Empreendimento de interesse: ${projeto || 'não informado (fale em imóveis, sem inventar um empreendimento)'}`,
    `- De onde veio: ${agenteFonte(lead)}`,
    `- Observações do cadastro: ${String(lead.observacoes || '').replace(/\s+/g, ' ').slice(0, 400) || 'nenhuma'}`,
    `- Agora: ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (saudação do horário: "${agenteSaudacao(agora)}")`,
    doLead.length ? `- O lead já escreveu no WhatsApp: ${doLead.map(t => `"${t}"`).join(' / ')}` : '- O lead ainda não escreveu nada no WhatsApp.',
    '',
    'Regras fixas: português do Brasil; não invente preço, condição de pagamento, endereço, metragem, prazo de entrega nem promessas;',
    'não use colchetes, chaves nem campos para preencher; no máximo 450 caracteres; escreva só a mensagem, sem assinatura.',
    'Responda apenas com JSON: {"mensagem": "texto da mensagem"}'
  ].join('\n');
  try {
    const r = await agenteGemini(cfg.gemini_key, prompt);
    const texto = String(r?.mensagem ?? '').trim().replace(/^["'“”]+|["'“”]+$/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (texto.length >= 15 && texto.length <= 700 && !/\{\{|\}\}|\[[^\]]*\]|<[^>]+>/.test(texto)) return { texto, via: 'IA (Gemini)' };
    return { ...reserva(), aviso: 'a IA devolveu um texto fora do padrão' };
  } catch (err) {
    return { ...reserva(), aviso: err.message || 'IA indisponível' };
  }
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
    const r = await naVezWA(() => agenteNaConversa({ phone: tel, background: true, nome: lead.nome || '', etiqueta }, 'agent_save_and_label_tab'));
    const problemas = [];
    if (r?.contato && !r.contato.salvo) problemas.push(`contato de ${lead.nome || tel} não foi salvo (${r.contato.motivo})`);
    const naoExiste = (r?.etiqueta?.alteracoes || []).find(a => /não existe/.test(a));
    if (etiqueta && naoExiste) problemas.push(`a etiqueta "${etiqueta}" não existe no seu WhatsApp Business — crie para o agente marcar`);
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
      const msg = await agenteGerarMensagem(lead, cfg, conversa);
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
