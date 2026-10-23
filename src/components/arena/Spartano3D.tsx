import { useEffect, useRef, useState } from "react";

// Spartano em 3D de verdade (Three.js), modelado em código: public/arena/spartano3d.js.
// Carrega sob demanda (não pesa o resto do Inmovya). Arraste para girar.

export function Spartano3D({ largura = 180, altura, className = "", autoGiro = true }: { largura?: number; altura?: number; className?: string; autoGiro?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [falhou, setFalhou] = useState(false);
  const h = altura ?? Math.round(largura * 1.45);

  useEffect(() => {
    let desmontar: (() => void) | null = null;
    let vivo = true;
    const url = "/arena/spartano3d.js";
    import(/* @vite-ignore */ url)
      .then(async (m: any) => {
        if (!vivo || !ref.current) return;
        const d = await m.montar(ref.current, { autoGiro });
        if (vivo) desmontar = d;
        else d();
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
      desmontar?.();
    };
  }, [autoGiro]);

  return (
    <div ref={ref} className={`relative ${className}`} style={{ width: largura, height: h }} title="Arraste para girar o spartano">
      {falhou && <div className="absolute inset-0 flex items-center justify-center text-6xl">🛡️</div>}
    </div>
  );
}
