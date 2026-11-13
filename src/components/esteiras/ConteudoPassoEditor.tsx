// Mensagem + anexos de um passo da esteira (usado na mensagem padrão e em cada versão por projeto).
import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  EsteiraAnexo,
  ANEXO_MAX_MB,
  escolherArquivos,
  guardarArquivoNoNavegador,
  partesDaMensagem,
  tamanhoLegivel,
} from "@/lib/esteiras";
import { Loader2, Paperclip, Shuffle, Eye, X as XIcon, Upload, Smartphone } from "lucide-react";
import { PreviaWhatsApp } from "@/components/esteiras/PreviaWhatsApp";
import { contarVariacoes, gerarSpintax, spin, spintaxValido } from "@/lib/spintax";

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
        <span className="text-[11px] text-muted-foreground ml-1">Enter quebra a linha · aceita {"{{nome}}"}, {"{{empreendimento}}"}, {"{{saudacao}}"}…</span>
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

/** Spintax: {Oi|Olá|Oii} — cada lead recebe uma combinação diferente. */
function SpintaxBarra({ mensagem, onMensagem }: { mensagem: string; onMensagem: (v: string) => void }) {
  const [exemplo, setExemplo] = useState<string | null>(null);
  if (!mensagem.trim()) return null;
  const valido = spintaxValido(mensagem);
  const n = valido ? contarVariacoes(mensagem) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {!valido ? (
          <span className="font-semibold text-destructive">Tem chave {"{ }"} sobrando ou faltando</span>
        ) : n > 1 ? (
          <span className="font-semibold text-success">✓ Variação ativa · {n.toLocaleString("pt-BR")} combinações (cada lead recebe um texto diferente)</span>
        ) : (
          <span className="font-semibold text-warning">
            Sem variação: todos recebem o mesmo texto, o que aumenta o risco de bloqueio. Use {"{Oi|Olá|Oii}"} ou clique em Gerar spintax.
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 h-6 px-2 rounded border bg-card hover:bg-muted"
            title="Troca expressões comuns (oi, tudo bem, posso te ajudar…) por opções. Revise depois."
            onClick={() => onMensagem(gerarSpintax(mensagem))}
          >
            <Shuffle className="w-3 h-3" /> Gerar spintax
          </button>
          <button
            type="button"
            disabled={!valido}
            className="inline-flex items-center gap-1 h-6 px-2 rounded border bg-card hover:bg-muted disabled:opacity-50"
            onClick={() => setExemplo(spin(mensagem))}
          >
            <Eye className="w-3 h-3" /> Ver exemplo
          </button>
        </div>
      </div>
      {exemplo !== null && (
        <div className="relative rounded-md border bg-muted/40 p-2 pr-7 text-xs whitespace-pre-wrap">
          {exemplo}
          <button type="button" className="absolute top-1 right-1 p-0.5 text-muted-foreground hover:text-foreground" onClick={() => setExemplo(null)} aria-label="Fechar exemplo">
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  mensagem: string;
  anexos: EsteiraAnexo[];
  onMensagem: (v: string) => void;
  onAnexos: (v: EsteiraAnexo[]) => void;
  placeholder?: string;
  /** lead usado na prévia (nome e empreendimento); sem ele, um nome de exemplo */
  exemploLead?: { nome?: string | null; observacoes?: string | null } | null;
}

const TIPOS_OK = /^(image\/(jpeg|png|webp|gif)|application\/pdf|video\/)/;

export function ConteudoPassoEditor({ mensagem, anexos, onMensagem, onAnexos, placeholder, exemploLead }: Props) {
  const { toast } = useToast();
  const [anexando, setAnexando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [previa, setPrevia] = useState(false);
  const partes = partesDaMensagem(mensagem);

  // arquivo solto fora da caixa não pode abrir no lugar do Inmovya
  useEffect(() => {
    const segurar = (ev: DragEvent) => {
      if (ev.dataTransfer?.types?.includes("Files")) ev.preventDefault();
    };
    window.addEventListener("dragover", segurar);
    window.addEventListener("drop", segurar);
    return () => {
      window.removeEventListener("dragover", segurar);
      window.removeEventListener("drop", segurar);
    };
  }, []);

  // aviso que fica na tela (o balão some rápido)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  // guarda a cópia de cada arquivo neste navegador e põe na lista de anexos do passo
  const adicionar = async (files: File[]) => {
    if (!files.length) return;
    setAnexando(true);
    setAviso(null);
    const novos: EsteiraAnexo[] = [];
    const erros: string[] = [];
    for (const f of files) {
      try {
        if (f.type && !TIPOS_OK.test(f.type)) throw new Error(`${f.name}: use PDF, JPG, PNG ou vídeo`);
        novos.push(await guardarArquivoNoNavegador(f));
      } catch (err: any) {
        erros.push(err?.message || `${f.name}: não consegui guardar`);
      }
    }
    if (novos.length) onAnexos([...anexos, ...novos]);
    const nomes = novos.map((n) => n.name).join(", ");
    if (novos.length && !erros.length) {
      setAviso({ ok: true, texto: `✓ Anexado: ${nomes}. Agora clique em Salvar para guardar na esteira.` });
      toast({ title: `${novos.length} anexo(s) adicionado(s)`, description: "Clique em Salvar para guardar na esteira." });
    } else if (novos.length) {
      setAviso({ ok: false, texto: `Anexado: ${nomes}. Não anexados: ${erros.join("; ")}.` });
    } else {
      setAviso({ ok: false, texto: `Nenhum arquivo anexado: ${erros.join("; ")}.` });
      toast({ title: "Anexo não adicionado", description: erros.join("; "), variant: "destructive" });
    }
    setAnexando(false);
  };

  // arrastar e soltar
  const soltar = (ev: ReactDragEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    setArrastando(false);
    adicionar(Array.from(ev.dataTransfer.files || []) as File[]);
  };

  // clique: abre a janela de escolher arquivo (tem que ser direto no clique)
  const anexar = () => {
    escolherArquivos().then(adicionar);
  };
  const mudarAnexo = (chave: string, campos: Partial<EsteiraAnexo>) =>
    onAnexos(anexos.map((a) => ((a.local_id || a.path) === chave ? { ...a, ...campos } : a)));
  const tirarAnexo = (chave: string) => onAnexos(anexos.filter((a) => (a.local_id || a.path) !== chave));

  return (
    <>
      <Textarea rows={4} value={mensagem} onChange={(ev) => onMensagem(ev.target.value)} placeholder={placeholder || "{Oi|Olá} {{nome}}, {{saudacao}}! ..."} />
      <SpintaxBarra mensagem={mensagem} onMensagem={onMensagem} />
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
          onDragOver={(ev) => {
            ev.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={soltar}
          className={`w-full flex items-center justify-center gap-2 min-h-14 rounded-lg border-2 border-dashed px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
            arrastando ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/60 hover:bg-muted/50"
          }`}
        >
          {anexando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {arrastando ? "Solte aqui para anexar" : "Anexar PDF ou imagem: clique ou arraste o arquivo aqui"}
        </button>
        <span className="text-[11px] text-muted-foreground">
          PDF, JPG, PNG (e vídeo) · até {ANEXO_MAX_MB} MB · uma cópia fica guardada neste navegador (não vai para a internet) · separe as mensagens com === para escolher depois de qual vai cada arquivo
        </span>
        {aviso && (
          <div
            role="status"
            className={`w-full rounded-md px-3 py-2 text-sm font-semibold ${aviso.ok ? "bg-success/15 text-success border border-success/30" : "bg-destructive/10 text-destructive border border-destructive/30"}`}
          >
            {aviso.texto}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPrevia((v) => !v)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-card text-sm font-semibold hover:bg-muted"
          aria-expanded={previa}
        >
          <Smartphone className="w-4 h-4" /> {previa ? "Fechar prévia" : "Ver prévia no WhatsApp"}
        </button>
      </div>
      {previa && (
        <PreviaWhatsApp
          mensagem={mensagem}
          anexos={anexos}
          leadNome={exemploLead?.nome || undefined}
          observacoes={exemploLead?.observacoes}
          onFechar={() => setPrevia(false)}
        />
      )}
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
