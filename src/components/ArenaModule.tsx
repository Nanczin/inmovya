import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as EventoMouse, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spartano3D } from "@/components/arena/Spartano3D";
import { Flame, Lock, Plus, Settings2, Shield, Swords, Target, Trophy, Zap } from "lucide-react";

// ARENA SPARTANA — transforma as métricas do dia a dia em jogo: XP, nível, missões do dia, sequência,
// metas do mês com o ritmo necessário e conquistas. Dados: ligações (Oferta Ativa) e os registros do dia
// (interações, negociações, visitas, documentações, vendas — tabela powerbi_funnel_metrics, linha "dia:AAAA-MM-DD").

type Metrica = "ligacoes" | "interessados" | "interacoes" | "negociacoes" | "visitas" | "documentacoes" | "vendas";
type Dia = Record<Metrica, number>;
const vazio = (): Dia => ({ ligacoes: 0, interessados: 0, interacoes: 0, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 0 });

const NOMES: Record<Metrica, string> = {
  ligacoes: "Ligações",
  interessados: "Interessados",
  interacoes: "Interações",
  negociacoes: "Negociações",
  visitas: "Visitas",
  documentacoes: "Documentações",
  vendas: "Vendas",
};
// quanto vale cada coisa (o que está mais perto da venda vale mais)
const SINGULAR: Partial<Record<Metrica, string>> = { negociacoes: "Negociação", visitas: "Visita", documentacoes: "Documentação", vendas: "Venda" };
const XP: Record<Metrica, number> = { ligacoes: 1, interessados: 10, interacoes: 3, negociacoes: 25, visitas: 60, documentacoes: 120, vendas: 600 };
// registros manuais (+1 direto daqui) → coluna da powerbi_funnel_metrics
const COLUNA: Partial<Record<Metrica, string>> = {
  interacoes: "interacao_ajuste",
  negociacoes: "negociacao",
  visitas: "visitas",
  documentacoes: "documentacao",
  vendas: "venda",
};

export interface Metas {
  diaLigacoes: number;
  diaInteressados: number;
  diaInteracoes: number;
  mesVisitas: number;
  mesNegociacoes: number;
  mesDocumentacoes: number;
  mesVendas: number;
}
export const METAS_PADRAO: Metas = {
  diaLigacoes: 200,
  diaInteressados: 5,
  diaInteracoes: 15,
  mesVisitas: 12,
  mesNegociacoes: 8,
  mesDocumentacoes: 3,
  mesVendas: 2,
};

const NIVEIS = [
  { nome: "Recruta", xp: 0 },
  { nome: "Soldado", xp: 600 },
  { nome: "Hoplita", xp: 1800 },
  { nome: "Veterano", xp: 3600 },
  { nome: "Centurião", xp: 6000 },
  { nome: "Spartano", xp: 9000 },
  { nome: "Lenda de Esparta", xp: 14000 },
];

export const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const xpDoDia = (d: Dia) => (Object.keys(XP) as Metrica[]).reduce((s, k) => s + d[k] * XP[k], 0);
export const ehDiaUtil = (d: Date) => d.getDay() !== 0; // segunda a sábado
export const interessado = (r?: string | null) => {
  const n = String(r || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return n.includes("interessado") && !n.includes("nao") && !n.includes("sem interesse");
};

export function lerMetasLocal(): Metas {
  try {
    const m = JSON.parse(localStorage.getItem("inmovya_arena_metas") || "null");
    const dia = Number(localStorage.getItem("meta_ligacoes_diarias")) || METAS_PADRAO.diaLigacoes;
    return { ...METAS_PADRAO, diaLigacoes: dia, ...(m || {}) };
  } catch {
    return METAS_PADRAO;
  }
}

// ---------- animações ----------
const CSS_ARENA = `
@keyframes arena-sobe { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes arena-brilho { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
@keyframes arena-chama { 0%,100% { transform: scale(1) rotate(-3deg); } 50% { transform: scale(1.15) rotate(3deg); } }
@keyframes arena-xp { 0% { opacity: 0; transform: translate(-50%, 0) scale(.6); } 15% { opacity: 1; transform: translate(-50%, -12px) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -90px) scale(1); } }
@keyframes arena-confete { 0% { transform: translateY(-10vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }
@keyframes arena-pulo { 0% { transform: scale(.3) rotate(-12deg); opacity: 0; } 60% { transform: scale(1.15) rotate(4deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
@keyframes arena-pop { 0% { transform: scale(1); } 40% { transform: scale(1.06); } 100% { transform: scale(1); } }
@keyframes arena-cresce { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes arena-escudo { 0%,100% { box-shadow: 0 0 0 0 hsl(var(--primary) / .45); } 50% { box-shadow: 0 0 0 10px hsl(var(--primary) / 0); } }
.arena-sobe { animation: arena-sobe .55s cubic-bezier(.2,.8,.2,1) both; }
.arena-barra { position: relative; overflow: hidden; transition: width 1.1s cubic-bezier(.2,.8,.2,1); }
.arena-barra::after { content: ""; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); animation: arena-brilho 2.4s ease-in-out infinite; }
.arena-chama { animation: arena-chama 1.1s ease-in-out infinite; transform-origin: 50% 90%; }
.arena-xp { position: fixed; z-index: 60; pointer-events: none; font-weight: 900; font-size: 1.35rem; color: hsl(var(--primary)); text-shadow: 0 2px 8px rgba(0,0,0,.18); animation: arena-xp 1.3s ease-out forwards; }
.arena-confete { position: fixed; top: 0; width: 9px; height: 14px; border-radius: 2px; pointer-events: none; z-index: 70; animation: arena-confete linear forwards; }
.arena-pulo { animation: arena-pulo .7s cubic-bezier(.2,.8,.2,1) both; }
.arena-pop { animation: arena-pop .5s ease-out; }
.arena-cresce { transform-origin: bottom; animation: arena-cresce .8s cubic-bezier(.2,.8,.2,1) both; }
.arena-escudo { animation: arena-escudo 2.2s ease-in-out infinite; }
.arena-card { transition: transform .2s ease, box-shadow .2s ease; }
.arena-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px -12px rgba(0,0,0,.35); }
@media (prefers-reduced-motion: reduce) {
  .arena-sobe, .arena-chama, .arena-xp, .arena-confete, .arena-pulo, .arena-pop, .arena-cresce, .arena-escudo, .arena-barra::after { animation: none !important; }
  .arena-barra, .arena-card { transition: none !important; }
}
/* ---- 3D ---- */
@keyframes arena-chao-anda { to { background-position: 0 44px, 0 0; } }
@keyframes arena-brasa { 0% { transform: translate3d(0,0,0) scale(1); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate3d(var(--dx), -220px, 0) scale(.3); opacity: 0; } }
@keyframes arena-gira { from { transform: rotateX(14deg) rotateY(0); } to { transform: rotateX(14deg) rotateY(360deg); } }
@keyframes arena-raios { to { transform: rotate(360deg); } }
@keyframes arena-revela { from { transform: rotateY(180deg) scale(.8); } to { transform: rotateY(0) scale(1); } }
@keyframes arena-flutua { 0%,100% { transform: translateZ(40px) translateY(0); } 50% { transform: translateZ(40px) translateY(-6px); } }
@keyframes arena-confete3d { 0% { transform: translate3d(0,-10vh,0) rotateX(0) rotateY(0) rotateZ(0); } 100% { transform: translate3d(var(--dx),110vh,0) rotateX(900deg) rotateY(540deg) rotateZ(180deg); } }
@keyframes arena-entra3d { from { opacity: 0; transform: perspective(900px) rotateX(55deg) translateY(60px) scale(.6); } to { opacity: 1; transform: perspective(900px) rotateX(0) translateY(0) scale(1); } }
@keyframes arena-xp3d { 0% { opacity: 0; transform: translate(-50%,0) perspective(400px) rotateX(90deg) scale(.5); } 20% { opacity: 1; transform: translate(-50%,-16px) perspective(400px) rotateX(0) scale(1.35); } 100% { opacity: 0; transform: translate(-50%,-110px) perspective(400px) rotateX(-30deg) scale(1); } }
.arena-arena { position: relative; overflow: hidden; background: radial-gradient(120% 90% at 50% 0%, #3b1d0e 0%, #140b06 55%, #07070a 100%); color: #fff; border-color: rgba(251,146,60,.25); }
.arena-chao { position: absolute; left: -50%; right: -50%; bottom: -30%; height: 110%; pointer-events: none;
  background-image: linear-gradient(rgba(251,146,60,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(251,146,60,.35) 1px, transparent 1px);
  background-size: 44px 44px; transform: perspective(260px) rotateX(62deg); transform-origin: bottom; animation: arena-chao-anda 1.6s linear infinite;
  -webkit-mask-image: linear-gradient(to top, #000 10%, transparent 75%); mask-image: linear-gradient(to top, #000 10%, transparent 75%); }
.arena-brasa { position: absolute; bottom: -8px; width: 5px; height: 5px; border-radius: 50%; background: #fb923c; box-shadow: 0 0 8px 2px #f97316; pointer-events: none; animation: arena-brasa linear infinite; }
.arena-texto3d { text-shadow: 0 1px 0 #f59e0b, 0 2px 0 #d97706, 0 3px 0 #b45309, 0 4px 0 #92400e, 0 5px 0 #78350f, 0 8px 14px rgba(0,0,0,.55); }
.arena-moeda-cena { perspective: 700px; flex-shrink: 0; }
.arena-moeda { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; animation: arena-gira 7s linear infinite; }
.arena-moeda:hover { animation-duration: 1.4s; }
.arena-moeda-borda { position: absolute; inset: 0; border-radius: 50%; background: var(--c3); }
.arena-moeda-face { position: absolute; inset: 0; border-radius: 50%; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(circle at 32% 28%, var(--c1), var(--c2) 58%, var(--c3)); color: rgba(0,0,0,.65);
  box-shadow: inset 0 0 0 4px rgba(255,255,255,.35), inset 0 -8px 16px rgba(0,0,0,.3), 0 0 26px var(--c2); }
.arena-moeda-face.verso { transform: rotateY(180deg) translateZ(6px); }
.arena-barra3d { height: 16px; border-radius: 999px; background: rgba(255,255,255,.08); box-shadow: inset 0 3px 6px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.08); overflow: hidden; }
.arena-barra3d .arena-barra { box-shadow: inset 0 2px 0 rgba(255,255,255,.45), inset 0 -3px 0 rgba(0,0,0,.25), 0 0 14px #f97316; }
.arena-inclina { transform-style: preserve-3d; transition: transform .15s ease-out, box-shadow .2s; will-change: transform; position: relative; }
.arena-reflexo { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity .2s; }
.arena-inclina:hover .arena-reflexo { opacity: 1; }
.arena-botao3d { transition: transform .08s, box-shadow .08s !important; box-shadow: 0 4px 0 rgba(0,0,0,.28); }
.arena-botao3d:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,.28); }
.arena-coluna { position: relative; width: 100%; }
.arena-coluna-topo { position: absolute; left: 4px; top: -6px; width: 100%; height: 6px; transform: skewX(-45deg); transform-origin: bottom left; filter: brightness(1.35); background: inherit; }
.arena-coluna-lado { position: absolute; right: -6px; top: -3px; width: 6px; height: 100%; transform: skewY(-45deg); transform-origin: top left; filter: brightness(.65); background: inherit; }
.arena-carta { perspective: 900px; height: 132px; }
.arena-carta-in { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .7s cubic-bezier(.2,.8,.2,1); }
.arena-carta:hover .arena-carta-in { transform: rotateY(180deg); }
.arena-carta-in.revela { animation: arena-revela 1s cubic-bezier(.2,.8,.2,1) backwards; }
.arena-carta-face { position: absolute; inset: 0; border-radius: .9rem; backface-visibility: hidden; -webkit-backface-visibility: hidden; transform-style: preserve-3d;
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: .6rem; text-align: center; overflow: hidden; }
.arena-carta-verso { transform: rotateY(180deg); }
.arena-carta-ouro { background: linear-gradient(145deg, #fde68a, #f59e0b 55%, #b45309); color: #451a03; box-shadow: inset 0 0 0 2px rgba(255,255,255,.4), 0 10px 22px -10px #b45309; }
.arena-carta-pedra { background: linear-gradient(145deg, #52525b, #27272a); color: #d4d4d8; box-shadow: inset 0 0 0 2px rgba(255,255,255,.08); }
.arena-carta-icone { font-size: 2.2rem; animation: arena-flutua 2.4s ease-in-out infinite; filter: drop-shadow(0 6px 4px rgba(0,0,0,.35)); }
.arena-carta-ouro::after { content: ""; position: absolute; inset: 0; width: 45%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.6), transparent); animation: arena-brilho 3s ease-in-out infinite; }
.arena-confete3d { position: fixed; top: 0; width: 10px; height: 16px; border-radius: 2px; pointer-events: none; z-index: 70; animation: arena-confete3d linear forwards; }
.arena-festa { animation: arena-entra3d .8s cubic-bezier(.2,.8,.2,1) both; background: radial-gradient(120% 100% at 50% 0%, #3b1d0e, #0b0705); color: #fff; border: 1px solid rgba(251,146,60,.35); }
.arena-raios { position: absolute; width: 520px; height: 520px; left: 50%; top: 50%; margin: -260px 0 0 -260px; pointer-events: none; border-radius: 50%;
  background: repeating-conic-gradient(rgba(251,191,36,.35) 0 8deg, transparent 8deg 22deg); animation: arena-raios 12s linear infinite;
  -webkit-mask-image: radial-gradient(circle, #000 15%, transparent 65%); mask-image: radial-gradient(circle, #000 15%, transparent 65%); }
.arena-xp { animation-name: arena-xp3d !important; font-size: 1.6rem !important; color: #fbbf24 !important; text-shadow: 0 1px 0 #d97706, 0 2px 0 #b45309, 0 3px 0 #92400e, 0 6px 10px rgba(0,0,0,.45) !important; }
@media (prefers-reduced-motion: reduce) {
  .arena-chao, .arena-brasa, .arena-moeda, .arena-carta-icone, .arena-raios, .arena-confete3d, .arena-festa, .arena-carta-in.revela { animation: none !important; }
}
`;

/** Número que sobe contando até o valor. */
function Contador({ valor }: { valor: number }) {
  const [mostra, setMostra] = useState(0);
  const atual = useRef(0);
  useEffect(() => {
    const de = atual.current;
    const ate = valor;
    if (de === ate) return;
    const inicio = performance.now();
    const dur = Math.min(1400, 400 + Math.abs(ate - de) * 4);
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / dur);
      const v = Math.round(de + (ate - de) * (1 - Math.pow(1 - p, 3)));
      atual.current = v;
      setMostra(v);
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <>{mostra.toLocaleString("pt-BR")}</>;
}

/** Barra que enche de 0 até a % (com brilho passando). */
function Barra({ pct, className }: { pct: number; className: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setW(pct), 80);
    return () => window.clearTimeout(t);
  }, [pct]);
  return <div className={`arena-barra h-full rounded-full ${className}`} style={{ width: `${w}%` }} />;
}

const CORES_CONFETE = ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#eab308", "#ec4899"];
function Confete() {
  const pedacos = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        cor: CORES_CONFETE[i % CORES_CONFETE.length],
        dur: 2.2 + Math.random() * 2,
        atraso: Math.random() * 0.8,
        dx: (Math.random() - 0.5) * 300,
      })),
    []
  );
  return (
    <>
      {pedacos.map((p, i) => (
        <span
          key={i}
          className="arena-confete3d"
          style={{ left: `${p.left}vw`, background: p.cor, animationDuration: `${p.dur}s`, animationDelay: `${p.atraso}s`, ["--dx" as any]: `${p.dx}px` }}
        />
      ))}
    </>
  );
}

/** Cartão que inclina em 3D seguindo o mouse, com reflexo de luz. */
function Inclina({ children, className = "", forca = 9 }: { children: ReactNode; className?: string; forca?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const mover = (e: EventoMouse<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setT({ rx: (0.5 - y) * forca, ry: (x - 0.5) * forca, gx: x * 100, gy: y * 100 });
  };
  return (
    <div
      ref={ref}
      onMouseMove={mover}
      onMouseLeave={() => setT({ rx: 0, ry: 0, gx: 50, gy: 50 })}
      className={`arena-inclina ${className}`}
      style={{ transform: `perspective(900px) rotateX(${t.rx}deg) rotateY(${t.ry}deg) ${t.rx || t.ry ? "scale(1.015)" : ""}` }}
    >
      {children}
      <div className="arena-reflexo" style={{ background: `radial-gradient(circle at ${t.gx}% ${t.gy}%, rgba(255,255,255,.22), transparent 55%)` }} />
    </div>
  );
}

const CORES_NIVEL = [
  ["#f3d2b3", "#b8733f", "#6b3a17"], // Recruta — bronze
  ["#f1f5f9", "#94a3b8", "#475569"], // Soldado — prata
  ["#fef3c7", "#f59e0b", "#92400e"], // Hoplita — ouro
  ["#d1fae5", "#10b981", "#065f46"], // Veterano — esmeralda
  ["#dbeafe", "#3b82f6", "#1e3a8a"], // Centurião — safira
  ["#fee2e2", "#ef4444", "#7f1d1d"], // Spartano — rubi
  ["#f5d0fe", "#a855f7", "#4c1d95"], // Lenda — ametista
];

/** Medalha de nível em 3D, girando (frente: escudo; verso: número do nível). */
function Medalha3D({ nivel, tamanho = 96, icone }: { nivel: number; tamanho?: number; icone?: string }) {
  const [c1, c2, c3] = CORES_NIVEL[Math.min(nivel, CORES_NIVEL.length - 1)];
  const borda = Array.from({ length: 11 }, (_, i) => i - 5);
  return (
    <div className="arena-moeda-cena" style={{ width: tamanho, height: tamanho, ["--c1" as any]: c1, ["--c2" as any]: c2, ["--c3" as any]: c3 }}>
      <div className="arena-moeda">
        {borda.map((z) => (
          <div key={z} className="arena-moeda-borda" style={{ transform: `translateZ(${z}px)` }} />
        ))}
        <div className="arena-moeda-face" style={{ transform: "translateZ(6px)" }}>
          {icone ? <span style={{ fontSize: tamanho * 0.48 }}>{icone}</span> : <Shield style={{ width: tamanho * 0.42, height: tamanho * 0.42 }} strokeWidth={2.4} />}
        </div>
        <div className="arena-moeda-face verso">
          {icone ? (
            <span style={{ fontSize: tamanho * 0.48 }}>{icone}</span>
          ) : (
            <>
              <span className="text-[10px] font-black uppercase tracking-widest">nível</span>
              <span className="font-black leading-none" style={{ fontSize: tamanho * 0.4 }}>
                {nivel + 1}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Brasas subindo no fundo da arena. */
function Brasas() {
  const b = useMemo(
    () => Array.from({ length: 22 }, () => ({ left: Math.random() * 100, dur: 3 + Math.random() * 4, atraso: Math.random() * 5, dx: (Math.random() - 0.5) * 80 })),
    []
  );
  return (
    <>
      {b.map((x, i) => (
        <span key={i} className="arena-brasa" style={{ left: `${x.left}%`, animationDuration: `${x.dur}s`, animationDelay: `${x.atraso}s`, ["--dx" as any]: `${x.dx}px` }} />
      ))}
    </>
  );
}

export function ArenaModule() {
  const { toast } = useToast();
  const [dias, setDias] = useState<Record<string, Dia>>({});
  const [linhas, setLinhas] = useState<Record<string, any>>({});
  const [metas, setMetas] = useState<Metas>(lerMetasLocal);
  const [editando, setEditando] = useState<Metas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [festa, setFesta] = useState<{ titulo: string; tipo: string; icone: string } | null>(null);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; txt: string }[]>([]);
  const [pulsando, setPulsando] = useState<string | null>(null);

  const hoje = new Date();
  const kHoje = chave(hoje);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioHist = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1); // 3 meses: sequência e recordes

  const carregar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const m: Record<string, Dia> = {};
    const pegar = (k: string) => (m[k] = m[k] || vazio());
    // ligações (Oferta Ativa)
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase
        .from("ligacoes")
        .select("data_ligacao, resultado")
        .eq("user_id", user.id)
        .gte("data_ligacao", inicioHist.toISOString())
        .range(de, de + 999);
      if (error) break;
      (data || []).forEach((l: any) => {
        const d = pegar(chave(new Date(l.data_ligacao)));
        d.ligacoes++;
        if (interessado(l.resultado)) d.interessados++;
      });
      if (!data || data.length < 1000) break;
    }
    // registros do dia
    const reg: Record<string, any> = {};
    const { data: rows } = await supabase.from("powerbi_funnel_metrics").select("*").eq("user_id", user.id);
    (rows || []).forEach((r: any) => {
      const p = String(r.period || "");
      if (!p.startsWith("dia:")) return;
      const k = p.slice(4);
      reg[k] = r;
      const d = pegar(k);
      d.interacoes += Number(r.interacao_ajuste) || 0;
      d.negociacoes += Number(r.negociacao) || 0;
      d.visitas += Number(r.visitas) || 0;
      d.documentacoes += Number(r.documentacao) || 0;
      d.vendas += Number(r.venda) || 0;
    });
    // metas guardadas no banco (vale em qualquer computador); se não houver, fica a deste navegador
    const { data: g } = await supabase.from("arena_metas" as any).select("metas").eq("user_id", user.id).maybeSingle();
    if ((g as any)?.metas) setMetas({ ...METAS_PADRAO, ...(g as any).metas });
    setDias(m);
    setLinhas(reg);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    const t = window.setInterval(carregar, 60_000);
    return () => window.clearInterval(t);
  }, [carregar]);

  const dHoje = dias[kHoje] || vazio();

  // ---- mês / temporada ----
  const mes = useMemo(() => {
    const t = vazio();
    Object.entries(dias).forEach(([k, d]) => {
      if (k >= chave(inicioMes) && k <= kHoje) (Object.keys(t) as Metrica[]).forEach((c) => (t[c] += d[c]));
    });
    return t;
  }, [dias, kHoje]);
  const xpMes = xpDoDia(mes);
  const nivelIdx = NIVEIS.reduce((acc, n, i) => (xpMes >= n.xp ? i : acc), 0);
  const nivel = NIVEIS[nivelIdx];
  const prox = NIVEIS[nivelIdx + 1];
  // subiu de nível? (guarda o último nível visto do mês neste navegador)
  useEffect(() => {
    if (carregando) return;
    const k = `inmovya_arena_nivel_${kHoje.slice(0, 7)}`;
    let visto: number | null = null;
    try {
      const v = localStorage.getItem(k);
      visto = v === null ? null : Number(v);
      localStorage.setItem(k, String(nivelIdx));
    } catch {
      /* ignora */
    }
    if (visto !== null && nivelIdx > visto) setFesta({ titulo: NIVEIS[nivelIdx].nome, tipo: "Subiu de nível!", icone: "🛡️" });
  }, [carregando, nivelIdx]);
  const pctNivel = prox ? Math.min(100, ((xpMes - nivel.xp) / (prox.xp - nivel.xp)) * 100) : 100;

  // dias úteis que faltam no mês (contando hoje)
  const diasRestantes = useMemo(() => {
    let n = 0;
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    for (let d = new Date(hoje); d <= fim; d.setDate(d.getDate() + 1)) if (ehDiaUtil(d)) n++;
    return Math.max(1, n);
  }, [kHoje]);
  const diasUteisPassados = useMemo(() => {
    let n = 0;
    for (let d = new Date(inicioMes); chave(d) < kHoje; d.setDate(d.getDate() + 1)) if (ehDiaUtil(d)) n++;
    return n;
  }, [kHoje]);

  // ---- missões de hoje ----
  const missoes = [
    { id: "lig", m: "ligacoes" as Metrica, alvo: metas.diaLigacoes, titulo: "Bater a meta de ligações", dica: "Oferta Ativa — rodadas 11:30 e 16:00" },
    { id: "int", m: "interessados" as Metrica, alvo: metas.diaInteressados, titulo: "Encontrar interessados", dica: "Ligações classificadas como Interessado" },
    { id: "itr", m: "interacoes" as Metrica, alvo: metas.diaInteracoes, titulo: "Gerar interações", dica: "Leads que responderam/conversaram" },
  ];
  const missoesFeitas = missoes.filter((x) => dHoje[x.m] >= x.alvo).length;

  // ---- sequência: dias úteis seguidos batendo a meta de ligações (hoje conta se já bateu) ----
  const sequencia = useMemo(() => {
    let n = 0;
    const d = new Date(hoje);
    if ((dias[chave(d)]?.ligacoes || 0) < metas.diaLigacoes) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 90; i++) {
      if (ehDiaUtil(d)) {
        if ((dias[chave(d)]?.ligacoes || 0) >= metas.diaLigacoes) n++;
        else break;
      }
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [dias, metas.diaLigacoes, kHoje]);

  // ---- recordes ----
  const recordeLig = Math.max(0, ...Object.entries(dias).filter(([k]) => k !== kHoje).map(([, d]) => d.ligacoes));
  const recordeXp = Math.max(0, ...Object.entries(dias).filter(([k]) => k !== kHoje).map(([, d]) => xpDoDia(d)));

  // ---- semana (seg→sáb) ----
  const semana = useMemo(() => {
    const seg = new Date(hoje);
    seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(seg);
      d.setDate(seg.getDate() + i);
      const k = chave(d);
      return { k, rot: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), xp: xpDoDia(dias[k] || vazio()), futuro: k > kHoje, bateu: (dias[k]?.ligacoes || 0) >= metas.diaLigacoes };
    });
  }, [dias, kHoje, metas.diaLigacoes]);
  const maxSemana = Math.max(1, ...semana.map((s) => s.xp));

  // ---- conquistas ----
  const todos = Object.values(dias);
  const conquistas = [
    { id: "c1", nome: "Primeiro sangue", desc: "Primeira venda do mês", ok: mes.vendas >= 1, icone: "🏆" },
    { id: "c2", nome: "Maratonista", desc: "300 ligações num dia", ok: todos.some((d) => d.ligacoes >= 300), icone: "🏃" },
    { id: "c3", nome: "Muralha", desc: "5 dias seguidos batendo a meta de ligações", ok: sequencia >= 5, icone: "🛡️" },
    { id: "c4", nome: "Faro de ouro", desc: "10 interessados num dia", ok: todos.some((d) => d.interessados >= 10), icone: "🎯" },
    { id: "c5", nome: "Pé na rua", desc: "2 visitas no mesmo dia", ok: todos.some((d) => d.visitas >= 2), icone: "🚶" },
    { id: "c6", nome: "Mesa cheia", desc: "Meta de negociações do mês", ok: mes.negociacoes >= metas.mesNegociacoes, icone: "🤝" },
    { id: "c7", nome: "Missão cumprida", desc: "As 3 missões de hoje", ok: missoesFeitas === missoes.length, icone: "⚔️" },
    { id: "c8", nome: "Quebra-recorde", desc: "Superar seu recorde de ligações", ok: recordeLig > 0 && dHoje.ligacoes > recordeLig, icone: "🔥" },
    { id: "c9", nome: "Spartano", desc: "Chegar ao nível Spartano no mês", ok: xpMes >= 9000, icone: "🦁" },
  ];

  // comemora quando uma missão do dia ou uma conquista nova acaba de ser cumprida (cada uma uma vez só)
  useEffect(() => {
    if (carregando) return;
    const ler = (k: string): string[] => {
      try {
        return JSON.parse(localStorage.getItem(k) || "null");
      } catch {
        return null as any;
      }
    };
    const kMis = `inmovya_arena_missoes_${kHoje}`;
    const kCon = "inmovya_arena_conquistas";
    const misFeitas = missoes.filter((x) => dHoje[x.m] >= x.alvo).map((x) => x.id);
    const conFeitas = conquistas.filter((c) => c.ok).map((c) => `${c.id}:${c.id === "c1" || c.id === "c6" || c.id === "c9" ? kHoje.slice(0, 7) : c.id === "c7" || c.id === "c8" ? kHoje : ""}`);
    const misVistas = ler(kMis);
    const conVistas = ler(kCon);
    // 1ª vez que abre (sem histórico): só guarda, sem festa pelo que já existia
    const novasMis = misVistas ? misFeitas.filter((f) => !misVistas.includes(f)) : [];
    const novasCon = conVistas ? conFeitas.filter((f) => !conVistas.includes(f)) : [];
    const con = novasCon[0] ? conquistas.find((c) => novasCon[0].startsWith(c.id + ":")) : null;
    const mis = !con && novasMis[0] ? missoes.find((x) => x.id === novasMis[0]) : null;
    if (con) setFesta({ titulo: con.nome, tipo: "Conquista desbloqueada", icone: con.icone });
    else if (mis) setFesta({ titulo: mis.titulo, tipo: "Missão cumprida", icone: "⚔️" });
    try {
      localStorage.setItem(kMis, JSON.stringify(misFeitas));
      localStorage.setItem(kCon, JSON.stringify([...new Set([...(conVistas || []), ...conFeitas])]));
    } catch {
      /* ignora */
    }
  }, [carregando, dias, metas]);

  // +1 rápido (interação, negociação, visita, documentação, venda) → mesma linha do dia usada em Relatórios
  const somarUm = async (m: Metrica, ev?: EventoMouse) => {
    const col = COLUNA[m];
    if (!col) return;
    // "+XP" subindo de onde clicou
    if (ev) {
      const id = Date.now() + Math.random();
      setPops((p) => [...p, { id, x: ev.clientX, y: ev.clientY - 10, txt: `+${XP[m]} XP` }]);
      window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 1400);
    }
    setPulsando(m);
    window.setTimeout(() => setPulsando(null), 600);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const r = linhas[kHoje] || {};
    const novo = {
      user_id: user.id,
      period: `dia:${kHoje}`,
      ligacoes: Number(r.ligacoes) || 0,
      interacao_ajuste: Number(r.interacao_ajuste) || 0,
      negociacao: Number(r.negociacao) || 0,
      visitas: Number(r.visitas) || 0,
      documentacao: Number(r.documentacao) || 0,
      venda: Number(r.venda) || 0,
      updated_at: new Date().toISOString(),
    } as any;
    novo[col] = (Number(r[col]) || 0) + 1;
    const { error } = await supabase.from("powerbi_funnel_metrics").upsert(novo, { onConflict: "user_id, period" });
    if (error) return toast({ title: "Não consegui registrar", description: error.message, variant: "destructive" });
    if (!ev) toast({ title: `+${XP[m]} XP`, description: `${NOMES[m]} registrada hoje.` });
    carregar();
  };

  const salvarMetas = async () => {
    if (!editando) return;
    setMetas(editando);
    try {
      localStorage.setItem("inmovya_arena_metas", JSON.stringify(editando));
      localStorage.setItem("meta_ligacoes_diarias", String(editando.diaLigacoes));
    } catch {
      /* ignora */
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from("arena_metas" as any).upsert({ user_id: user.id, metas: editando, updated_at: new Date().toISOString() } as any, { onConflict: "user_id" });
    setEditando(null);
    toast({ title: "Metas salvas" });
  };

  const metasMes = [
    { m: "vendas" as Metrica, alvo: metas.mesVendas },
    { m: "documentacoes" as Metrica, alvo: metas.mesDocumentacoes },
    { m: "visitas" as Metrica, alvo: metas.mesVisitas },
    { m: "negociacoes" as Metrica, alvo: metas.mesNegociacoes },
  ];

  const frase =
    missoesFeitas === missoes.length
      ? "Dia vencido. Tudo o que vier agora é bônus de XP."
      : dHoje.ligacoes === 0
        ? "A batalha começa na primeira ligação. Bora!"
        : `Faltam ${Math.max(0, metas.diaLigacoes - dHoje.ligacoes)} ligações para fechar a missão principal.`;

  const mesNome = hoje.toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="space-y-4 max-w-6xl">
      <style>{CSS_ARENA}</style>
      {/* cabeçalho: arena 3D com medalha de nível */}
      <section className="arena-sobe arena-arena rounded-2xl border p-4 sm:p-6 shadow-card">
        <div className="arena-chao" />
        <Brasas />
        <div className="relative flex flex-wrap items-center gap-6">
          <Spartano3D largura={190} altura={270} className="hidden sm:block shrink-0 -my-2" />
          <div className="flex-1 min-w-[260px]">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Medalha3D nivel={nivelIdx} />
            <div>
              <div className="text-xs uppercase tracking-[.2em] text-orange-300/90 font-bold">Arena Spartana · temporada de {mesNome}</div>
              <div key={nivel.nome} className="arena-pulo arena-texto3d text-3xl sm:text-4xl font-black leading-tight">
                {nivel.nome}
              </div>
              <div className="text-sm text-white/70 mt-1">{frase}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="arena-texto3d text-4xl sm:text-5xl font-black tabular-nums text-amber-300">
                <Contador valor={xpMes} />
              </div>
              <div className="text-xs text-white/60 uppercase tracking-widest">XP no mês</div>
            </div>
            <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white" onClick={() => window.dispatchEvent(new Event("inmovya-metas-dia"))} title="Números do dia">
              <Target className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white" onClick={() => setEditando(metas)} title="Definir metas">
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="relative mt-5">
          <div className="flex justify-between text-xs text-white/70 mb-1.5 font-semibold">
            <span>{nivel.nome}</span>
            <span>{prox ? `faltam ${(prox.xp - xpMes).toLocaleString("pt-BR")} XP para ${prox.nome}` : "nível máximo!"}</span>
          </div>
          <div className="arena-barra3d">
            <Barra pct={pctNivel} className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />
          </div>
          <div className="flex justify-between mt-2">
            {NIVEIS.map((n, i) => (
              <span key={n.nome} className={`text-[10px] font-bold uppercase tracking-wide ${i <= nivelIdx ? "text-amber-300" : "text-white/30"}`} title={`${n.xp} XP`}>
                {i <= nivelIdx ? "★" : "☆"} <span className="hidden sm:inline">{n.nome}</span>
              </span>
            ))}
          </div>
        </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* missões de hoje */}
        <section className="arena-sobe rounded-2xl border bg-card p-4 sm:p-5 shadow-card lg:col-span-2" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <Swords className="w-4 h-4" /> Missões de hoje
            </h3>
            <span className="text-sm font-semibold tabular-nums">
              {missoesFeitas}/{missoes.length} · +<Contador valor={xpDoDia(dHoje)} /> XP hoje
            </span>
          </div>
          <div className="space-y-3">
            {missoes.map((x, i) => {
              const v = dHoje[x.m];
              const pct = Math.min(100, (v / Math.max(1, x.alvo)) * 100);
              const ok = v >= x.alvo;
              return (
                <div key={x.id} className="arena-sobe" style={{ animationDelay: `${150 + i * 70}ms` }}>
                <div className={pulsando === x.m ? "arena-pop" : ""}>
                <Inclina className={`rounded-xl border p-3 ${ok ? "border-success/50 bg-success/10" : "bg-card"}`} forca={6}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">
                        {ok ? <span className="arena-pulo inline-block">✅ </span> : ""}
                        {x.titulo}
                      </div>
                      <div className="text-xs text-muted-foreground">{x.dica}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-bold">
                        <Contador valor={v} />/{x.alvo}
                      </span>
                      {COLUNA[x.m] && (
                        <Button size="sm" variant="outline" className="h-8 arena-botao3d" onClick={(e) => somarUm(x.m, e)} title={`Registrar +1 ${NOMES[x.m]}`}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="h-2.5 mt-2 rounded-full bg-muted overflow-hidden shadow-inner">
                    <Barra pct={pct} className={ok ? "bg-success" : "bg-primary"} />
                  </div>
                </Inclina>
                </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["negociacoes", "visitas", "documentacoes", "vendas"] as Metrica[]).map((m) => (
              <Button key={m} variant="secondary" size="sm" className={`arena-botao3d ${pulsando === m ? "arena-pop" : ""}`} onClick={(e) => somarUm(m, e)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {SINGULAR[m]} <span className="ml-1 text-xs text-muted-foreground">+{XP[m]} XP</span>
              </Button>
            ))}
          </div>
        </section>

        {/* sequência e recordes */}
        <section className="arena-sobe rounded-2xl border bg-card p-4 sm:p-5 shadow-card space-y-4" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center arena-botao3d ${sequencia ? "bg-orange-100 text-orange-600 dark:bg-orange-950" : "bg-muted text-muted-foreground"}`}>
              <Flame className={`w-6 h-6 ${sequencia ? "arena-chama" : ""}`} />
            </div>
            <div>
              <div className="text-2xl font-black tabular-nums">
                <Contador valor={sequencia} /> {sequencia === 1 ? "dia" : "dias"}
              </div>
              <div className="text-xs text-muted-foreground">seguidos batendo {metas.diaLigacoes} ligações</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Recorde de ligações</div>
              <div className="text-lg font-bold tabular-nums">
                <Contador valor={Math.max(recordeLig, dHoje.ligacoes)} />
              </div>
            </div>
            <div className="rounded-xl bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Melhor dia (XP)</div>
              <div className="text-lg font-bold tabular-nums">
                <Contador valor={Math.max(recordeXp, xpDoDia(dHoje))} />
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5">XP da semana</div>
            <div className="flex items-end gap-3 h-20 pr-2 pt-2">
              {semana.map((s, i) => (
                <div key={s.k} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`arena-cresce arena-coluna transition-all duration-700 ${s.k === kHoje ? "bg-orange-500" : s.bateu ? "bg-emerald-500" : "bg-slate-400"}`}
                    style={{ height: `${s.futuro ? 4 : Math.max(4, (s.xp / maxSemana) * 58)}px`, opacity: s.futuro ? 0.3 : 1, animationDelay: `${250 + i * 60}ms` }}
                    title={`${s.xp} XP`}
                  >
                    <div className="arena-coluna-topo" />
                    <div className="arena-coluna-lado" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{s.rot}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* metas do mês com ritmo */}
      <section className="arena-sobe rounded-2xl border bg-card p-4 sm:p-5 shadow-card" style={{ animationDelay: "240ms" }}>
        <h3 className="font-bold flex items-center gap-2 mb-3">
          <Target className="w-4 h-4" /> Metas de {mesNome}
          <span className="text-xs font-normal text-muted-foreground">· {diasRestantes} dias úteis restantes</span>
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metasMes.map(({ m, alvo }) => {
            const v = mes[m];
            const pct = Math.min(100, (v / Math.max(1, alvo)) * 100);
            const falta = Math.max(0, alvo - v);
            const projecao = diasUteisPassados > 0 ? Math.round((v / diasUteisPassados) * (diasUteisPassados + diasRestantes)) : v;
            const noRitmo = projecao >= alvo || v >= alvo;
            return (
              <div key={m} className={pulsando === m ? "arena-pop" : ""}>
              <Inclina className="rounded-xl border p-3 bg-card h-full">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-sm">{NOMES[m]}</span>
                  <span className="tabular-nums">
                    <b className="text-lg">
                      <Contador valor={v} />
                    </b>
                    <span className="text-muted-foreground">/{alvo}</span>
                  </span>
                </div>
                <div className="h-2 mt-2 rounded-full bg-muted overflow-hidden">
                  <Barra pct={pct} className={v >= alvo ? "bg-success" : noRitmo ? "bg-primary" : "bg-warning"} />
                </div>
                <div className={`text-xs mt-1.5 ${v >= alvo ? "text-success font-semibold" : noRitmo ? "text-muted-foreground" : "text-warning font-semibold"}`}>
                  {v >= alvo
                    ? "Meta batida! 🏆"
                    : noRitmo
                      ? `No ritmo: projeção de ${projecao}`
                      : `Fora do ritmo (projeção ${projecao}). Precisa de ${(falta / diasRestantes).toFixed(1).replace(".", ",")}/dia`}
                </div>
              </Inclina>
              </div>
            );
          })}
        </div>
      </section>

      {/* conquistas */}
      <section className="arena-sobe rounded-2xl border bg-card p-4 sm:p-5 shadow-card" style={{ animationDelay: "320ms" }}>
        <h3 className="font-bold flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4" /> Conquistas
          <span className="text-xs font-normal text-muted-foreground">
            · {conquistas.filter((c) => c.ok).length}/{conquistas.length} · passe o mouse para virar a carta
          </span>
        </h3>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {conquistas.map((c, i) => (
            <div key={c.id} className="arena-sobe arena-carta" style={{ animationDelay: `${380 + i * 50}ms` }}>
              <div className={`arena-carta-in ${c.ok ? "revela" : ""}`} style={{ animationDelay: `${600 + i * 90}ms` }}>
                <div className={`arena-carta-face ${c.ok ? "arena-carta-ouro" : "arena-carta-pedra"}`}>
                  {c.ok ? <div className="arena-carta-icone">{c.icone}</div> : <Lock className="w-8 h-8 opacity-70" />}
                  <div className="font-black text-sm mt-1.5">{c.ok ? c.nome : "???"}</div>
                  <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">{c.ok ? "desbloqueada" : "bloqueada"}</div>
                </div>
                <div className={`arena-carta-face arena-carta-verso ${c.ok ? "arena-carta-ouro" : "arena-carta-pedra"}`}>
                  <div className="font-black text-sm">{c.nome}</div>
                  <div className="text-[11px] leading-tight mt-1 opacity-90">{c.desc}</div>
                  <div className="text-[10px] uppercase tracking-widest font-bold mt-2 opacity-70">{c.ok ? "✓ feito" : "como destravar"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
          <Zap className="w-3 h-3" /> XP: ligação 1 · interessado 10 · interação 3 · negociação 25 · visita 60 · documentação 120 · venda 600. Ligações vêm da
          Oferta Ativa; o resto do botão + ou de Relatórios → Registrar.
        </p>
      </section>

      {/* comemoração */}
      {pops.map((p) => (
        <span key={p.id} className="arena-xp" style={{ left: p.x, top: p.y }}>
          {p.txt}
        </span>
      ))}

      {festa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-in fade-in" onClick={() => setFesta(null)}>
          <Confete />
          <div className="arena-festa relative overflow-hidden rounded-3xl p-8 text-center shadow-2xl max-w-sm mx-4 w-full">
            <div className="arena-raios" />
            <div className="relative flex justify-center mb-4">
              <Medalha3D nivel={festa.tipo === "Subiu de nível!" ? nivelIdx : 2} tamanho={140} icone={festa.icone} />
            </div>
            <div className="relative text-xs uppercase tracking-[.25em] text-orange-300 font-bold">{festa.tipo}</div>
            <div className="relative arena-texto3d text-3xl font-black mt-2">{festa.titulo}</div>
            <div className="relative text-sm text-white/70 mt-3">Isso é Esparta! Continue assim.</div>
            <Button className="relative mt-5 arena-botao3d bg-orange-500 hover:bg-orange-600 text-white px-8" onClick={() => setFesta(null)}>
              Bora!
            </Button>
          </div>
        </div>
      )}

      {/* metas */}
      <Dialog open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Suas metas</DialogTitle>
            <DialogDescription>As do dia viram missões; as do mês mostram se você está no ritmo. Use as da planilha Spartanos.</DialogDescription>
          </DialogHeader>
          {editando && (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["diaLigacoes", "Ligações por dia"],
                  ["diaInteressados", "Interessados por dia"],
                  ["diaInteracoes", "Interações por dia"],
                  ["mesNegociacoes", "Negociações no mês"],
                  ["mesVisitas", "Visitas no mês"],
                  ["mesDocumentacoes", "Documentações no mês"],
                  ["mesVendas", "Vendas no mês"],
                ] as [keyof Metas, string][]
              ).map(([k, rot]) => (
                <label key={k} className="grid gap-1 text-sm font-semibold">
                  {rot}
                  <Input
                    type="number"
                    min={0}
                    value={editando[k]}
                    onChange={(e) => setEditando({ ...editando, [k]: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarMetas}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
