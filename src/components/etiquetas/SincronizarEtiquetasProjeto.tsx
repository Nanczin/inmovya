import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Tags, CheckCircle2, AlertTriangle, PhoneOff } from "lucide-react";
import { diagnosticoExtensao, resumoEtiquetasProjeto, sincronizarEtiquetasProjeto, type ResumoSincronizacao } from "@/lib/etiquetasProjeto";

// Botão "Sincronizar etiquetas de projeto": põe todos os leads com projeto na fila; o Inmovya Scale
// (com o WhatsApp Web aberto) põe as etiquetas que faltam, com intervalo entre uma conversa e outra.
// Esta tela acompanha e, no fim, mostra quantos foram aplicados, quantos já estavam certos e quem
// não tem conversa no WhatsApp.
export function SincronizarEtiquetasProjeto() {
  const { toast } = useToast();
  const [resumo, setResumo] = useState<ResumoSincronizacao | null>(null);
  const [rodando, setRodando] = useState(false);
  const [inicio, setInicio] = useState<number | null>(null);
  const [parado, setParado] = useState(false);
  const [diag, setDiag] = useState<{ texto: string | null; em: string | null }>({ texto: null, em: null });
  const ultimoPendente = useRef<{ n: number; t: number }>({ n: -1, t: 0 });

  const atualizar = useCallback(async () => {
    try {
      const r = await resumoEtiquetasProjeto();
      setResumo(r);
      diagnosticoExtensao().then(setDiag).catch(() => {});
      if (r.pendentes !== ultimoPendente.current.n) ultimoPendente.current = { n: r.pendentes, t: Date.now() };
      // 3 minutos sem andar: a extensão provavelmente não está trabalhando
      setParado(r.pendentes > 0 && Date.now() - ultimoPendente.current.t > 3 * 60 * 1000);
      return r;
    } catch (e: any) {
      toast({ title: "Não consegui ler o andamento", description: e?.message, variant: "destructive" });
      return null;
    }
  }, [toast]);

  useEffect(() => {
    atualizar().then((r) => r && r.pendentes > 0 && setRodando(true));
  }, [atualizar]);

  useEffect(() => {
    if (!rodando) return;
    const t = window.setInterval(async () => {
      const r = await atualizar();
      if (r && r.pendentes === 0) setRodando(false);
    }, 5000);
    return () => window.clearInterval(t);
  }, [rodando, atualizar]);

  const sincronizar = async () => {
    try {
      const r = await sincronizarEtiquetasProjeto();
      setInicio(Date.now());
      ultimoPendente.current = { n: -1, t: Date.now() };
      setRodando(true);
      toast({ title: `${r.na_fila} leads na fila`, description: "Deixe o WhatsApp Web aberto com o Inmovya Scale. As etiquetas vão sendo aplicadas aos poucos." });
      atualizar();
    } catch (e: any) {
      toast({ title: "Não consegui começar", description: e?.message, variant: "destructive" });
    }
  };

  const feitos = resumo ? resumo.total - resumo.pendentes : 0;
  const pct = resumo && resumo.total ? Math.round((feitos / resumo.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={sincronizar} disabled={rodando}>
          <RefreshCw className={`w-4 h-4 mr-2 ${rodando ? "animate-spin" : ""}`} />
          {rodando ? "Sincronizando…" : "Sincronizar etiquetas de projeto"}
        </Button>
        {resumo && (
          <span className="text-sm text-muted-foreground">
            {resumo.total} leads com projeto{rodando ? ` · ${feitos} de ${resumo.total} conferidos (${pct}%)` : ""}
          </span>
        )}
      </div>

      {rodando && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {diag.texto && (
        <p className="text-xs text-muted-foreground">
          Inmovya Scale{diag.em ? ` (${new Date(diag.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})` : ""}: {diag.texto}
        </p>
      )}

      {parado && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <span>
            Nada andou nos últimos minutos. Abra o <b>WhatsApp Web</b> neste computador com o <b>Inmovya Scale</b> atualizado e deixe a aba aberta.
          </span>
        </div>
      )}

      {resumo && (inicio || !rodando) && resumo.total > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tags className="w-4 h-4 text-primary" /> Aplicados agora
            </div>
            <div className="text-2xl font-extrabold tabular-nums">{resumo.aplicados}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-success" /> Já estavam certos
            </div>
            <div className="text-2xl font-extrabold tabular-nums">{resumo.jaCertos}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PhoneOff className="w-4 h-4 text-warning" /> Sem conversa no WhatsApp
            </div>
            <div className="text-2xl font-extrabold tabular-nums">{resumo.semConversa.length}</div>
          </div>
        </div>
      )}

      {resumo && resumo.semConversa.length > 0 && (
        <details className="rounded-xl border p-3 text-sm" open={!rodando}>
          <summary className="cursor-pointer font-semibold">Leads sem conversa no WhatsApp ({resumo.semConversa.length})</summary>
          <p className="text-muted-foreground mt-1 mb-2">Não criei conversa nem mandei mensagem. A etiqueta entra sozinha quando houver conversa (confere de novo a cada 6 horas).</p>
          <ul className="max-h-64 overflow-y-auto divide-y">
            {resumo.semConversa.map((l) => (
              <li key={l.id} className="py-1.5 flex justify-between gap-3">
                <span className="truncate">{l.nome}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">{l.telefone}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {resumo && (resumo.erros.length > 0 || resumo.avisos.length > 0) && (
        <details className="rounded-xl border border-warning/40 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Avisos ({resumo.erros.length + resumo.avisos.length})</summary>
          <ul className="max-h-64 overflow-y-auto divide-y mt-2">
            {resumo.erros.map((l) => (
              <li key={l.id} className="py-1.5">
                <b>{l.nome}</b> <span className="text-muted-foreground">({l.telefone})</span>: {l.aviso || "erro"} — tenta de novo em 30 min
              </li>
            ))}
            {resumo.avisos.map((a, i) => (
              <li key={`a${i}`} className="py-1.5">
                <b>{a.nome}</b>: {a.aviso}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
