import { useSyncExternalStore } from "react";
import { Loader2, Square, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assinarExecucao, deveParar, lerExecucao, pedirParadaEsteira } from "@/lib/execucaoEsteira";

// Aviso flutuante: a esteira continua enviando quando você sai da aba Esteiras.
export function EsteiraEmAndamento({ onAbrir }: { onAbrir: () => void }) {
  const ex = useSyncExternalStore(assinarExecucao, lerExecucao);
  if (!ex.rodando) return null;
  const parando = deveParar();
  const tempo = ex.contagem > 0 ? `${Math.floor(ex.contagem / 60)}:${String(ex.contagem % 60).padStart(2, "0")}` : "";
  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)] rounded-xl border bg-white shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2">
        {ex.emPausa ? <Workflow className="w-4 h-4 text-amber-600" /> : <Loader2 className="w-4 h-4 animate-spin text-green-700" />}
        <span className="font-semibold">Esteira {ex.emPausa ? "em pausa" : "enviando"}</span>
        <span className="text-muted-foreground">
          {Math.min(ex.feitos + 1, ex.total)}/{ex.total}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground truncate">
        {parando
          ? "Parando depois do envio atual..."
          : ex.emPausa
            ? `Pausa — retoma em ${tempo}`
            : tempo
              ? `Próximo envio em ${tempo}`
              : `Enviando para ${ex.atual}`}
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" className="h-8 flex-1" onClick={onAbrir}>
          Ver esteira
        </Button>
        <Button size="sm" variant="destructive" className="h-8 flex-1" disabled={parando} onClick={pedirParadaEsteira}>
          <Square className="w-3.5 h-3.5 mr-1" /> Parar
        </Button>
      </div>
    </div>
  );
}
