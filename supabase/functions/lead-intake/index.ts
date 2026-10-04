// lead-intake — cadastra automaticamente no Inmovya os leads que chegam de:
//   1) Meta Lead Ads (webhook "leadgen" da página)          → POST JSON { object: "page", entry: [...] }
//   2) Bitrix24 (webhook de saída ONCRMDEALADD/ONCRMLEADADD) → POST form-urlencoded (event, data[FIELDS][ID], auth[...])
//   3) Make / Zapier / qualquer formulário                   → POST JSON { nome, telefone, email, ... } + token
//
// Todos entram na etapa "Validação" (aba Negócios) e não duplicam: se o telefone já existir
// para o seu usuário, o lead existente recebe uma anotação em vez de um cadastro novo.
//
// Segredos (supabase secrets set ...):
//   INMOVYA_USER_EMAIL       e-mail do seu login no Inmovya (dono dos leads)        — obrigatório
//   INTAKE_SECRET            token para Make/Zapier e para o Bitrix (?token=...)    — obrigatório
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
  if (!email) throw new Error("Segredo INMOVYA_USER_EMAIL não configurado");
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

  const { data, error } = await supabase
    .from("leads")
    .insert([{
      nome: lead.nome?.trim() || "Lead sem nome",
      telefone,
      email: lead.email?.trim() || fakeEmail(telefone),
      origem: lead.origem,
      observacoes: lead.observacoes || null,
      status,
      tags: Array.from(new Set(lead.tags ?? [])),
      ultimo_contato: new Date().toISOString(),
      user_id: userId,
    }])
    .select("id")
    .single();
  if (error) throw error;
  return { action: "criado", id: data.id };
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
    tags: ["Meta Ads", ...(campanha ? [`Campanha: ${campanha}`] : [])],
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
    tags: ["Bitrix", ...(campanha ? [`Campanha: ${campanha}`] : [])],
    fonte: "Bitrix",
  };
}

// ---------- servidor ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  // Verificação do webhook da Meta
  if (req.method === "GET") {
    if (url.searchParams.get("hub.mode") === "subscribe") {
      const ok = url.searchParams.get("hub.verify_token") === env("META_VERIFY_TOKEN") && env("META_VERIFY_TOKEN") !== "";
      return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
    }
    return json({ ok: true, service: "lead-intake" });
  }
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const raw = await req.text();
  const contentType = req.headers.get("content-type") ?? "";

  try {
    // ---- Bitrix (form-urlencoded) ----
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = new URLSearchParams(raw);
      const appToken = env("BITRIX_APP_TOKEN");
      const tokenOk = appToken
        ? form.get("auth[application_token]") === appToken
        : url.searchParams.get("token") === env("INTAKE_SECRET") && env("INTAKE_SECRET") !== "";
      if (!tokenOk) return json({ error: "token inválido" }, 401);

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
      tags: [...(Array.isArray(body.tags) ? body.tags.map(String) : []), ...(campanha ? [`Campanha: ${campanha}`] : [])],
      fonte: String(body.fonte ?? "Formulário"),
    });
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("lead-intake erro:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
