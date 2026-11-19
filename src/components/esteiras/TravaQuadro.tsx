// Trava de Engajamento na tela das Esteiras:
// - TravaPainel: resumo do dia (todas as esteiras + disparo), limite de ignorados, Retomar e "Testar travas".
// - TravaQuadroEsteira: o quadrinho de uma esteira (Enviados | Responderam | Ignoraram | Taxa | 🟢🟡🔴).
// - TravaConfigEsteira: os números da trava desta esteira (fica junto das pausas, nas Configurações da esteira).
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlaskConical, Play, RotateCcw, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  getTravaEsteira,
  origemEsteira,
  setTravaEsteira,
  travaLimiteDia,
  travaRetomar,
  travaStatus,
  travaTeste,
  type TravaCfg,
  type TravaOrigem,
  type TravaPode,
  type TravaStatus,
} from "@/lib/trava";

const COR: Record<string, { bola: string; txt: string; classe: string }> = {
  verde: { bola: "🟢", txt: "normal", classe: "text-success" },
  amarelo: { bola: "🟡", txt: "intervalo dobrado", classe: "text-amber-600 dark:text-amber-400" },
  vermelho: { bola: "🔴", txt: "pausado", classe: "text-red-600 dark:text-red-400" },
  medindo: { bola: "⚪", txt: "medindo…", classe: "text-muted-foreground" },
  desligada: { bola: "⚫", txt: "trava desligada", classe: "text-muted-foreground" },
};

/** Lê o status da trava na extensão a cada 20 s (e quando alguém pede para atualizar). */
export function useTravaStatus(teste = false) {
  const [status, setStatus] = useState<TravaStatus | null>(null);
  const [semExtensao, setSemExtensao] = useState(false);
  const atualizar = useCallback(async () => {
    const s = await travaStatus(teste);
    setSemExtensao(!s);
    if (s) setStatus(s);
  }, [teste]);
  useEffect(() => {
    atualizar();
    const t = window.setInterval(atualizar, 20000);
    const ouvir = () => atualizar();
    window.addEventListener("inmovya-trava-mudou", ouvir);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("inmovya-trava-mudou", ouvir);
    };
  }, [atualizar]);
  return { status, semExtensao, atualizar };
}
export const avisarTravaMudou = () => window.dispatchEvent(new Event("inmovya-trava-mudou"));

function Numeros({ o, cfg }: { o?: TravaOrigem; cfg: TravaCfg }) {
  const n = o?.numeros || { enviados: 0, responderam: 0, ignoraram: 0, taxa: null, maduras: 0, respondeuTotal: 0 };
  const chave = !cfg.ligada ? "desligada" : o?.pausa ? "vermelho" : o?.status || "medindo";
  const c = COR[chave];
  const caixa = (valor: ReactNode, rotulo: string) => (
    <div className="rounded-lg bg-muted/60 px-1.5 py-1.5 text-center min-w-0">
      <div className="text-base font-extrabold leading-tight">{valor}</div>
      <div className="text-[10.5px] text-muted-foreground truncate">{rotulo}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {caixa(n.enviados, "Enviados")}
      {caixa(n.responderam, "Responderam")}
      {caixa(n.ignoraram, "Ignoraram")}
      {caixa(n.taxa == null ? "—" : `${n.taxa}%`, "Taxa")}
      {caixa(c.bola, c.txt)}
    </div>
  );
}

function Motivo({ o, cfg, status, retomar }: { o?: TravaOrigem; cfg: TravaCfg; status: TravaStatus | null; retomar: (alvo: string) => void }) {
  if (status?.alarme) return null; // o alarme aparece no painel geral
  if (status?.global) return null;
  if (o?.pausa)
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-red-700 dark:text-red-400">⏸️ {o.pausa.motivo}</span>
      </div>
    );
  if (!cfg.ligada) return <div className="text-[11px] text-muted-foreground">Trava desligada nesta esteira (o limite do dia e o alarme continuam valendo).</div>;
  if (o?.status === "amarelo")
    return <div className="text-[11px] text-amber-700 dark:text-amber-400">🟡 Poucas respostas: o tempo entre os envios desta esteira está dobrado até a próxima medição ({o.proximaMedicao} envios).</div>;
  const mad = o?.numeros.maduras || 0;
  if (mad < cfg.cada)
    return (
      <div className="text-[11px] text-muted-foreground">
        Medindo… só conta mensagem enviada há mais de {cfg.janelaMin} min (precisa de {cfg.cada}; tem {mad}).
      </div>
    );
  return null;
}

/** Quadrinho de uma esteira. */
export function TravaQuadroEsteira({ esteiraId, nome, status, onRetomar }: { esteiraId: string; nome: string; status: TravaStatus | null; onRetomar: (alvo: string) => void }) {
  const o = status?.origens?.[origemEsteira(esteiraId)];
  const cfg = getTravaEsteira(esteiraId);
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 ${o?.pausa ? "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30" : "bg-card"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold flex items-center gap-1.5 min-w-0">
          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
          <span className="truncate">Trava de engajamento — {nome}</span>
        </div>
        {o?.pausa && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onRetomar(origemEsteira(esteiraId))}>
            <RotateCcw className="w-3 h-3 mr-1" /> Retomar mesmo assim
          </Button>
        )}
      </div>
      <Numeros o={o} cfg={cfg} />
      <Motivo o={o} cfg={cfg} status={status} retomar={onRetomar} />
    </div>
  );
}

/** Configuração da trava desta esteira (fica nas Configurações da esteira, junto das pausas). */
export function TravaConfigEsteira({ esteiraId, nome }: { esteiraId: string; nome: string }) {
  const [cfg, setCfg] = useState<TravaCfg>(() => getTravaEsteira(esteiraId));
  useEffect(() => setCfg(getTravaEsteira(esteiraId)), [esteiraId]);
  const mudar = (c: Partial<TravaCfg>) => {
    setCfg(setTravaEsteira(esteiraId, c, nome));
    avisarTravaMudou();
  };
  const campo = (rotulo: string, k: keyof Omit<TravaCfg, "ligada">, min: number, max: number) => (
    <label className="grid gap-1 text-[11px] text-muted-foreground">
      {rotulo}
      <Input type="number" min={min} max={max} className="h-9 bg-card" value={cfg[k]} onChange={(e) => mudar({ [k]: parseInt(e.target.value) || 0 } as Partial<TravaCfg>)} />
    </label>
  );
  return (
    <div className="grid gap-2 sm:col-span-2 rounded-md border border-primary/25 bg-primary/[0.04] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Trava de engajamento desta esteira
        </Label>
        <Switch checked={cfg.ligada} onCheckedChange={(v) => mudar({ ligada: v })} aria-label="Ligar trava de engajamento" />
      </div>
      {cfg.ligada ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {campo("Normal a partir de (%)", "verde", 1, 100)}
            {campo("Abaixo de (%) pausa", "amarelo", 0, 100)}
            {campo("Medir a cada (envios)", "cada", 3, 100)}
            {campo("Esperar resposta (min)", "janelaMin", 10, 1440)}
          </div>
          <span className="text-[11px] text-muted-foreground">
            A cada {cfg.cada} envios mede quantos responderam (só conta mensagem com mais de {cfg.janelaMin} min). {cfg.verde}% ou mais: normal. Entre {cfg.amarelo}% e {cfg.verde}%: o tempo entre os
            envios dobra. Abaixo de {cfg.amarelo}%: esta esteira pausa até amanhã. Salva na hora.
          </span>
        </>
      ) : (
        <span className="text-[11px] text-muted-foreground">Desligada: esta esteira não é medida. O limite do dia e o alarme continuam protegendo o número.</span>
      )}
    </div>
  );
}

/** Painel geral: alarme, pausa geral, limite de ignorados do dia, resumo por esteira/disparo e o modo de teste. */
export function TravaPainel({ esteiras }: { esteiras: { id: string; nome: string }[] }) {
  const { status, semExtensao, atualizar } = useTravaStatus();
  const [limite, setLimite] = useState<string>("");
  const [testeAberto, setTesteAberto] = useState(false);
  useEffect(() => {
    if (status && limite === "") setLimite(String(status.limiteDia));
  }, [status, limite]);

  const retomar = async (alvo: string) => {
    await travaRetomar(alvo);
    atualizar();
  };
  const salvarLimite = async () => {
    const n = parseInt(limite);
    if (!Number.isFinite(n)) return;
    await travaLimiteDia(n);
    atualizar();
  };

  if (semExtensao && !status)
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" /> Trava de engajamento: não achei o Inmovya Scale 1.29 neste Chrome. Atualize a extensão para ligar a proteção.
      </div>
    );

  const disparo = status?.origens?.disparo;
  const ign = status?.ignoradosHoje ?? 0;
  const lim = status?.limiteDia ?? 15;
  const pct = Math.min(100, Math.round((ign / Math.max(1, lim)) * 100));
  const travado = !!(status?.alarme || status?.global);

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${travado ? "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30" : "bg-card"}`}>
      <div className="flex flex-wrap items-center gap-3">
        {travado ? <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" /> : <ShieldCheck className="w-5 h-5 text-success shrink-0" aria-hidden="true" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold">Trava de engajamento</div>
          <div className="text-xs text-muted-foreground">Freia as esteiras e o disparo quando muita gente ignora as mensagens. O 1º contato de lead novo não entra na conta.</div>
        </div>
        <Button variant="outline" className="h-9 px-3 text-sm" onClick={() => setTesteAberto(true)}>
          <FlaskConical className="w-4 h-4 mr-1.5" /> Testar travas
        </Button>
      </div>

      {status?.alarme && (
        <div className="rounded-xl border border-red-300 bg-red-100/70 dark:bg-red-950/50 dark:border-red-900 p-3 flex flex-col gap-2">
          <div className="text-sm font-bold text-red-800 dark:text-red-300">⚠️ Todos os envios automáticos estão pausados (inclusive o 1º contato)</div>
          <div className="text-xs">{status.alarme.motivo}</div>
          <Button className="h-9 self-start bg-success hover:bg-success/90 text-success-foreground" onClick={() => retomar("alarme")}>
            <Play className="w-4 h-4 mr-1.5" /> Retomar
          </Button>
        </div>
      )}
      {!status?.alarme && status?.global && (
        <div className="rounded-xl border border-red-300 bg-red-100/70 dark:bg-red-950/50 dark:border-red-900 p-3 flex flex-col gap-2">
          <div className="text-sm font-bold text-red-800 dark:text-red-300">⏸️ Esteiras e disparo pausados até amanhã</div>
          <div className="text-xs">{status.global.motivo}</div>
          <Button variant="outline" className="h-9 self-start" onClick={() => retomar("global")}>
            <RotateCcw className="w-4 h-4 mr-1.5" /> Retomar mesmo assim
          </Button>
        </div>
      )}

      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            Ignorados hoje (todas as esteiras + disparo): <b>{ign}</b> de <b>{lim}</b>
          </span>
          <span className="flex items-center gap-1.5">
            Limite do dia
            <Input type="number" min={3} max={500} className="h-8 w-20" value={limite} onChange={(e) => setLimite(e.target.value)} onBlur={salvarLimite} onKeyDown={(e) => e.key === "Enter" && salvarLimite()} />
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
          <div className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-success"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-muted-foreground">No limite, tudo pausa até amanhã. "Ignorou" = não respondeu depois do tempo de espera de cada esteira.</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {esteiras.map((e) => (
          <TravaQuadroEsteira key={e.id} esteiraId={e.id} nome={e.nome} status={status} onRetomar={retomar} />
        ))}
        <div className={`rounded-xl border p-3 flex flex-col gap-2 ${disparo?.pausa ? "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30" : "bg-card"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Trava de engajamento — Disparo (Scale)
            </div>
            {disparo?.pausa && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => retomar("disparo")}>
                <RotateCcw className="w-3 h-3 mr-1" /> Retomar mesmo assim
              </Button>
            )}
          </div>
          <Numeros o={disparo} cfg={disparo?.cfg || { ligada: true, verde: 40, amarelo: 20, cada: 10, janelaMin: 60 }} />
          {disparo?.pausa ? (
            <div className="text-xs font-semibold text-red-700 dark:text-red-400">⏸️ {disparo.pausa.motivo}</div>
          ) : (
            <div className="text-[11px] text-muted-foreground">Os números do disparo se ajustam no próprio Disparo, no WhatsApp Web (seção Proteção contra bloqueio).</div>
          )}
        </div>
      </div>

      <TesteTravas aberto={testeAberto} onFechar={() => setTesteAberto(false)} />
    </div>
  );
}

// ---------------- Modo de teste ----------------
// Usa um registro separado: não envia nada no WhatsApp e não mexe nos números de verdade.
function TesteTravas({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [st, setSt] = useState<(TravaStatus & { simulados?: number; depois?: TravaPode; primeiroContato?: TravaPode }) | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const rodar = async (dados: Parameters<typeof travaTeste>[0], titulo: string) => {
    setOcupado(true);
    const r = await travaTeste(dados);
    setOcupado(false);
    if (!r) {
      setLog((l) => [`❌ ${titulo}: a extensão não respondeu (precisa da versão 1.29).`, ...l]);
      return;
    }
    setSt(r);
    const d = r.depois;
    let res = "";
    if (d) res = d.pode ? (d.fator && d.fator > 1 ? "→ 🟡 continua, mas com intervalo DOBRADO" : "→ 🟢 continua normal") : `→ 🔴 BLOQUEADO: ${d.motivo}`;
    if (r.primeiroContato) res += ` · 1º contato: ${r.primeiroContato.pode ? "liberado ✅" : "bloqueado ⛔"}`;
    setLog((l) => [`${titulo}${r.simulados != null ? ` (${r.simulados} envios simulados)` : ""} ${res}`.trim(), ...l].slice(0, 12));
  };
  useEffect(() => {
    if (aberto) rodar({ op: "zerar" }, "🧹 Teste zerado");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const o = st?.origens?.["teste-esteira"];
  const od = st?.origens?.["teste-disparo"];
  const botao = (rotulo: string, dados: Parameters<typeof travaTeste>[0], titulo = rotulo, variante: "outline" | "default" = "outline") => (
    <Button variant={variante} className="h-auto min-h-9 py-1.5 px-3 text-xs justify-start text-left whitespace-normal" disabled={ocupado} onClick={() => rodar(dados, titulo)}>
      {rotulo}
    </Button>
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" /> Testar travas (simulação)
          </DialogTitle>
          <DialogDescription>Nada é enviado no WhatsApp e os seus números de verdade não mudam. Siga a ordem: 1, 2 e 3.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="text-sm font-bold">1 · Termômetro (uma esteira de teste)</div>
            <div className="grid sm:grid-cols-3 gap-2">
              {botao("Simular 10 envios — 5 respondem (50%)", { op: "envios", origem: "teste-esteira", qtd: 10, responder: 50 }, "10 envios, 50% responderam")}
              {botao("Simular 10 envios — 3 respondem (30%)", { op: "envios", origem: "teste-esteira", qtd: 10, responder: 30 }, "10 envios, 30% responderam")}
              {botao("Simular 10 envios — 1 responde (10%)", { op: "envios", origem: "teste-esteira", qtd: 10, responder: 10 }, "10 envios, 10% responderam")}
            </div>
            <span className="text-[11px] text-muted-foreground">
              Cada clique recomeça a esteira de teste, simula 10 envios (com mais de 1 h) e mede. 50% = 🟢 normal · 30% = 🟡 intervalo dobrado · 10% = 🔴 pausa até amanhã.
            </span>
            {o && (
              <TravaQuadroEsteiraTeste o={o} />
            )}
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-bold">2 · Limite do dia (soma de todas)</div>
            {botao(`Simular envios em 2 esteiras até somar ${st?.limiteDia ?? 15} ignorados`, { op: "limite" }, "Limite do dia")}
            {st && (
              <div className="text-xs">
                Ignorados hoje (teste): <b>{st.ignoradosHoje}</b> de <b>{st.limiteDia}</b>
                {od ? ` · disparo de teste: ${od.numeros.enviados} enviados` : ""}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-bold">3 · Alarme (pausa tudo, só volta clicando em Retomar)</div>
            <div className="grid sm:grid-cols-3 gap-2">
              {botao("Simular aviso do WhatsApp", { op: "aviso" }, "Aviso do WhatsApp")}
              {botao("Simular 5 mensagens com 1 tracinho", { op: "tracinho" }, "5 com 1 tracinho")}
              {botao("Simular erro de envio", { op: "erro" }, "Erro de envio")}
            </div>
            {botao("Tentar enviar agora (esteira e 1º contato)", { op: "tentar", origem: "teste-esteira" }, "Tentativa de envio")}
          </div>

          {st && (st.alarme || st.global || Object.values(st.origens || {}).some((x) => x.pausa)) && (
            <div className="rounded-xl border border-red-300 bg-red-50/70 dark:bg-red-950/40 dark:border-red-900 p-3 grid gap-1.5 text-xs">
              {st.alarme && <div className="font-semibold">⚠️ {st.alarme.motivo}</div>}
              {st.global && <div className="font-semibold">⏸️ {st.global.motivo}</div>}
              {Object.entries(st.origens || {})
                .filter(([, x]) => x.pausa)
                .map(([k, x]) => (
                  <div key={k}>
                    ⏸️ <b>{x.nome}</b>: {x.pausa?.motivo}
                  </div>
                ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 bg-success hover:bg-success/90 text-success-foreground"
                  disabled={ocupado}
                  onClick={async () => {
                    await travaRetomar("tudo", true);
                    rodar({ op: "status" }, "▶️ Retomado (teste)");
                  }}
                >
                  <Play className="w-3.5 h-3.5 mr-1" /> Retomar
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold">O que aconteceu</div>
            <Button size="sm" variant="ghost" className="h-8" disabled={ocupado} onClick={() => { setLog([]); rodar({ op: "zerar" }, "🧹 Teste zerado"); }}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Zerar
            </Button>
          </div>
          <div className="rounded-lg border bg-muted/40 p-2 text-xs grid gap-1 min-h-12">
            {log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <span className="text-muted-foreground">Clique em um dos botões acima.</span>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TravaQuadroEsteiraTeste({ o }: { o: TravaOrigem }) {
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 ${o.pausa ? "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30" : "bg-card"}`}>
      <div className="text-xs font-bold">{o.nome}</div>
      <Numeros o={o} cfg={o.cfg} />
      {o.pausa && <div className="text-xs font-semibold text-red-700 dark:text-red-400">⏸️ {o.pausa.motivo}</div>}
      {!o.pausa && o.status === "amarelo" && <div className="text-[11px] text-amber-700 dark:text-amber-400">🟡 Intervalo entre envios dobrado.</div>}
    </div>
  );
}
