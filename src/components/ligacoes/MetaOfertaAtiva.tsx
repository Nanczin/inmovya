// Meta diária dentro da Oferta Ativa, gamificada: barra que esquenta, chama "on fire", +1 a cada ligação,
// combo da sessão e comemoração ao passar de 25%, 50%, 75% e ao bater a meta.
import { useEffect, useRef, useState } from "react";

const CSS = `
@keyframes moa-chama { 0%,100% { transform: scale(1) rotate(-3deg); filter: drop-shadow(0 0 6px rgba(255,120,0,.7)); }
  50% { transform: scale(1.18) rotate(3deg); filter: drop-shadow(0 0 14px rgba(255,60,0,.9)); } }
@keyframes moa-faisca { 0% { opacity: 1; transform: translate(0,0) scale(1); } 100% { opacity: 0; transform: translate(var(--dx), -38px) scale(.4); } }
@keyframes moa-mais { 0% { opacity: 0; transform: translate(-50%, 0) scale(.8); } 20% { opacity: 1; transform: translate(-50%, -6px) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -34px) scale(1); } }
@keyframes moa-fluxo { from { background-position: 0 0; } to { background-position: 40px 0; } }
@keyframes moa-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(255,90,0,.0); } 50% { box-shadow: 0 0 18px 2px rgba(255,90,0,.45); } }
@keyframes moa-festa { 0% { opacity: 0; transform: scale(.6); } 15% { opacity: 1; transform: scale(1.08); } 80% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(.96); } }
.moa-chama { display: inline-block; animation: moa-chama .7s ease-in-out infinite; }
.moa-faisca { position: absolute; bottom: 1px; width: 4px; height: 4px; border-radius: 9999px; background: #ffb020; animation: moa-faisca 1.1s ease-out infinite; }
.moa-mais { position: absolute; left: 50%; top: -14px; font-weight: 800; color: #ff7a00; pointer-events: none; animation: moa-mais .9s ease-out both; }
.moa-barra-fogo { background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 10px, transparent 10px 20px), linear-gradient(90deg, #ffb020, #ff5a00 60%, #e11d48); background-size: 40px 100%, 100% 100%; animation: moa-fluxo .8s linear infinite; }
.moa-quente { animation: moa-pulso 1.6s ease-in-out infinite; }
.moa-festa { animation: moa-festa 2.4s ease-out both; }
@media (prefers-reduced-motion: reduce) { .moa-chama, .moa-faisca, .moa-mais, .moa-barra-fogo, .moa-quente, .moa-festa { animation: none !important; } }
`;

const nivel = (p: number) =>
  p >= 100
    ? { nome: "META BATIDA", icone: "🏆", cor: "text-amber-500" }
    : p >= 75
      ? { nome: "ON FIRE", icone: "🔥🔥🔥", cor: "text-red-500" }
      : p >= 50
        ? { nome: "Pegando fogo", icone: "🔥🔥", cor: "text-orange-500" }
        : p >= 25
          ? { nome: "Esquentando", icone: "🔥", cor: "text-amber-500" }
          : { nome: "Aquecendo", icone: "🧊", cor: "text-sky-500" };

export function MetaOfertaAtiva({ feito, alvo }: { feito: number; alvo: number }) {
  const meta = Math.max(1, alvo || 1);
  const p = Math.round((feito / meta) * 100);
  const n = nivel(p);
  const anterior = useRef(feito);
  const [mais, setMais] = useState(0); // chave da animação "+1"
  const [combo, setCombo] = useState(0); // ligações seguidas nesta sessão da oferta
  const [festa, setFesta] = useState<string | null>(null);
  const timerFesta = useRef<number | undefined>();
  useEffect(() => () => window.clearTimeout(timerFesta.current), []);

  useEffect(() => {
    const antes = anterior.current;
    anterior.current = feito;
    if (feito <= antes) return;
    setMais((k) => k + 1);
    setCombo((c) => c + (feito - antes));
    const pa = Math.floor((antes / meta) * 4);
    const pn = Math.floor((feito / meta) * 4);
    if (pn > pa && pn >= 1) {
      setFesta(pn >= 4 ? "🏆 META DO DIA BATIDA! 🏆" : pn === 3 ? "🔥 75% — ON FIRE!" : pn === 2 ? "🔥 Metade da meta!" : "🔥 25% — esquentou!");
      window.clearTimeout(timerFesta.current);
      timerFesta.current = window.setTimeout(() => setFesta(null), 2400);
    }
  }, [feito, meta]);

  const quente = p >= 50;
  const falta = Math.max(0, meta - feito);

  return (
    <div className={`relative w-full sm:w-[26rem] rounded-full border px-3 py-1.5 bg-gradient-to-r from-background to-orange-50/60 dark:to-orange-950/30 ${quente ? "moa-quente border-orange-300" : "border-border"}`}>
      <style>{CSS}</style>
      <div className="flex items-center gap-2">
        <span className={`text-base leading-none shrink-0 ${p >= 25 ? "moa-chama" : ""}`} aria-hidden>{n.icone}</span>
        <span className={`text-[10px] font-extrabold uppercase tracking-wide shrink-0 ${n.cor}`}>{n.nome}</span>
        <div className="relative flex-1 h-2.5 rounded-full bg-muted" title={falta ? `faltam ${falta} ligações` : `+${feito - meta} além da meta`}>
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${p >= 25 ? "moa-barra-fogo" : "bg-sky-400"}`}
            style={{ width: `${Math.min(100, p)}%` }}
          />
          {quente &&
            [12, 34, 58, 80].map((l, i) => (
              <span key={l} className="moa-faisca" style={{ left: `${Math.min(l, Math.max(5, p - 4))}%`, animationDelay: `${i * 0.27}s`, ["--dx" as any]: `${(i % 2 ? 1 : -1) * (4 + i * 2)}px` }} />
            ))}
        </div>
        <span className="relative shrink-0 text-xs tabular-nums">
          <b className="text-sm">{feito}</b>
          <span className="text-muted-foreground">/{meta}</span>
          {mais > 0 && (
            <span key={mais} className="moa-mais text-sm">
              +1
            </span>
          )}
        </span>
        {combo >= 3 && <b className="shrink-0 text-[10px] text-orange-600">x{combo}</b>}
      </div>

      {festa && (
        <div className="moa-festa pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-xs font-extrabold shadow-lg">
          {festa}
        </div>
      )}
    </div>
  );
}
