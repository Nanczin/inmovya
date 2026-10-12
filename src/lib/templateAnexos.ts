// Arquivos dos templates de mensagem (imagem, PDF, vídeo, áudio, documentos...).
// Ficam no Storage (bucket "empreendimentos"); no template guardamos as URLs e os nomes,
// um por linha em arquivo_url / arquivo_nome (assim templates antigos, com um arquivo só, continuam valendo).

export interface AnexoTemplate {
  url: string;
  name: string;
}

type ComArquivos = { arquivo_url?: string | null; arquivo_nome?: string | null };

const nomeDaUrl = (url: string) => {
  try {
    return decodeURIComponent(url.split("?")[0].split("/").pop() || "arquivo");
  } catch {
    return "arquivo";
  }
};

export const anexosDoTemplate = (t?: ComArquivos | null): AnexoTemplate[] => {
  const urls = String(t?.arquivo_url || "")
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean);
  const nomes = String(t?.arquivo_nome || "").split(/\r?\n/);
  return urls.map((url, i) => ({ url, name: (nomes[i] || "").trim() || nomeDaUrl(url) }));
};

export const juntarAnexos = (lista: AnexoTemplate[]) => ({
  arquivo_url: lista.map((a) => a.url).join("\n"),
  arquivo_nome: lista.map((a) => a.name.replace(/\r?\n/g, " ")).join("\n"),
});

const tipoPelaExtensao = (nome: string) => {
  const ext = (nome.split(".").pop() || "").toLowerCase();
  const mapa: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", "3gp": "video/3gpp",
    mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4", wav: "audio/wav", opus: "audio/ogg",
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip", txt: "text/plain", csv: "text/csv",
  };
  return mapa[ext] || "application/octet-stream";
};

const blobParaDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Baixa os arquivos do template e devolve no formato que o Inmovya Scale envia no WhatsApp (depois do texto). */
export async function anexosParaEnvio(lista: AnexoTemplate[]) {
  const out: { id: string; name: string; type: string; size: number; data: string; useCaption: boolean; caption: string; messageIndex: number }[] = [];
  for (const a of lista) {
    const resp = await fetch(a.url);
    if (!resp.ok) throw new Error(`Não consegui baixar o arquivo ${a.name}.`);
    let blob = await resp.blob();
    const type = blob.type && blob.type !== "application/octet-stream" ? blob.type : tipoPelaExtensao(a.name);
    if (blob.type !== type) blob = new Blob([blob], { type });
    out.push({
      id: a.url,
      name: a.name,
      type,
      size: blob.size,
      data: await blobParaDataUrl(blob),
      useCaption: false,
      caption: "",
      messageIndex: 9999, // a extensão limita à última mensagem: os arquivos vão depois do texto
    });
  }
  return out;
}
