import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEtiquetasWhatsApp } from "@/context/EtiquetasWhatsAppContext";
import { Loader2, Square, Tag } from "lucide-react";

/** Botão do cabeçalho: etiquetas do WhatsApp sincronizadas com a etapa do funil. */
export function EtiquetasWhatsAppMenu() {
  const { pendentes, automatico, setAutomatico, rodando, progresso, falhas, extensaoPronta, sincronizarAgora, parar } =
    useEtiquetasWhatsApp();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Etiquetas do WhatsApp">
          {rodando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Tag className="w-5 h-5" />}
          {!rodando && pendentes.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-[10px] leading-4 text-white">
              {pendentes.length > 99 ? "99+" : pendentes.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 z-50 p-3 space-y-3">
        <div>
          <p className="text-sm font-semibold">Etiquetas do WhatsApp</p>
          <p className="text-xs text-muted-foreground">
            A conversa recebe a etiqueta da etapa do funil: 20%, 50%, 75% (70%), Fechado ou Lead (fim da esteira). Não envia mensagem.
          </p>
        </div>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Automático
            <span className="block text-xs text-muted-foreground">Acerta sozinho quando o lead muda de etapa (com o Inmovya aberto).</span>
          </span>
          <Switch checked={automatico} onCheckedChange={setAutomatico} />
        </label>

        {extensaoPronta === false && (
          <p className="text-xs text-red-600">
            Inmovya Scale não encontrado ou desatualizado (precisa da 1.2.6). Recarregue a extensão em chrome://extensions e dê F5 aqui.
          </p>
        )}

        <DropdownMenuSeparator />

        {rodando ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>
              Etiquetando {progresso ? `${progresso.feitos + 1}/${progresso.total}` : "…"}
            </span>
            <Button size="sm" variant="destructive" onClick={parar}>
              <Square className="w-3 h-3 mr-1" /> Parar
            </Button>
          </div>
        ) : (
          <Button size="sm" className="w-full" disabled={!pendentes.length} onClick={sincronizarAgora}>
            {pendentes.length ? `Sincronizar agora (${pendentes.length})` : "Tudo sincronizado"}
          </Button>
        )}

        {falhas.length > 0 && (
          <div className="max-h-32 overflow-auto text-xs text-red-600 space-y-0.5">
            {falhas.slice(0, 8).map((f, i) => (
              <p key={i}>
                {f.nome}: {f.erro}
              </p>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
