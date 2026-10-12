// Arquivos dos templates de mensagem (imagem, PDF, vídeo, áudio, documentos...).
// Ficam NO COMPUTADOR (não ocupam o Supabase): no template guardamos só "local:<id>" e o nome;
// o atalho para o arquivo fica neste navegador (igual aos anexos das esteiras).
// Um por linha em arquivo_url / arquivo_nome. Templates antigos com link (Storage) continuam valendo.
import {
  anexosLocaisSuportados,
  escolherArquivosDoComputador,
  esquecerArquivoLocal,
  guardarAtalhoDeArquivo,
  lerArquivoLocal,
  liberarArquivosLocais,
} from "@/lib/esteiras";

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

export const ehLocal = (a: AnexoTemplate) => a.url.startsWith("local:");
const idLocal = (a: AnexoTemplate) => a.url.slice("local:".length);
/** Só os arquivos que têm link na internet (para e-mail / link no texto). */
export const anexosComLink = (lista: AnexoTemplate[]) => lista.filter((a) => !ehLocal(a));

/** Abre a janela do computador e devolve os arquivos escolhidos (nada vai para o Supabase). */
export async function escolherArquivosTemplate(): Promise<AnexoTemplate[]> {
  const escolhidos = await escolherArquivosDoComputador();
  return escolhidos.map((e) => ({ url: `local:${e.local_id}`, name: e.name }));
}

/** Arquivos arrastados para a tela (Chrome/Edge dão o atalho do arquivo). */
export async function arquivosArrastados(dt: DataTransfer): Promise<AnexoTemplate[]> {
  const out: AnexoTemplate[] = [];
  for (const item of Array.from(dt.items || [])) {
    if (item.kind !== "file" || typeof (item as any).getAsFileSystemHandle !== "function") continue;
    const h: any = await (item as any).getAsFileSystemHandle();
    if (!h || h.kind !== "file") continue;
    const f: File = await h.getFile();
    out.push({ url: `local:${await guardarAtalhoDeArquivo(h)}`, name: f.name });
  }
  return out;
}

export const esquecerAnexo = async (a: AnexoTemplate) => {
  if (ehLocal(a)) await esquecerArquivoLocal(idLocal(a));
};

/** Pede ao Chrome a leitura dos arquivos (chamar logo após um clique). Devolve os que faltam. */
export const liberarAnexosTemplate = (lista: AnexoTemplate[]) =>
  liberarArquivosLocais(lista.filter(ehLocal).map((a) => ({ local_id: idLocal(a), name: a.name, type: "", size: 0 })));

export { anexosLocaisSuportados };

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

/** Lê os arquivos do template (do computador ou do link) no formato que o Inmovya Scale envia no WhatsApp (depois do texto). */
export async function anexosParaEnvio(lista: AnexoTemplate[]) {
  const out: { id: string; name: string; type: string; size: number; data: string; useCaption: boolean; caption: string; messageIndex: number }[] = [];
  for (const a of lista) {
    let blob: Blob;
    if (ehLocal(a)) {
      blob = await lerArquivoLocal(idLocal(a), a.name);
    } else {
      const resp = await fetch(a.url);
      if (!resp.ok) throw new Error(`Não consegui baixar o arquivo ${a.name}.`);
      blob = await resp.blob();
    }
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
