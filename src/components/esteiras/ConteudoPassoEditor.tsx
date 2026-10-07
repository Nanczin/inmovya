// Mensagem + anexos de um passo da esteira (usado na mensagem padrão e em cada versão por projeto).
import { useRef, useState } from "react";
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

// Formatação do WhatsApp: *negrito*, _itálico_, ~tachado~, ```mono```
const FORMATOS = [
  { marca: "*", titulo: "Negrito", rotulo: <b>N</b> },
  { marca: "_", titulo: "Itálico", rotulo: <i>I</i> },
  { marca: "~", titulo: "Tachado", rotulo: <s>S</s> },
  { marca: "```", titulo: "Monoespaçado", rotulo: <span className="font-mono">{"</>"}</span> },
];

/** Legenda própria do anexo: várias linhas e botões de formatação do WhatsApp. */
function LegendaEditor({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const formatar = (marca: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: ini, selectionEnd: fim } = el;
    const selecionado = valor.slice(ini, fim) || "texto";
    onChange(valor.slice(0, ini) + marca + selecionado + marca + valor.slice(fim));
    // mantém o texto formatado selecionado
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length + selecionado.length);
    });
  };
  return (
    <div className="basis-full w-full space-y-1">
      <div className="flex items-center gap-1">
        {FORMATOS.map((f) => (
          <button
            key={f.marca}
            type="button"
            title={`${f.titulo} (selecione o texto)`}
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => formatar(f.marca)}
            className="h-6 min-w-6 px-1.5 rounded border bg-white text-xs hover:bg-slate-100"
          >
            {f.rotulo}
          </button>
        ))}
        <span className="text-[11px] text-muted-foreground ml-1">Enter quebra a linha · aceita {"{{nome}}"}, {"{{saudacao}}"}…</span>
      </div>
      <Textarea
        ref={ref}
        rows={Math.min(8, Math.max(2, valor.split("\n").length + 1))}
        value={valor}
        placeholder={"Ex.: {{nome}}, segue a planta do apartamento\n\n*3 dormitórios* com suíte"}
        onChange={(ev) => onChange(ev.target.value)}
        className="text-xs bg-white"
      />
    </div>
  );
}

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
            <div key={chave} className="w-full flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 rounded-md border bg-slate-50 px-2 py-1.5 text-xs">
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
              <button type="button" className="text-red-600 hover:text-red-800 self-end sm:self-auto sm:ml-auto" onClick={() => tirarAnexo(chave)} title="Tirar anexo">
                <XIcon className="w-3.5 h-3.5" />
              </button>
              {modo === "propria" && (
                <LegendaEditor valor={a.legenda || ""} onChange={(v) => mudarAnexo(chave, { legenda: v })} />
              )}
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
