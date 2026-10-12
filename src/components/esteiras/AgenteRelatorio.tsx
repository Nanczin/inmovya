import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Loader2, MessageCircle, Play, Trash2 } from "lucide-react";
import {
  agenteDisponivel,
  assinarRelatorio,
  getAgenteAtivo,
  leadsNoFimDaEsteira,
  lerRelatorio,
  limparRelatorio,
  rodarFimDasEsteiras,
  rotulo,
  setAgenteAtivo,
  statusFim,
  type Classificacao,
} from "@/lib/agenteEsteira";

const cor: Record<Classificacao, string> = {
  positiva: "bg-green-100 text-green-800 border-green-200",
  negativa: "bg-red-100 text-red-800 border-red-200",
  neutra: "bg-amber-100 text-amber-800 border-amber-200",
  sem_resposta: "bg-slate-100 text-slate-700 border-slate-200",
};

const FILTROS: { id: "todos" | Classificacao; nome: string }[] = [
  { id: "todos", nome: "Todos" },
  { id: "positiva", nome: "Positivas" },
  { id: "negativa", nome: "Negativas" },
  { id: "neutra", nome: "Neutras" },
  { id: "sem_resposta", nome: "Sem resposta" },
];

export function AgenteRelatorio({ onRodou }: { onRodou?: () => void }) {
  const { toast } = useToast();
  const [itens, setItens] = useState(lerRelatorio());
  const [ativo, setAtivo] = useState(getAgenteAtivo());
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");
  const [rodando, setRodando] = useState(statusFim().rodando);
  const [pendentes, setPendentes] = useState<number | null>(null);

  useEffect(
    () =>
      assinarRelatorio(() => {
        setItens([...lerRelatorio()]);
        setRodando(statusFim().rodando);
      }),
    []
  );
  useEffect(() => {
    leadsNoFimDaEsteira().then((l) => setPendentes(l.length)).catch(() => setPendentes(null));
  }, [itens.length]);

  const visiveis = useMemo(() => (filtro === "todos" ? itens : itens.filter((i) => i.classificacao === filtro)), [itens, filtro]);
  const conta = (c: Classificacao) => itens.filter((i) => i.classificacao === c).length;

  const rodarAgora = async () => {
    if (!agenteDisponivel()) {
      toast({ title: "Atualize o Inmovya Scale", description: "O agente precisa da versão 1.4.0 (chrome://extensions → ↻).", variant: "destructive" });
      return;
    }
    setRodando(true);
    try {
      const r = await rodarFimDasEsteiras();
      toast({ title: "Agente", description: r.length ? `${r.length} lead(s) analisado(s).` : "Ninguém terminou a esteira agora." });
      if (r.length) onRodou?.();
    } finally {
      setRodando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <Bot className="w-8 h-8 text-blue-700 shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <div className="font-semibold">Agente da esteira</div>
          <div className="text-xs text-muted-foreground">
            Antes de cada envio e no fim da esteira, lê a conversa no WhatsApp. Sem resposta no fim → tag <b>disparo</b> + etiqueta <b>Lead</b>.
            Resposta positiva → <b>50%</b>. Negativa ou neutra → sai da esteira e aparece aqui para você decidir.
            {pendentes ? <> · <b>{pendentes}</b> terminaram a esteira e aguardam o agente.</> : null}
          </div>
          {!agenteDisponivel() && <div className="text-xs text-amber-700 mt-1">Atualize o Inmovya Scale para 1.4.0 para o agente funcionar.</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={rodarAgora} disabled={rodando || !ativo}>
            {rodando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            {rodando ? "Analisando..." : "Rodar agora"}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={ativo}
              onCheckedChange={(v) => {
                setAgenteAtivo(v);
                setAtivo(v);
              }}
            />
            {ativo ? "Ligado" : "Desligado"}
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`text-xs rounded-full border px-3 py-1 ${filtro === f.id ? "bg-blue-800 text-white border-blue-800" : "bg-white hover:bg-slate-50"}`}
          >
            {f.nome} ({f.id === "todos" ? itens.length : conta(f.id)})
          </button>
        ))}
        {itens.length > 0 && (
          <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-red-700 flex items-center gap-1" onClick={limparRelatorio}>
            <Trash2 className="w-3.5 h-3.5" /> Limpar relatório
          </button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum lead analisado ainda. O agente roda ao abrir as Esteiras, antes de cada envio e a cada 30 minutos.
        </div>
      ) : (
        <div className="space-y-2">
          {visiveis.map((r) => (
            <div key={r.id} className="rounded-lg border bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{r.nome}</span>
                <span className="text-xs text-muted-foreground">{r.telefone}</span>
                <span className={`text-[11px] rounded-full border px-2 py-0.5 ${cor[r.classificacao]}`}>{rotulo(r.classificacao)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {r.esteira} · {r.momento} · {new Date(r.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {r.via}
                </span>
                <a
                  href={`https://web.whatsapp.com/send?phone=${String(r.telefone).replace(/\D/g, "").replace(/^(?!55)/, "55")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-xs text-green-700 hover:underline flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Abrir conversa
                </a>
              </div>
              {r.resumo && <div className="mt-1">{r.resumo}</div>}
              {r.respostas.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground italic">“{r.respostas.join(" / ").slice(0, 400)}”</div>
              )}
              {r.sugestao && <div className="mt-1 text-xs"><b>Próximo passo:</b> {r.sugestao}</div>}
              {r.acoes.length > 0 && <div className="mt-1 text-[11px] text-muted-foreground">{r.acoes.join(" · ")}</div>}
              {r.erro && <div className="mt-1 text-[11px] text-red-700">{r.erro}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
