import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Abertura } from "./Abertura";
import { METAS_PADRAO, Metas, chave, ehDiaUtil, interessado, lerMetasLocal } from "@/components/ArenaModule";

// Pop-up que abre toda vez que entra no Inmovya (cada vez que a página é aberta/recarregada): os números que precisa fazer hoje.

interface Linha {
  icone: string;
  nome: string;
  feito: number;
  alvo: number;
  obs?: string;
}

const CSS = `
@keyframes md-entra { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes md-linha { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.md-caixa { animation: md-entra .4s ease-out both; background: hsl(222 47% 11%); color: #fff; border: 1px solid hsl(var(--primary) / .35); }
.md-linha { animation: md-linha .35s ease-out both; }
@media (prefers-reduced-motion: reduce) { .md-caixa, .md-linha { animation: none !important; } }
`;

export function MetasDoDia({ onAbrirArena }: { onAbrirArena: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [mesLinhas, setMesLinhas] = useState<Linha[]>([]);
  const hoje = new Date();
  const kHoje = chave(hoje);
  useEffect(() => {
    let vivo = true;
    // cada consulta isolada: se uma falhar, o pop-up abre do mesmo jeito (com zero naquela linha)
    const tentar = async <T,>(f: () => PromiseLike<T>, padrao: T): Promise<T> => {
      try {
        return await f();
      } catch (e) {
        console.warn("[Inmovya metas do dia]", e);
        return padrao;
      }
    };
    const carregar = async () => {
      const { data: sessao } = await supabase.auth.getSession();
      const user = sessao?.session?.user;
      if (!user) return;
      let metas: Metas = lerMetasLocal();
      const g: any = await tentar(async () => (await supabase.from("arena_metas" as any).select("metas").eq("user_id", user.id).maybeSingle()).data, null);
      if (g?.metas) metas = { ...METAS_PADRAO, ...g.metas };

      // hoje: ligações e interessados
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const ligs: any[] = await tentar(
        async () => (await supabase.from("ligacoes").select("resultado").eq("user_id", user.id).gte("data_ligacao", inicioDia.toISOString()).limit(5000)).data || [],
        []
      );
      const lig = ligs.length;
      const int = ligs.filter((l: any) => interessado(l.resultado)).length;

      // registros do mês (powerbi_funnel_metrics "dia:AAAA-MM-DD")
      const mesPref = `dia:${kHoje.slice(0, 7)}`;
      const rows: any[] = await tentar(
        async () => ((await supabase.from("powerbi_funnel_metrics").select("*").eq("user_id", user.id)).data || []).filter((r: any) => String(r.period || "").startsWith(mesPref)),
        []
      );
      const soma = { interacoes: 0, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 0, interacoesHoje: 0 };
      (rows || []).forEach((r: any) => {
        soma.interacoes += Number(r.interacao_ajuste) || 0;
        soma.negociacoes += Number(r.negociacao) || 0;
        soma.visitas += Number(r.visitas) || 0;
        soma.documentacoes += Number(r.documentacao) || 0;
        soma.vendas += Number(r.venda) || 0;
        if (r.period === `dia:${kHoje}`) soma.interacoesHoje += Number(r.interacao_ajuste) || 0;
      });

      // dias úteis que faltam no mês (contando hoje)
      let restam = 0;
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      for (let d = new Date(inicioDia); d <= fim; d.setDate(d.getDate() + 1)) if (ehDiaUtil(d)) restam++;
      restam = Math.max(1, restam);
      const porDia = (feito: number, alvo: number) => {
        const falta = Math.max(0, alvo - feito);
        if (!falta) return "meta do mês batida ✓";
        const n = falta / restam;
        return `faltam ${falta} no mês · ${n < 1 ? `1 a cada ${Math.round(1 / n)} dias` : `${n.toFixed(1).replace(".", ",")} por dia`}`;
      };

      if (!vivo) return;
      setLinhas([
        { icone: "📞", nome: "Ligações", feito: lig, alvo: metas.diaLigacoes, obs: "Oferta Ativa — rodadas 11:30 e 16:00" },
        { icone: "🎯", nome: "Interessados", feito: int, alvo: metas.diaInteressados },
        { icone: "💬", nome: "Interações", feito: soma.interacoesHoje, alvo: metas.diaInteracoes },
      ]);
      setMesLinhas([
        { icone: "🏆", nome: "Vendas", feito: soma.vendas, alvo: metas.mesVendas, obs: porDia(soma.vendas, metas.mesVendas) },
        { icone: "📄", nome: "Documentações", feito: soma.documentacoes, alvo: metas.mesDocumentacoes, obs: porDia(soma.documentacoes, metas.mesDocumentacoes) },
        { icone: "🚶", nome: "Visitas", feito: soma.visitas, alvo: metas.mesVisitas, obs: porDia(soma.visitas, metas.mesVisitas) },
        { icone: "🤝", nome: "Negociações", feito: soma.negociacoes, alvo: metas.mesNegociacoes, obs: porDia(soma.negociacoes, metas.mesNegociacoes) },
      ]);
      window.setTimeout(() => vivo && setAberto(true), 600);
    };
    carregar().catch((e) => console.warn("[Inmovya metas do dia]", e));
    // a Arena pode pedir para abrir de novo (botão "Números do dia")
    const abrir = () => carregar().catch(() => {});
    window.addEventListener("inmovya-metas-dia", abrir);
    return () => {
      vivo = false;
      window.removeEventListener("inmovya-metas-dia", abrir);
    };
  }, [kHoje]);

  const fechar = () => setAberto(false);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  if (!aberto) return null;
  const h = hoje.getHours();
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const dataTxt = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 animate-in fade-in">
      <style>{CSS}</style>
      <div className="md-caixa relative overflow-hidden rounded-3xl shadow-2xl w-full max-w-4xl">
        <button className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={fechar} aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
        <div className="relative flex items-stretch">
          {/* imagens encostadas na lateral, sem moldura, sumindo na direita */}
          <div
            className="hidden md:block relative shrink-0 w-[270px]"
            style={{ WebkitMaskImage: "linear-gradient(to right, #000 70%, transparent)", maskImage: "linear-gradient(to right, #000 70%, transparent)" }}
          >
            <Abertura />
          </div>
          <div className="flex-1 min-w-0 p-5 sm:p-6 md:pl-1">
            <div className="text-xs uppercase tracking-[.25em] text-blue-200/90 font-semibold">{dataTxt}</div>
            <h2 className="text-3xl sm:text-4xl font-black mt-1">{saudacao}!</h2>
            <p className="text-white/70 text-sm mt-1">Estes são os números de hoje para vencer a batalha.</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {linhas.map((l, i) => {
                const falta = Math.max(0, l.alvo - l.feito);
                const pct = Math.min(100, (l.feito / Math.max(1, l.alvo)) * 100);
                return (
                  <div key={l.nome} className="md-linha rounded-xl bg-white/5 border border-white/10 p-3 text-center" style={{ animationDelay: `${300 + i * 120}ms` }}>
                    <div className="text-sm font-bold flex items-center justify-center gap-1.5">
                      <span className="text-lg">{l.icone}</span> {l.nome}
                    </div>
                    <div className="text-4xl font-black tabular-nums text-[hsl(var(--primary-glow))] leading-none mt-2">{falta ? falta : "✓"}</div>
                    <div className="text-[11px] text-white/60 mt-1">{falta ? `faltam · meta ${l.alvo}` : `meta ${l.alvo} batida`}</div>
                    <div className="h-1.5 mt-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--primary-glow))] to-[hsl(var(--accent-glow))]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-xs uppercase tracking-widest text-white/50 font-bold">Metas do mês</div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {mesLinhas.map((l, i) => (
                <div key={l.nome} className="md-linha rounded-xl bg-white/5 border border-white/10 p-2.5" style={{ animationDelay: `${700 + i * 100}ms` }}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold truncate">
                      {l.icone} {l.nome}
                    </span>
                    <span className="tabular-nums text-sm shrink-0">
                      <b className="text-[hsl(var(--primary-glow))]">{l.feito}</b>
                      <span className="text-white/50">/{l.alvo}</span>
                    </span>
                  </div>
                  <div className="text-[10px] text-white/60 mt-0.5 leading-tight">{l.obs}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="font-semibold px-6"
                onClick={() => {
                  fechar();
                  onAbrirArena();
                }}
              >
                Ir para a Arena
              </Button>
              <Button variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={fechar}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
