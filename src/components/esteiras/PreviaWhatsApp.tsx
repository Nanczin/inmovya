// Prévia do que o lead vai receber: mensagens (com nome, variação sorteada e variáveis) e anexos
// (imagem aparece de verdade; PDF/vídeo como cartão), na mesma ordem do envio.
import { useEffect, useMemo, useState } from "react";
import { FileText, Film, ImageOff, RefreshCw, X as XIcon } from "lucide-react";
import { EsteiraAnexo, lerArquivoLocal, liberarArquivosLocais, montarMensagem, partesDaMensagem, tamanhoLegivel } from "@/lib/esteiras";

type Item =
  | { tipo: "texto"; texto: string; chave: string }
  | { tipo: "anexo"; anexo: EsteiraAnexo; legenda: string; chave: string };

interface Props {
  mensagem: string;
  anexos: EsteiraAnexo[];
  leadNome?: string;
  observacoes?: string | null;
  onFechar: () => void;
}

export function PreviaWhatsApp({ mensagem, anexos, leadNome, observacoes, onFechar }: Props) {
  const nome = (leadNome || "").trim() || "Maria Silva";
  const [semente, setSemente] = useState(() => crypto.randomUUID());
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [semAcesso, setSemAcesso] = useState<string[]>([]);
  const [versao, setVersao] = useState(0);

  // monta a sequência igual ao envio: cada parte (separada por ===) e os anexos que vão depois dela
  const itens = useMemo<Item[]>(() => {
    const texto = montarMensagem(mensagem, nome, observacoes, semente);
    const partes = partesDaMensagem(texto);
    const ultima = partes.length - 1;
    const pos = (a: EsteiraAnexo) => (Number.isInteger(a.depois_de) ? Math.min(Math.max(0, a.depois_de as number), ultima) : ultima);
    const out: Item[] = [];
    partes.forEach((parte, k) => {
      const ligados = anexos.filter((a) => pos(a) === k);
      const comoLegenda = ligados.find((a) => a.legenda_texto && !(a.legenda || "").trim() && (a.legenda ?? null) === null);
      const limpo = parte.trim();
      if (limpo && !comoLegenda) out.push({ tipo: "texto", texto: limpo, chave: `t${k}` });
      ligados.forEach((a) => {
        const legenda = a === comoLegenda ? limpo : (a.legenda || "").trim() ? montarMensagem(String(a.legenda), nome, observacoes, semente) : "";
        out.push({ tipo: "anexo", anexo: a, legenda, chave: `a${a.local_id || a.path || a.name}` });
      });
    });
    return out;
  }, [mensagem, anexos, nome, observacoes, semente]);

  // lê as imagens do computador para mostrar de verdade
  useEffect(() => {
    let vivo = true;
    const criadas: string[] = [];
    (async () => {
      const novas: Record<string, string> = {};
      const falta: string[] = [];
      for (const a of anexos) {
        if (!a.local_id || !(a.type || "").startsWith("image/")) continue;
        try {
          const f = await lerArquivoLocal(a.local_id, a.name);
          const u = URL.createObjectURL(f);
          criadas.push(u);
          novas[a.local_id] = u;
        } catch {
          falta.push(a.name);
        }
      }
      if (vivo) {
        setUrls(novas);
        setSemAcesso(falta);
      }
    })();
    return () => {
      vivo = false;
      criadas.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [anexos, versao]);

  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#075E54] text-white">
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">Prévia: como {nome.split(" ")[0]} vai receber</div>
          <div className="text-[11px] opacity-90">Variação sorteada · nome e empreendimento já trocados</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSemente(crypto.randomUUID())}
            className="inline-flex items-center gap-1 h-8 px-2 rounded-md bg-white/15 hover:bg-white/25 text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Outra variação
          </button>
          <button type="button" onClick={onFechar} className="p-1.5 rounded-md hover:bg-white/15" aria-label="Fechar prévia">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-3 sm:p-4 flex flex-col items-end gap-1.5 bg-[#EFEAE2] dark:bg-[#0B141A] max-h-[520px] overflow-y-auto">
        {itens.length === 0 && <div className="self-center text-xs text-slate-600 dark:text-slate-300 py-6">Escreva a mensagem ou anexe um arquivo para ver a prévia.</div>}
        {itens.map((it) =>
          it.tipo === "texto" ? (
            <div key={it.chave} className="max-w-[85%] rounded-lg rounded-tr-none bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] px-2.5 py-1.5 shadow-sm">
              <div className="text-sm whitespace-pre-wrap break-words">{it.texto}</div>
              <div className="text-[10px] text-right opacity-60 mt-0.5">{hora} ✓✓</div>
            </div>
          ) : (
            <div key={it.chave} className="max-w-[85%] w-[280px] rounded-lg rounded-tr-none bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] p-1 shadow-sm">
              {(it.anexo.type || "").startsWith("image/") ? (
                it.anexo.local_id && urls[it.anexo.local_id] ? (
                  <img src={urls[it.anexo.local_id]} alt={it.anexo.name} className="w-full max-h-72 object-cover rounded-md" />
                ) : (
                  <div className="h-40 rounded-md bg-black/10 flex flex-col items-center justify-center gap-1 text-xs text-center px-3">
                    <ImageOff className="w-6 h-6 opacity-60" />
                    {it.anexo.name}
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2.5 rounded-md bg-black/5 dark:bg-white/10 px-2.5 py-2.5">
                  {(it.anexo.type || "").startsWith("video/") ? <Film className="w-8 h-8 shrink-0 text-slate-600 dark:text-slate-200" /> : <FileText className="w-8 h-8 shrink-0 text-red-600" />}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" title={it.anexo.name}>{it.anexo.name}</div>
                    <div className="text-[11px] opacity-70">
                      {(it.anexo.type || "").includes("pdf") ? "PDF" : (it.anexo.type || "").startsWith("video/") ? "Vídeo" : "Arquivo"} · {tamanhoLegivel(it.anexo.size)}
                    </div>
                  </div>
                </div>
              )}
              {it.legenda && <div className="text-sm whitespace-pre-wrap break-words px-1.5 pt-1">{it.legenda}</div>}
              <div className="text-[10px] text-right opacity-60 px-1">{hora} ✓✓</div>
            </div>
          )
        )}
      </div>
      {semAcesso.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-warning/10 border-t">
          <span>O Chrome precisa de permissão para mostrar {semAcesso.length === 1 ? "a imagem" : "as imagens"}.</span>
          <button
            type="button"
            className="h-8 px-3 rounded-md border bg-card font-semibold hover:bg-muted"
            onClick={async () => {
              await liberarArquivosLocais(anexos);
              setVersao((v) => v + 1);
            }}
          >
            Mostrar imagens
          </button>
        </div>
      )}
    </div>
  );
}
