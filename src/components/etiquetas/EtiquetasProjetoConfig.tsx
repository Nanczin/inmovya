import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Tags, Trash2 } from "lucide-react";
import {
  FaltaSqlEtiquetas,
  etiquetasDoWhatsApp,
  listarRegras,
  resolverEtiquetaProjeto,
  salvarRegras,
  type RegraProjeto,
} from "@/lib/etiquetasProjeto";
import { SincronizarEtiquetasProjeto } from "./SincronizarEtiquetasProjeto";

const semAcento = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// Configurações → Etiquetas de projeto: regras "o projeto contém… → etiqueta do WhatsApp".
export function EtiquetasProjetoConfig() {
  const { toast } = useToast();
  const [regras, setRegras] = useState<RegraProjeto[] | null>(null);
  const [removidas, setRemovidas] = useState<string[]>([]);
  const [faltaSql, setFaltaSql] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mudou, setMudou] = useState(false);
  const [doWhats, setDoWhats] = useState<{ nomes: string[]; em: string | null }>({ nomes: [], em: null });
  const [teste, setTeste] = useState("");
  const [resultadoTeste, setResultadoTeste] = useState<string[] | null>(null);

  useEffect(() => {
    listarRegras()
      .then(setRegras)
      .catch((e) => {
        if (e instanceof FaltaSqlEtiquetas) setFaltaSql(true);
        else toast({ title: "Não consegui ler as regras", description: e?.message, variant: "destructive" });
      });
    etiquetasDoWhatsApp().then(setDoWhats).catch(() => {});
  }, [toast]);

  const existeNoWhats = useMemo(() => {
    const set = new Set(doWhats.nomes.map(semAcento));
    return (nome: string) => !doWhats.nomes.length || set.has(semAcento(nome));
  }, [doWhats]);

  const mudar = (i: number, campo: Partial<RegraProjeto>) => {
    setRegras((rs) => (rs || []).map((r, j) => (j === i ? { ...r, ...campo } : r)));
    setMudou(true);
  };
  const mover = (i: number, d: -1 | 1) => {
    setRegras((rs) => {
      const lista = [...(rs || [])];
      const j = i + d;
      if (j < 0 || j >= lista.length) return lista;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return lista.map((r, k) => ({ ...r, ordem: r.padrao.trim() === "*" ? 999 : (k + 1) * 10 }));
    });
    setMudou(true);
  };
  const remover = (i: number) => {
    const r = regras?.[i];
    if (r?.id) setRemovidas((x) => [...x, r.id!]);
    setRegras((rs) => (rs || []).filter((_, j) => j !== i));
    setMudou(true);
  };
  const adicionar = () => {
    setRegras((rs) => {
      const lista = [...(rs || [])];
      const reserva = lista.findIndex((r) => r.padrao.trim() === "*");
      const nova: RegraProjeto = { padrao: "", etiqueta: "", ordem: 0, ativo: true };
      if (reserva >= 0) lista.splice(reserva, 0, nova);
      else lista.push(nova);
      return lista.map((r, k) => ({ ...r, ordem: r.padrao.trim() === "*" ? 999 : (k + 1) * 10 }));
    });
    setMudou(true);
  };

  const salvar = async () => {
    if (!regras) return;
    setSalvando(true);
    try {
      const ordenadas = regras.map((r, k) => ({ ...r, ordem: r.padrao.trim() === "*" ? 999 : (k + 1) * 10 }));
      const n = await salvarRegras(ordenadas, removidas);
      setRemovidas([]);
      setMudou(false);
      setRegras(await listarRegras());
      toast({ title: "Regras salvas", description: n ? `${n} lead(s) mudaram de etiqueta e entram na fila do WhatsApp.` : "Nenhum lead mudou de etiqueta." });
    } catch (e: any) {
      toast({ title: "Não consegui salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    try {
      setResultadoTeste(await resolverEtiquetaProjeto(teste));
    } catch (e: any) {
      toast({ title: "Não consegui testar", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-card space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Tags className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-lg leading-tight">Etiquetas de projeto</h2>
          <p className="text-sm text-muted-foreground">
            Qual etiqueta do WhatsApp cada lead recebe pelo <b>projeto de origem</b>. O Inmovya Scale só <b>adiciona</b> essa etiqueta (não mexe em 20%, 50%, Lead, Bitrix…).
          </p>
        </div>
      </div>

      {faltaSql ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm flex gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <p>
            Falta um passo no Supabase: abra o SQL Editor, cole o arquivo <code>supabase/projeto_etiquetas.sql</code> e clique em Run.
          </p>
        </div>
      ) : !regras ? (
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
      ) : (
        <>
          <div className="text-xs text-muted-foreground rounded-lg bg-muted/50 p-3 leading-relaxed">
            <b>Como escrever o padrão</b> (maiúsculas, acentos e hífens não importam): <code>collection + vila mariana</code> = precisa ter as duas;{" "}
            <code>sarutai | saruutai</code> = qualquer uma; <code>*</code> = qualquer outro projeto (etiqueta reserva). Vale a primeira regra da lista que
            casar. Projeto com <code>/</code> recebe a etiqueta de cada parte.
          </div>

          <div className="space-y-2">
            {regras.map((r, i) => {
              const reserva = r.padrao.trim() === "*";
              const falta = r.etiqueta.trim() && !existeNoWhats(r.etiqueta);
              return (
                <div key={r.id || `n${i}`} className={`rounded-xl border p-2.5 ${reserva ? "bg-muted/40" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{reserva ? "Qualquer outro" : "Projeto contém"}</span>
                    <Input
                      className="h-9 flex-1 min-w-[160px]"
                      value={r.padrao}
                      placeholder="ex.: collection + vila mariana"
                      onChange={(e) => mudar(i, { padrao: e.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      className="h-9 flex-1 min-w-[160px]"
                      value={r.etiqueta}
                      placeholder="etiqueta exata do WhatsApp"
                      onChange={(e) => mudar(i, { etiqueta: e.target.value })}
                    />
                    <div className="flex items-center gap-1">
                      <Switch checked={r.ativo} onCheckedChange={(v) => mudar(i, { ativo: v })} title="Ativa" />
                      {!reserva && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mover(i, -1)} title="Subir">
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mover(i, 1)} title="Descer">
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remover(i)} title="Remover regra">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {falta && (
                    <p className="text-xs text-warning mt-1.5 ml-1">
                      A etiqueta "{r.etiqueta}" não está no seu WhatsApp. Crie com esse nome exato no WhatsApp Business (o Inmovya não cria sozinho); até lá
                      usa a etiqueta reserva.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={adicionar}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar projeto
            </Button>
            <Button onClick={salvar} disabled={!mudou || salvando}>
              {salvando ? "Salvando…" : "Salvar regras"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-sm font-semibold">Testar:</span>
            <Input
              className="h-9 flex-1 min-w-[200px]"
              value={teste}
              placeholder="digite um projeto, ex.: The Collection - Vila Mariana"
              onChange={(e) => {
                setTeste(e.target.value);
                setResultadoTeste(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && testar()}
            />
            <Button variant="outline" size="sm" onClick={testar} disabled={!teste.trim()}>
              Ver etiqueta
            </Button>
            {resultadoTeste && (
              <span className="text-sm">
                {resultadoTeste.length ? resultadoTeste.map((e) => <b key={e} className="mr-2 rounded-md bg-primary/10 text-primary px-1.5 py-0.5">{e}</b>) : "nenhuma etiqueta"}
              </span>
            )}
          </div>
          {mudou && <p className="text-xs text-muted-foreground">O teste usa as regras salvas — salve antes de testar uma mudança.</p>}

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-1">Sincronizar com o WhatsApp</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Confere todos os leads com projeto e põe no WhatsApp a etiqueta que estiver faltando. Não manda mensagem e não cria conversa.
              {doWhats.em && ` Etiquetas do WhatsApp lidas em ${new Date(doWhats.em).toLocaleString("pt-BR")}.`}
            </p>
            <SincronizarEtiquetasProjeto />
          </div>
        </>
      )}
    </section>
  );
}
