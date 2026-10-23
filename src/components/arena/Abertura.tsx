import { useCallback, useEffect, useRef, useState } from "react";

// ABERTURA estilo tela de carregamento do GTA: imagens fixas passando uma a uma, cada uma com movimento lento de
// câmera (zoom + panorâmica) e a próxima entrando em faixas inclinadas que deslizam da direita. Sem legenda.
// Imagens em public/arena/abertura/. "foco" = ponto da imagem que nunca pode sair do quadro (rosto).

const TEMPO = 6500; // ms por imagem
const IMAGENS = [
  { src: "/arena/abertura/1.jpg", foco: "58% 28%" },
  { src: "/arena/abertura/2.jpg", foco: "45% 32%" },
  { src: "/arena/abertura/3.jpg", foco: "38% 35%" },
  { src: "/arena/abertura/4.jpg", foco: "55% 38%" },
  { src: "/arena/abertura/5.jpg", foco: "35% 45%" },
];

const CSS = `
@keyframes ab-kb-1 { from { transform: scale(1.04) translate(1.5%, 1%); } to { transform: scale(1.16) translate(-2%, -1.5%); } }
@keyframes ab-kb-2 { from { transform: scale(1.16) translate(-3%, 0); } to { transform: scale(1.16) translate(3%, -1%); } }
@keyframes ab-kb-3 { from { transform: scale(1.16) translate(0, -2%); } to { transform: scale(1.05) translate(-1%, 1.5%); } }
@keyframes ab-kb-4 { from { transform: scale(1.14) translate(3%, 1.5%); } to { transform: scale(1.14) translate(-3%, -1.5%); } }
@keyframes ab-faixa { from { transform: translateX(115%); } to { transform: translateX(0); } }
@keyframes ab-sai { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-20%); opacity: .35; } }
@keyframes ab-brilho { 0% { opacity: 0; } 20% { opacity: .3; } 100% { opacity: 0; } }
.ab-raiz { position: relative; overflow: hidden; background: #050505; }
.ab-camada { position: absolute; inset: 0; overflow: hidden; }
.ab-camada.sai { animation: ab-sai .75s cubic-bezier(.7,0,.2,1) forwards; z-index: 1; }
.ab-camada.entra { z-index: 2; }
.ab-faixa { position: absolute; inset: 0; overflow: hidden; animation: ab-faixa .65s cubic-bezier(.75,0,.2,1) both; will-change: transform; }
.ab-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; animation-duration: ${TEMPO + 1200}ms; animation-timing-function: linear; animation-fill-mode: both; }
.ab-vinheta { position: absolute; inset: 0; z-index: 3; pointer-events: none; background: radial-gradient(120% 95% at 50% 45%, transparent 55%, rgba(0,0,0,.5)); }
.ab-flash { position: absolute; inset: 0; z-index: 3; pointer-events: none; background: #fff; mix-blend-mode: overlay; animation: ab-brilho .6s ease-out both; }
@media (prefers-reduced-motion: reduce) { .ab-img, .ab-faixa, .ab-camada.sai, .ab-flash { animation: none !important; } }
`;

// faixas inclinadas (como as do GTA); se sobrepõem um pouco para não aparecer emenda
const FAIXAS = [
  "polygon(-20% 0, 42% 0, 22% 100%, -40% 100%)",
  "polygon(40% 0, 76% 0, 56% 100%, 20% 100%)",
  "polygon(74% 0, 130% 0, 130% 100%, 54% 100%)",
];

/** largura/altura: tamanho fixo. Sem elas, ocupa todo o elemento pai (use como fundo, com o pai em position: relative). */
export function Abertura({ largura, altura, className = "" }: { largura?: number; altura?: number; className?: string }) {
  const [atual, setAtual] = useState(0);
  const [anterior, setAnterior] = useState<number | null>(null);
  const [geracao, setGeracao] = useState(0);
  const atualRef = useRef(0);

  useEffect(() => {
    IMAGENS.forEach((i) => {
      const im = new Image();
      im.src = i.src;
    });
  }, []);

  const avancar = useCallback(() => {
    const a = atualRef.current;
    const prox = (a + 1) % IMAGENS.length;
    atualRef.current = prox;
    setAnterior(a);
    setAtual(prox);
    setGeracao((g) => g + 1);
  }, []);

  useEffect(() => {
    const t = window.setInterval(avancar, TEMPO);
    return () => window.clearInterval(t);
  }, [avancar]);

  // some com a camada que saiu depois da transição
  useEffect(() => {
    if (anterior === null) return;
    const t = window.setTimeout(() => setAnterior(null), 800);
    return () => window.clearTimeout(t);
  }, [anterior, geracao]);

  const camada = (i: number, tipo: "entra" | "sai" | "fixa", chave: string) => {
    const im = IMAGENS[i];
    // a que está saindo continua do ponto em que parou (fim do movimento), sem pulo
    const imagem = (
      <img
        src={im.src}
        alt=""
        className="ab-img"
        style={{ objectPosition: im.foco, transformOrigin: im.foco, animationName: `ab-kb-${(i % 4) + 1}`, animationDelay: tipo === "sai" ? `-${TEMPO}ms` : undefined }}
        draggable={false}
      />
    );
    if (tipo !== "entra")
      return (
        <div key={chave} className={`ab-camada ${tipo === "sai" ? "sai" : ""}`}>
          {imagem}
        </div>
      );
    return (
      <div key={chave} className="ab-camada entra">
        {FAIXAS.map((clip, k) => (
          <div key={k} className="ab-faixa" style={{ clipPath: clip, WebkitClipPath: clip, animationDelay: `${k * 90}ms` }}>
            {imagem}
          </div>
        ))}
      </div>
    );
  };

  const fundo = largura === undefined;
  return (
    <>
      <style>{CSS}</style>
      <div className={`ab-raiz ${fundo ? "!absolute inset-0" : ""} ${className}`} style={fundo ? undefined : { width: largura, height: altura }}>
        {anterior !== null && anterior !== atual && camada(anterior, "sai", `s-${geracao}`)}
        {camada(atual, geracao > 0 ? "entra" : "fixa", `e-${geracao}`)}
        <div className="ab-vinheta" />
      </div>
    </>
  );
}
