// Envia notificação push (celular/computador, mesmo com o Inmovya fechado)
// quando entra um lead novo da captura automática (Bitrix/roleta ou Meta Ads).
// Chamada por um gatilho no banco (tabela leads, INSERT) com { lead_id }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const isAutoLead = (lead: any) => {
  const tags: string[] = Array.isArray(lead?.tags) ? lead.tags.map((t: any) => String(t).toLowerCase()) : [];
  const origem = String(lead?.origem || "").toLowerCase();
  return origem === "roleta" || tags.includes("roleta") || tags.includes("meta ads");
};

// Telefone no formato do discador: +55DDDNUMERO
const telParaDiscar = (telefone?: string | null) => {
  let d = String(telefone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = "55" + d;
  return "+" + d;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });

  try {
    const body = await req.json().catch(() => ({}));
    const leadId = body?.lead_id ?? body?.record?.id;
    if (!leadId) return json({ error: "lead_id ausente" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Confere o lead no banco (não confia no corpo da requisição)
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, user_id, nome, telefone, origem, tags, observacoes, created_at")
      .eq("id", leadId)
      .maybeSingle();
    if (error) throw error;
    if (!lead) return json({ skipped: "lead não encontrado" });
    if (!isAutoLead(lead)) return json({ skipped: "não é captura automática" });
    const idadeMin = (Date.now() - new Date(lead.created_at).getTime()) / 60000;
    if (idadeMin > 15) return json({ skipped: "lead antigo" });

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!publicKey || !privateKey) return json({ error: "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas" }, 500);
    webpush.setVapidDetails("mailto:admin@inmovya.com", publicKey, privateKey);

    const { data: subs, error: subError } = await supabase
      .from("user_push_subscriptions")
      .select("id, subscription")
      .eq("user_id", lead.user_id);
    if (subError) throw subError;

    const fonte = String(lead.origem || "").toLowerCase() === "roleta" ? "Roleta (Bitrix)" : "Meta Ads";
    const obs = String(lead.observacoes || "").split("\n")[0].replace(/Bitrix #\d+/g, "").trim();
    const payload = JSON.stringify({
      title: `🔥 Lead novo: ${lead.nome || "sem nome"}`,
      body: [fonte, lead.telefone, obs].filter(Boolean).join(" · ").slice(0, 160),
      icon: "/icons/icon-192x192.png",
      url: `/?leadId=${lead.id}`,
      tag: `lead-${lead.id}`,
      tel: telParaDiscar(lead.telefone),
      nome: lead.nome || "",
      leadId: lead.id,
    });

    const results: unknown[] = [];
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(sub.subscription, payload, { TTL: 3600, urgency: "high" });
        results.push({ device: sub.id, status: "sent" });
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("user_push_subscriptions").delete().eq("id", sub.id);
        }
        results.push({ device: sub.id, status: "error", code: err?.statusCode, message: err?.message });
      }
    }
    return json({ ok: true, devices: results.length, results });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
