import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Target, FileSpreadsheet, Loader2 } from "lucide-react";
import { carregarMetas, salvarMetas, salvarRegistros, METAS_VAZIAS, lerLimitesParado, salvarLimitesParado } from "@/lib/gestor/dados";
import { mesDe, type EtapaFunil, type Metas } from "@/lib/gestor/metricas";
import { baixarPlanilha, interpretarPlanilha } from "@/lib/gestor/planilhaSpartanos";

const CAMPOS: { id: keyof Metas; nome: string; dinheiro?: boolean }[] = [
  { id: "interacoes", nome: "Interações" },
  { id: "negociacoes", nome: "Negociações" },
  { id: "visitas", nome: "Visitas" },
  { id: "documentacoes", nome: "Documentações / propostas" },
  { id: "vendas_qtd", nome: "Vendas (quantidade)" },
  { id: "vendas_valor", nome: "Vendas (R$)", dinheiro: true },
  { id: "leads", nome: "Leads" },
  { id: "ligacoes", nome: "Ligações" },
];

const CHAVE_PLANILHA = "inmovya_planilha_spartanos";

export function MetasDoMes() {
  const { toast } = useToast();
  const [mes, setMes] = useState(mesDe(new Date()));
  const [metas, setMetas] = useState<Metas>({ ...METAS_VAZIAS });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [limites, setLimites] = useState(lerLimitesParado());
  const salvo = (() => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_PLANILHA) || "{}");
    } catch {
      return {};
    }
  })();
  const [link, setLink] = useState<string>(salvo.link || "");
  const [gid, setGid] = useState<string>(salvo.gid || "");
  const [comRealizados, setComRealizados] = useState(true);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    carregarMetas(mes)
      .then((r) => setMetas(r.metas))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [mes]);

  const salvar = async (m = metas) => {
    setSalvando(true);
    try {
      await salvarMetas(mes, m);
      salvarLimitesParado(limites);
      toast({ title: "Metas salvas", description: `Mês ${mes.split("-").reverse().join("/")}` });
    } catch (e: any) {
      toast({ title: "Não consegui salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const importar = async () => {
    setImportando(true);
    try {
      try {
        localStorage.setItem(CHAVE_PLANILHA, JSON.stringify({ link, gid }));
      } catch {
        /* ignore */
      }
      const linhas = await baixarPlanilha(link, gid);
      const r = interpretarPlanilha(linhas, mes);
      const novas = { ...metas, ...Object.fromEntries(Object.entries(r.metas).filter(([, v]) => (v as number) > 0)) } as Metas;
      setMetas(novas);
      await salvarMetas(mes, novas);
      if (comRealizados && r.registros.length) await salvarRegistros(r.registros);
      toast({
        title: "Planilha importada",
        description: [`Metas do mês atualizadas`, comRealizados ? `${r.registros.length} dia(s) de realizado` : "", ...r.avisos].filter(Boolean).join(" · "),
      });
    } catch (e: any) {
      toast({ title: "Não consegui importar", description: e.message, variant: "destructive" });
    } finally {
      setImportando(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Metas do mês</h2>
            <p className="text-sm text-muted-foreground">Usadas pelo Gestor em Relatórios.</p>
          </div>
        </div>
        <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-[170px] h-9" aria-label="Mês" />
      </div>

      {erro ? (
        <p className="text-sm text-warning">{erro}</p>
      ) : carregando ? (
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CAMPOS.map((c) => (
              <label key={c.id} className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">{c.nome}</span>
                <Input
                  type="number"
                  min={0}
                  step={c.dinheiro ? "0.01" : "1"}
                  inputMode={c.dinheiro ? "decimal" : "numeric"}
                  className="h-9 tabular-nums"
                  value={(metas[c.id] as number) || ""}
                  placeholder="0"
                  onChange={(e) => setMetas((m) => ({ ...m, [c.id]: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Switch checked={metas.so_dias_uteis} onCheckedChange={(v) => setMetas((m) => ({ ...m, so_dias_uteis: v }))} />
              Contar só dias úteis no ritmo diário
            </label>
            <Button onClick={() => salvar()} disabled={salvando}>
              {salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Salvar metas
            </Button>
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <p className="text-sm font-semibold">Lead parado depois de quantos dias sem interação</p>
            <div className="flex flex-wrap gap-3">
              {(["20", "50", "70"] as EtapaFunil[]).map((et) => (
                <label key={et} className="flex items-center gap-2 text-sm">
                  <span className="font-semibold w-9">{et}%</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-16 tabular-nums"
                    value={limites[et]}
                    onChange={(e) => setLimites((l) => ({ ...l, [et]: Math.max(1, Number(e.target.value) || 1) }))}
                  />
                  <span className="text-muted-foreground">dias</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-success" />
              <p className="text-sm font-semibold">Importar da planilha Spartanos</p>
            </div>
            <p className="text-xs text-muted-foreground">
              A planilha precisa estar compartilhada como "Qualquer pessoa com o link pode ver". O gid é o número depois de <code>gid=</code> no link da sua aba.
            </p>
            <div className="grid sm:grid-cols-[1fr_140px] gap-2">
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className="h-9" />
              <Input value={gid} onChange={(e) => setGid(e.target.value)} placeholder="gid da aba" className="h-9" inputMode="numeric" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" className="h-4 w-4" checked={comRealizados} onChange={(e) => setComRealizados(e.target.checked)} />
                Também os realizados de cada dia (vão para o "Registrar o dia")
              </label>
              <Button variant="outline" onClick={importar} disabled={importando || !link.trim()}>
                {importando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Importar do mês {mes.split("-").reverse().join("/")}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
