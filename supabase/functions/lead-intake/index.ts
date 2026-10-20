// lead-intake — cadastra automaticamente no Inmovya os leads que chegam de:
//   1) Meta Lead Ads (webhook "leadgen" da página)          → POST JSON { object: "page", entry: [...] }
//   2) Bitrix24 (webhook de saída ONCRMDEALADD/ONCRMLEADADD) → POST form-urlencoded (event, data[FIELDS][ID], auth[...])
//   3) Make / Zapier / qualquer formulário                   → POST JSON { nome, telefone, email, ... } + token
//
// Todos entram na etapa "Validação" (aba Negócios) e não duplicam: se o telefone já existir
// para o seu usuário, o lead existente recebe uma anotação em vez de um cadastro novo.
//
// Segredos (supabase secrets set ...):
//   INMOVYA_USER_EMAIL       (opcional) e-mail do dono dos leads; sem ele, usa o usuário com mais leads
//   INTAKE_SECRET            token para Make/Zapier (?token=...)
//   INTAKE_DEFAULT_STATUS    etapa inicial (padrão "Validação")
//   META_VERIFY_TOKEN        texto combinado na configuração do webhook da Meta
//   META_PAGE_ACCESS_TOKEN   token da página (permissão leads_retrieval)
//   META_APP_SECRET          (opcional) valida a assinatura X-Hub-Signature-256
//   BITRIX_WEBHOOK_URL       webhook de ENTRADA do Bitrix (ex.: https://sua.bitrix24.com.br/rest/1/abc123/)
//   BITRIX_APP_TOKEN         (opcional) "application_token" do webhook de SAÍDA do Bitrix

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-intake-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const env = (k: string) => (Deno.env.get(k) ?? "").trim();

interface IncomingLead {
  nome: string;
  telefone?: string;
  email?: string;
  origem: string;
  observacoes?: string;
  tags?: string[];
  fonte: string; // "Meta Ads" | "Bitrix" | "Formulário"
}

// ---------- utilidades ----------

const onlyDigits = (s?: string | null) => (s ?? "").replace(/\D/g, "");

/** Telefone no mesmo formato do app: (11) 99999-9999 */
const formatPhone = (raw?: string | null) => {
  let d = onlyDigits(raw);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw?.trim() || "";
};

const phoneKey = (raw?: string | null) => {
  let d = onlyDigits(raw);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d;
};

const fakeEmail = (phone: string) => `sem-email+${phoneKey(phone) || Date.now()}@inmovya.local`;

const nowBR = () =>
  new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- dono dos leads ----------

let cachedUserId: string | null = null;
async function getOwnerId(supabase: SupabaseClient): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const email = env("INMOVYA_USER_EMAIL").toLowerCase();
  if (!email) {
    // Sem e-mail configurado: o dono é o usuário com mais leads cadastrados
    const { data, error } = await supabase.from("leads").select("user_id").not("user_id", "is", null).limit(5000);
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const r of data ?? []) counts[r.user_id] = (counts[r.user_id] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) throw new Error("Não foi possível identificar o dono dos leads (configure INMOVYA_USER_EMAIL)");
    return (cachedUserId = top[0]);
  }
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) return (cachedUserId = found.id);
    if (data.users.length < 200) break;
  }
  throw new Error(`Usuário ${email} não encontrado no Inmovya`);
}

// ---------- gravação (com anti-duplicidade) ----------

async function saveLead(supabase: SupabaseClient, lead: IncomingLead) {
  const userId = await getOwnerId(supabase);
  const telefone = formatPhone(lead.telefone);
  const key = phoneKey(lead.telefone);
  const status = env("INTAKE_DEFAULT_STATUS") || "Validação";
  const nota = `[${nowBR()}] Lead recebido automaticamente via ${lead.fonte}${lead.observacoes ? ` — ${lead.observacoes}` : ""}`;

  // Procura duplicado pelo telefone (mesmo dono)
  if (key.length >= 8) {
    const { data: candidates, error } = await supabase
      .from("leads")
      .select("id, nome, telefone, observacoes, tags")
      .eq("user_id", userId)
      .ilike("telefone", `%${key.slice(-4)}%`);
    if (error) throw error;
    const existing = (candidates ?? []).find((c) => {
      const k = phoneKey(c.telefone);
      return k === key || (k.length >= 10 && key.length >= 10 && k.slice(-8) === key.slice(-8));
    });
    if (existing) {
      const tags = Array.from(new Set([...(existing.tags ?? []), ...(lead.tags ?? []), "reentrada"]));
      const observacoes = [existing.observacoes, nota].filter(Boolean).join("\n");
      const { error: upErr } = await supabase
        .from("leads")
        .update({ observacoes, tags, ultimo_contato: new Date().toISOString() })
        .eq("id", existing.id);
      if (upErr) throw upErr;
      return { action: "duplicado_atualizado", id: existing.id, nome: existing.nome };
    }
  }

  // Lead novo: não entra direto. Vai para a fila e o Inmovya Scale confere o número no WhatsApp
  // (a cada 1 minuto); só vira lead se tiver WhatsApp (supabase/captura_whatsapp.sql).
  if (key.length >= 8) {
    const { data: naFila, error: filaErr } = await supabase
      .from("captura_fila")
      .select("id, telefone")
      .eq("user_id", userId)
      .eq("status", "pendente")
      .ilike("telefone", `%${key.slice(-4)}%`);
    if (filaErr) throw filaErr;
    const igual = (naFila ?? []).find((c) => {
      const k = phoneKey(c.telefone);
      return k === key || (k.length >= 10 && key.length >= 10 && k.slice(-8) === key.slice(-8));
    });
    if (igual) return { action: "ja_na_fila", id: igual.id };
  }
  const { data, error } = await supabase
    .from("captura_fila")
    .insert([{
      user_id: userId,
      fonte: lead.fonte,
      nome: lead.nome?.trim() || "Lead sem nome",
      telefone,
      email: lead.email?.trim() || fakeEmail(telefone),
      origem: lead.origem,
      observacoes: lead.observacoes || null,
      tags: Array.from(new Set(lead.tags ?? [])),
      status: key.length >= 8 ? "pendente" : "sem_telefone",
      resolvido_em: key.length >= 8 ? null : new Date().toISOString(),
    }])
    .select("id")
    .single();
  if (error) throw error;
  return { action: key.length >= 8 ? "na_fila_whatsapp" : "sem_telefone", id: data.id, status };
}

// ---------- 1) Meta Lead Ads ----------

async function fetchMetaLead(leadgenId: string): Promise<IncomingLead> {
  const token = env("META_PAGE_ACCESS_TOKEN");
  if (!token) throw new Error("Segredo META_PAGE_ACCESS_TOKEN não configurado");
  const url = `https://graph.facebook.com/v21.0/${leadgenId}?fields=field_data,created_time,campaign_name,adset_name,ad_name,form_id,platform&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(`Graph API: ${JSON.stringify(body?.error ?? body)}`);

  const fields: Record<string, string> = {};
  for (const f of body.field_data ?? []) fields[String(f.name).toLowerCase()] = (f.values ?? []).join(", ");

  const pick = (...names: string[]) => names.map((n) => fields[n]).find((v) => v && v.trim()) ?? "";
  const nome = pick("full_name", "nome_completo", "nome", "name") || [pick("first_name"), pick("last_name")].filter(Boolean).join(" ");
  const telefone = pick("phone_number", "telefone", "celular", "whatsapp", "phone");
  const email = pick("email", "e-mail");

  const used = new Set(["full_name", "nome_completo", "nome", "name", "first_name", "last_name", "phone_number", "telefone", "celular", "whatsapp", "phone", "email", "e-mail"]);
  const extras = Object.entries(fields).filter(([k]) => !used.has(k)).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);

  const campanha = body.campaign_name || "";
  const obs = [campanha && `Campanha: ${campanha}`, body.ad_name && `Anúncio: ${body.ad_name}`, ...extras].filter(Boolean).join(" | ");
  const plataforma = String(body.platform ?? "").toLowerCase();

  return {
    nome,
    telefone,
    email,
    origem: plataforma === "ig" || plataforma === "instagram" ? "Instagram" : "Facebook",
    observacoes: obs,
    tags: ["Meta Ads"],
    fonte: "Meta Ads",
  };
}

// ---------- 2) Bitrix24 ----------

async function bitrixCall(method: string, params: Record<string, string>) {
  const base = env("BITRIX_WEBHOOK_URL").replace(/\/?$/, "/");
  if (!base || base === "/") throw new Error("Segredo BITRIX_WEBHOOK_URL não configurado");
  const res = await fetch(`${base}${method}.json?${new URLSearchParams(params)}`);
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`Bitrix ${method}: ${body.error_description ?? body.error ?? res.status}`);
  return body.result;
}

const firstMulti = (arr?: { VALUE?: string }[]) => (Array.isArray(arr) && arr[0]?.VALUE) || "";

async function fetchBitrixLead(event: string, id: string): Promise<IncomingLead> {
  let nome = "", telefone = "", email = "", titulo = "", campanha = "", comentario = "";
  if (event.includes("LEAD")) {
    const l = await bitrixCall("crm.lead.get", { id });
    nome = [l.NAME, l.SECOND_NAME, l.LAST_NAME].filter(Boolean).join(" ") || l.TITLE;
    telefone = firstMulti(l.PHONE);
    email = firstMulti(l.EMAIL);
    titulo = l.TITLE ?? "";
    campanha = l.UTM_CAMPAIGN ?? "";
    comentario = l.COMMENTS ?? "";
  } else {
    const d = await bitrixCall("crm.deal.get", { id });
    titulo = d.TITLE ?? "";
    campanha = d.UTM_CAMPAIGN ?? "";
    comentario = d.COMMENTS ?? "";
    if (d.CONTACT_ID && d.CONTACT_ID !== "0") {
      const c = await bitrixCall("crm.contact.get", { id: d.CONTACT_ID });
      nome = [c.NAME, c.SECOND_NAME, c.LAST_NAME].filter(Boolean).join(" ");
      telefone = firstMulti(c.PHONE);
      email = firstMulti(c.EMAIL);
    }
    if (!nome) nome = titulo;
  }
  const clean = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const obs = [titulo && titulo !== nome && titulo, campanha && `Campanha: ${campanha}`, comentario && clean(comentario)].filter(Boolean).join(" | ");
  return {
    nome,
    telefone,
    email,
    origem: "roleta",
    observacoes: obs,
    tags: ["roleta"],
    fonte: "Bitrix",
  };
}

// ---------- 2a) Roleta do Bitrix: aceita sozinho ----------
// O lead da roleta chega na etapa "Fila de atendimento" atribuído a você; se não for para "Primeiro contato"
// em ~10 min, o Bitrix tira de você. A cada minuto, move para "Primeiro contato" (= aceitar) os seus negócios
// que estão na fila. Funciona 24 h (servidor), sem depender do computador.
let etapasRoleta: { fila: string; primeiro: string }[] | null = null;
async function etapasDaRoleta() {
  if (etapasRoleta) return etapasRoleta;
  const sem = (t: string) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const todas: any[] = (await bitrixCall("crm.status.list", { "filter[ENTITY_ID]": "DEAL_STAGE" })) ?? [];
  // funis extras (DEAL_STAGE_1, DEAL_STAGE_2...)
  const cats: any[] = (await bitrixCall("crm.dealcategory.list", {}).catch(() => [])) ?? [];
  for (const c of cats) {
    const r = await bitrixCall("crm.status.list", { "filter[ENTITY_ID]": `DEAL_STAGE_${c.ID}` }).catch(() => []);
    todas.push(...(r ?? []));
  }
  const porFunil = new Map<string, { fila?: string; primeiro?: string }>();
  for (const st of todas) {
    const nome = sem(st.NAME);
    const f = porFunil.get(st.ENTITY_ID) ?? {};
    if (nome.includes("fila de atendimento")) f.fila = st.STATUS_ID;
    if (nome.includes("primeiro contato")) f.primeiro = st.STATUS_ID;
    porFunil.set(st.ENTITY_ID, f);
  }
  etapasRoleta = Array.from(porFunil.values()).filter((f) => f.fila && f.primeiro) as { fila: string; primeiro: string }[];
  return etapasRoleta;
}

async function aceitarRoletaBitrix(owner: string) {
  if (!owner || env("BITRIX_AUTO_ACEITAR") === "nao") return [];
  const aceitos: { deal: string; action: string }[] = [];
  const etapas = await etapasDaRoleta();
  if (!etapas.length) {
    etapasRoleta = null; // tenta achar de novo na próxima
    return [{ deal: "-", action: "roleta_sem_etapas" }];
  }
  for (const e of etapas) {
    const deals = (await bitrixCall("crm.deal.list", {
      "filter[STAGE_ID]": e.fila,
      "filter[ASSIGNED_BY_ID]": owner,
      "select[]": "ID",
    })) ?? [];
    for (const d of deals) {
      try {
        await bitrixCall("crm.deal.update", { id: String(d.ID), "fields[STAGE_ID]": e.primeiro });
        aceitos.push({ deal: String(d.ID), action: "aceito_roleta" });
      } catch (err) {
        aceitos.push({ deal: String(d.ID), action: `erro_aceitar: ${err instanceof Error ? err.message : err}` });
      }
    }
  }
  return aceitos;
}

// ---------- 2b) Bitrix por consulta periódica (sem webhook de saída) ----------
// Chamado a cada 1 min pelo agendador (pg_cron). Importa os negócios criados nos últimos
// BITRIX_POLL_MINUTES (padrão 3 dias) que estão atribuídos ao dono do webhook de entrada.
async function pollBitrix(supabase: SupabaseClient) {
  const base = env("BITRIX_WEBHOOK_URL");
  if (!base) throw new Error("Segredo BITRIX_WEBHOOK_URL não configurado");
  const owner = (base.match(/\/rest\/(\d+)\//) ?? [])[1] ?? "";
  // Olha os negócios criados nos últimos 3 dias que estão com você (não só os últimos 30 min):
  // o da roleta pode ser passado para você bem depois de criado (outro corretor perdeu).
  // Quem já entrou (tag "Bitrix #ID" no Inmovya ou na fila) é pulado.
  const minutes = Number(env("BITRIX_POLL_MINUTES") || String(3 * 24 * 60));
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const params: Record<string, string> = { "filter[>DATE_CREATE]": since, "order[DATE_CREATE]": "DESC" };
  if (owner) params["filter[ASSIGNED_BY_ID]"] = owner;
  // primeiro aceita o que está esperando na roleta (vale mais que importar)
  let aceitos: { deal: string; action: string }[] = [];
  try {
    aceitos = await aceitarRoletaBitrix(owner);
  } catch (err) {
    aceitos = [{ deal: "-", action: `erro_roleta: ${err instanceof Error ? err.message : err}` }];
  }
  const deals = await bitrixCall("crm.deal.list", params);
  const userId = await getOwnerId(supabase);
  const results = [];
  for (const d of deals ?? []) {
    const tag = "Bitrix #" + d.ID;
    const { data: seen, error } = await supabase.from("leads").select("id").eq("user_id", userId).ilike("observacoes", "%" + tag + "%").limit(1);
    if (error) throw error;
    if (seen && seen.length) { results.push({ deal: d.ID, action: "ja_importado" }); continue; }
    const { data: filaVista, error: filaErr } = await supabase.from("captura_fila").select("id").eq("user_id", userId).ilike("observacoes", "%" + tag + "%").limit(1);
    if (filaErr) throw filaErr;
    if (filaVista && filaVista.length) { results.push({ deal: d.ID, action: "ja_na_fila" }); continue; }
    // apagado no Inmovya: não volta
    const { data: visto } = await supabase.from("captura_vistos").select("externo_id").eq("user_id", userId).eq("fonte", "Bitrix").eq("externo_id", String(d.ID)).limit(1);
    if (visto && visto.length) { results.push({ deal: d.ID, action: "apagado_no_inmovya" }); continue; }
    const lead = await fetchBitrixLead("ONCRMDEALADD", String(d.ID));
    lead.observacoes = [lead.observacoes, tag].filter(Boolean).join(" | ");
    results.push({ deal: d.ID, ...(await saveLead(supabase, lead)) });
  }
  return [...aceitos, ...results];
}

// ---------- servidor ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  // Verificação do webhook da Meta
  if (req.method === "GET") {
    if (url.searchParams.get("hub.mode") === "subscribe") {
      // Sem META_VERIFY_TOKEN configurado, aceita a verificação (os leads só são lidos com o token da sua página)
      const expected = env("META_VERIFY_TOKEN");
      const ok = !expected || url.searchParams.get("hub.verify_token") === expected;
      return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
    }
    return json({ ok: true, service: "lead-intake" });
  }
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const raw = await req.text();
  const contentType = req.headers.get("content-type") ?? "";

  try {
    // ---- Bitrix por consulta (agendador) ----
    if (url.searchParams.get("action") === "poll-bitrix") {
      const results = await pollBitrix(supabase);
      console.log("poll-bitrix", JSON.stringify(results));
      return json({ ok: true, results });
    }

    // ---- Bitrix (form-urlencoded) ----
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = new URLSearchParams(raw);
      // Se BITRIX_APP_TOKEN estiver configurado, confere. Sem ele, a segurança vem do próprio Bitrix:
      // a função só importa negócios que existem de fato na sua conta (buscados pelo webhook de entrada).
      const appToken = env("BITRIX_APP_TOKEN");
      if (appToken && form.get("auth[application_token]") !== appToken) return json({ error: "token inválido" }, 401);

      const event = (form.get("event") ?? "").toUpperCase();
      const id = form.get("data[FIELDS][ID]") ?? "";
      if (!id || !/ONCRM(DEAL|LEAD)ADD/.test(event)) return json({ ignored: true, event });
      const lead = await fetchBitrixLead(event, id);
      const result = await saveLead(supabase, lead);
      console.log("bitrix", event, id, result);
      return json({ ok: true, ...result });
    }

    const body = raw ? JSON.parse(raw) : {};

    // ---- Meta Lead Ads ----
    if (body?.object === "page") {
      const secret = env("META_APP_SECRET");
      if (secret) {
        const sig = (req.headers.get("x-hub-signature-256") ?? "").replace("sha256=", "");
        if (sig !== (await hmacSha256Hex(secret, raw))) return json({ error: "assinatura inválida" }, 401);
      }
      const results = [];
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== "leadgen" || !change.value?.leadgen_id) continue;
          const lead = await fetchMetaLead(String(change.value.leadgen_id));
          const r = await saveLead(supabase, lead);
          console.log("meta", change.value.leadgen_id, r);
          results.push(r);
        }
      }
      return json({ ok: true, results });
    }

    // ---- Genérico (Make / Zapier / formulário próprio) ----
    const token = req.headers.get("x-intake-secret") ?? url.searchParams.get("token") ?? "";
    if (!env("INTAKE_SECRET") || token !== env("INTAKE_SECRET")) return json({ error: "token inválido" }, 401);
    if (!body?.nome && !body?.telefone) return json({ error: "envie ao menos nome ou telefone" }, 400);
    const campanha = body.campanha ? String(body.campanha) : "";
    const result = await saveLead(supabase, {
      nome: String(body.nome ?? ""),
      telefone: String(body.telefone ?? ""),
      email: body.email ? String(body.email) : "",
      origem: String(body.origem ?? "Formulário"),
      observacoes: [body.observacoes, campanha && `Campanha: ${campanha}`].filter(Boolean).join(" | "),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      fonte: String(body.fonte ?? "Formulário"),
    });
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("lead-intake erro:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
