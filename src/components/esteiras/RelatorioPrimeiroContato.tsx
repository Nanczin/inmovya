import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock, Download, Loader2, RefreshCw, Search, XCircle } from "lucide-react";

// Relatório do 1º contato: dos leads que chegaram no período, quem foi chamado e quem não foi (e por quê).
type Grupo = "chamado" | "aguardando" | "falhou" | "pulado" | "tirado" | "fora";

interface Linha {
  id: string;
  nome: string;
  telefone: string;
  origem: string;
  chegou: string;
  chamadoEm: string | null;
  grupo: Grupo;
  motivo: string;
}

const GRUPOS: { id: Grupo; nome: string; cor: string }[] = [
  { id: "chamado", nome: "Chamados", cor: "text-success bg-success/10 border-success/30" },
  { id: "aguardando", nome: "Aguardando", cor: "text-primary bg-primary/10 border-primary/30" },
  { id: "falhou", nome: "Falharam", cor: "text-destructive bg-destructive/10 border-destructive/30" },
  { id: "pulado", nome: "Pulados", cor: "text-warning bg-warning/10 border-warning/30" },
  { id: "tirado", nome: "Tirados por você", cor: "text-muted-foreground bg-muted border-border" },
  { id: "fora", nome: "Fora do 1º contato", cor: "text-muted-foreground bg-muted border-border" },
];

const PERIODOS = [
  { id: "hoje", nome: "Hoje", dias: 0 },
  { id: "7", nome: "7 dias", dias: 7 },
  { id: "30", nome: "30 dias", dias: 30 },
] as const;

const daCaptura = (origem: string, tags: string[]) => {
  const t = tags.map((x) => x.toLowerCase());
  const o = origem.toLowerCase();
  return t.includes("meta ads") || t.includes("bitrix") || t.includes("roleta") || ["roleta", "facebook", "instagram", "formulário", "formulario"].includes(o);
};

function classificar(l: any, incluirMidrah = false): { grupo: Grupo; motivo: string } {
  const s = l.primeiro_contato_status as string | null;
  const erro = String(l.primeiro_contato_erro || "");
  const tent = l.primeiro_contato_tentativas || 0;
  const origem = String(l.origem || "");
  const tags: string[] = l.tags || [];
  if (s === "enviado") return { grupo: "chamado", motivo: "mensagem enviada" };
  if (s === "pulado") {
    if (/tirado da fila|fila limpa/i.test(erro)) return { grupo: "tirado", motivo: erro };
    return { grupo: "pulado", motivo: erro || "pulado pelo agente" };
  }
  if (s === "erro" && tent >= 3) return { grupo: "falhou", motivo: `desistiu depois de 3 tentativas${erro ? `: ${erro}` : ""}` };
  if (s === "erro") return { grupo: "aguardando", motivo: `falhou, vai tentar de novo (tentativa ${tent + 1} de 3)${erro ? ` — ${erro}` : ""}` };
  if (s === "enviando") return { grupo: "aguardando", motivo: "a extensão está enviando" };
  if (s === "na_fila") return { grupo: "aguardando", motivo: "você escolheu atender — na fila" };
  // nunca entrou na fila
  const midrah = origem.toLowerCase() === "midrah";
  if (midrah && !incluirMidrah) return { grupo: "fora", motivo: "Midrah — o próprio Midrah faz o 1º contato" };
  if (!midrah && !daCaptura(origem, tags)) return { grupo: "fora", motivo: "não veio da captura automática (cadastrado à mão)" };
  if (Date.now() - new Date(l.created_at).getTime() > 3 * 86400_000) return { grupo: "fora", motivo: "passou de 3 dias sem ser chamado (agente desligado ou PC fora)" };
  return { grupo: "aguardando", motivo: "na fila — recebe em 1 a 2 minutos com o agente ligado" };
}

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const duracao = (min: number) => (min < 60 ? `${Math.round(min)} min` : min < 1440 ? `${(min / 60).toFixed(1)} h` : `${(min / 1440).toFixed(1)} dias`);

export function RelatorioPrimeiroContato() {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["id"]>("7");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Grupo | "todos" | "nao">("todos");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setCarregando(false);
    const p = PERIODOS.find((x) => x.id === periodo)!;
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    if (p.dias) desde.setDate(desde.getDate() - (p.dias - 1));
    const { data } = await supabase
      .from("leads")
      .select("id, nome, telefone, origem, tags, created_at, primeiro_contato_status, primeiro_contato_em, primeiro_contato_erro, primeiro_contato_tentativas")
      .eq("user_id", user.id)
      .gte("created_at", desde.toISOString())
      .order("created_at", { ascending: false })
      .limit(1000);
    const { data: cfg } = await supabase.from("agente_config" as any).select("*").eq("user_id", user.id).maybeSingle();
    const incluirMidrah = !!(cfg as any)?.incluir_midrah;
    setLinhas(
      ((data as any[]) || []).map((l) => {
        const c = classificar(l, incluirMidrah);
        return {
          id: l.id,
          nome: l.nome || "Lead sem nome",
          telefone: l.telefone || "",
          origem: l.origem || "—",
          chegou: l.created_at,
          chamadoEm: l.primeiro_contato_status === "enviado" ? l.primeiro_contato_em : null,
          ...c,
        };
      })
    );
    setCarregando(false);
  }, [periodo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    linhas.forEach((l) => (c[l.grupo] = (c[l.grupo] || 0) + 1));
    return c;
  }, [linhas]);
  const alvo = linhas.filter((l) => l.grupo !== "fora").length; // quem deveria ser chamado
  const chamados = contagem.chamado || 0;
  const naoChamados = alvo - chamados;
  const tempos = linhas.filter((l) => l.chamadoEm).map((l) => (new Date(l.chamadoEm!).getTime() - new Date(l.chegou).getTime()) / 60000);
  const tempoMedio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;

  const visiveis = linhas.filter((l) => {
    if (filtro === "nao" && (l.grupo === "chamado" || l.grupo === "fora")) return false;
    if (filtro !== "todos" && filtro !== "nao" && l.grupo !== filtro) return false;
    const q = busca.trim().toLowerCase();
    if (q && !`${l.nome} ${l.telefone} ${l.origem}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const exportar = () => {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const linhasCsv = [
      ["Nome", "Telefone", "Origem", "Chegou", "Situação", "Chamado em", "Motivo"].join(";"),
      ...visiveis.map((l) =>
        [l.nome, l.telefone, l.origem, dataHora(l.chegou), GRUPOS.find((g) => g.id === l.grupo)?.nome || l.grupo, dataHora(l.chamadoEm), l.motivo].map(esc).join(";")
      ),
    ];
    const blob = new Blob(["﻿" + linhasCsv.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-1o-contato-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cor = (g: Grupo) => GRUPOS.find((x) => x.id === g)?.cor || "";

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold leading-tight">Relatório do 1º contato</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Leads que chegaram no período: quem foi chamado e quem não foi (e por quê)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5 text-xs">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id)}
                className={`px-2.5 py-1 rounded-md font-semibold ${periodo === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {p.nome}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={carregar} disabled={carregando} title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Números */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border p-3">
          <div className="text-xs text-muted-foreground">Deveriam ser chamados</div>
          <div className="text-2xl font-extrabold tabular-nums">{alvo}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Chamados</div>
          <div className="text-2xl font-extrabold tabular-nums text-success">
            {chamados}
            {alvo > 0 && <span className="text-sm font-semibold text-muted-foreground"> · {Math.round((chamados / alvo) * 100)}%</span>}
          </div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-destructive" /> Não chamados</div>
          <div className={`text-2xl font-extrabold tabular-nums ${naoChamados ? "text-destructive" : ""}`}>{naoChamados}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Tempo médio até chamar</div>
          <div className="text-2xl font-extrabold tabular-nums">{tempoMedio === null ? "—" : duracao(tempoMedio)}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "todos" as const, nome: "Todos", n: linhas.length, cor: "" },
          { id: "nao" as const, nome: "Não chamados", n: naoChamados, cor: "" },
          ...GRUPOS.map((g) => ({ id: g.id, nome: g.nome, n: contagem[g.id] || 0, cor: g.cor })),
        ]
          .filter((f) => f.id === "todos" || f.n > 0)
          .map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`text-xs font-semibold rounded-full border px-2.5 py-1 ${filtro === f.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            >
              {f.nome} <span className="tabular-nums opacity-80">{f.n}</span>
            </button>
          ))}
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou telefone" className="h-8 pl-8 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={exportar} disabled={!visiveis.length}>
          <Download className="w-3.5 h-3.5 mr-1" /> Baixar planilha
        </Button>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lead nesse filtro.</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold">Lead</th>
                <th className="px-3 py-2 font-semibold hidden md:table-cell">Origem</th>
                <th className="px-3 py-2 font-semibold">Chegou</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visiveis.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.nome}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{l.telefone}</div>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-xs">{l.origem}</td>
                  <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap">{dataHora(l.chegou)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block text-[11px] font-semibold rounded-full border px-2 py-0.5 ${cor(l.grupo)}`}>
                      {GRUPOS.find((g) => g.id === l.grupo)?.nome}
                      {l.chamadoEm ? ` · ${dataHora(l.chamadoEm)}` : ""}
                    </span>
                    {l.grupo !== "chamado" && <div className="text-xs text-muted-foreground mt-0.5">{l.motivo}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
