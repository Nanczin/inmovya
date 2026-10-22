import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Bot, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { checarExtensao, extensaoAtualizada, versaoExtensao } from "@/lib/esteiras";
import {
  ConfigRobo,
  ConversaRobo,
  SinalRobo,
  VERSAO_SCALE_ROBO,
  carregarRobo,
  lerConversasRobo,
  salvarRobo,
  testarIA,
} from "@/lib/roboAnuncios";

const hora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const SITUACAO: Record<string, { txt: string; cor: string }> = {
  qualificando: { txt: "qualificando", cor: "bg-blue-50 text-blue-700 border-blue-200" },
  concluido: { txt: "qualificado", cor: "bg-green-50 text-green-700 border-green-200" },
  transferido: { txt: "passado para você", cor: "bg-amber-50 text-amber-700 border-amber-200" },
  ignorado: { txt: "não respondido", cor: "bg-gray-50 text-gray-600 border-gray-200" },
};

export function RoboAnunciosPainel() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<ConfigRobo | null>(null);
  const [sinal, setSinal] = useState<SinalRobo | null>(null);
  const [erroBanco, setErroBanco] = useState("");
  const [conversas, setConversas] = useState<ConversaRobo[]>([]);
  const [extensao, setExtensao] = useState<{ ok: boolean; atual: boolean; versao: string | null } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [testando, setTestando] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const r = await carregarRobo();
      setCfg((atual) => (atual && alterado ? atual : r.cfg));
      setSinal(r.sinal);
      setErroBanco("");
    } catch (e: any) {
      setErroBanco(e?.message || "Não consegui ler a configuração do robô.");
    }
    setConversas(await lerConversasRobo());
  }, [alterado]);

  useEffect(() => {
    recarregar();
    const t = window.setInterval(recarregar, 30_000);
    return () => window.clearInterval(t);
  }, [recarregar]);

  useEffect(() => {
    checarExtensao().then((ok) => setExtensao({ ok, atual: ok && extensaoAtualizada(VERSAO_SCALE_ROBO), versao: versaoExtensao }));
  }, []);

  const mudar = (p: Partial<ConfigRobo>) => {
    setCfg((c) => (c ? { ...c, ...p } : c));
    setAlterado(true);
  };

  const salvar = async (p: Partial<ConfigRobo> = {}, titulo = "Configuração do robô salva") => {
    if (!cfg) return;
    setSalvando(true);
    try {
      const novo = { ...cfg, ...p };
      const { entregue } = await salvarRobo(novo);
      setCfg(novo);
      setAlterado(false);
      const precisaAtualizar = novo.ativo && (!extensao?.atual || !entregue);
      toast({
        title: titulo,
        description: precisaAtualizar
          ? `A extensão não recebeu: atualize o Inmovya Scale para a versão ${VERSAO_SCALE_ROBO} (chrome://extensions → Recarregar) e abra esta tela de novo.`
          : novo.ativo
            ? "O robô confere as conversas novas a cada minuto. Deixe o WhatsApp Web aberto neste Chrome."
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

  const testar = async () => {
    if (!cfg?.iaChave.trim()) return;
    setTestando(true);
    try {
      const r = await testarIA(cfg.iaChave, cfg.iaModelo);
      toast({ title: "IA funcionando", description: r.slice(0, 200) });
    } catch (e: any) {
      toast({ title: "A IA não respondeu", description: e?.message, variant: "destructive" });
    } finally {
      setTestando(false);
    }
  };

  const minutosDesdeSinal = sinal?.ultimoSinal ? (Date.now() - new Date(sinal.ultimoSinal).getTime()) / 60000 : null;
  const extensaoViva = minutosDesdeSinal !== null && minutosDesdeSinal < 3;

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
            <Bot className="w-5 h-5" />
            <div>
              <div className="font-semibold">Robô de anúncios</div>
              <div className="text-xs text-muted-foreground">
                Qualifica no seu WhatsApp Business só quem é <b>lead novo de anúncio</b>: nunca falou com você, não está no Inmovya e mandou a
                mensagem do anúncio.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{cfg.ativo ? "Ligado" : "Desligado"}</span>
            <Switch checked={cfg.ativo} disabled={salvando} onCheckedChange={(v) => salvar({ ativo: v }, v ? "Robô de anúncios ligado" : "Robô de anúncios desligado")} />
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
              {extensaoViva ? `Extensão conferindo (última vez ${hora(sinal?.ultimoSinal)})` : sinal?.ultimoSinal ? `Extensão parada desde ${hora(sinal.ultimoSinal)} — o Chrome está aberto?` : "A extensão ainda não conferiu"}
            </span>
          )}
        </div>
        {sinal?.aviso && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {sinal.aviso}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Chave da IA (Groq — gratuita)</Label>
          <div className="flex gap-2">
            <Input type="password" autoComplete="off" placeholder="gsk_..." value={cfg.iaChave} onChange={(e) => mudar({ iaChave: e.target.value })} />
            <Button variant="outline" onClick={testar} disabled={!cfg.iaChave.trim() || testando}>
              {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Testar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Modelo aberto <code>{cfg.iaModelo}</code>. Crie a chave grátis em console.groq.com → API Keys. Sem chave, o robô segue o roteiro fixo
            de 5 perguntas. Com ou sem IA, preço, desconto, condições e financiamento sempre passam para você.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Frases da mensagem do anúncio (uma por linha)</Label>
          <Textarea rows={5} value={cfg.frases.join("\n")} onChange={(e) => mudar({ frases: e.target.value.split("\n") })} />
          <p className="text-xs text-muted-foreground">O robô só abre a conversa se a mensagem do lead tiver uma destas frases (sem acento, tanto faz maiúscula).</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Responder quem esperou até (horas)</Label>
            <Input type="number" min={1} max={72} value={cfg.recuperarHoras} onChange={(e) => mudar({ recuperarHoras: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">Ao abrir o Chrome, responde quem escreveu nesse período ("Desculpe a demora").</p>
          </div>
          <div className="space-y-1.5">
            <Label>Seu WhatsApp pessoal (recebe os avisos)</Label>
            <Input value={cfg.numeroAviso} onChange={(e) => mudar({ numeroAviso: e.target.value })} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => salvar()} disabled={!alterado || salvando}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Salvar
          </Button>
          <Button variant="outline" onClick={recarregar}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="font-semibold text-sm">Últimas conversas do robô</div>
        {!conversas.length ? (
          <p className="text-xs text-muted-foreground">Nenhuma ainda.</p>
        ) : (
          <div className="divide-y">
            {conversas.map((c) => (
              <div key={c.telefone} className="py-2 text-sm flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded border ${SITUACAO[c.situacao]?.cor || ""}`}>{SITUACAO[c.situacao]?.txt || c.situacao}</span>
                <a className="font-medium hover:underline" href={`https://wa.me/${c.telefone}`} target="_blank" rel="noreferrer">
                  {c.nome || `+${c.telefone}`}
                </a>
                <span className="text-xs text-muted-foreground">{hora(c.updated_at)}</span>
                {c.resultado_inmovya && <span className="text-xs text-muted-foreground">· {c.resultado_inmovya}</span>}
                {Object.keys(c.respostas || {}).length > 0 && (
                  <div className="w-full text-xs text-muted-foreground">
                    {Object.entries(c.respostas).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
