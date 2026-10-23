import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Loader2, Megaphone, RefreshCw } from "lucide-react";
import { checarExtensao, extensaoAtualizada, versaoExtensao } from "@/lib/esteiras";
import { ConfigRobo, ConversaRobo, SinalRobo, VERSAO_SCALE_ROBO, carregarRobo, lerConversasRobo, salvarRobo } from "@/lib/roboAnuncios";

const hora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const RESULTADO: Record<string, string> = {
  na_fila_whatsapp: "cadastrado (vai para Validação)",
  ja_na_fila: "já estava na fila",
  ja_cadastrado: "já era lead",
};

/** Cadastro automático dos leads de anúncio que chegam direto no WhatsApp (feito pela extensão Inmovya Scale). */
export function RoboAnunciosPainel() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<ConfigRobo | null>(null);
  const [sinal, setSinal] = useState<SinalRobo | null>(null);
  const [erroBanco, setErroBanco] = useState("");
  const [cadastrados, setCadastrados] = useState<ConversaRobo[]>([]);
  const [extensao, setExtensao] = useState<{ ok: boolean; atual: boolean; versao: string | null } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const r = await carregarRobo();
      setCfg((atual) => (atual && alterado ? atual : r.cfg));
      setSinal(r.sinal);
      setErroBanco("");
    } catch (e: any) {
      setErroBanco(e?.message || "Não consegui ler a configuração.");
    }
    setCadastrados((await lerConversasRobo()).filter((c) => c.situacao === "cadastrado"));
  }, [alterado]);

  useEffect(() => {
    recarregar();
    const t = window.setInterval(recarregar, 30_000);
    return () => window.clearInterval(t);
  }, [recarregar]);

  useEffect(() => {
    checarExtensao().then((ok) => setExtensao({ ok, atual: ok && extensaoAtualizada(VERSAO_SCALE_ROBO), versao: versaoExtensao }));
  }, []);

  const salvar = async (p: Partial<ConfigRobo> = {}, titulo = "Configuração salva") => {
    if (!cfg) return;
    setSalvando(true);
    try {
      // sem robô de conversa: nada de IA, modo teste ou tempo de resposta
      const novo = { ...cfg, ...p, testeNumero: "", testeDesde: null };
      const { entregue } = await salvarRobo(novo);
      setCfg(novo);
      setAlterado(false);
      const precisaAtualizar = novo.ativo && (!extensao?.atual || !entregue);
      toast({
        title: titulo,
        description: precisaAtualizar
          ? `A extensão não recebeu: atualize o Inmovya Scale para a versão ${VERSAO_SCALE_ROBO} (chrome://extensions → Recarregar) e abra esta tela de novo.`
          : novo.ativo
            ? "Deixe o WhatsApp Web aberto numa aba deste Chrome. Nenhuma mensagem é enviada: só o cadastro."
            : undefined,
        variant: precisaAtualizar ? "destructive" : undefined,
      });
      recarregar();
    } catch (e: any) {
      toast({ title: "Não consegui salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const minutos = sinal?.ultimoSinal ? (Date.now() - new Date(sinal.ultimoSinal).getTime()) / 60000 : null;
  const extensaoViva = minutos !== null && minutos < 3;

  if (erroBanco) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{erroBanco}</span>
      </div>
    );
  }
  if (!cfg) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            <div>
              <div className="font-semibold">Cadastro automático de leads de anúncio</div>
              <div className="text-xs text-muted-foreground">
                Quando alguém de anúncio escreve no seu WhatsApp (número não salvo, com a frase do anúncio e fora do Inmovya), a extensão
                cadastra no Inmovya. <b>Não manda nenhuma mensagem</b> — o atendimento é seu.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{cfg.ativo ? "Ligado" : "Desligado"}</span>
            <Switch
              checked={cfg.ativo}
              disabled={salvando}
              onCheckedChange={(v) => salvar({ ativo: v }, v ? "Cadastro automático ligado" : "Cadastro automático desligado")}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className={extensao?.atual ? "text-green-700" : "text-amber-700"}>
            {extensao === null
              ? "Procurando o Inmovya Scale…"
              : extensao.atual
                ? `Inmovya Scale ${extensao.versao} ✓`
                : `Inmovya Scale ${extensao.versao || "não encontrado"} — precisa da versão ${VERSAO_SCALE_ROBO}`}
          </span>
          {cfg.ativo && (
            <span className={extensaoViva ? "text-green-700" : "text-amber-700"}>
              {extensaoViva
                ? `Conferindo o WhatsApp (última vez ${hora(sinal?.ultimoSinal)})`
                : sinal?.ultimoSinal
                  ? `Parado desde ${hora(sinal.ultimoSinal)} — o Chrome está aberto?`
                  : "A extensão ainda não conferiu"}
            </span>
          )}
        </div>
        {sinal?.aviso && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {sinal.aviso}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Frases da mensagem do anúncio (uma por linha)</Label>
          <Textarea
            rows={5}
            value={cfg.frases.join("\n")}
            onChange={(e) => {
              setCfg({ ...cfg, frases: e.target.value.split("\n") });
              setAlterado(true);
            }}
          />
          <p className="text-xs text-muted-foreground">Só cadastra se a mensagem do lead tiver uma destas frases (sem acento, tanto faz maiúscula).</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => salvar()} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Salvar
          </Button>
          <Button variant="outline" onClick={recarregar}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="font-semibold text-sm">Últimos cadastrados pelo WhatsApp</div>
        {!cadastrados.length ? (
          <p className="text-xs text-muted-foreground">Nenhum ainda.</p>
        ) : (
          <div className="divide-y">
            {cadastrados.map((c) => (
              <div key={c.telefone} className="py-2 text-sm flex flex-wrap items-center gap-2">
                <a className="font-medium hover:underline" href={`https://wa.me/${c.telefone}`} target="_blank" rel="noreferrer">
                  +{c.telefone}
                </a>
                <span className="text-xs text-muted-foreground">{hora(c.updated_at)}</span>
                {c.resultado_inmovya && <span className="text-xs text-muted-foreground">· {RESULTADO[c.resultado_inmovya] || c.resultado_inmovya}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
