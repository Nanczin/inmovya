// robo-anuncios.js — Robô de anúncios DENTRO do Inmovya Scale (WhatsApp Business principal, pelo WhatsApp Web).
//
// Só trabalha quando você liga no Inmovya (Esteiras → Robô de anúncios). A cada minuto:
//   1. lê a LISTA de conversas da aba do WhatsApp Web (sem abrir nada) e pega as não lidas de número NÃO salvo;
//   2. para cada uma, sem abrir a conversa: já está em qualificação com o robô? continua.
//      Senão, só abre se a prévia for a mensagem do anúncio ("Olá! Tenho interesse…") e o número não estiver no Inmovya;
//   3. abre a conversa (janelinha do canto) e confere: é a 1ª vez que esse número fala com você? (nenhuma mensagem sua,
//      fora a saudação automática do WhatsApp Business). Só então responde.
// Nunca fala de preço, desconto, condição ou financiamento: nesses casos (e em áudio, pedido de corretor, etc.)
// diz "Vou te passar para o Estevão" e para. Você entrou na conversa? O robô para na hora.
// IA: Groq (modelo aberto, chave gratuita). Sem chave ou com erro, usa o roteiro fixo.
// Usa as funções do background.js / agente-primeiro-contato.js: naVezWA, agenteNaConversa, sendCampaignMessage,
// agenteCredenciais, agenteRpc, agenteSemAcento, agentePrimeiroNome.

const ROBO_ALARME = 'inmovya-robo-anuncios';
const ROBO_ENTRE_NOVOS_MS = 2 * 60 * 1000;   // 2 minutos entre um lead NOVO e outro
const ROBO_MAX_POR_RODADA = 4;
const ROBO_MAX_MSGS = 12;                     // depois disso, passa para você
const ROBO_ATRASO_MIN = 10;                   // respondeu depois de 10 min? começa com "desculpe a demora"

function roboGarantirAlarme() {
  chrome.alarms.get(ROBO_ALARME, a => {
    if (!a) chrome.alarms.create(ROBO_ALARME, { periodInMinutes: 1, delayInMinutes: 0.5 });
  });
}
roboGarantirAlarme();
chrome.runtime.onStartup.addListener(roboGarantirAlarme);
chrome.runtime.onInstalled.addListener(roboGarantirAlarme);
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === ROBO_ALARME) roboRodada().catch(err => console.error('[Inmovya robô]', err));
});

// ---------- Roteiro ----------
const ROBO_CAMPOS = {
  objetivo: 'Objetivo (investir ou morar)',
  dormitorios: 'Dormitórios',
  vaga: 'Vagas',
  regiao: 'Região/bairro',
  valor: 'Faixa de valor',
  entrada: 'Entrada disponível',
  planta_pronto: 'Planta ou pronto',
};
const ROBO_ROTULOS = { ...ROBO_CAMPOS, outras: 'Outras respostas' };
const ROBO_ROTEIRO = [ // usado sem IA (ou se a IA falhar)
  { campos: ['objetivo'], texto: 'Para começar: você procura o imóvel para *investimento* ou para *morar*?' },
  { campos: ['dormitorios', 'vaga'], texto: 'Quantos *dormitórios* você precisa? E quantas *vagas de garagem*?' },
  { campos: ['regiao'], texto: 'Qual *região ou bairro* você prefere?' },
  { campos: ['valor', 'entrada'], texto: 'Qual a *faixa de valor* que você tem em mente? E quanto teria disponível de *entrada*?' },
  { campos: ['planta_pronto'], texto: 'Última: prefere imóvel *na planta* ou *pronto para morar*?' },
];
const ROBO_MSG_FIM = 'Perfeito! Já vou separar as opções e te chamo em instantes.';
const roboMsgHumano = meuNome => `Vou te passar para o ${meuNome} agora mesmo`;

function roboSaudacao(meuNome, atrasado) {
  const desculpa = atrasado ? ' Desculpe a demora para responder.' : '';
  return `Olá!${desculpa} Aqui é o ${meuNome}, corretor. Obrigado pelo contato! Vi que você veio pelo nosso anúncio. Posso te fazer umas perguntas rápidas para te mandar as melhores opções?`;
}

// Travas que valem SEMPRE (com ou sem IA)
function roboPrecisaDoCorretor(texto, jaComecou) {
  const t = agenteSemAcento(texto);
  if (/\b(atendente|humano|pessoa de verdade|robo|bot|corretor|falar com (o|a|voce|alguem)|me liga|pode ligar|ligacao|ligar pra|ligar para|audio|visita|visitar|agendar)\b/.test(t)) return 'pediu atendimento/visita';
  if (/\b(preco|precos|quanto custa|quanto (e|fica|sai|ta|esta)|qual (o|e o) valor|valores|tabela|desconto|parcela|parcelas|parcelamento|condicao|condicoes|financia|financiamento|fgts|minha casa|mcmv|metragem|planta baixa|book|endereco|localizacao exata|entrega|disponibilidade)\b/.test(t)) return 'perguntou preço/condições/detalhes do imóvel';
  if (!jaComecou && /^(nao|n|agora nao|nao quero|nao obrigado|sem interesse|nao tenho interesse)\b/.test(t)) return 'não quis responder as perguntas';
  if (String(texto).length > 500) return 'mensagem longa';
  return null;
}
const roboTemValorOuCondicao = s => /R\$|\d[\d.,]*\s*(mil|k|milh|reais)\b|desconto|parcela|financ|fgts|m²|metros quadrados/i.test(String(s || ''));

// ---------- IA (Groq, compatível com a API da OpenAI) ----------
async function roboIA(estado, conversa, historico) {
  const respostas = conversa.respostas || {};
  const faltam = Object.keys(ROBO_CAMPOS).filter(k => !String(respostas[k] || '').trim());
  const transcricao = historico.slice(-20).map(m => `${m.dir === 'out' ? estado.meu_nome : 'Cliente'}: ${m.texto || `[${m.tipo}]`}`).join('\n');
  const sistema = [
    `Você é o ${estado.meu_nome}, corretor de imóveis em São Paulo, atendendo pelo WhatsApp um lead que chegou por anúncio.`,
    'Sua única tarefa é QUALIFICAR o lead de forma objetiva e simpática, uma ou duas perguntas por mensagem, coletando:',
    Object.entries(ROBO_CAMPOS).map(([k, v]) => `- ${k}: ${v}`).join('\n'),
    'Também anote o primeiro nome do cliente se ele disser (campo "nome"). Pode perguntar o nome de forma natural, uma vez.',
    'Regras obrigatórias:',
    '- Mensagens curtas de WhatsApp (1 a 3 frases), em português do Brasil, espelhando o jeito de escrever do cliente (formal/informal, emojis só se ele usar).',
    '- NUNCA fale preço, valores, desconto, parcelas, condições, financiamento, FGTS, metragem, endereço, prazo de entrega ou disponibilidade, e não prometa nada. Não invente informações sobre imóveis.',
    '- Se o cliente perguntar qualquer uma dessas coisas, pedir corretor/ligação/visita, demonstrar irritação, ou fizer pergunta que você não pode responder: acao "passar".',
    '- Se o cliente não quiser responder ou disser que não tem interesse: acao "passar".',
    '- Quando tiver todas (ou quase todas) as informações: acao "concluir" (o sistema manda a mensagem final).',
    '- Caso contrário: acao "responder" com a próxima pergunta, reconhecendo brevemente o que ele disse.',
    'Responda SOMENTE com um JSON: {"acao":"responder|passar|concluir","mensagem":"texto para o cliente (só em responder)",',
    '"respostas":{campo:valor dos campos que o cliente já informou, com as palavras dele},"nome":"","motivo":"(em passar) por quê"}',
  ].join('\n');
  const usuario = `Informações já coletadas: ${JSON.stringify(respostas)}\nFaltam: ${faltam.join(', ') || 'nada'}\n\nConversa até agora:\n${transcricao}`;
  const modelos = [estado.ia_modelo || 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];
  let ultimoErro;
  for (const modelo of [...new Set(modelos)]) {
    try {
      const corpo = {
        model: modelo,
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
      };
      if (/gpt-oss/.test(modelo)) corpo.reasoning_effort = 'low';
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(25000), // IA demorou? cai no roteiro fixo
        headers: { Authorization: `Bearer ${estado.ia_chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error?.message || `IA respondeu ${r.status}`);
      const texto = j?.choices?.[0]?.message?.content || '';
      const json = JSON.parse((texto.match(/\{[\s\S]*\}/) || [texto])[0]);
      if (!['responder', 'passar', 'concluir'].includes(json.acao)) throw new Error('resposta da IA sem ação');
      return { ...json, modelo };
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw ultimoErro || new Error('IA indisponível');
}

// Roteiro fixo: usado quando não há chave da IA OU quando a IA falha/demora (vale no meio da conversa também).
// Não depende de "etapa": olha qual foi a última pergunta do robô e quais informações ainda faltam.
function roboRoteiroFixo(conversa, textoCliente) {
  const respostas = { ...(conversa.respostas || {}) };
  const ultima = agenteSemAcento(conversa.ultima_msg_robo || '');
  const perguntado = ROBO_ROTEIRO.find(p => ultima && ultima.includes(agenteSemAcento(p.texto).slice(0, 40)));
  const resposta = String(textoCliente || '').trim();
  if (resposta) {
    if (perguntado) {
      for (const c of perguntado.campos) if (!String(respostas[c] || '').trim()) respostas[c] = resposta;
    } else if (!ultima.includes('perguntas rapidas')) { // "sim" depois da saudação não é resposta
      // a última pergunta foi da IA: descobre pelo assunto da pergunta onde guardar a resposta
      const assuntos = { objetivo: /investi|morar|moradia/, dormitorios: /dormit|quarto|suite/, vaga: /vaga|garagem/,
        regiao: /bairro|regiao|zona|localiza/, valor: /valor|faixa|investimento de|orcamento/, entrada: /entrada/, planta_pronto: /planta|pronto/ };
      const campos = Object.keys(assuntos).filter(c => assuntos[c].test(ultima) && !String(respostas[c] || '').trim());
      if (campos.length) for (const c of campos) respostas[c] = resposta;
      else respostas.outras = [respostas.outras, resposta].filter(Boolean).join(' / ').slice(0, 500);
    }
  }
  const falta = ROBO_ROTEIRO.find(p => p.campos.some(c => !String(respostas[c] || '').trim()));
  const preenchidos = Object.keys(ROBO_CAMPOS).filter(c => String(respostas[c] || '').trim()).length;
  if (!falta) return { acao: 'concluir', respostas, etapa: preenchidos, via: 'roteiro fixo' };
  return { acao: 'responder', mensagem: falta.texto, respostas, etapa: preenchidos, via: 'roteiro fixo' };
}

// ---------- WhatsApp ----------
async function roboAbaPrincipal() {
  const abas = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  return abas.find(t => !String(t.url || '').includes('inmovya_auto=1')) || null;
}

function roboQuando(m) { // "11/10/2026" + "16:23" -> Date
  const d = String(m?.data || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const h = String(m?.hora || '').match(/(\d{1,2}):(\d{2})/);
  if (!h) return null;
  const agora = new Date();
  const dt = d ? new Date(+d[3], +d[2] - 1, +d[1], +h[1], +h[2]) : new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), +h[1], +h[2]);
  if (!d && dt > agora) dt.setDate(dt.getDate() - 1);
  return dt;
}

const roboNorm = s => agenteSemAcento(s).slice(0, 60);

async function roboEnviar(tel, texto) {
  await naVezWA(() => sendCampaignMessage({ phone: tel, text: texto, background: true, gapMinMs: 0, gapMaxMs: 0 }));
}

async function roboAvisarVoce(estado, texto) {
  const tel = String(estado.numero_aviso || '').replace(/\D/g, '');
  if (!tel) return;
  try { await roboEnviar(tel, texto); } catch (err) { console.warn('[Inmovya robô] aviso não enviado', err.message); }
}

// ---------- Rodada ----------
let roboEmCurso = false;
async function roboRodada() {
  if (roboEmCurso) return;
  roboEmCurso = true;
  try { await roboRodadaAgora(); } finally { roboEmCurso = false; }
}

async function roboRodadaAgora() {
  const cred = await agenteCredenciais();
  if (!cred) return;
  let estado;
  try {
    estado = await agenteRpc(cred, 'robo_ext_estado', { p_token: cred.token });
  } catch (err) {
    if (!/robo_ext_estado|não existe|does not exist|PGRST202|Falta rodar/i.test(err.message)) console.warn('[Inmovya robô]', err.message);
    return;
  }
  if (!estado?.ativo) return;
  const aviso = a => agenteRpc(cred, 'robo_ext_aviso', { p_token: cred.token, p_aviso: a || null }).catch(() => {});

  const { roboOcupadoAte = 0 } = await chrome.storage.local.get('roboOcupadoAte');
  if (Date.now() < roboOcupadoAte) return;

  const aba = await roboAbaPrincipal();
  if (!aba?.id) return aviso('Abra o WhatsApp Web numa aba do Chrome para o robô ver as conversas novas.');
  let lista;
  try {
    lista = await chrome.tabs.sendMessage(aba.id, { action: 'robo_listar_conversas' });
  } catch (err) {
    return aviso('O WhatsApp Web não respondeu ao robô. Dê F5 na aba do WhatsApp.');
  }
  if (!lista?.ok) return aviso(lista?.error || 'Não consegui ler a lista de conversas.');
  await aviso(null);

  const frases = (estado.frases_anuncio || []).map(agenteSemAcento).filter(Boolean);
  const pareceAnuncio = t => { const s = agenteSemAcento(t); return !!s && frases.some(f => s.includes(f)); };

  await chrome.storage.local.set({ roboOcupadoAte: Date.now() + 12 * 60 * 1000 });
  try {
    let feitos = 0;
    for (const linha of lista.linhas || []) {
      if (feitos >= ROBO_MAX_POR_RODADA) break;
      const tel = agenteTelefone(linha.telefone);
      if (!tel || tel.length < 12) continue;
      if (tel.slice(-8) === String(estado.numero_aviso || '').slice(-8)) continue; // seu pessoal: nunca
      let info;
      try { info = await agenteRpc(cred, 'robo_ext_conversa', { p_token: cred.token, p_telefone: tel }); } catch (_) { continue; }
      const conversa = info?.conversa;
      if (conversa && conversa.situacao !== 'qualificando') continue; // encerrada/ignorada: é sua
      if (!conversa) {
        if (info?.ja_e_lead) continue;                // já está no Inmovya: é seu
        if (!pareceAnuncio(linha.ultimaMensagem)) continue; // não é a mensagem do anúncio: nem abre
        const { roboUltimoNovo = 0 } = await chrome.storage.local.get('roboUltimoNovo');
        if (Date.now() - roboUltimoNovo < ROBO_ENTRE_NOVOS_MS) continue; // 2 min entre leads novos
      }
      feitos++;
      try {
        await roboAtender(cred, estado, tel, conversa, pareceAnuncio);
      } catch (err) {
        console.warn('[Inmovya robô]', tel, err.message);
        await aviso(`Robô: erro com +${tel}: ${err.message}`);
      }
    }
  } finally {
    await chrome.storage.local.set({ roboOcupadoAte: 0 });
  }
}

async function roboAtender(cred, estado, tel, conversa, pareceAnuncio) {
  const salvar = dados => agenteRpc(cred, 'robo_ext_salvar', { p_token: cred.token, p_telefone: tel, p_dados: dados });
  const leitura = await naVezWA(() => agenteNaConversa({ phone: tel, background: true }, 'agent_read_chat_tab'));
  const msgs = Array.isArray(leitura?.mensagens) ? leitura.mensagens : [];
  if (!msgs.length) return;

  // mensagens do cliente que ainda não tiveram resposta
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i].dir === 'in') i--;
  const pendentes = msgs.slice(i + 1);
  if (!pendentes.length) return;
  const ultimaDele = roboQuando(pendentes[pendentes.length - 1]);
  const idadeMin = ultimaDele ? (Date.now() - ultimaDele.getTime()) / 60000 : 0;
  const atrasado = idadeMin > ROBO_ATRASO_MIN;
  const textoCliente = pendentes.map(m => m.texto).filter(Boolean).join('\n').trim();
  const temMidia = pendentes.some(m => m.tipo && m.tipo !== 'texto');

  if (!conversa) {
    // 1ª vez? Nenhuma mensagem sua (só aceita a saudação automática do Business, logo após a 1ª dele)
    const entradas = msgs.filter(m => m.dir === 'in');
    const saidas = msgs.filter(m => m.dir === 'out');
    const primeira = roboQuando(entradas[0]);
    const saudacaoAuto = saidas.length === 1 && primeira && roboQuando(saidas[0]) && Math.abs(roboQuando(saidas[0]) - primeira) <= 2 * 60000;
    const novo = entradas.length <= 6 && (saidas.length === 0 || saudacaoAuto) && entradas.some(m => pareceAnuncio(m.texto));
    if (!novo) {
      await salvar({ situacao: 'ignorado', nome: '' });
      await roboAvisarVoce(estado, `📩 *Robô:* abri a conversa de +${tel} achando que era lead de anúncio, mas não é contato novo. *Não respondi* — confira você.\n👉 https://wa.me/${tel}`);
      return;
    }
    if (idadeMin > (Number(estado.recuperar_horas) || 12) * 60) {
      await salvar({ situacao: 'ignorado' });
      await roboAvisarVoce(estado, `⏰ *Robô:* o lead de anúncio +${tel} escreveu há mais de ${estado.recuperar_horas}h. Não respondi — é com você.\n💬 "${textoCliente.slice(0, 200)}"\n👉 https://wa.me/${tel}`);
      return;
    }
    await chrome.storage.local.set({ roboUltimoNovo: Date.now() });
    // 1ª mensagem: o texto do anúncio às vezes já fala em "valores"; por isso aqui só áudio/arquivo passa direto
    const motivo = temMidia ? 'mandou áudio/arquivo' : null;
    const nova = { etapa: 0, respostas: {}, situacao: 'qualificando', nome: '', msgs_robo: 0 };
    if (motivo) return roboPassar(cred, estado, tel, nova, motivo, textoCliente, salvar);
    const texto = roboSaudacao(estado.meu_nome, atrasado);
    await roboEnviar(tel, texto);
    await salvar({ ...nova, msgs_robo: 1, ultima_msg_robo: texto });
    // cadastra já no 1º contato: ninguém se perde se parar de responder
    await agenteRpc(cred, 'robo_ext_registrar', { p_token: cred.token, p_nome: '', p_telefone: tel, p_observacoes: 'Veio pelo anúncio — robô iniciou a qualificação' }).catch(() => {});
    return;
  }

  // conversa em andamento: você entrou nela? (a última mensagem "sua" não é a do robô)
  const ultimaSua = [...msgs].reverse().find(m => m.dir === 'out');
  if (ultimaSua && conversa.ultima_msg_robo && roboNorm(ultimaSua.texto) && !roboNorm(conversa.ultima_msg_robo).startsWith(roboNorm(ultimaSua.texto).slice(0, 40))
      && !roboNorm(ultimaSua.texto).startsWith(roboNorm(conversa.ultima_msg_robo).slice(0, 40))) {
    await salvar({ situacao: 'transferido', resultado_inmovya: 'você assumiu a conversa' });
    return;
  }

  const jaComecou = Number(conversa.etapa || 0) > 0 || Object.keys(conversa.respostas || {}).length > 0;
  const trava = temMidia ? 'mandou áudio/arquivo' : roboPrecisaDoCorretor(textoCliente, jaComecou);
  if (trava) return roboPassar(cred, estado, tel, conversa, trava, textoCliente, salvar);
  if (Number(conversa.msgs_robo || 0) >= ROBO_MAX_MSGS) return roboPassar(cred, estado, tel, conversa, 'conversa ficou longa', textoCliente, salvar);

  let decisao = null;
  if (estado.ia_chave) {
    try {
      decisao = await roboIA(estado, conversa, msgs);
      if (decisao.acao === 'responder' && (!String(decisao.mensagem || '').trim() || roboTemValorOuCondicao(decisao.mensagem))) {
        decisao = { ...decisao, acao: 'passar', motivo: 'a IA ia falar de valores — passei para você' };
      }
    } catch (err) {
      console.warn('[Inmovya robô] IA falhou, uso o roteiro fixo:', err.message);
      decisao = null;
    }
  }
  if (!decisao) decisao = roboRoteiroFixo(conversa, textoCliente);

  const respostas = { ...(conversa.respostas || {}), ...Object.fromEntries(Object.entries(decisao.respostas || {}).filter(([, v]) => String(v || '').trim())) };
  const nome = String(decisao.nome || conversa.nome || '').trim();
  const atual = { ...conversa, respostas, nome, etapa: decisao.etapa ?? Number(conversa.etapa || 0) + 1 };

  if (decisao.acao === 'passar') return roboPassar(cred, estado, tel, atual, decisao.motivo || 'a IA achou melhor você assumir', textoCliente, salvar);
  if (decisao.acao === 'concluir') {
    await roboEnviar(tel, ROBO_MSG_FIM);
    await salvar({ ...atual, situacao: 'concluido', msgs_robo: Number(conversa.msgs_robo || 0) + 1, ultima_msg_robo: ROBO_MSG_FIM });
    return roboFinalizar(cred, estado, tel, atual, null);
  }
  let texto = String(decisao.mensagem).trim().slice(0, 600);
  if (atrasado && !/desculp/i.test(texto)) texto = `Desculpe a demora! ${texto}`;
  await roboEnviar(tel, texto);
  await salvar({ ...atual, situacao: 'qualificando', msgs_robo: Number(conversa.msgs_robo || 0) + 1, ultima_msg_robo: texto });
}

async function roboPassar(cred, estado, tel, conversa, motivo, textoCliente, salvar) {
  const texto = roboMsgHumano(estado.meu_nome);
  await roboEnviar(tel, texto);
  await salvar({ ...conversa, situacao: 'transferido', ultima_msg_robo: texto, msgs_robo: Number(conversa.msgs_robo || 0) + 1 });
  return roboFinalizar(cred, estado, tel, conversa, { motivo, texto: textoCliente });
}

async function roboFinalizar(cred, estado, tel, conversa, transf) {
  const linhas = Object.entries(conversa.respostas || {}).filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `${ROBO_ROTULOS[k] || k.replace(/_/g, ' ')}: ${String(v).replace(/\s+/g, ' ')}`);
  const obs = [...linhas, transf ? `Passado para o ${estado.meu_nome}: ${transf.motivo}` : 'Qualificação completa'].join(' | ');
  let inmovya;
  try {
    const r = await agenteRpc(cred, 'robo_ext_registrar', { p_token: cred.token, p_nome: conversa.nome || '', p_telefone: tel, p_observacoes: obs });
    inmovya = { na_fila_whatsapp: 'cadastrado (entra em Validação)', ja_na_fila: 'respostas acrescentadas no cadastro', ja_cadastrado: 'já era lead (respostas acrescentadas)' }[r?.acao] || r?.acao;
  } catch (err) {
    inmovya = 'ERRO ao cadastrar: ' + err.message.slice(0, 120);
  }
  // etiqueta 20% e salva o contato com o nome (se o cliente disse)
  let etiqueta = '';
  try {
    const nome = agentePrimeiroNome(conversa.nome) ? `${String(conversa.nome).trim()}${conversa.empreendimento ? ' ' + conversa.empreendimento : ''}` : '';
    const r = await naVezWA(() => agenteNaConversa({ phone: tel, background: true, nome, etiqueta: '20%' }, 'agent_save_and_label_tab'));
    etiqueta = r?.etiqueta?.ok === false ? 'não consegui pôr a etiqueta 20%' : 'etiqueta 20%';
    if (nome) etiqueta += r?.contato?.salvo ? ' · contato salvo' : ' · contato NÃO salvo';
  } catch (err) {
    etiqueta = 'não consegui etiquetar (' + err.message.slice(0, 60) + ')';
  }
  await agenteRpc(cred, 'robo_ext_salvar', { p_token: cred.token, p_telefone: tel, p_dados: { resultado_inmovya: inmovya } }).catch(() => {});
  const cab = transf ? `🔴 *Lead do anúncio PRECISA DE VOCÊ* (${transf.motivo})` : '🟢 *Lead do anúncio qualificado*';
  const ultima = transf?.texto ? `\n💬 Última mensagem: "${transf.texto.slice(0, 300)}"` : '';
  await roboAvisarVoce(estado, `${cab}\n👤 ${conversa.nome || '-'}\n📱 +${tel}\n${linhas.map(l => '• ' + l).join('\n') || '• (sem respostas)'}${ultima}\n🗂 Inmovya: ${inmovya}\n🏷 ${etiqueta}\n👉 https://wa.me/${tel}`);
}
