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
  // separa por vírgula, ponto e vírgula, dois-pontos, parênteses, quebra de linha, ponto final, marcadores e " e Nome"
  const pedacos = String(texto)
    .split(/[\n,;:()\[\]•·|\/]|\.\s| - | – | e (?=[A-ZÁÉÍÓÚÂÊÔÃÕ])/)
    .map((p) => p.trim())
    .filter(Boolean);
  const base = leads
    .filter((l) => l.nome && l.nome.trim().length >= 2)
    .map((l) => ({ ...l, n: norm(l.nome), dig: String(l.telefone || "").replace(/\D/g, "").slice(-8) }));
  const porNome = new Map<string, typeof base>();
  base.forEach((l) => porNome.set(l.n, [...(porNome.get(l.n) || []), l]));
  const saida: LeadAchado[] = [];
  const vistos = new Set<string>();
  const juntar = (achados: typeof base, trecho: string) => {
    const repetido = achados.length > 1;
    for (const l of achados.slice(0, 4)) {
      if (vistos.has(l.id)) continue;
      vistos.add(l.id);
      saida.push({ id: l.id, nome: l.nome, telefone: l.telefone, trecho, repetido });
    }
  };
  for (const pedaco of pedacos) {
    // telefone no trecho: confere pelos 8 últimos dígitos
    const dig = pedaco.replace(/\D/g, "");
    if (dig.length >= 8) {
      const porTel = base.filter((l) => l.dig && l.dig === dig.slice(-8));
      if (porTel.length) {
        juntar(porTel, pedaco);
        continue;
      }
    }
    const palavras = norm(pedaco.replace(/\(?\+?\d[\d\s().-]{6,}\d\)?/g, "")).split(" ").filter(Boolean);
    if (!palavras.length) continue;
    // só o primeiro nome (ex.: "Sandro"): todos os leads que começam assim
    if (palavras.length <= 2) {
      const p = palavras.join(" ");
      const exatos = porNome.get(p);
      if (exatos) {
        juntar(exatos, pedaco);
        continue;
      }
      if (p.length >= 3) {
        const comeca = base.filter((l) => l.n.startsWith(`${p} `));
        if (comeca.length) {
          juntar(comeca, pedaco);
          continue;
        }
      }
    }
    // nome completo no meio de uma frase (ex.: "Retomar também Juliana Braite"): procura de 4 a 2 palavras seguidas
    let i = 0;
    while (i < palavras.length) {
      let achou = 0;
      for (let tam = Math.min(4, palavras.length - i); tam >= 2; tam--) {
        const lista = porNome.get(palavras.slice(i, i + tam).join(" "));
        if (lista) {
          juntar(lista, pedaco);
          achou = tam;
          break;
        }
      }
      i += achou || 1;
    }
  }
  return saida;
}
