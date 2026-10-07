// Backup das esteiras: esteiras, passos (mensagens, anexos, colunas) e a posição dos leads.
// O arquivo .json pode ser restaurado depois (atualiza as mesmas esteiras, sem duplicar).
import { supabase } from "@/integrations/supabase/client";

const TIPO = "inmovya-esteiras";
const VERSAO = 1;

// Só estes campos entram/voltam (evita colunas que não existem mais no banco)
const CAMPOS_ESTEIRA = ["id", "nome", "ordem", "etapa", "ao_concluir_tag", "ao_concluir_etapa", "ao_concluir_dias", "scale_id", "created_at"];
const CAMPOS_PASSO = ["id", "esteira_id", "ordem", "titulo", "mensagem", "dias_espera", "so_colar", "anexos", "etapa", "scale_id", "created_at"];
const CAMPOS_LEAD = ["id", "nome", "telefone", "esteira_id", "esteira_passo", "esteira_proximo", "esteira_ultimo_envio"];

const escolher = (obj: Record<string, any>, campos: string[]) =>
  Object.fromEntries(campos.filter((c) => c in obj).map((c) => [c, obj[c]]));

export interface BackupEsteiras {
  tipo: typeof TIPO;
  versao: number;
  criado_em: string;
  esteiras: Record<string, any>[];
  passos: Record<string, any>[];
  leads: Record<string, any>[];
}

export async function gerarBackupEsteiras(): Promise<BackupEsteiras> {
  const [{ data: esteiras, error: e1 }, { data: passos, error: e2 }] = await Promise.all([
    supabase.from("esteiras").select("*").order("ordem"),
    supabase.from("esteira_passos").select("*").order("ordem"),
  ]);
  if (e1 || e2) throw e1 || e2;
  const leads: Record<string, any>[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, nome, telefone, esteira_id, esteira_passo, esteira_proximo, esteira_ultimo_envio")
      .not("esteira_id", "is", null)
      .range(de, de + 999);
    if (error) throw error;
    leads.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return {
    tipo: TIPO,
    versao: VERSAO,
    criado_em: new Date().toISOString(),
    esteiras: (esteiras || []).map((e) => escolher(e, CAMPOS_ESTEIRA)),
    passos: (passos || []).map((p) => escolher(p, CAMPOS_PASSO)),
    leads: leads.map((l) => escolher(l, CAMPOS_LEAD)),
  };
}

/** Baixa o backup como arquivo .json no computador. */
export async function baixarBackupEsteiras(prefixo = "esteiras-backup") {
  const backup = await gerarBackupEsteiras();
  const data = new Date();
  const carimbo = `${data.toLocaleDateString("pt-BR").split("/").reverse().join("-")}_${String(data.getHours()).padStart(2, "0")}h${String(data.getMinutes()).padStart(2, "0")}`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${prefixo}_${carimbo}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return backup;
}

export function lerBackupEsteiras(texto: string): BackupEsteiras {
  const b = JSON.parse(texto);
  if (b?.tipo !== TIPO || !Array.isArray(b.esteiras) || !Array.isArray(b.passos)) {
    throw new Error("Este arquivo não é um backup de esteiras do Inmovya.");
  }
  return { ...b, leads: Array.isArray(b.leads) ? b.leads : [] };
}

/**
 * Restaura o backup: as esteiras do arquivo voltam como estavam (mesmos passos e mensagens).
 * Esteiras que não estão no arquivo ficam como estão. Com `posicoes`, os leads voltam ao passo/data do backup.
 */
export async function restaurarBackupEsteiras(backup: BackupEsteiras, opcoes: { posicoes: boolean }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const esteiras: Record<string, any>[] = backup.esteiras.map((e) => ({ ...escolher(e, CAMPOS_ESTEIRA), user_id: user.id }));
  if (esteiras.length) {
    const { error } = await supabase.from("esteiras").upsert(esteiras as any, { onConflict: "id" });
    if (error) throw error;
  }

  // Passos: cada esteira restaurada fica exatamente com os passos do backup
  const idsEsteiras = esteiras.map((e) => e.id as string);
  const idsPassos = new Set(backup.passos.map((p) => p.id));
  if (idsEsteiras.length) {
    const { data: atuais, error } = await supabase.from("esteira_passos").select("id").in("esteira_id", idsEsteiras);
    if (error) throw error;
    const sobrando = (atuais || []).map((p) => p.id).filter((id) => !idsPassos.has(id));
    if (sobrando.length) {
      const { error: eDel } = await supabase.from("esteira_passos").delete().in("id", sobrando);
      if (eDel) throw eDel;
    }
  }
  const passos = backup.passos.map((p) => ({ ...escolher(p, CAMPOS_PASSO), user_id: user.id }));
  for (let i = 0; i < passos.length; i += 200) {
    const { error } = await supabase.from("esteira_passos").upsert(passos.slice(i, i + 200) as any, { onConflict: "id" });
    if (error) throw error;
  }

  // Posição dos leads (só quem ainda existe no Inmovya)
  let leadsRestaurados = 0;
  if (opcoes.posicoes) {
    for (const l of backup.leads) {
      const { data, error } = await supabase
        .from("leads")
        .update({
          esteira_id: l.esteira_id,
          esteira_passo: l.esteira_passo ?? 0,
          esteira_proximo: l.esteira_proximo ?? null,
          ...(l.esteira_ultimo_envio !== undefined ? { esteira_ultimo_envio: l.esteira_ultimo_envio } : {}),
        })
        .eq("id", l.id)
        .select("id");
      if (error) throw error;
      leadsRestaurados += (data || []).length;
    }
  }
  return { esteiras: esteiras.length, passos: passos.length, leads: leadsRestaurados };
}
