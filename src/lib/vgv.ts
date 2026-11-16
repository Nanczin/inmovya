// VGV (valor geral de vendas): o valor de cada venda. Fica junto das metas (arena_metas.metas.vgvPorDia),
// sem tabela nova. Com meta de VGV, a meta de vendas anda proporcional ao VGV vendido.
import { supabase } from "@/integrations/supabase/client";
import { lerMetasLocal, normalizarMetas, type Metas } from "@/components/ArenaModule";

export type VgvPorDia = Record<string, number>; // "AAAA-MM-DD" → R$

export const vgvPorDiaDe = (m: Partial<Metas> | null | undefined): VgvPorDia => {
  const v = (m as any)?.vgvPorDia;
  return v && typeof v === "object" ? v : {};
};

/** Soma do VGV entre duas datas "AAAA-MM-DD" (inclusive). */
export const somarVgv = (mapa: VgvPorDia, de: string, ate: string) =>
  Object.entries(mapa).reduce((s, [k, v]) => (k >= de && k <= ate ? s + (Number(v) || 0) : s), 0);

/** VGV do mês ("AAAA-MM"). */
export const vgvDoMes = (mapa: VgvPorDia, mes: string) => Object.entries(mapa).reduce((s, [k, v]) => (k.startsWith(mes) ? s + (Number(v) || 0) : s), 0);

/** Vendas "proporcionais": VGV vendido ÷ meta de VGV × meta de vendas (1 casa). null = sem meta de VGV. */
export const vendasProporcionais = (vgv: number, metas: Pick<Metas, "mesVendas"> & { mesVgv?: number }) => {
  const meta = Number(metas.mesVgv) || 0;
  if (meta <= 0) return null;
  return Math.round((vgv / meta) * (Number(metas.mesVendas) || 0) * 10) / 10;
};

/** "R$ 1,25 mi", "R$ 850 mil", "R$ 900" */
export const reais = (v: number) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `R$ ${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (Math.abs(n) >= 1e4) return `R$ ${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

/** "1.250.000", "1,25 mi", "850 mil", "850k", "R$ 900.000,00" → número */
export const lerReais = (txt: string) => {
  let t = String(txt || "").toLowerCase().replace(/r\$|\s/g, "");
  let mult = 1;
  if (/(mi|milh[aã]o|milh[oõ]es|m)$/.test(t)) {
    mult = 1e6;
    t = t.replace(/(mi|milh[aã]o|milh[oõ]es|m)$/, "");
  } else if (/(mil|k)$/.test(t)) {
    mult = 1e3;
    t = t.replace(/(mil|k)$/, "");
  }
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, "");
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * mult) : 0;
};

/** Grava o VGV de um dia (substitui; 0 apaga), lendo as metas atuais do banco para não perder nada. */
export async function salvarVgvDoDia(dia: string, valor: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Faça login de novo.");
  const { data, error } = await supabase.from("arena_metas" as any).select("metas").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  const metas: any = normalizarMetas((data as any)?.metas || lerMetasLocal());
  const mapa: VgvPorDia = { ...vgvPorDiaDe(metas) };
  if (valor > 0) mapa[dia] = Math.round(valor);
  else delete mapa[dia];
  metas.vgvPorDia = mapa;
  const { error: e2 } = await supabase
    .from("arena_metas" as any)
    .upsert({ user_id: user.id, metas, updated_at: new Date().toISOString() } as any, { onConflict: "user_id" });
  if (e2) throw e2;
  try {
    localStorage.setItem("inmovya_arena_metas", JSON.stringify(metas));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("inmovya-metas-salvas", { detail: metas }));
  return mapa;
}
