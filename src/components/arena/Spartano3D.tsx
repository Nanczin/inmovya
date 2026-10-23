import { useEffect, useRef, useState, type MouseEvent } from "react";

// Spartano em 3D: a imagem em camadas (fundo e figura) que se mexem em profundidades diferentes,
// moldura de bronze com espessura, olhos em brasa, brilho na ponta da lança e balanço suave quando parado.

const CSS = `
@keyframes sp-respira { 0%,100% { transform: rotateX(4deg) rotateY(-10deg) translateY(0); } 50% { transform: rotateX(-3deg) rotateY(10deg) translateY(-6px); } }
@keyframes sp-olho { 0%,100% { opacity: .55; transform: scale(.9); } 50% { opacity: 1; transform: scale(1.25); } }
@keyframes sp-brilho { 0%,70%,100% { opacity: 0; transform: scale(.4) rotate(0); } 80% { opacity: 1; transform: scale(1.2) rotate(45deg); } }
@keyframes sp-luz { from { transform: translateX(-120%) skewX(-18deg); } to { transform: translateX(260%) skewX(-18deg); } }
@keyframes sp-sombra { 0%,100% { transform: translateX(-50%) scaleX(1); opacity: .55; } 50% { transform: translateX(-50%) scaleX(.85); opacity: .35; } }
.sp-cena { perspective: 900px; position: relative; }
.sp-corpo { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
.sp-corpo.parado { animation: sp-respira 6s ease-in-out infinite; }
.sp-corpo.mexendo { transition: transform .12s ease-out; }
.sp-moldura { position: absolute; inset: 0; border-radius: 18px; background: linear-gradient(145deg, #e7c27d, #8a5a1f 55%, #4a2c0a); }
.sp-face { position: absolute; inset: 0; border-radius: 18px; overflow: hidden; transform: translateZ(8px);
  box-shadow: inset 0 0 0 3px #e7c27d, inset 0 0 0 5px #5a3510, 0 0 30px rgba(249,115,22,.25); background: #1a120a; }
.sp-camada { position: absolute; inset: -8%; background-size: cover; background-position: center; transition: transform .12s ease-out; }
.sp-fundo { filter: brightness(.55) blur(1.5px) sepia(.4); }
.sp-figura { -webkit-mask-image: radial-gradient(58% 62% at 50% 58%, #000 62%, transparent 82%); mask-image: radial-gradient(58% 62% at 50% 58%, #000 62%, transparent 82%); filter: contrast(1.08) saturate(1.1); }
.sp-olho { position: absolute; width: 9%; height: 3.2%; border-radius: 50%; background: radial-gradient(circle, #fde047, #f97316 45%, transparent 72%); filter: blur(1px); animation: sp-olho 2.2s ease-in-out infinite; mix-blend-mode: screen; }
.sp-brilho { position: absolute; width: 18px; height: 18px; animation: sp-brilho 3.5s ease-in-out infinite; pointer-events: none; }
.sp-brilho::before, .sp-brilho::after { content: ""; position: absolute; left: 50%; top: 50%; background: #fff; box-shadow: 0 0 8px #fde68a; border-radius: 2px; }
.sp-brilho::before { width: 2px; height: 18px; margin: -9px 0 0 -1px; }
.sp-brilho::after { width: 18px; height: 2px; margin: -1px 0 0 -9px; }
.sp-luz { position: absolute; inset: 0; width: 35%; background: linear-gradient(90deg, transparent, rgba(255,236,200,.28), transparent); animation: sp-luz 5s ease-in-out infinite; pointer-events: none; }
.sp-vinheta { position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,.6)); pointer-events: none; }
.sp-sombra { position: absolute; left: 50%; bottom: -18px; width: 80%; height: 18px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.65), transparent); animation: sp-sombra 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .sp-corpo.parado, .sp-olho, .sp-brilho, .sp-luz, .sp-sombra { animation: none !important; } }
`;

const IMG = "/arena/spartano.jpg";

export function Spartano3D({ largura = 180, className = "" }: { largura?: number; className?: string }) {
  const altura = Math.round(largura * (740 / 415));
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<{ x: number; y: number } | null>(null);
  const espessura = Array.from({ length: 8 }, (_, i) => i);

  useEffect(() => {
    const img = new Image();
    img.src = IMG; // pré-carrega
  }, []);

  const mover = (e: MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setT({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
  };

  const rx = t ? -t.y * 22 : 0;
  const ry = t ? t.x * 26 : 0;
  const px = (n: number) => (t ? `translate3d(${-t.x * n}px, ${-t.y * n}px, 0) scale(1.02)` : "none");

  return (
    <div
      ref={ref}
      className={`sp-cena ${className}`}
      style={{ width: largura, height: altura }}
      onMouseMove={mover}
      onMouseLeave={() => setT(null)}
      aria-label="Spartano"
    >
      <style>{CSS}</style>
      <div className="sp-sombra" />
      <div className={`sp-corpo ${t ? "mexendo" : "parado"}`} style={t ? { transform: `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.04)` } : undefined}>
        {espessura.map((z) => (
          <div key={z} className="sp-moldura" style={{ transform: `translateZ(${z}px)`, filter: `brightness(${0.55 + z * 0.06})` }} />
        ))}
        <div className="sp-face">
          <div className="sp-camada sp-fundo" style={{ backgroundImage: `url(${IMG})`, transform: px(6) }} />
          <div className="sp-camada sp-figura" style={{ backgroundImage: `url(${IMG})`, transform: px(-14) }}>
            <span className="sp-olho" style={{ left: "38%", top: "44.6%" }} />
            <span className="sp-olho" style={{ left: "55%", top: "44.4%", animationDelay: ".15s" }} />
            <span className="sp-brilho" style={{ left: "80%", top: "4%" }} />
          </div>
          <div className="sp-vinheta" />
          <div className="sp-luz" />
        </div>
      </div>
    </div>
  );
}
