import { Button } from "@/components/ui/button";
import { useEtiquetasWhatsApp } from "@/context/EtiquetasWhatsAppContext";
import { Loader2, Tag } from "lucide-react";

/** Botão do cabeçalho: sincroniza o Inmovya com as etiquetas do WhatsApp (o WhatsApp é a referência). */
export function EtiquetasWhatsAppMenu() {
  const { abrirSincronizacao, lendo } = useEtiquetasWhatsApp();
  return (
    <Button variant="ghost" size="icon" title="Sincronizar com as etiquetas do WhatsApp" onClick={abrirSincronizacao}>
      {lendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Tag className="w-5 h-5" />}
    </Button>
  );
}

/** Mesmo atalho, em formato de botão com texto (Negócios e Leads). */
export function SincronizarWhatsAppButton({ className = "" }: { className?: string }) {
  const { abrirSincronizacao, lendo } = useEtiquetasWhatsApp();
  return (
    <Button variant="outline" size="sm" className={className} onClick={abrirSincronizacao} title="Acerta a etapa e as tags pelos rótulos (etiquetas) do WhatsApp">
      {lendo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Tag className="w-4 h-4 mr-1" />}
      Sincronizar com WhatsApp
    </Button>
  );
}
