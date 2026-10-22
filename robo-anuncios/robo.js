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

function saudacao(nome, empreendimento) {
  const primeiro = String(nome || "").trim().split(/\s+/)[0];
  const ola = primeiro && /[a-zà-ú]/i.test(primeiro) ? `Olá, ${primeiro}!` : "Olá!";
  const anuncio = empreendimento ? `Vi que você veio pelo anúncio do *${empreendimento}*. ` : "Vi que você veio pelo nosso anúncio. ";
  return `${ola} Aqui é o ${cfg.meuNome}, corretor. Obrigado pelo contato! ${anuncio}Posso te fazer umas perguntas rápidas para te mandar as melhores opções?`;
}

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
    atendendo = !!s.atende;
  } catch (e) {
    log("Falha no sinal do Inmovya:", e.message);
    // sem internet com o Inmovya: o PC continua atendendo; a nuvem fica em espera
    atendendo = cfg.quem === "pc";
  }
}

// ---------------- conversa ----------------
const filas = new Map(); // chatId -> { msgs: [], timer }
const ocupados = new Set();

function receber(evento) {
  const d = evento.data || {};
  if (evento.event !== "message.received") return;
  if (d.fromMe || d.isGroup || d.isStatusBroadcast) return;
  if (d.kind && d.kind !== "individual") return;
  const chatId = d.chatId || d.from;
  if (!chatId || /@g\.us$|@broadcast$|@newsletter$|status@/.test(chatId)) return;
  const ts = Number(d.timestamp || 0) * 1000;
  if (ts && Date.now() - ts > cfg.ignorarMaisAntigasQueMin * 60000) return;

  let telefone = chatId.endsWith("@c.us") ? chatId.split("@")[0] : d.senderPhone || "";
  telefone = String(telefone).replace(/\D/g, "");
  if (telefone.length < 10) { log("Mensagem sem telefone identificável, ignorada:", chatId); return; }
  if (telefone === cfg.numeroPessoal) return; // nunca conversa com o seu número pessoal
  if (cfg.testeSomenteNumeros?.length && !cfg.testeSomenteNumeros.includes(telefone)) return;

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

async function conversar(chatId, item) {
  const { telefone, nome, msgs } = item;
  const texto = msgs.map((m) => m.texto).filter(Boolean).join("\n").trim();
  const soTexto = msgs.every((m) => m.tipo === "chat" || m.tipo === "text");
  const info = await rpc("robo_conversa", { p_telefone: telefone });
  let c = info.conversa;

  if (c && c.situacao !== "qualificando") return; // encerrada: nunca mais responde
  if (!c && info.ja_e_lead) {
    log(`${telefone} já é lead no Inmovya — robô não aborda; avisando o ${cfg.meuNome}.`);
    await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: { chat_id: chatId, nome, situacao: "transferido", atendido_por: cfg.quem, resultado_inmovya: "ja_era_lead" } });
    await avisar(`📣 *Lead que JÁ ESTÁ no Inmovya* escreveu no número dos anúncios (o robô não respondeu).\n👤 ${nome || "-"}\n📱 +${telefone}\n💬 "${texto.slice(0, 300)}"`);
    return;
  }

  if (!c) {
    const empreendimento = acharEmpreendimento(texto);
    c = { chat_id: chatId, nome, empreendimento, etapa: 0, respostas: {}, situacao: "qualificando", atendido_por: cfg.quem };
    const motivo = !soTexto ? "mandou áudio/arquivo" : precisaDoEstevao(texto, 0);
    if (motivo) return transferir(chatId, telefone, c, motivo, texto);
    await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: c });
    await enviarTexto(chatId, saudacao(nome, empreendimento));
    log(`Novo contato ${telefone} (${nome || "sem nome"})${empreendimento ? " — " + empreendimento : ""}: saudação enviada.`);
    return;
  }

  if (!c.empreendimento) c.empreendimento = acharEmpreendimento(texto);
  const motivo = !soTexto ? "mandou áudio/arquivo" : precisaDoEstevao(texto, c.etapa + 1);
  if (motivo) return transferir(chatId, telefone, c, motivo, texto);

  if (c.etapa === 0) {
    if (recusou(texto)) return transferir(chatId, telefone, c, "não quis responder as perguntas", texto);
  } else {
    const p = PERGUNTAS[c.etapa - 1];
    c.respostas = { ...(c.respostas || {}), [p.campo]: texto };
  }

  if (c.etapa < PERGUNTAS.length) {
    const prox = PERGUNTAS[c.etapa];
    c.etapa += 1;
    await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: { ...c, atendido_por: cfg.quem } });
    await enviarTexto(chatId, prox.texto);
    return;
  }

  // respondeu a última pergunta
  c.situacao = "concluido";
  await rpc("robo_salvar_conversa", { p_telefone: telefone, p_dados: { ...c, atendido_por: cfg.quem } });
  await enviarTexto(chatId, MSG_FIM);
  await finalizar(chatId, telefone, c, null);
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
}

if (require.main === module) iniciar().catch((e) => { log("Falha ao iniciar:", e.message); process.exit(1); });
module.exports = { precisaDoEstevao, acharEmpreendimento, saudacao, recusou };
