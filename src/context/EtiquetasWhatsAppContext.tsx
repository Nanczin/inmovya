// Sincronização com o WhatsApp (o WhatsApp é a referência): lê as etiquetas no WhatsApp Web,
// mostra o que muda nos leads (etapa do funil e tags) e só grava depois da sua confirmação.
// Abre pelo botão do cabeçalho, do Negócios ou do Leads.
import { createContext, ReactNode, useContext, useState } from "react";
import { useLeads } from "@/context/LeadsContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { checarExtensao, extensaoAtualizada } from "@/lib/esteiras";
import {
  aplicarSincronizacao,
  isWhatsAppOcupado,
  lerEtiquetasDoWhatsApp,
  planejarSincronizacao,
  PlanoSincronizacao,
  setWhatsAppOcupado,
} from "@/lib/etiquetasWhatsApp";
import { Loader2 } from "lucide-react";

const VERSAO_MINIMA = "1.2.8";

interface EtiquetasWhatsAppValue {
  abrirSincronizacao: () => void;
  lendo: boolean;
}

const Ctx = createContext<EtiquetasWhatsAppValue | null>(null);

export const useEtiquetasWhatsApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEtiquetasWhatsApp fora do EtiquetasWhatsAppProvider");
  return v;
};

const rotuloStatus = (s: string | null | undefined) => (s === null ? "sai do funil" : s || "sem etapa");

export function EtiquetasWhatsAppProvider({ children }: { children: ReactNode }) {
  const { leads, refreshLeads } = useLeads();
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [plano, setPlano] = useState<PlanoSincronizacao | null>(null);
  const [erro, setErro] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const abrirSincronizacao = () => {
    setAberto(true);
    setErro("");
  };

  const ler = async () => {
    setErro("");
    if (isWhatsAppOcupado()) return setErro("A esteira está enviando agora. Espere terminar e leia de novo.");
    if (!(await checarExtensao()) || !extensaoAtualizada(VERSAO_MINIMA)) {
      return setErro(`Atualize o Inmovya Scale (versão ${VERSAO_MINIMA}): recarregue em chrome://extensions e dê F5 no WhatsApp Web e aqui.`);
    }
    setLendo(true);
    setWhatsAppOcupado(true);
    try {
      const etiquetas = await lerEtiquetasDoWhatsApp();
      const p = planejarSincronizacao(etiquetas, (leads || []) as any);
      setPlano(p);
      setMarcados(new Set(p.mudancas.map((m) => m.leadId)));
    } catch (err: any) {
      setErro(err?.message || "Não consegui ler as etiquetas do WhatsApp.");
    } finally {
      setWhatsAppOcupado(false);
      setLendo(false);
    }
  };

  const aplicar = async () => {
    if (!plano) return;
    const escolhidas = plano.mudancas.filter((m) => marcados.has(m.leadId));
    if (!escolhidas.length) return;
    setAplicando(true);
    try {
      const r = await aplicarSincronizacao(escolhidas, (leads || []) as any);
      await refreshLeads();
      toast({
        title: "Inmovya sincronizado com o WhatsApp",
        description: r.erros.length ? `${r.feitos} lead(s) atualizados, ${r.erros.length} com erro. Ex.: ${r.erros[0]}` : `${r.feitos} lead(s) atualizados.`,
        variant: r.erros.length ? "destructive" : undefined,
      });
      setPlano(null);
      setAberto(false);
    } finally {
      setAplicando(false);
    }
  };

  const alternar = (id: string) =>
    setMarcados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <Ctx.Provider value={{ abrirSincronizacao, lendo }}>
      {children}
      <Dialog open={aberto} onOpenChange={(v) => !lendo && !aplicando && setAberto(v)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Sincronizar com o WhatsApp</DialogTitle>
            <DialogDescription>
              O WhatsApp é a referência: as etiquetas 20%, 50%, 75%, Fechado, Lead e Nutrição acertam a etapa e as tags dos leads no Negócios e no Leads.
              Nada muda no WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 text-sm">
            {!plano && !lendo && (
              <div className="rounded-md bg-slate-50 border p-3 space-y-1 text-xs text-slate-700">
                <p>Deixe o WhatsApp Web aberto numa aba. Durante a leitura ele vem para a frente e abre cada etiqueta (não use o WhatsApp até terminar).</p>
                <p>
                  20% → 20% · 50% → 50% · 75% → 70% · Fechado → Vendeu · Lead → tag “disparo” e sai do funil · Nutrição → tag “nutrição”.
                </p>
              </div>
            )}
            {lendo && (
              <div className="flex items-center gap-2 text-slate-700">
                <Loader2 className="w-4 h-4 animate-spin" /> Lendo as etiquetas no WhatsApp… pode levar alguns minutos.
              </div>
            )}
            {erro && <p className="text-red-600 text-sm">{erro}</p>}

            {plano && (
              <>
                <p>
                  {plano.totalContatos} contato(s) etiquetados no WhatsApp · <b>{plano.mudancas.length}</b> lead(s) para atualizar ·{" "}
                  {plano.jaCertos} já certos.
                </p>
                {plano.mudancas.length > 0 && (
                  <div className="rounded-md border divide-y">
                    {plano.mudancas.map((m) => (
                      <label key={m.leadId} className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <Checkbox checked={marcados.has(m.leadId)} onCheckedChange={() => alternar(m.leadId)} className="mt-0.5" />
                        <span className="min-w-0">
                          <span className="font-medium">{m.nome}</span>
                          <span className="block text-xs text-slate-600">
                            WhatsApp: {m.etiquetas.join(", ")}
                            {m.statusNovo !== undefined && ` · etapa: ${rotuloStatus(m.statusAtual)} → ${rotuloStatus(m.statusNovo)}`}
                            {m.tagsNovas.length > 0 && ` · + tag ${m.tagsNovas.join(", ")}`}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {plano.naoEncontrados.length > 0 && (
                  <div className="text-xs text-amber-700">
                    <b>{plano.naoEncontrados.length} contato(s) do WhatsApp não estão no Inmovya</b> (nada foi criado):{" "}
                    {plano.naoEncontrados.map((c) => `${c.nome} (${c.etiquetas.join(", ")})`).join("; ")}
                  </div>
                )}
                {plano.ambiguos.length > 0 && (
                  <div className="text-xs text-amber-700">
                    <b>{plano.ambiguos.length} com mais de um lead de mesmo nome</b> (não mexi): {plano.ambiguos.map((c) => c.nome).join(", ")}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            {plano ? (
              <>
                <Button variant="outline" onClick={ler} disabled={lendo || aplicando}>
                  Ler de novo
                </Button>
                <Button onClick={aplicar} disabled={aplicando || !plano.mudancas.some((m) => marcados.has(m.leadId))}>
                  {aplicando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Aplicar {Array.from(marcados).length} mudança(s)
                </Button>
              </>
            ) : (
              <Button onClick={ler} disabled={lendo}>
                {lendo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                {lendo ? "Lendo..." : "Ler etiquetas do WhatsApp"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
