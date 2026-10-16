import { useState, useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, ShieldCheck, Square } from "lucide-react";
import {
  ItemConferencia,
  Situacao,
  assinarConferencia,
  corrigirItens,
  getConfigConferencia,
  lerEstadoConferencia,
  pararConferencia,
  podeCorrigirSozinho,
  resumoRelatorio,
  rodarConferencia,
  setConfigConferencia,
} from "@/lib/conferenciaWhatsApp";

const SECOES: { s: Situacao; titulo: string; dica: string; cor: string }[] = [
  { s: "divergente", titulo: "Divergentes", dica: "O WhatsApp é a referência: “Corrigir” ajusta o Inmovya.", cor: "border-amber-200 bg-amber-50" },
  {
    s: "excluir",
    titulo: "Para excluir do Inmovya",
    dica: "Saíram da Bitrix e estão sem etiqueta no WhatsApp. A exclusão é permanente: confira e exclua você mesmo.",
    cor: "border-red-200 bg-red-50",
  },
  { s: "nao_achado", titulo: "Não achados no WhatsApp", dica: "O número não aparece nas conversas do WhatsApp.", cor: "border-gray-200 bg-gray-50" },
  { s: "observacao", titulo: "Observações", dica: "Só para saber — nada a corrigir agora.", cor: "border-blue-200 bg-blue-50" },
];

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function ConferenciaWhatsAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const estado = useSyncExternalStore(assinarConferencia, lerEstadoConferencia);
  const cfg = getConfigConferencia();
  const [corrigindo, setCorrigindo] = useState<string | null>(null);
  const [verOk, setVerOk] = useState(false);
  const rel = estado.relatorio;
  const resumo = rel ? resumoRelatorio(rel) : null;
  const corrigiveis = rel ? rel.itens.filter((i) => i.situacao === "divergente" && podeCorrigirSozinho(i)) : [];

  const corrigir = async (ids: string[], chave: string) => {
    setCorrigindo(chave);
    try {
      const { feitos, erros } = await corrigirItens(ids);
      toast({
        title: erros.length ? `${feitos} corrigido(s), ${erros.length} com erro` : `${feitos} lead(s) corrigido(s)`,
        description: erros.length ? erros.slice(0, 3).join(" · ") : "O Inmovya agora segue as etiquetas do WhatsApp.",
        variant: erros.length ? "destructive" : undefined,
      });
    } finally {
      setCorrigindo(null);
    }
  };

  const linha = (i: ItemConferencia) => (
    <li key={i.leadId} className="py-2 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium break-words">
          {i.nome} <span className="text-xs font-normal text-muted-foreground">{i.telefone}</span>
        </div>
        <div className="text-xs text-muted-foreground break-words">
          {i.motivo}
          {i.nomeWhatsApp && i.nomeWhatsApp !== i.nome && ` · no WhatsApp: ${i.nomeWhatsApp}`}
          {i.etiquetas.length > 0 && ` · etiquetas: ${i.etiquetas.join(", ")}`}
        </div>
        {i.erroCorrecao && <div className="text-xs text-red-600">Erro: {i.erroCorrecao}</div>}
      </div>
      {i.situacao === "divergente" &&
        (i.corrigido ? (
          <span className="text-xs text-green-700 flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> corrigido
          </span>
        ) : i.correcao ? (
          <Button size="sm" variant="outline" className="h-7 shrink-0" disabled={!!corrigindo} onClick={() => corrigir([i.leadId], i.leadId)}>
            {corrigindo === i.leadId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Corrigir${i.correcao.status ? ` → ${i.correcao.status}` : ""}`}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground shrink-0">ajuste à mão</span>
        ))}
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Conferir com o WhatsApp
          </DialogTitle>
          <DialogDescription>
            Compara as etiquetas do WhatsApp com as etapas do Inmovya, lead por lead pelo telefone. Grátis e sem IA. O WhatsApp é a referência.
          </DialogDescription>
        </DialogHeader>

        {/* Configuração */}
        <div className="rounded-lg border p-3 space-y-3 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <span className="font-medium">Quais leads:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" className="h-4 w-4" checked={cfg.escopo === "funil"} disabled={estado.rodando} onChange={() => setConfigConferencia({ ...cfg, escopo: "funil" })} />
              Prospecção e funil (sem Lista fria/Perdido/Nenhuma)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" className="h-4 w-4" checked={cfg.escopo === "todos"} disabled={estado.rodando} onChange={() => setConfigConferencia({ ...cfg, escopo: "todos" })} />
              Todos
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Switch checked={cfg.automatica} onCheckedChange={(v) => setConfigConferencia({ ...cfg, automatica: v })} />
            <span>Conferir sozinho todo dia às</span>
            <Input type="time" className="w-28 h-8" value={cfg.hora} onChange={(e) => setConfigConferencia({ ...cfg, hora: e.target.value || "07:00" })} />
            <span className="text-xs text-muted-foreground">(só gera o relatório; corrigir é com você)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Precisa do WhatsApp Web aberto numa aba deste Chrome e do Inmovya Scale. A aba do WhatsApp vem para a frente enquanto lê as etiquetas; depois a
            busca pelos telefones roda numa janelinha no canto (uns 5 s por lead).
          </p>
          <div className="flex items-center gap-2">
            {estado.rodando ? (
              <>
                <Button variant="outline" onClick={pararConferencia}>
                  <Square className="w-4 h-4 mr-2" /> Parar
                </Button>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {estado.fase}
                </span>
              </>
            ) : (
              <Button onClick={() => rodarConferencia("manual")}>
                <ShieldCheck className="w-4 h-4 mr-2" /> Conferir agora
              </Button>
            )}
          </div>
        </div>

        {/* Relatório */}
        {rel && resumo && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">
                {rel.erro ? "Conferência incompleta" : resumo.divergentes + resumo.excluir === 0 ? "Tudo batendo ✅" : "Há pendências"}
              </span>
              <span className="text-xs text-muted-foreground">
                {quando(rel.feitoEm)} · {rel.total} lead(s) · {resumo.ok} ok · {resumo.divergentes} divergente(s) · {resumo.excluir} para excluir ·{" "}
                {resumo.naoAchados} não achado(s)
              </span>
              {corrigiveis.length > 0 && (
                <Button size="sm" className="ml-auto" disabled={!!corrigindo} onClick={() => corrigir(corrigiveis.map((i) => i.leadId), "todos")}>
                  {corrigindo === "todos" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Corrigir todos ({corrigiveis.length})
                </Button>
              )}
            </div>
            {rel.erro && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{rel.erro}</div>}
            {Object.keys(rel.contagemEtiquetas).length > 0 && (
              <div className="text-xs text-muted-foreground">
                No WhatsApp:{" "}
                {Object.entries(rel.contagemEtiquetas)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")}
              </div>
            )}

            {SECOES.map(({ s, titulo, dica, cor }) => {
              const itens = rel.itens.filter((i) => i.situacao === s);
              if (!itens.length) return null;
              return (
                <div key={s} className={`rounded-lg border p-3 ${cor}`}>
                  <div className="font-semibold text-sm">
                    {titulo} ({itens.length})
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">{dica}</div>
                  <ul className="divide-y divide-black/5">{itens.map(linha)}</ul>
                </div>
              );
            })}

            {rel.foraDoInmovya.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="font-semibold text-sm">Na etiqueta do WhatsApp, mas sem lead conferido ({rel.foraDoInmovya.length})</div>
                <div className="text-xs text-muted-foreground mb-1">
                  Pode não estar cadastrado no Inmovya, ou estar com outro nome/etapa fora da conferência. Confira pelo telefone.
                </div>
                <ul className="text-sm space-y-0.5">
                  {rel.foraDoInmovya.map((f, k) => (
                    <li key={`${f.nome}-${f.etiqueta}-${k}`}>
                      <b>{f.nome}</b> <span className="text-xs text-muted-foreground">· {f.etiqueta}</span>
                      {f.leadComMesmoNome && <span className="text-xs text-muted-foreground"> · no Inmovya: {f.leadComMesmoNome}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resumo.ok > 0 && (
              <div className="rounded-lg border p-3">
                <button type="button" className="text-sm font-semibold" onClick={() => setVerOk((v) => !v)}>
                  {verOk ? "▾" : "▸"} Batendo ({resumo.ok})
                </button>
                {verOk && <ul className="divide-y mt-1">{rel.itens.filter((i) => i.situacao === "ok").map(linha)}</ul>}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
