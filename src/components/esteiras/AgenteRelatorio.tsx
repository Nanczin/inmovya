import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, CheckCircle2, KeyRound, Loader2, MessageCircle, Play, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  agenteDisponivel,
  assinarRelatorio,
  getAgenteAtivo,
  leadsNoFimDaEsteira,
  lerChaveGemini,
  salvarChaveGemini,
  testarChaveGemini,
  lerRelatorio,
  limparRelatorio,
  rodarFimDasEsteiras,
  rotulo,
  setAgenteAtivo,
  statusFim,
  lerResumo,
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
  const [progresso, setProgresso] = useState(statusFim().progresso);
  const [resumo, setResumo] = useState(lerResumo());
  const [verNomes, setVerNomes] = useState(false);
  const [pendentes, setPendentes] = useState<number | null>(null);
  const [chave, setChave] = useState("");
  const [chaveSalva, setChaveSalva] = useState(false);
  const [salvandoChave, setSalvandoChave] = useState(false);
  const [editandoChave, setEditandoChave] = useState(false);
  useEffect(() => {
    lerChaveGemini().then((k) => {
      setChave(k);
      setChaveSalva(!!k);
    });
  }, []);

  const salvarChave = async () => {
    if (!chave.trim()) return;
    setSalvandoChave(true);
    try {
      const ok = await testarChaveGemini(chave).catch(() => false);
      if (!ok) {
        toast({ title: "Chave do Google inválida", description: "Confira a chave criada em aistudio.google.com/apikey.", variant: "destructive" });
        return;
      }
      await salvarChaveGemini(chave);
      setChaveSalva(true);
      setEditandoChave(false);
      toast({ title: "Gemini conectado", description: "O agente vai usar a IA do Google (grátis) para analisar as respostas." });
    } finally {
      setSalvandoChave(false);
    }
  };

  useEffect(
    () =>
      assinarRelatorio(() => {
        setItens([...lerRelatorio()]);
        setRodando(statusFim().rodando);
        setProgresso(statusFim().progresso);
        setResumo(lerResumo());
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
      toast({ title: "Atualize o Inmovya Scale", description: "O agente precisa da versão 1.5.0 (chrome://extensions → ↻).", variant: "destructive" });
      return;
    }
    setRodando(true);
    try {
      const r = await rodarFimDasEsteiras(true);
      const res = lerResumo();
      toast({
        title: "Agente",
        description: res
          ? `${res.conferidos} conversa(s) conferida(s): ${res.responderam} responderam, ${res.fim} foram para disparo, ${res.semResposta.length} sem resposta (seguem na esteira).`
          : `${r.length} lead(s) analisado(s).`,
      });
      if (r.length) onRodou?.();
    } catch (e: any) {
      toast({ title: "Agente não rodou", description: e?.message, variant: "destructive" });
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
          {!agenteDisponivel() && <div className="text-xs text-amber-700 mt-1">Atualize o Inmovya Scale para 1.5.0 para o agente funcionar.</div>}
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

      {rodando && progresso && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
          Conferindo {progresso.atual}/{progresso.total}: <span className="truncate">{progresso.nome}</span> — o WhatsApp fica aberto numa janelinha no canto até terminar.
        </div>
      )}

      {resumo && !rodando && (
        <div className="rounded-lg border bg-white p-3 text-sm">
          <div>
            <b>Última verificação</b> ({new Date(resumo.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}):{" "}
            {resumo.conferidos} conversa(s) conferida(s) · <b>{resumo.responderam}</b> responderam · <b>{resumo.fim}</b> foram para disparo ·{" "}
            <button type="button" className="underline" onClick={() => setVerNomes((v) => !v)}>
              {resumo.semResposta.length} sem resposta (seguem na esteira)
            </button>
            {resumo.erros.length > 0 && <span className="text-red-700"> · {resumo.erros.length} erro(s)</span>}
          </div>
          {verNomes && resumo.semResposta.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">{resumo.semResposta.join(", ")}</div>
          )}
          {resumo.erros.length > 0 && <div className="mt-1 text-xs text-red-700">{resumo.erros.slice(0, 5).join(" · ")}</div>}
        </div>
      )}

      <div className="rounded-lg border bg-white p-3 flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
        <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
        {chaveSalva && !editandoChave ? (
          <>
            <span className="flex-1 flex items-center gap-1 text-green-700">
              <CheckCircle2 className="w-4 h-4" /> IA do Google (Gemini, grátis) conectada
            </span>
            <button type="button" className="text-xs underline text-muted-foreground" onClick={() => setEditandoChave(true)}>
              trocar chave
            </button>
          </>
        ) : (
          <>
            <span className="shrink-0">Chave do Google Gemini:</span>
            <Input
              type="password"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="Cole aqui a chave (começa com AIza...)"
              className="h-9 flex-1"
            />
            <Button size="sm" onClick={salvarChave} disabled={salvandoChave || !chave.trim()}>
              {salvandoChave ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-xs underline text-blue-700 shrink-0">
              criar chave grátis
            </a>
          </>
        )}
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
          Nenhuma resposta analisada ainda. Clique em <b>Rodar agora</b> para o agente conferir as conversas de quem está nas esteiras
          (ele também roda sozinho a cada 30 minutos e antes de cada envio). Quem não respondeu aparece no resumo acima.
        </div>
      ) : (
        <div className="space-y-2">
          {visiveis.map((r) => (
            <div key={r.id} className="rounded-lg border bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{r.nome}</span>
                <span className="text-xs text-muted-foreground">{r.telefone}</span>
                <span className={`text-[11px] rounded-full border px-2 py-0.5 ${cor[r.classificacao]}`}>{rotulo(r.classificacao, r.momento)}</span>
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
