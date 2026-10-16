// IA gratuita: Google Gemini (plano grátis do Google AI Studio).
// A chave fica neste navegador e nas Configurações do Inmovya (tabela configuracoes, campo ia.gemini_key).
import { carregarConfiguracoes, salvarConfiguracoes } from "@/lib/supabase";

const okGemini = (k?: string | null) => (k && k.trim().length > 20 ? k.trim() : null);

let chaveCache: string | null | undefined;
let chaveEm = 0;

/** Chave do Gemini salva (neste navegador ou nas Configurações). */
export async function lerChaveGemini(): Promise<string> {
  if (chaveCache !== undefined && Date.now() - chaveEm < 5 * 60_000) return chaveCache || "";
  let chave: string | null = null;
  try {
    chave = okGemini(JSON.parse(localStorage.getItem("inmovya_config") || "null")?.ia?.gemini_key);
  } catch {
    /* ignore */
  }
  if (!chave) {
    try {
      const r: any = await carregarConfiguracoes();
      chave = okGemini((r?.data || r)?.ia?.gemini_key);
    } catch {
      /* ignore */
    }
  }
  chaveEm = Date.now();
  chaveCache = chave;
  return chave || "";
}

/** Salva a chave do Gemini neste navegador e nas Configurações do Inmovya (banco). */
export async function salvarChaveGemini(chave: string) {
  const k = chave.trim();
  try {
    const atual = JSON.parse(localStorage.getItem("inmovya_config") || "{}");
    localStorage.setItem("inmovya_config", JSON.stringify({ ...atual, ia: { ...(atual.ia || {}), gemini_key: k } }));
  } catch {
    /* ignore */
  }
  chaveCache = undefined;
  try {
    const r: any = await carregarConfiguracoes();
    const cfg = r?.data || {};
    await salvarConfiguracoes({ ...cfg, ia: { ...(cfg.ia || {}), gemini_key: k } } as any);
  } catch {
    /* fica salvo neste navegador */
  }
}

/** Testa a chave no Google. */
export async function testarChaveGemini(chave: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(chave.trim())}`);
  return r.ok;
}

// Do mais indicado para o mais leve; se um estiver desativado ou sobrecarregado, tenta o próximo.
const MODELOS_GEMINI = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"];

/** Pergunta ao Gemini e devolve o JSON da resposta. */
export async function perguntarGemini(chave: string, prompt: string, temperatura = 0.7): Promise<any> {
  let ultimoErro = "";
  for (const modelo of MODELOS_GEMINI) {
    let resp: Response;
    try {
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: temperatura, responseMimeType: "application/json" },
          }),
        }
      );
    } catch {
      ultimoErro = "sem conexão com o Gemini";
      continue;
    }
    // modelo desativado, sobrecarregado ou com a cota grátis dele esgotada: tenta o próximo
    if (resp.status === 404 || resp.status === 429 || resp.status >= 500) {
      ultimoErro =
        resp.status === 404 ? `modelo ${modelo} indisponível` : resp.status === 429 ? "limite grátis do Gemini atingido por agora" : "Gemini sobrecarregado no momento";
      continue;
    }
    if (!resp.ok) throw new Error(resp.status === 400 || resp.status === 403 ? "chave do Gemini inválida" : `Gemini indisponível (${resp.status})`);
    const json = await resp.json();
    const texto = (json.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
    try {
      return JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, "") || "{}");
    } catch {
      ultimoErro = "resposta do Gemini em formato inesperado";
    }
  }
  throw new Error(ultimoErro || "Gemini indisponível");
}
