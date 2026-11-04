import { NOME_STATUS, type StatusEtiqueta } from "@/lib/etiquetasProjeto";

// Etiqueta(s) de projeto do lead (resolvida pelo banco) + se já está no WhatsApp.
export function EtiquetaProjetoBadges({ lead }: { lead: any }) {
  const etqs: string[] = lead?.etiqueta_projeto || [];
  if (!etqs.length) return null;
  const st = lead?.etiqueta_projeto_status as StatusEtiqueta | null;
  const noZap = st === "aplicada" || st === "ja_estava";
  const titulo = st ? `Etiqueta do WhatsApp — ${NOME_STATUS[st]}${lead?.etiqueta_projeto_aviso ? ` (${lead.etiqueta_projeto_aviso})` : ""}` : "Etiqueta do WhatsApp (use Sincronizar para aplicar)";
  return (
    <span className="inline-flex flex-wrap gap-1">
      {etqs.map((e) => (
        <span
          key={e}
          title={titulo}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${noZap ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}
        >
          🏷️ {e}
          {st && !noZap && <span className="font-normal opacity-70">· {st === "sem_conversa" ? "sem conversa" : "pendente"}</span>}
        </span>
      ))}
    </span>
  );
}
