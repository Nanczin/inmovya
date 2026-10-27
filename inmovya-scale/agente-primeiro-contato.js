// agente-primeiro-contato.js — 1º contato automático rodando DENTRO do Inmovya Scale.
// Funciona com o Inmovya fechado (basta o Chrome aberto, mesmo minimizado, e o WhatsApp Web conectado).
//
// A cada minuto (chrome.alarms): pergunta ao banco (funções agente_* com o token do agente) se há lead novo,
// atende UM por vez, com intervalo ALEATÓRIO entre um envio e outro (2 a 5 minutos) e uma pequena espera
// aleatória antes de cada envio, para não ter ritmo de robô:
//   reserva no banco (só um envio por lead) → mesmo número já recebeu? pula → lê a conversa no WhatsApp
//   (mensagem sua? pula) → SALVA o contato e marca a etiqueta → monta a SUA mensagem (spintax) → envia → grava o resultado.
// Usa as funções do background.js: naVezWA, agenteNaConversa, sendCampaignMessage.

const AGENTE_ALARME = 'inmovya-primeiro-contato';
// despertador de uma vez só, marcado no segundo exato do próximo envio sorteado
// (o alarme de 1 em 1 minuto arredondava tudo e deixava os intervalos quase iguais)
const AGENTE_ALARME_PROXIMO = 'inmovya-primeiro-contato-proximo';
let agenteMomentoEnvio = 0; // quando a mensagem saiu de fato (antes de salvar contato/etiqueta)
// Randomização do envio: depois de cada 1º contato, o próximo só sai entre 2 e 5 minutos depois (sorteado),
// e cada envio ainda espera de 3 a 25 segundos ao acaso antes de começar.
const AGENTE_INTERVALO_MIN_MS = 2 * 60 * 1000;
const AGENTE_INTERVALO_MAX_MS = 5 * 60 * 1000;
const AGENTE_ESPERA_MIN_MS = 3 * 1000;
const AGENTE_ESPERA_MAX_MS = 25 * 1000;
const agenteSortear = (min, max) => Math.round(min + Math.random() * (max - min));

function agenteGarantirAlarme() {
  chrome.alarms.get(AGENTE_ALARME, alarme => {
    if (!alarme) chrome.alarms.create(AGENTE_ALARME, { periodInMinutes: 1, delayInMinutes: 0.2 });
  });
}
agenteGarantirAlarme();
chrome.runtime.onStartup.addListener(agenteGarantirAlarme);
chrome.runtime.onInstalled.addListener(agenteGarantirAlarme);
chrome.alarms.onAlarm.addListener(alarme => {
  if (alarme.name === AGENTE_ALARME_PROXIMO) agenteRodada().catch(err => console.error('[Inmovya agente]', err));
  if (alarme.name === AGENTE_ALARME) {
    // primeiro confere a fila da captura (Bitrix/Meta só viram lead com WhatsApp), depois o 1º contato
    agenteFilaCaptura()
      .catch(err => console.warn('[Inmovya captura]', err.message || err))
      .finally(() => agenteRodada().catch(err => console.error('[Inmovya agente]', err)));
  }
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
// Bitrix (tag Bitrix ou origem roleta) → etiqueta "Bitrix"; Meta Ads → etiqueta "Meta Ads"; Midrah → etiqueta "Midrah".
// No Inmovya o lead já tem a tag da origem (a captura automática põe), que é de onde sai a etiqueta.
function agenteEtiquetaDaOrigem(lead) {
  const tags = (lead.tags || []).map(t => String(t).toLowerCase());
  const origem = String(lead.origem || '').toLowerCase();
  if (tags.includes('bitrix') || tags.includes('roleta') || origem === 'roleta') return 'Bitrix';
  if (tags.includes('meta ads') || origem === 'facebook' || origem === 'instagram') return 'Meta Ads';
  if (tags.includes('midrah') || origem === 'midrah') return 'Midrah';
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
    const etiquetaOk = r?.etiqueta && r.etiqueta.ok !== false && !(r.etiqueta.alteracoes || []).some(a => /não existe/.test(a));
    // "já estava salvo" só vale se o nome do topo bater com o do lead (lead novo quase nunca está salvo;
    // o WhatsApp pode mostrar o nome do perfil do lead no topo de um número não salvo)
    const primeiro = agenteSemAcento(String(lead.nome || '').split(/\s+/)[0] || '');
    const salvoDeVerdade = c => c?.salvo && (!c.jaEstava || (primeiro && agenteSemAcento(c.motivo || '').includes(primeiro)));
    // não salvou (ou a etiqueta falhou) na janelinha do canto? tenta de novo numa aba normal
    if (!r || (r.contato && !salvoDeVerdade(r.contato)) || (etiqueta && !etiquetaOk)) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const r2 = await naVezWA(() => agenteNaConversa({ phone: tel, background: false, nome: lead.nome || '', etiqueta: etiquetaOk ? null : etiqueta }, 'agent_save_and_label_tab'));
      r = { contato: r2?.contato || r?.contato, etiqueta: etiquetaOk ? r.etiqueta : (r2?.etiqueta || r?.etiqueta) };
    }
    const problemas = [];
    if (r?.contato && !r.contato.salvo) problemas.push(`contato de ${lead.nome || tel} não foi salvo (${r.contato.motivo})`);
    else if (r?.contato && !salvoDeVerdade(r.contato)) problemas.push(`contato de ${lead.nome || tel} pode não ter sido salvo (${r.contato.motivo})`);
    else if (r?.contato?.salvo && r.contato.sincronizado === false && !r.contato.jaEstava)
      problemas.push(`contato de ${lead.nome || tel} salvo no WhatsApp, mas não achei a opção de sincronizar com a agenda do celular`);
    const naoExiste = (r?.etiqueta?.alteracoes || []).find(a => /não existe/.test(a));
    if (etiqueta && naoExiste) problemas.push(`${naoExiste} — crie a etiqueta "${etiqueta}" no WhatsApp Business para o agente marcar`);
    else if (etiqueta && r?.etiqueta && r.etiqueta.ok === false) problemas.push(`não consegui marcar a etiqueta ${etiqueta} (${r.etiqueta.error || 'erro'})`);
    return problemas.length ? `1º contato: ${problemas.join('; ')}.` : null;
  } catch (err) {
    return `1º contato: não consegui salvar o contato/etiqueta de ${lead.nome || tel}: ${err.message}`;
  }
}

// ---------- Rodada (1 lead por vez, intervalo aleatório) ----------
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
  const { agenteOcupadoAte = 0, agenteUltimoEnvio = 0, agenteProximoEnvio = 0 } =
    await chrome.storage.local.get(['agenteOcupadoAte', 'agenteUltimoEnvio', 'agenteProximoEnvio']);
  if (Date.now() < agenteOcupadoAte) return;

  // consulta o banco todo minuto (isso também é o "sinal de vida" que o Inmovya mostra), mesmo esperando a hora sorteada
  let dados;
  try {
    dados = await agenteRpc(cred, 'agente_pendentes', { p_token: cred.token });
  } catch (err) {
    console.warn('[Inmovya agente] sem acesso ao banco:', err.message);
    return;
  }
  if (Date.now() - agenteUltimoEnvio < AGENTE_INTERVALO_MIN_MS - 2000) return; // nunca menos de 2 min
  if (Date.now() < agenteProximoEnvio - 2000) return; // ainda não chegou a hora sorteada
  if (!dados?.ativo || !Array.isArray(dados.leads) || !dados.leads.length) return;
  const cfg = dados.config || {};
  if (!String(cfg.meu_nome || '').trim()) return agenteAviso(cred, 'Preencha o seu nome no agente de 1º contato.');

  await chrome.storage.local.set({ agenteOcupadoAte: Date.now() + 12 * 60 * 1000 });
  try {
    // pequena espera aleatória antes de começar (o alarme bate sempre no mesmo segundo do minuto)
    await new Promise(resolve => setTimeout(resolve, agenteSortear(AGENTE_ESPERA_MIN_MS, AGENTE_ESPERA_MAX_MS)));
    if (!(await agenteAindaLigado(cred))) return; // desligou durante a espera
    for (const lead of dados.leads) {
      const r = await agenteAtender(cred, cfg, lead);
      if (r === 'enviado' || r === 'erro') {
        // conta o intervalo a partir do momento em que a mensagem saiu, não do fim do salvar contato/etiqueta
        const base = r === 'enviado' && agenteMomentoEnvio ? agenteMomentoEnvio : Date.now();
        const proximo = base + agenteSortear(AGENTE_INTERVALO_MIN_MS, AGENTE_INTERVALO_MAX_MS);
        await chrome.storage.local.set({ agenteUltimoEnvio: base, agenteProximoEnvio: proximo });
        chrome.alarms.create(AGENTE_ALARME_PROXIMO, { when: Math.max(proximo, Date.now() + 31000) });
        console.log('[Inmovya agente] próximo 1º contato a partir de', new Date(proximo).toLocaleTimeString('pt-BR'));
        break; // um envio por vez; o próximo sai no horário sorteado (2 a 5 min)
      }
    }
  } finally {
    await chrome.storage.local.set({ agenteOcupadoAte: 0 });
  }
}

// O 1º contato ainda está ligado? (na dúvida, sem internet: NÃO envia)
async function agenteAindaLigado(cred) {
  try {
    return (await agenteRpc(cred, 'agente_ativo', { p_token: cred.token })) === true;
  } catch (_) {
    return false;
  }
}

// Desligou antes do envio: devolve o lead para a fila (sai quando você ligar de novo), sem gastar tentativa
async function agenteLiberar(cred, leadId) {
  try {
    await agenteRpc(cred, 'agente_liberar', { p_token: cred.token, p_lead: leadId });
  } catch (_) {
    // banco ainda sem a função: marca como erro (volta sozinho em 5 min, quando ligado)
    await agenteRpc(cred, 'agente_resultado', { p_token: cred.token, p_lead: leadId, p_status: 'erro', p_msg: null, p_erro: '1º contato desligado antes do envio', p_via: null }).catch(() => {});
  }
}

async function agenteAtender(cred, cfg, lead) {
  agenteMomentoEnvio = 0;
  const reserva = await agenteRpc(cred, 'agente_reservar', { p_token: cred.token, p_lead: lead.id });
  if (!reserva?.ok) return 'ignorado'; // outro computador/aba já pegou

  const resultado = (status, extra = {}) =>
    agenteRpc(cred, 'agente_resultado', { p_token: cred.token, p_lead: lead.id, p_status: status, p_msg: extra.msg || null, p_erro: extra.erro || null, p_via: extra.via || null });

  const tel = agenteTelefone(lead.telefone);
  if (!tel || tel.length < 12) { await resultado('pulado', { erro: 'telefone inválido para WhatsApp' }); return 'pulado'; }
  if (reserva.outro) { await resultado('pulado', { erro: `este número já recebeu o 1º contato (lead ${reserva.outro})` }); return 'pulado'; }

  try {
    // 1) conversa já tem mensagem sua? não faz nada
    const leitura = await naVezWA(() => agenteNaConversa({ phone: tel, background: true }, 'agent_read_chat_tab'));
    const conversa = Array.isArray(leitura?.mensagens) ? leitura.mensagens : [];
    if (conversa.some(m => m.dir === 'out')) { await resultado('pulado', { erro: 'já existe mensagem sua nesta conversa do WhatsApp' }); return 'pulado'; }

    // 2) PRIMEIRO salva o contato e marca a etiqueta da origem
    if (!(await agenteAindaLigado(cred))) { await agenteLiberar(cred, lead.id); return 'parou'; }
    let aviso = await agenteSalvarEEtiquetar(tel, lead);

    // 3) DEPOIS manda a mensagem (confere de novo, colado no envio, se o 1º contato continua ligado)
    const feito = await naVezWA(async () => {
      const msg = await agenteGerarMensagem(lead, cfg);
      if (!(await agenteAindaLigado(cred))) return { parou: true };
      await sendCampaignMessage({ phone: tel, text: msg.texto, background: true, gapMinMs: 0, gapMaxMs: 0 });
      agenteMomentoEnvio = Date.now();
      return { msg };
    });
    if (feito.parou) { await agenteLiberar(cred, lead.id); return 'parou'; }
    const via = feito.msg.aviso ? `${feito.msg.via} (${feito.msg.aviso})` : feito.msg.via;
    // grava o envio JÁ (é o que impede mandar de novo)
    await resultado('enviado', { msg: feito.msg.texto, via });
    // se o contato/etiqueta não deu certo antes (conversa ainda vazia), tenta mais uma vez agora com a mensagem enviada
    if (aviso) aviso = await agenteSalvarEEtiquetar(tel, lead);
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

// ---------- Fila da captura (Bitrix e Meta): só vira lead quem tem WhatsApp ----------
// O lead-intake (Supabase) põe os leads novos na captura_fila; aqui cada número é testado no WhatsApp Web.
let agenteFilaEmCurso = false;
async function agenteFilaCaptura() {
  if (agenteFilaEmCurso) return;
  const cred = await agenteCredenciais();
  if (!cred) return;
  agenteFilaEmCurso = true;
  try {
    let fila;
    try {
      fila = await agenteRpc(cred, 'agente_fila_captura', { p_token: cred.token });
    } catch (err) {
      if (/agente_fila_captura|não existe|does not exist|PGRST202|Falta rodar/i.test(err.message)) return; // SQL ainda não rodado
      throw err;
    }
    if (!Array.isArray(fila) || !fila.length) return;
    let criou = false;
    for (const l of fila) {
      const tel = agenteTelefone(l.telefone);
      let tem = null;
      if (!tel || tel.length < 12) tem = false;
      else {
        try {
          const conf = await naVezWA(() => agenteNaConversa({ phone: tel, background: true }, 'checar_whatsapp_tab'));
          if (conf?.temWhatsapp === true) tem = true;
          else if (conf?.temWhatsapp === false) tem = false;
        } catch (_) { tem = null; } // WhatsApp Web não respondeu: tenta no próximo minuto
      }
      const r = await agenteRpc(cred, 'agente_resolver_captura', { p_token: cred.token, p_id: l.id, p_tem_whatsapp: tem });
      console.log('[Inmovya captura]', l.fonte, l.nome, '→', r?.acao);
      if (r?.acao === 'criado') criou = true;
      if (tem === null) break; // WhatsApp fora do ar: não adianta testar os outros agora
    }
    return criou;
  } finally {
    agenteFilaEmCurso = false;
  }
}

// ---------- Captura do CRM Midrah (a aba do Midrah manda os negócios novos; aqui cadastra no Inmovya) ----------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== 'midrah_capturar') return;
  (async () => {
    const cred = await agenteCredenciais();
    if (!cred) throw new Error('Abra o Inmovya uma vez neste Chrome (Esteiras → 1º contato) para ligar a captura.');
    const resultados = [];
    // 1º contato desligado: não abre o WhatsApp para conferir; os negócios esperam e entram quando ligar de novo
    try {
      const ativo = await agenteRpc(cred, 'agente_ativo', { p_token: cred.token });
      if (ativo === false) return { resultados: (request.leads || []).map(l => ({ id: l.id, ok: false, erro: '1º contato desligado' })) };
    } catch (_) { /* SQL novo ainda não rodado: segue */ }
    // já cadastrados antes? pula sem abrir o WhatsApp
    let vistos = new Set();
    try {
      const ids = (request.leads || []).map(l => String(l.id));
      vistos = new Set(await agenteRpc(cred, 'agente_captura_vistos', { p_token: cred.token, p_fonte: 'Midrah', p_ids: ids }) || []);
    } catch (_) { /* SQL novo ainda não rodado: segue conferindo */ }
    for (const l of request.leads || []) {
      if (vistos.has(String(l.id))) {
        resultados.push({ id: l.id, ok: true, acao: 'ja_visto' });
        continue;
      }
      try {
        // só cadastra quem tem WhatsApp
        const tel = agenteTelefone(l.telefone);
        if (!tel || tel.length < 12) {
          resultados.push({ id: l.id, ok: true, acao: 'sem_telefone' });
          continue;
        }
        let conf = null;
        try {
          conf = await naVezWA(() => agenteNaConversa({ phone: tel, background: true }, 'checar_whatsapp_tab'));
        } catch (_) { conf = null; }
        if (conf?.temWhatsapp === false) {
          resultados.push({ id: l.id, ok: true, acao: 'sem_whatsapp' });
          continue;
        }
        if (conf?.temWhatsapp !== true) {
          // não deu para conferir (WhatsApp Web fora do ar): tenta de novo no próximo minuto
          resultados.push({ id: l.id, ok: false, erro: 'WhatsApp Web não respondeu' });
          continue;
        }
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
    // Midrah: só cadastra. O 1º contato é feito pelo próprio Midrah (o agente não atende leads do Midrah).
    return { resultados };
  })()
    .then(r => sendResponse({ ok: true, ...r }))
    .catch(err => sendResponse({ ok: false, error: err.message }));
  return true;
});


// ---------- Roleta do Midrah: pega sozinho o lead oferecido para você ----------
// A aba do Midrah guarda o login (midrahSessao); aqui confere a cada 30 s, mesmo com a aba em segundo plano.
// Ao instalar/atualizar a extensão, injeta de novo o script nas abas do Midrah já abertas (sem precisar dar F5).
const ROLETA_ALARME = 'inmovya-roleta-midrah';
const ROLETA_BASE = 'https://inckgllwamnbnqoldngz.supabase.co/rest/v1/';
function roletaGarantir() {
  chrome.alarms.get(ROLETA_ALARME, a => {
    if (!a) chrome.alarms.create(ROLETA_ALARME, { periodInMinutes: 0.5, delayInMinutes: 0.1 });
  });
}
async function roletaReinjetar() {
  try {
    const abas = await chrome.tabs.query({ url: 'https://crm.midrah.com.br/*' });
    for (const t of abas) {
      chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['content/midrah-captura.js'] }).catch(() => {});
    }
  } catch (_) { /* sem permissão: vale no próximo F5 */ }
}
roletaGarantir();
chrome.runtime.onInstalled.addListener(() => { roletaGarantir(); roletaReinjetar(); });
chrome.runtime.onStartup.addListener(roletaGarantir);

const roletaFeitas = new Set();
async function roletaConferir() {
  const { midrahSessao: s } = await chrome.storage.local.get('midrahSessao');
  if (!s?.token || !s.apikey) return;
  if (s.expira && s.expira * 1000 < Date.now() + 15000) return; // login vencido: a aba renova quando estiver aberta
  const h = { apikey: s.apikey, Authorization: `Bearer ${s.token}` };
  const agora = encodeURIComponent(new Date().toISOString());
  const r = await fetch(`${ROLETA_BASE}lead_offers?select=id,status,expires_at&user_id=eq.${s.usuario}` +
    `&status=not.in.(aceito,expirado,recusado,passado)&expires_at=gt.${agora}&order=offered_at.asc&limit=5`, { headers: h });
  if (!r.ok) return;
  for (const o of await r.json()) {
    if (roletaFeitas.has(o.id)) continue;
    roletaFeitas.add(o.id);
    const a = await fetch(`${ROLETA_BASE}rpc/roulette_accept`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_offer: o.id })
    });
    if (a.ok) console.log('[Inmovya roleta] lead pego', o.id);
    else { console.warn('[Inmovya roleta] não pegou', a.status, (await a.text()).slice(0, 200)); roletaFeitas.delete(o.id); }
  }
}
chrome.alarms.onAlarm.addListener(alarme => {
  if (alarme.name === ROLETA_ALARME) roletaConferir().catch(err => console.warn('[Inmovya roleta]', err?.message || err));
});
