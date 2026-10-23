import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Spartano3D } from "./Spartano3D";
import { METAS_PADRAO, Metas, chave, ehDiaUtil, interessado, lerMetasLocal } from "@/components/ArenaModule";

// Pop-up que abre 1x por dia, na primeira vez que entra no Inmovya: os números que precisa fazer hoje.

interface Linha {
  icone: string;
  nome: string;
  feito: number;
  alvo: number;
  obs?: string;
}

const CSS = `
@keyframes md-entra { from { opacity: 0; transform: perspective(1000px) rotateX(40deg) translateY(50px) scale(.8); } to { opacity: 1; transform: none; } }
@keyframes md-linha { from { opacity: 0; transform: perspective(600px) rotateY(-50deg) translateX(-30px); } to { opacity: 1; transform: none; } }
@keyframes md-chao { to { background-position: 0 40px, 0 0; } }
.md-caixa { animation: md-entra .8s cubic-bezier(.2,.8,.2,1) both; background: radial-gradient(120% 90% at 30% 0%, #3b1d0e, #0d0806 70%); color: #fff; border: 1px solid rgba(251,146,60,.35); }
.md-linha { animation: md-linha .6s cubic-bezier(.2,.8,.2,1) both; }
.md-chao { position: absolute; left: -50%; right: -50%; bottom: -35%; height: 80%; pointer-events: none;
  background-image: linear-gradient(rgba(251,146,60,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(251,146,60,.25) 1px, transparent 1px);
  background-size: 40px 40px; transform: perspective(240px) rotateX(62deg); transform-origin: bottom; animation: md-chao 1.8s linear infinite;
  -webkit-mask-image: linear-gradient(to top, #000, transparent 80%); mask-image: linear-gradient(to top, #000, transparent 80%); }
.md-num { text-shadow: 0 1px 0 #d97706, 0 2px 0 #b45309, 0 3px 0 #92400e, 0 6px 10px rgba(0,0,0,.5); }
@media (prefers-reduced-motion: reduce) { .md-caixa, .md-linha, .md-chao { animation: none !important; } }
`;

export function MetasDoDia({ onAbrirArena }: { onAbrirArena: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [mesLinhas, setMesLinhas] = useState<Linha[]>([]);
  const hoje = new Date();
  const kHoje = chave(hoje);
  const kGuardado = "inmovya_popup_metas_dia";

  useEffect(() => {
    let jaViu = false;
    try {
      jaViu = localStorage.getItem(kGuardado) === kHoje;
    } catch {
      /* ignora */
    }
    let vivo = true;
    const carregar = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      let metas: Metas = lerMetasLocal();
      const { data: g } = await supabase.from("arena_metas" as any).select("metas").eq("user_id", user.id).maybeSingle();
      if ((g as any)?.metas) metas = { ...METAS_PADRAO, ...(g as any).metas };

      // hoje: ligações e interessados
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const { data: ligs } = await supabase.from("ligacoes").select("resultado").eq("user_id", user.id).gte("data_ligacao", inicioDia.toISOString()).limit(5000);
      const lig = ligs?.length || 0;
      const int = (ligs || []).filter((l: any) => interessado(l.resultado)).length;

      // registros do mês (powerbi_funnel_metrics "dia:AAAA-MM-DD")
      const mesPref = `dia:${kHoje.slice(0, 7)}`;
      const { data: rows } = await supabase.from("powerbi_funnel_metrics").select("*").eq("user_id", user.id).like("period", `${mesPref}%`);
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
      window.setTimeout(() => vivo && setAberto(true), 700);
    };
    if (!jaViu) carregar().catch(() => {});
    // a Arena pode pedir para abrir de novo (botão "Números do dia")
    const abrir = () => carregar().catch(() => {});
    window.addEventListener("inmovya-metas-dia", abrir);
    return () => {
      vivo = false;
      window.removeEventListener("inmovya-metas-dia", abrir);
    };
  }, [kHoje]);

  const fechar = () => {
    setAberto(false);
    try {
      localStorage.setItem(kGuardado, kHoje);
    } catch {
      /* ignora */
    }
  };

  if (!aberto) return null;
  const h = hoje.getHours();
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const dataTxt = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 animate-in fade-in" onClick={fechar}>
      <style>{CSS}</style>
      <div className="md-caixa relative overflow-hidden rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="md-chao" />
        <button className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={fechar} aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
        <div className="relative grid gap-5 p-5 sm:p-7 md:grid-cols-[200px_1fr] items-center">
          <div className="hidden md:flex justify-center">
            <Spartano3D largura={190} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[.25em] text-orange-300 font-bold">{dataTxt}</div>
            <h2 className="md-num text-3xl sm:text-4xl font-black mt-1">{saudacao}, spartano!</h2>
            <p className="text-white/70 text-sm mt-1">Estes são os números de hoje para vencer a batalha.</p>

            <div className="mt-4 space-y-2">
              {linhas.map((l, i) => {
                const falta = Math.max(0, l.alvo - l.feito);
                const pct = Math.min(100, (l.feito / Math.max(1, l.alvo)) * 100);
                return (
                  <div key={l.nome} className="md-linha rounded-xl bg-white/5 border border-white/10 p-3" style={{ animationDelay: `${300 + i * 120}ms` }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{l.icone}</span>
                        <div>
                          <div className="font-bold">{l.nome}</div>
                          {l.obs && <div className="text-[11px] text-white/50">{l.obs}</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="md-num text-3xl font-black tabular-nums text-amber-300 leading-none">{falta ? falta : "✓"}</div>
                        <div className="text-[11px] text-white/60">
                          {falta ? `faltam · meta ${l.alvo}` : `meta ${l.alvo} batida`}
                        </div>
                      </div>
                    </div>
                    <div className="h-2 mt-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-xs uppercase tracking-widest text-white/50 font-bold">Metas do mês</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {mesLinhas.map((l, i) => (
                <div key={l.nome} className="md-linha rounded-xl bg-white/5 border border-white/10 p-2.5" style={{ animationDelay: `${700 + i * 100}ms` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">
                      {l.icone} {l.nome}
                    </span>
                    <span className="tabular-nums text-sm">
                      <b className="text-amber-300">{l.feito}</b>
                      <span className="text-white/50">/{l.alvo}</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-white/60 mt-0.5">{l.obs}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 shadow-[0_4px_0_#9a3412] active:translate-y-[3px] active:shadow-[0_1px_0_#9a3412] transition-all"
                onClick={() => {
                  fechar();
                  onAbrirArena();
                }}
              >
                ⚔️ Bora pra Arena
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
