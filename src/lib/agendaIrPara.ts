// "Ir para" dos compromissos da Agenda: para onde o clique leva e como montar o link.
// Os links usam só IDs (nunca nome, telefone ou e-mail).

export type AcaoTipo = "whatsapp" | "lead" | "negocios" | "esteira" | "ligacoes" | "registrar" | "link";

export const ACOES: { id: AcaoTipo; nome: string; precisaLead?: boolean }[] = [
  { id: "whatsapp", nome: "WhatsApp do lead", precisaLead: true },
  { id: "lead", nome: "Ficha do lead", precisaLead: true },
  { id: "negocios", nome: "Negócios (uma coluna)" },
  { id: "esteira", nome: "Esteira" },
  { id: "ligacoes", nome: "Ligações (Oferta Ativa)" },
  { id: "registrar", nome: "Relatórios → Registrar (nine box)" },
  { id: "link", nome: "Link livre" },
];

export const nomeAcao = (t?: string | null) => ACOES.find((a) => a.id === t)?.nome || "";

/** Telefone só com números e com o 55 do Brasil na frente. */
export function telefoneComPais(tel?: string | null) {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length <= 11) d = `55${d}`;
  return d;
}

export const linkSeguro = (url?: string | null) => {
  const u = String(url || "").trim();
  if (!u) return "";
  const comProtocolo = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const x = new URL(comProtocolo);
    return x.protocol === "http:" || x.protocol === "https:" ? x.toString() : "";
  } catch {
    return "";
  }
};

/** Caminho dentro do Inmovya para cada destino (null = não é uma tela do Inmovya). */
export function caminhoInterno(tipo: AcaoTipo, alvo?: string | null, leadId?: string | null): string | null {
  const q = (k: string, v?: string | null) => (v ? `?${k}=${encodeURIComponent(v)}` : "");
  switch (tipo) {
    case "lead":
      return `/leads${q("lead", alvo || leadId)}`;
    case "negocios":
      return `/negocios${q("coluna", alvo)}`;
    case "esteira":
      return `/esteiras${q("esteira", alvo)}`;
    case "ligacoes":
      return "/ligacoes";
    case "registrar":
      return "/relatorios?registrar=1";
    default:
      return null;
  }
}

// ---------- WhatsApp ----------
/**
 * Abre a conversa do lead. Com o WhatsApp Web aberto e a extensão Inmovya Scale, abre NA MESMA ABA
 * (não derruba o WhatsApp onde a esteira roda). Sem extensão: web.whatsapp.com/send numa aba nova.
 * No celular: wa.me (abre o app).
 */
export async function abrirWhatsApp(telefone?: string | null): Promise<{ ok: boolean; aviso?: string }> {
  const tel = telefoneComPais(telefone);
  if (!tel) return { ok: false, aviso: "Este lead não tem telefone." };
  const celular = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  if (celular) {
    window.open(`https://wa.me/${tel}`, "_blank", "noopener");
    return { ok: true };
  }
  // sem a extensão neste Chrome: abre a aba na hora (o navegador só deixa abrir logo depois do clique)
  if (!temExtensao) {
    const aba = window.open(`https://web.whatsapp.com/send?phone=${tel}`, "_blank");
    return aba ? { ok: true } : { ok: false, aviso: "O navegador bloqueou a nova aba. Libere pop-ups para o Inmovya." };
  }
  const r = await pedirExtensao(tel);
  if (r?.ok) return { ok: true };
  if (r?.ocupado) return { ok: false, aviso: "Uma esteira ou disparo está enviando agora no WhatsApp. Para não atrapalhar, abra a conversa quando terminar." };
  const aba = window.open(`https://web.whatsapp.com/send?phone=${tel}`, "_blank");
  if (!aba) return { ok: false, aviso: "O navegador bloqueou a nova aba. Libere pop-ups para o Inmovya." };
  return { ok: true };
}

// a extensão responde a um "olá" quando a página carrega
let temExtensao = false;
if (typeof window !== "undefined") {
  window.addEventListener("INMOVYA_EXTENSION_READY", () => (temExtensao = true));
  window.setTimeout(() => window.dispatchEvent(new CustomEvent("INMOVYA_CHECK_EXTENSION")), 1500);
}

function pedirExtensao(telefone: string): Promise<{ ok?: boolean; ocupado?: boolean; erro?: string } | null> {
  return new Promise((resolve) => {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const ouvir = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      if (d?.token !== token) return;
      window.clearTimeout(t);
      window.removeEventListener("INMOVYA_ABRIR_CONVERSA_RESULT", ouvir);
      resolve(d);
    };
    const t = window.setTimeout(() => {
      window.removeEventListener("INMOVYA_ABRIR_CONVERSA_RESULT", ouvir);
      resolve(null);
    }, 4000);
    window.addEventListener("INMOVYA_ABRIR_CONVERSA_RESULT", ouvir);
    window.dispatchEvent(new CustomEvent("INMOVYA_ABRIR_CONVERSA", { detail: { token, telefone } }));
  });
}

// ---------- vários leads nas observações ----------
const norm = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type LeadAchado = { id: string; nome: string; telefone?: string; trecho: string; repetido: boolean };

/**
 * Acha nas observações os nomes que batem com leads cadastrados.
 * Ex.: "Esteira 20% - follow-up: Sandro, Sebastião André, Alexandre Queiroz".
 * Um trecho que bate com mais de um lead traz todos (marcados como "repetido", para mostrar o final do telefone).
 * Se o trecho tiver um telefone, confere pelos 8 últimos dígitos.
 */
export function leadsNasObservacoes(texto: string | null | undefined, leads: { id: string; nome: string; telefone?: string }[]): LeadAchado[] {
  if (!texto || !leads.length) return [];
  // depois de ":" começa a lista; separa por vírgula, ponto e vírgula, quebra de linha, marcadores e " e "
  const pedacos = String(texto)
    .split(/\n/)
    .flatMap((linha) => {
      const i = linha.indexOf(":");
      return (i >= 0 ? linha.slice(i + 1) : linha).split(/[,;•·|\/]| - | – | e (?=[A-ZÁÉÍÓÚÂÊÔÃÕ])/);
    })
    .map((p) => p.trim())
    .filter(Boolean);
  const base = leads
    .filter((l) => l.nome && l.nome.trim().length >= 2)
    .map((l) => ({ ...l, n: norm(l.nome), dig: String(l.telefone || "").replace(/\D/g, "").slice(-8) }));
  const saida: LeadAchado[] = [];
  const vistos = new Set<string>();
  for (const pedaco of pedacos) {
    const dig = pedaco.replace(/\D/g, "");
    const p = norm(pedaco.replace(/\(?\+?\d[\d\s().-]{6,}\d\)?/g, ""));
    let achados: typeof base = [];
    if (dig.length >= 8) achados = base.filter((l) => l.dig && l.dig === dig.slice(-8));
    if (!achados.length) {
      if (!p || p.length < 3 || p.split(" ").length > 5) continue;
      const exatos = base.filter((l) => l.n === p);
      achados = exatos.length ? exatos : base.filter((l) => l.n.startsWith(`${p} `));
    }
    if (!achados.length) continue;
    const repetido = achados.length > 1;
    for (const l of achados.slice(0, 4)) {
      if (vistos.has(l.id)) continue;
      vistos.add(l.id);
      saida.push({ id: l.id, nome: l.nome, telefone: l.telefone, trecho: pedaco, repetido });
    }
  }
  return saida;
}
