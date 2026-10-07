// Mensagem + anexos de um passo da esteira (usado na mensagem padrão e em cada versão por projeto).
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  EsteiraAnexo,
  ANEXO_MAX_MB,
  escolherArquivosDoComputador,
  partesDaMensagem,
  tamanhoLegivel,
} from "@/lib/esteiras";
import { Loader2, Paperclip, X as XIcon } from "lucide-react";

interface Props {
  mensagem: string;
  anexos: EsteiraAnexo[];
  onMensagem: (v: string) => void;
  onAnexos: (v: EsteiraAnexo[]) => void;
  placeholder?: string;
}

export function ConteudoPassoEditor({ mensagem, anexos, onMensagem, onAnexos, placeholder }: Props) {
  const { toast } = useToast();
  const [anexando, setAnexando] = useState(false);
  const partes = partesDaMensagem(mensagem);

  const anexar = async () => {
    setAnexando(true);
    try {
      const novos = await escolherArquivosDoComputador();
      if (novos.length) {
        onAnexos([...anexos, ...novos]);
        toast({ title: `${novos.length} anexo(s) adicionado(s)`, description: "Clique em Salvar esteira para guardar." });
      }
    } catch (err: any) {
      toast({ title: "Anexo não adicionado", description: err?.message, variant: "destructive" });
    } finally {
      setAnexando(false);
    }
  };
  const mudarAnexo = (chave: string, campos: Partial<EsteiraAnexo>) =>
    onAnexos(anexos.map((a) => ((a.local_id || a.path) === chave ? { ...a, ...campos } : a)));
  const tirarAnexo = (chave: string) => onAnexos(anexos.filter((a) => (a.local_id || a.path) !== chave));

  return (
    <>
      <Textarea rows={4} value={mensagem} onChange={(ev) => onMensagem(ev.target.value)} placeholder={placeholder || "Oi {{nome}}, {{saudacao}}! ..."} />
      <div className="flex flex-wrap items-center gap-2">
        {anexos.map((a) => {
          const chave = (a.local_id || a.path)!;
          const modo = (a.legenda ?? null) !== null ? "propria" : a.legenda_texto ? "texto" : "nenhuma";
          return (
            <div key={chave} className="w-full flex flex-col sm:flex-row sm:items-center gap-1.5 rounded-md border bg-slate-50 px-2 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1 min-w-0 sm:w-56 shrink-0">
                <Paperclip className="w-3 h-3 shrink-0" />
                <span className="truncate" title={a.name}>{a.name}</span>
                <span className="text-muted-foreground shrink-0">({tamanhoLegivel(a.size)})</span>
              </span>
              {partes.length > 1 && (
                <Select
                  value={String(Number.isInteger(a.depois_de) ? Math.min(a.depois_de as number, partes.length - 1) : partes.length - 1)}
                  onValueChange={(v) => mudarAnexo(chave, { depois_de: parseInt(v) })}
                >
                  <SelectTrigger className="h-7 w-full sm:w-[170px] text-xs bg-white" title="Em que ponto da sequência este arquivo é enviado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {partes.map((_, k) => (
                      <SelectItem key={k} value={String(k)}>
                        Depois da mensagem {k + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select
                value={modo}
                onValueChange={(v) =>
                  mudarAnexo(chave, {
                    legenda: v === "propria" ? a.legenda || "" : null,
                    legenda_texto: v === "texto",
                  })
                }
              >
                <SelectTrigger className="h-7 w-full sm:w-[190px] text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Sem legenda</SelectItem>
                  <SelectItem value="texto">Legenda = texto da mensagem</SelectItem>
                  <SelectItem value="propria">Escrever legenda</SelectItem>
                </SelectContent>
              </Select>
              {modo === "propria" && (
                <Input
                  value={a.legenda || ""}
                  placeholder="Ex.: {{nome}}, segue a planta do apartamento"
                  onChange={(ev) => mudarAnexo(chave, { legenda: ev.target.value })}
                  className="h-7 text-xs flex-1 bg-white"
                />
              )}
              <button type="button" className="text-red-600 hover:text-red-800 self-end sm:self-auto" onClick={() => tirarAnexo(chave)} title="Tirar anexo">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          disabled={anexando}
          onClick={anexar}
          className="inline-flex items-center gap-1 text-xs rounded-md border px-2 py-1 hover:bg-slate-50 disabled:opacity-60"
        >
          {anexando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
          Anexar arquivo do computador
        </button>
        <span className="text-[11px] text-muted-foreground">
          PDF, vídeo, imagem, áudio, documentos · até {ANEXO_MAX_MB} MB · separe as mensagens com === e escolha depois de qual mensagem cada arquivo vai · o arquivo fica no seu computador (não mova nem apague)
        </span>
      </div>
      {anexos.length > 0 && (
        <div className="rounded-md bg-blue-50/60 border border-blue-100 px-2 py-1.5">
          <div className="text-[11px] font-semibold text-blue-900 mb-0.5">Ordem do envio deste passo</div>
          <ol className="list-decimal pl-5 text-[11px] text-slate-700 space-y-0.5">
            {(() => {
              const ultima = partes.length - 1;
              const pos = (a: EsteiraAnexo) => (Number.isInteger(a.depois_de) ? Math.min(Math.max(0, a.depois_de as number), ultima) : ultima);
              const itens: JSX.Element[] = [];
              partes.forEach((parte, k) => {
                const ligados = anexos.filter((a) => pos(a) === k);
                const comoLegenda = ligados.find((a) => a.legenda_texto && !(a.legenda || "").trim() && (a.legenda ?? null) === null);
                const resumo = parte.replace(/\s+/g, " ").trim();
                if (resumo && !comoLegenda) {
                  itens.push(<li key={`m${k}`}>Mensagem {k + 1}: “{resumo.slice(0, 60)}{resumo.length > 60 ? "…" : ""}”</li>);
                }
                ligados.forEach((a) =>
                  itens.push(
                    <li key={`a${a.local_id || a.path}`}>
                      📎 {a.name}
                      {a === comoLegenda
                        ? ` — legenda: mensagem ${k + 1}`
                        : (a.legenda || "").trim()
                        ? ` — legenda: “${String(a.legenda).slice(0, 40)}”`
                        : ""}
                    </li>
                  )
                );
              });
              return itens;
            })()}
          </ol>
        </div>
      )}
    </>
  );
}
