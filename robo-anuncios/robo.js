// Robô de qualificação dos anúncios (WhatsApp dedicado, via OpenWA)
// - Só responde quem escreveu primeiro; ignora grupos, status e mensagens enviadas pelo próprio número.
// - Uma pergunta por vez. Pergunta fora do roteiro, preço/condição ou pedido de humano => passa para o Estevão e para.
// - Depois de encerrar ou passar para o Estevão, nunca mais responde aquele contato.
// - Cadastra no Inmovya (fila de conferência → Validação), etiqueta "20%" se existir e avisa o Estevão.
// Sem dependências: precisa só do Node.js 22+.

"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PASTA = __dirname;
const CONFIG_ARQ = path.join(PASTA, "config.json");
const LOG_ARQ = path.join(PASTA, "robo-log.txt");

// ---------------- configuração ----------------
const cfg = fs.existsSync(CONFIG_ARQ) ? JSON.parse(fs.readFileSync(CONFIG_ARQ, "utf8").replace(/^\uFEFF/, "")) : {};
const padrao = {
  openwaUrl: "http://localhost:2785/api",
  openwaPastaDados: path.join(PASTA, "OpenWA", "data"),
  sessao: "atendimento-anuncios",
  porta: 3999,
  quem: "pc", // "pc" (principal) ou "nuvem" (reserva)
  numeroPessoal: "5511988782027",
  meuNome: "Estevão",
  esperaAgruparMs: 8000, // espera o cliente terminar de digitar (várias mensagens seguidas)
  pausaMinMs: 4000,
  pausaMaxMs: 9000,
  ignorarMaisAntigasQueMin: 10,
  empreendimentos: [],
  testeSomenteNumeros: [], // se tiver números aqui, o robô SÓ responde esses (modo teste)
  recuperarHoras: 12, // ao ligar: retoma quem escreveu nas últimas X horas e ficou sem resposta (0 = desliga)
  recuperarIntervaloMin: 2, // minutos entre um contato e outro na recuperação
};
for (const [k, v] of Object.entries(padrao)) if (cfg[k] === undefined) cfg[k] = v;
if (!cfg.webhookSegredo && require.main === module) {
  cfg.webhookSegredo = crypto.randomBytes(24).toString("hex");
  fs.writeFileSync(CONFIG_ARQ, JSON.stringify(cfg, null, 2));
}

function log(...partes) {
  const linha = `[${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] ${partes.join(" ")}`;
  console.log(linha);
  try { fs.appendFileSync(LOG_ARQ, linha + "\n"); } catch {}
}

function chaveApi() {
  if (cfg.openwaChave) return cfg.openwaChave;
  const arq = path.join(cfg.openwaPastaDados, ".api-key");
  if (fs.existsSync(arq)) return fs.readFileSync(arq, "utf8").trim();
  throw new Error("Chave do OpenWA não encontrada (OpenWA/data/.api-key). O OpenWA está ligado?");
}

// ---------------- roteiro ----------------
const PERGUNTAS = [
  { campo: "objetivo", texto: "Para começar: você procura o imóvel para *investimento* ou para *morar*?" },
  { campo: "dormitorios_vaga", texto: "Quantos *dormitórios* você precisa? E quantas *vagas de garagem*?" },
  { campo: "regiao", texto: "Qual *região ou bairro* você prefere?" },
  { campo: "valor_entrada", texto: "Qual a *faixa de valor* que você tem em mente? E quanto teria disponível de *entrada*?" },
  { campo: "planta_pronto", texto: "Última: prefere imóvel *na planta* ou *pronto para morar*?" },
];
const ROTULOS = {
  objetivo: "Objetivo",
  dormitorios_vaga: "Dormitórios e vaga",
  regiao: "Região",
  valor_entrada: "Faixa de valor e entrada",
  planta_pronto: "Planta ou pronto",
};
const MSG_FIM = "Perfeito! Já vou separar as opções e te chamo em instantes.";
const MSG_HUMANO = `Vou te passar para o ${cfg.meuNome} agora mesmo`;

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function saudacao(nome, empreendimento, atrasado = false) {
  const primeiro = String(nome || "").trim().split(/\s+/)[0];
  const ola = primeiro && /[a-zà-ú]/i.test(primeiro) ? `Olá, ${primeiro}!` : "Olá!";
  const anuncio = empreendimento ? `Vi que você veio pelo anúncio do *${empreendimento}*. ` : "Vi que você veio pelo nosso anúncio. ";
  const desculpa = atrasado ? " Desculpe a demora para responder." : "";
  return `${ola}${desculpa} Aqui é o ${cfg.meuNome}, corretor. Obrigado pelo contato! ${anuncio}Posso te fazer umas perguntas rápidas para te mandar as melhores opções?`;
}
const MSG_DESCULPA = "Desculpe a demora!";

function acharEmpreendimento(texto) {
  const t = semAcento(texto);
  for (const nome of cfg.empreendimentos || []) {
    const variantes = [nome, ...(cfg.apelidos?.[nome] || [])];
    if (variantes.some((v) => v && t.includes(semAcento(v)))) return nome;
  }
  const m = String(texto || "").match(/interesse (?:no|na|em|pelo|pela)\s+(?:empreendimento\s+|im[oó]vel\s+)?([A-ZÀ-Ú0-9][\wÀ-ú.'&-]*(?:\s+(?:(?:da|do|de|dos|das|e)\s+)?[A-ZÀ-Ú0-9][\wÀ-ú.'&-]*){0,4})/);
  return m ? m[1].trim() : null;
}

// Pedido de humano, preço/condição ou pergunta fora do roteiro?
function precisaDoEstevao(texto, etapa) {
  const t = semAcento(texto);
  const humano = /\b(atendente|humano|pessoa de verdade|robo|corretor|falar com (o|a|voce|alguem)|me liga|pode ligar|ligacao|ligar pra|ligar para|audio)\b/;
  const preco = /\b(preco|precos|quanto custa|quanto (e|fica|sai|ta|esta)|qual (o|e o) valor|valores|tabela|desconto|parcela|parcelas|parcelamento|condicao|condicoes|financia|financiamento|fgts|minha casa|mcmv|metragem|planta baixa|book|localizacao exata|endereco)\b/;
  if (humano.test(t)) return "pediu atendimento humano";
  if (preco.test(t)) return "perguntou preço/condições";
  if (etapa >= 1 && texto.includes("?")) return "fez uma pergunta fora do roteiro";
  if (texto.length > 350) return "mensagem longa fora do roteiro";
  return null;
}

function recusou(texto) {
  const t = semAcento(texto).trim();
  return /^(nao|n|agora nao|nao quero|nao obrigado|nao, obrigado|sem interesse|nao tenho interesse)\b/.test(t);
}

// ---------------- OpenWA ----------------
let sessaoId = null;

async function openwa(metodo, rota, corpo, tentativa = 0) {
  const r = await fetch(cfg.openwaUrl + rota, {
    method: metodo,
    headers: { "X-API-Key": chaveApi(), "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
  if (r.status === 429 && tentativa < 5) {
    const seg = Number(dados?.retryAfterSeconds || dados?.error?.retryAfterSeconds || 30);
    log(`OpenWA pediu para esperar ${seg}s (ritmo de envio).`);
    await dormir(Math.min(seg, 600) * 1000);
    return openwa(metodo, rota, corpo, tentativa + 1);
  }
  if ((r.status === 409 || r.status === 503) && tentativa < 3) {
    await dormir(5000);
    return openwa(metodo, rota, corpo, tentativa + 1);
  }
  if (!r.ok) throw new Error(`OpenWA ${metodo} ${rota} → ${r.status} ${typeof dados === "string" ? dados : JSON.stringify(dados)}`);
  return dados;
}

async function acharSessao() {
  const lista = await openwa("GET", "/sessions");
  const arr = Array.isArray(lista) ? lista : lista?.items || lista?.sessions || [];
  const s = arr.find((x) => x.name === cfg.sessao);
  if (!s) throw new Error(`Sessão "${cfg.sessao}" não existe no OpenWA ainda.`);
  const proibidos = [cfg.numeroPessoal, ...(cfg.numerosProibidos || [])].map((n) => String(n).replace(/\D/g, "")).filter(Boolean);
  const fone = String(s.phone || "").replace(/\D/g, "");
  if (fone && proibidos.some((n) => n.slice(-8) === fone.slice(-8))) {
    log(`PARADO: a sessão está conectada no número +${fone}, que NÃO é o número dos anúncios. Desconecte e leia o QR Code com o chip dos anúncios.`);
    process.exit(2);
  }
  sessaoId = s.id;
  return s;
}

async function garantirWebhook() {
  const url = `http://localhost:${cfg.porta}/webhook`;
  const lista = await openwa("GET", `/sessions/${sessaoId}/webhooks`);
  const arr = Array.isArray(lista) ? lista : lista?.items || [];
  const meu = arr.find((w) => w.url === url);
  if (meu) {
    await openwa("PUT", `/sessions/${sessaoId}/webhooks/${meu.id}`, { url, events: ["message.received"], secret: cfg.webhookSegredo });
  } else {
    await openwa("POST", `/sessions/${sessaoId}/webhooks`, { url, events: ["message.received"], secret: cfg.webhookSegredo });
  }
  log("Webhook do OpenWA apontando para o robô:", url);
}

async function enviarTexto(chatId, texto) {
  await dormir(cfg.pausaMinMs + Math.random() * (cfg.pausaMaxMs - cfg.pausaMinMs));
  try { await openwa("POST", `/sessions/${sessaoId}/chats/typing`, { chatId, state: "typing" }); } catch {}
  await dormir(1500 + Math.min(texto.length * 40, 4000));
  await openwa("POST", `/sessions/${sessaoId}/messages/send-text`, { chatId, text: texto, linkPreview: false });
}

async function etiquetar20(chatId) {
  try {
    const labels = await openwa("GET", `/sessions/${sessaoId}/labels`);
    const l = (Array.isArray(labels) ? labels : []).find((x) => String(x.name).replace(/\s/g, "") === "20%");
    if (!l) return "sem etiqueta 20% neste WhatsApp";
    await openwa("POST", `/sessions/${sessaoId}/labels/chat/${encodeURIComponent(chatId)}`, { labelId: String(l.id) });
    return "etiqueta 20% aplicada";
  } catch (e) {
    return "não deu para etiquetar (" + e.message.slice(0, 80) + ")";
  }
}

// ---------------- Inmovya (Supabase) ----------------
async function rpc(nome, args) {
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: cfg.roboToken, ...args }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Inmovya ${nome} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

let atendendo = cfg.quem === "pc";
async function sinal() {
  try {
    const s = await rpc("robo_sinal", { p_quem: cfg.quem });
    if (s.atende !== atendendo) log(s.atende ? "Este robô passou a ATENDER." : "Este robô ficou em ESPERA (o outro está atendendo).");
    const virou = !atendendo && !!s.atende;
    atendendo = !!s.atende;
    if (virou) recuperar(); // assumiu o atendimento: retoma quem ficou sem resposta
  } catch (e) {
    log("Falha no sinal do Inmovya:", e.message);
    // sem internet com o Inmovya: o PC continua atendendo; a nuvem fica em espera
    atendendo = cfg.quem === "pc";
  }
}

// ---------------- conversa ----------------
const filas = new Map(); // chatId -> { msgs: [], timer }
const ocupados = new Set();

function telefoneDe(chatId, senderPhone) {
  const t = chatId.endsWith("@c.us") ? chatId.split("@")[0] : senderPhone || "";
  return String(t).replace(/\D/g, "");
}
function podeAtender(telefone) {
  if (telefone.length < 10) return false;
  const teste = (cfg.testeSomenteNumeros || []).map((n) => String(n).replace(/\D/g, ""));
  if (teste.length) return teste.includes(telefone); // modo teste: SÓ esses números (pode incluir o pessoal)
  if (telefone === cfg.numeroPessoal) return false; // fora do teste: nunca conversa com o seu número pessoal
  return true;
}

function receber(evento) {
  const d = evento.data || {};
  if (evento.event !== "message.received") return;
  if (d.fromMe || d.isGroup || d.isStatusBroadcast) return;
  if (d.kind && d.kind !== "individual") return;
  const chatId = d.chatId || d.from;
  if (!chatId || /@g\.us$|@broadcast$|@newsletter$|status@/.test(chatId)) return;
  const ts = Number(d.timestamp || 0) * 1000;
  if (ts && Date.now() - ts > cfg.ignorarMaisAntigasQueMin * 60000) return;

  const telefone = telefoneDe(chatId, d.senderPhone);
  if (telefone.length < 10) { log("Mensagem sem telefone identificável, ignorada:", chatId); return; }
  if (!podeAtender(telefone)) return;

  const nome = d.contact?.pushName || d.contact?.name || d.chatName || "";
  const item = filas.get(chatId) || { msgs: [], timer: null, telefone, nome };
  item.msgs.push({ tipo: d.type || "chat", texto: String(d.body || ""), id: d.id });
  if (nome) item.nome = nome;
  clearTimeout(item.timer);
  item.timer = setTimeout(() => processar(chatId).catch((e) => log("ERRO", chatId, e.message)), cfg.esperaAgruparMs);
  filas.set(chatId, item);
}

async function processar(chatId) {
  if (ocupados.has(chatId)) { // ainda respondendo a anterior: tenta de novo daqui a pouco
    const it = filas.get(chatId);
    if (it) it.timer = setTimeout(() => processar(chatId).catch((e) => log("ERRO", chatId, e.message)), 3000);
    return;
  }
  const item = filas.get(chatId);
  if (!item || !item.msgs.length) return;
  filas.delete(chatId);
  if (!atendendo) { log(`Em espera — ${item.telefone} não respondido por este robô (${cfg.quem}).`); return; }
  ocupados.add(chatId);
  try { await conversar(chatId, item); } finally { ocupados.delete(chatId); }
}

async function conversar(chatId, item, atrasado = false) {
  const { telefone, nome, msgs } = item;
  const texto = msgs.map((m) => m.texto).filter(Boolean).join("\n").trim();
  const soTexto = msgs.every((m) => m.tipo === "chat" || m.tipo === "text");
  const info = await rpc("robo_conversa", { p_telefone: telefone });
  let c = info.conversa;

  if (c && c.situacao !== "qualificando") return "encerrada"; // encerrada: nunca mais responde
  if (!c && info.ja_e_lead) {
    log(`${telefone} já é lead no Inmovya — robô não aborda; avisando o ${cfg.meuNome}.`);
    await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: { chat_id: chatId, nome, situacao: "transferido", atendido_por: cfg.quem, resultado_inmovya: "ja_era_lead" } });
    await avisar(`📣 *Lead que JÁ ESTÁ no Inmovya* escreveu no número dos anúncios (o robô não respondeu).\n👤 ${nome || "-"}\n📱 +${telefone}\n💬 "${texto.slice(0, 300)}"`);
    return "ja_era_lead";
  }

  if (!c) {
    const empreendimento = acharEmpreendimento(texto);
    c = { chat_id: chatId, nome, empreendimento, etapa: 0, respostas: {}, situacao: "qualificando", atendido_por: cfg.quem };
    const motivo = !soTexto ? "mandou áudio/arquivo" : precisaDoEstevao(texto, 0);
    if (motivo) { await transferir(chatId, telefone, c, motivo, texto); return "transferido"; }
    await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: c });
    await enviarTexto(chatId, saudacao(nome, empreendimento, atrasado));
    log(`Novo contato ${telefone} (${nome || "sem nome"})${empreendimento ? " — " + empreendimento : ""}: saudação enviada${atrasado ? " (recuperação)" : ""}.`);
    await cadastrarJa(telefone, c);
    return "saudacao";
  }

  if (!c.empreendimento) c.empreendimento = acharEmpreendimento(texto);
  const motivo = !soTexto ? "mandou áudio/arquivo" : precisaDoEstevao(texto, c.etapa + 1);
  if (motivo) { await transferir(chatId, telefone, c, motivo, texto); return "transferido"; }

  if (c.etapa === 0) {
    if (recusou(texto)) { await transferir(chatId, telefone, c, "não quis responder as perguntas", texto); return "transferido"; }
  } else {
    const p = PERGUNTAS[c.etapa - 1];
    c.respostas = { ...(c.respostas || {}), [p.campo]: texto };
  }

  if (c.etapa < PERGUNTAS.length) {
    const prox = PERGUNTAS[c.etapa];
    c.etapa += 1;
    await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: { ...c, atendido_por: cfg.quem } });
    await enviarTexto(chatId, atrasado ? `${MSG_DESCULPA} ${prox.texto}` : prox.texto);
    return "pergunta";
  }

  // respondeu a última pergunta
  c.situacao = "concluido";
  await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: { ...c, atendido_por: cfg.quem } });
  await enviarTexto(chatId, MSG_FIM);
  await finalizar(chatId, telefone, c, null);
  return "qualificado";
}

// Cadastra no Inmovya logo no 1º contato, para nenhum lead se perder se ele parar de responder.
// No fim da qualificação o mesmo lead recebe as respostas (o Inmovya acrescenta nas observações).
async function cadastrarJa(telefone, c) {
  const obs = [c.empreendimento ? `Empreendimento: ${c.empreendimento}` : null, "Veio pelo anúncio — robô iniciou a qualificação"].filter(Boolean).join(" | ");
  try {
    const r = await rpc("robo_registrar_lead", { p_nome: c.nome || "", p_telefone: telefone, p_observacoes: obs });
    log(`${telefone}: cadastrado no Inmovya no 1º contato (${r?.acao || "ok"}).`);
  } catch (e) {
    log(`${telefone}: não consegui cadastrar no 1º contato: ${e.message.slice(0, 150)}`);
  }
}

// ---------------- recuperação ao ligar ----------------
// Quem escreveu nas últimas `recuperarHoras` e ficou SEM resposta (a última mensagem do chat é do cliente)
// recebe resposta agora, um contato por vez, com `recuperarIntervaloMin` minutos entre eles.
let recuperando = false;
async function recuperar() {
  if (recuperando || !cfg.recuperarHoras || !atendendo) return;
  recuperando = true;
  const feitos = [];
  try {
    const agora = Date.now();
    const desde = agora - cfg.recuperarHoras * 3600e3;
    const ate = agora - cfg.ignorarMaisAntigasQueMin * 60e3; // as mais novas chegam pelo webhook normal
    const chats = await openwa("GET", `/sessions/${sessaoId}/chats?limit=300`);
    const lista = (Array.isArray(chats) ? chats : chats?.items || [])
      .filter((ch) => (ch.kind ? ch.kind === "individual" : !ch.isGroup) && !ch.archived)
      .filter((ch) => /@(c\.us|lid|s\.whatsapp\.net)$/.test(ch.id))
      .filter((ch) => ch.timestamp * 1000 >= desde && ch.timestamp * 1000 <= ate)
      .sort((a, b) => a.timestamp - b.timestamp); // quem esperou mais vai primeiro
    log(`Recuperação: ${lista.length} conversa(s) com movimento nas últimas ${cfg.recuperarHoras}h para conferir.`);
    let primeiro = true;
    for (const ch of lista) {
      if (!atendendo) { log("Recuperação interrompida: este robô entrou em espera."); break; }
      if (ch.id.endsWith("@c.us") && !podeAtender(telefoneDe(ch.id))) continue; // nem lê o histórico (ex.: modo teste)
      let hist;
      try { hist = await openwa("GET", `/sessions/${sessaoId}/messages/${encodeURIComponent(ch.id)}/history?limit=20`); }
      catch (e) { log(`Recuperação: não li o histórico de ${ch.id}: ${e.message.slice(0, 120)}`); continue; }
      const msgs = (Array.isArray(hist) ? hist : hist?.items || hist?.messages || []).sort((a, b) => a.timestamp - b.timestamp);
      if (!msgs.length || msgs[msgs.length - 1].fromMe) continue; // já respondido (pelo robô ou por você)
      const pendentes = [];
      for (let i = msgs.length - 1; i >= 0 && !msgs[i].fromMe; i--) pendentes.unshift(msgs[i]);
      const ultima = pendentes[pendentes.length - 1];
      if (ultima.timestamp * 1000 < desde || ultima.timestamp * 1000 > ate) continue;
      const telefone = telefoneDe(ch.id, ultima.senderPhone);
      if (!podeAtender(telefone)) continue;
      if (ocupados.has(ch.id) || filas.has(ch.id)) continue; // já está sendo atendido pelo webhook

      if (!primeiro) await dormir(cfg.recuperarIntervaloMin * 60e3);
      primeiro = false;
      const item = { telefone, nome: ch.name && !/^\+?\d[\d\s-]+$/.test(ch.name) ? ch.name : "", msgs: pendentes.map((m) => ({ tipo: m.type || "chat", texto: String(m.body || ""), id: m.id })) };
      ocupados.add(ch.id);
      try {
        const r = await conversar(ch.id, item, true);
        log(`Recuperação: ${telefone} → ${r || "sem ação"}`);
        if (r && r !== "encerrada") feitos.push(`• ${item.nome || "-"} (+${telefone}): ${{ saudacao: "recebeu a saudação", pergunta: "continuou as perguntas", transferido: "passado para você", qualificado: "qualificado", ja_era_lead: "já era lead (não respondido)" }[r] || r}`);
      } catch (e) {
        log(`Recuperação: erro com ${telefone}: ${e.message.slice(0, 150)}`);
      } finally {
        ocupados.delete(ch.id);
      }
    }
  } catch (e) {
    log("Recuperação falhou:", e.message.slice(0, 200));
  } finally {
    recuperando = false;
  }
  if (feitos.length) await avisar(`🔁 *Robô religado — respondi quem ficou sem resposta* (últimas ${cfg.recuperarHoras}h):\n${feitos.join("\n")}`);
  log(`Recuperação terminada: ${feitos.length} contato(s) atendido(s).`);
}

async function transferir(chatId, telefone, c, motivo, texto) {
  c.situacao = "transferido";
  await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: { ...c, atendido_por: cfg.quem } });
  await enviarTexto(chatId, MSG_HUMANO);
  await finalizar(chatId, telefone, c, { motivo, texto });
}

function resumoRespostas(c) {
  const linhas = [];
  if (c.empreendimento) linhas.push(`Empreendimento: ${c.empreendimento}`);
  for (const p of PERGUNTAS) if (c.respostas?.[p.campo]) linhas.push(`${ROTULOS[p.campo]}: ${c.respostas[p.campo].replace(/\s+/g, " ")}`);
  return linhas;
}

async function finalizar(chatId, telefone, c, transf) {
  const linhas = resumoRespostas(c);
  const obs = [...linhas, transf ? `Passado para o ${cfg.meuNome}: ${transf.motivo}` : "Qualificação completa"].join(" | ");
  let inmovya = "";
  try {
    const r = await rpc("robo_registrar_lead", { p_nome: c.nome || "", p_telefone: telefone, p_observacoes: obs });
    inmovya = { na_fila_whatsapp: "cadastrado (entra em Validação após a conferência do WhatsApp)", ja_na_fila: "já estava na fila do Inmovya (respostas acrescentadas)", ja_cadastrado: "já era lead (respostas acrescentadas)" }[r.acao] || r.acao;
  } catch (e) {
    inmovya = "ERRO ao cadastrar: " + e.message.slice(0, 120);
  }
  const etiqueta = await etiquetar20(chatId);
  try { await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: { resultado_inmovya: inmovya } }); } catch {}
  log(`${telefone}: ${transf ? "TRANSFERIDO (" + transf.motivo + ")" : "QUALIFICADO"} — Inmovya: ${inmovya} — ${etiqueta}`);

  const cab = transf ? `🔴 *Lead do anúncio PRECISA DE VOCÊ* (${transf.motivo})` : "🟢 *Lead do anúncio qualificado*";
  const ultima = transf?.texto ? `\n💬 Última mensagem: "${transf.texto.slice(0, 300)}"` : "";
  await avisar(`${cab}\n👤 ${c.nome || "-"}\n📱 +${telefone}\n${linhas.map((l) => "• " + l).join("\n") || "• (sem respostas)"}${ultima}\n🗂 Inmovya: ${inmovya}\n🏷 ${etiqueta}\n👉 https://wa.me/${telefone}`);
}

async function avisar(texto) {
  try {
    await openwa("POST", `/sessions/${sessaoId}/messages/send-text`, { chatId: `${cfg.numeroPessoal}@c.us`, text: texto, linkPreview: false });
  } catch (e) {
    log("Não consegui avisar no seu WhatsApp pessoal:", e.message);
  }
}

// ---------------- servidor do webhook ----------------
function assinaturaOk(corpo, assinatura) {
  if (!assinatura) return false;
  const esperado = "sha256=" + crypto.createHmac("sha256", cfg.webhookSegredo).update(corpo).digest("hex");
  const a = Buffer.from(assinatura), b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const vistos = new Set();
const servidor = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end(`Robô de anúncios ligado (${cfg.quem}) — ${atendendo ? "ATENDENDO" : "EM ESPERA"} — sessão ${cfg.sessao}`);
  }
  if (req.method !== "POST" || req.url !== "/webhook") { res.writeHead(404); return res.end(); }
  const partes = [];
  req.on("data", (p) => partes.push(p));
  req.on("end", () => {
    const corpo = Buffer.concat(partes);
    if (!assinaturaOk(corpo, req.headers["x-openwa-signature"])) { res.writeHead(401); return res.end("assinatura inválida"); }
    res.writeHead(200); res.end("ok");
    try {
      const ev = JSON.parse(corpo.toString("utf8"));
      const chave = ev.idempotencyKey || ev.deliveryId;
      if (chave) { if (vistos.has(chave)) return; vistos.add(chave); if (vistos.size > 5000) vistos.clear(); }
      receber(ev);
    } catch (e) { log("Webhook inválido:", e.message); }
  });
});

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function iniciar() {
  log(`=== Robô de anúncios iniciando (${cfg.quem}) ===`);
  for (const k of ["supabaseUrl", "supabaseAnonKey", "roboToken"]) if (!cfg[k]) throw new Error(`Falta "${k}" no config.json`);
  servidor.listen(cfg.porta, "127.0.0.1", () => log(`Robô ouvindo em http://localhost:${cfg.porta}`));
  for (;;) {
    try {
      const s = await acharSessao();
      log(`Sessão "${cfg.sessao}" encontrada — status: ${s.status}`);
      await garantirWebhook();
      break;
    } catch (e) {
      log("Aguardando o OpenWA/sessão:", e.message.slice(0, 200));
      await dormir(20000);
    }
  }
  await sinal();
  setInterval(sinal, 60000);
  log(atendendo ? "Pronto e ATENDENDO." : "Pronto, em ESPERA (o PC está atendendo).");
  setTimeout(() => recuperar(), 30000); // dá tempo do WhatsApp sincronizar as conversas
}

if (require.main === module) iniciar().catch((e) => { log("Falha ao iniciar:", e.message); process.exit(1); });
module.exports = { precisaDoEstevao, acharEmpreendimento, saudacao, recusou };
