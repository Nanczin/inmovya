import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Bot, CheckCircle2, Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { checarExtensao, extensaoAtualizada, versaoExtensao } from "@/lib/esteiras";
import { lerChaveGemini, salvarChaveGemini, testarChaveGemini } from "@/lib/iaGratis";
import {
  ConfigPrimeiroContato,
  INSTRUCOES_PADRAO,
  MENSAGEM_RESERVA_PADRAO,
  PassoTeste,
  RegistroContato,
  SinalAgente,
  VERSAO_SCALE_AGENTE,
  carregarConfigAgente,
  entregarParaExtensao,
  exemploDeMensagem,
  lerHistoricoAgente,
  salvarChaveNoAgente,
  salvarConfigAgente,
  testarEnvio,
} from "@/lib/primeiroContato";

const hora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const COR: Record<string, string> = {
  enviado: "bg-green-50 text-green-700 border-green-200",
  enviando: "bg-blue-50 text-blue-700 border-blue-200",
  pulado: "bg-gray-50 text-gray-600 border-gray-200",
  erro: "bg-red-50 text-red-700 border-red-200",
};

export function PrimeiroContatoPainel() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<ConfigPrimeiroContato | null>(null);
  const [sinal, setSinal] = useState<SinalAgente | null>(null);
  const [erroBanco, setErroBanco] = useState("");
  const [historico, setHistorico] = useState<RegistroContato[]>([]);
  const [extensao, setExtensao] = useState<{ ok: boolean; atual: boolean; versao: string | null } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [chave, setChave] = useState("");
  const [chaveOk, setChaveOk] = useState<boolean | null>(null);
  const [testandoChave, setTestandoChave] = useState(false);
  const [exemplo, setExemplo] = useState<{ texto: string; via: string; aviso?: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [telTeste, setTelTeste] = useState("");
  const [testandoEnvio, setTestandoEnvio] = useState(false);
  const [passosTeste, setPassosTeste] = useState<PassoTeste[]>([]);

  const recarregar = useCallback(async () => {
    try {
      const r = await carregarConfigAgente();
      setCfg((atual) => (atual && alterado ? atual : r.cfg));
      setSinal(r.sinal);
      setErroBanco("");
    } catch (e: any) {
      setErroBanco(e?.message || "Não consegui ler a configuração do agente.");
      setCfg((atual) => atual);
    }
    setHistorico(await lerHistoricoAgente());
  }, [alterado]);

  useEffect(() => {
    recarregar();
    const t = window.setInterval(recarregar, 30_000);
    return () => window.clearInterval(t);
  }, [recarregar]);

  useEffect(() => {
    lerChaveGemini().then((k) => {
      setChave(k);
      if (k) setChaveOk(true);
    });
    checarExtensao().then((ok) => setExtensao({ ok, atual: ok && extensaoAtualizada(VERSAO_SCALE_AGENTE), versao: versaoExtensao }));
  }, []);

  const mudar = (p: Partial<ConfigPrimeiroContato>) => {
    setCfg((c) => (c ? { ...c, ...p } : c));
    setAlterado(true);
  };

  const salvar = async (p: Partial<ConfigPrimeiroContato> = {}, aviso?: { title: string; description?: string }) => {
    if (!cfg) return;
    setSalvando(true);
    try {
      const novo = await salvarConfigAgente({ ...cfg, ...p });
      setCfg(novo);
      setAlterado(false);
      const entregue = extensao?.atual ? await entregarParaExtensao(novo.ativo) : false;
      toast({
        title: aviso?.title || "Configuração salva",
        description: [aviso?.description, novo.ativo && !entregue && `Atualize o Inmovya Scale para a versão ${VERSAO_SCALE_AGENTE} (chrome://extensions → Recarregar).`]
          .filter(Boolean)
          .join(" "),
        variant: novo.ativo && !entregue ? "destructive" : undefined,
      });
      recarregar();
    } catch (e: any) {
      toast({ title: "Não consegui salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const ligar = (v: boolean) => {
    if (!cfg) return;
    if (v && !cfg.meuNome.trim()) {
      toast({ title: "Preencha o seu nome", description: "O agente se apresenta com ele na mensagem.", variant: "destructive" });
      return;
    }
    if (v && cfg.usarIA && !chave.trim()) {
      toast({ title: "Sem chave do Gemini", description: "Vou usar a mensagem reserva até você colocar a chave grátis do Gemini." });
    }
    salvar(
      { ativo: v },
      v
        ? { title: "1º contato automático ligado", description: "Vale para os leads que chegarem a partir de agora. Pode fechar o Inmovya: a extensão continua." }
        : { title: "1º contato automático desligado" }
    );
  };

  const testarChave = async () => {
    if (!chave.trim()) return;
    setTestandoChave(true);
    try {
      const ok = await testarChaveGemini(chave);
      setChaveOk(ok);
      if (ok) {
        await salvarChaveGemini(chave);
        await salvarChaveNoAgente(chave);
      }
      toast({
        title: ok ? "Gemini conectado e chave salva" : "Chave do Gemini inválida",
        description: ok ? "O agente vai escrever as mensagens com a IA grátis do Google." : "Confira a chave criada no Google AI Studio.",
        variant: ok ? undefined : "destructive",
      });
    } catch {
      setChaveOk(false);
      toast({ title: "Não foi possível testar o Gemini", variant: "destructive" });
    } finally {
      setTestandoChave(false);
    }
  };

  if (erroBanco && !cfg) {
    return <div className="max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{erroBanco}</div>;
  }
  if (!cfg) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
      </div>
    );
  }

  // a extensão confere a cada minuto: sem sinal há mais de 3 min = parada (Chrome fechado, PC dormindo, extensão antiga)
  const minutosSemSinal = sinal?.ultimoSinal ? (Date.now() - new Date(sinal.ultimoSinal).getTime()) / 60_000 : Infinity;
  const extensaoRodando = minutosSemSinal < 3;
  const enviadosHoje = historico.filter((r) => r.status === "enviado" && r.em && new Date(r.em).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-4">
      {/* Liga/desliga */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold flex items-center gap-2">
              <Bot className="w-5 h-5" /> 1º contato automático
            </h2>
            <p className="text-sm text-muted-foreground">
              Lead novo entrou → em 1 a 2 minutos ele recebe a primeira mensagem no WhatsApp, escrita pela IA grátis do Google. 24 horas por dia,
              sem custo.
            </p>
          </div>
          <Switch checked={cfg.ativo} disabled={salvando} onCheckedChange={ligar} />
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            Quem envia é o <b>Inmovya Scale</b>: funciona com o Inmovya <b>fechado</b>. Precisa só do Chrome aberto (pode ficar minimizado), do WhatsApp
            Web conectado e do computador sem entrar em suspensão. Com o computador desligado, os leads esperam e são atendidos quando ele voltar
            (até 3 dias).
          </div>
          <div>
            Nunca manda duas vezes: o banco reserva cada lead para um envio só, confere se o mesmo número já recebeu e, antes de enviar, a extensão lê a
            conversa no WhatsApp — se já existe mensagem sua, pula.
          </div>
        </div>
        {extensao && !extensao.atual && (
          <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {extensao.ok
              ? `Este Chrome está com o Inmovya Scale ${extensao.versao || "antigo"}. O agente precisa da ${VERSAO_SCALE_AGENTE}: abra chrome://extensions e clique em Recarregar no Inmovya Scale; depois recarregue esta página.`
              : "Inmovya Scale não encontrado neste Chrome."}
          </div>
        )}
        {cfg.ativo && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {sinal?.aviso ? (
              <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" /> {sinal.aviso}
              </span>
            ) : extensaoRodando ? (
              <span className="flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Extensão ligada — esperando lead novo
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                {sinal?.ultimoSinal
                  ? `A extensão não confere desde ${hora(sinal.ultimoSinal)} (Chrome fechado, computador dormindo ou extensão desatualizada)`
                  : "A extensão ainda não conferiu nenhuma vez — recarregue o Inmovya Scale em chrome://extensions"}
              </span>
            )}
            {sinal?.ultimoSinal && extensaoRodando && <span className="text-muted-foreground">conferido às {hora(sinal.ultimoSinal)}</span>}
            <span className="text-muted-foreground">· {enviadosHoje} enviado(s) hoje</span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => entregarParaExtensao(true).then(() => setTimeout(recarregar, 3000))}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Conferir agora
            </Button>
          </div>
        )}
      </div>

      {/* Configuração */}
      <div className="rounded-lg border bg-white p-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pc-nome">Seu nome (o agente se apresenta com ele)</Label>
          <Input id="pc-nome" value={cfg.meuNome} placeholder="Ex.: Estevão" onChange={(e) => mudar({ meuNome: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pc-chave" className="flex items-center gap-1">
            Chave do Google Gemini (grátis)
            {chaveOk && <CheckCircle2 className="w-4 h-4 text-green-600" />}
          </Label>
          <div className="flex gap-2">
            <Input
              id="pc-chave"
              type="password"
              value={chave}
              placeholder="AIza..."
              onChange={(e) => {
                setChave(e.target.value.trim());
                setChaveOk(null);
              }}
            />
            <Button variant="outline" onClick={testarChave} disabled={testandoChave || !chave.trim()}>
              {testandoChave ? <Loader2 className="w-4 h-4 animate-spin" /> : "Testar e salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Crie de graça em{" "}
            <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>{" "}
            (entre com sua conta Google → "Create API key"). Sem cartão.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Quais leads</Label>
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" className="h-4 w-4" checked={cfg.quais === "captura"} onChange={() => mudar({ quais: "captura" })} />
              Só da captura automática (Meta Ads, Bitrix, formulários)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" className="h-4 w-4" checked={cfg.quais === "todos"} onChange={() => mudar({ quais: "todos" })} />
              Todos os leads novos (inclusive cadastrados à mão)
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Quem escreve</Label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={cfg.usarIA} onCheckedChange={(v) => mudar({ usarIA: v })} />
            {cfg.usarIA ? "IA (Gemini) escreve uma mensagem para cada lead" : "Sempre a mensagem reserva (sem IA)"}
          </label>
        </div>

        {cfg.usarIA && (
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pc-instr">Instruções para a IA</Label>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => mudar({ instrucoes: INSTRUCOES_PADRAO })}>
                <RotateCcw className="w-3 h-3 mr-1" /> Padrão
              </Button>
            </div>
            <Textarea id="pc-instr" rows={4} value={cfg.instrucoes} onChange={(e) => mudar({ instrucoes: e.target.value })} />
          </div>
        )}

        <div className="space-y-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pc-reserva">Mensagem reserva {cfg.usarIA && "(se a IA não responder)"}</Label>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => mudar({ mensagemReserva: MENSAGEM_RESERVA_PADRAO })}>
              <RotateCcw className="w-3 h-3 mr-1" /> Padrão
            </Button>
          </div>
          <Textarea id="pc-reserva" rows={3} value={cfg.mensagemReserva} onChange={(e) => mudar({ mensagemReserva: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            Variáveis: {"{{nome}}"}, {"{{saudacao}}"}, {"{{meu_nome}}"}, {"{{empreendimento}}"}
          </p>
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          <Button onClick={() => salvar()} disabled={salvando || !alterado}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Salvar configuração
          </Button>
          {alterado && <span className="text-xs text-amber-700">alterações ainda não salvas</span>}
          <Button
            variant="outline"
            onClick={async () => {
              setGerando(true);
              try {
                setExemplo(await exemploDeMensagem(cfg));
              } finally {
                setGerando(false);
              }
            }}
            disabled={gerando}
          >
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Ver exemplo (não envia nada)
          </Button>
        </div>
        {exemplo && (
          <div className="md:col-span-2 rounded-lg border bg-green-50/50 p-3 text-sm space-y-1">
            <div className="whitespace-pre-wrap">{exemplo.texto}</div>
            <div className="text-xs text-muted-foreground">
              Lead de exemplo: Mariana Souza, Residencial Jardim das Flores · escrito por: {exemplo.via}
              {exemplo.aviso && ` (${exemplo.aviso})`}
            </div>
          </div>
        )}
      </div>

      {/* Teste */}
      <div className="rounded-lg border bg-white p-4 space-y-2">
        <h3 className="font-semibold text-sm">Testar envio</h3>
        <p className="text-xs text-muted-foreground">
          Faz o caminho completo (lê a conversa → escreve com a IA → envia) para um número seu e mostra em qual passo parou. Não grava nada no Inmovya.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={telTeste} placeholder="Seu WhatsApp com DDD, ex.: 11 99999-9999" onChange={(e) => setTelTeste(e.target.value)} className="sm:w-72" />
          <Button
            variant="outline"
            disabled={testandoEnvio || !telTeste.trim()}
            onClick={async () => {
              setTestandoEnvio(true);
              setPassosTeste([]);
              try {
                await testarEnvio(telTeste, cfg, setPassosTeste);
              } finally {
                setTestandoEnvio(false);
              }
            }}
          >
            {testandoEnvio ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Testar envio
          </Button>
        </div>
        {passosTeste.length > 0 && (
          <ul className="text-sm space-y-1">
            {passosTeste.map((p) => (
              <li key={p.passo} className="flex gap-2">
                <span className="shrink-0">{p.ok === null ? "⏳" : p.ok ? "✅" : "❌"}</span>
                <span className="min-w-0 break-words">
                  <b>{p.passo}</b>
                  {p.detalhe && <span className="text-muted-foreground"> — {p.detalhe}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Histórico */}
      <div className="rounded-lg border bg-white p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Últimos atendimentos</h3>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={recarregar}>
            <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
          </Button>
        </div>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum ainda. Quando um lead novo chegar, ele aparece aqui.</p>
        ) : (
          <ul className="divide-y">
            {historico.map((r) => (
              <li key={r.leadId} className="py-2 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs rounded-full border px-2 py-0.5 ${COR[r.status] || ""}`}>{r.status}</span>
                  <span className="font-medium">{r.nome}</span>
                  <span className="text-xs text-muted-foreground">{r.telefone}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{hora(r.em)}</span>
                </div>
                {r.detalhe && <div className="text-xs text-muted-foreground">{r.detalhe}</div>}
                {r.texto && r.status === "enviado" && <div className="text-xs whitespace-pre-wrap rounded bg-muted/50 p-2">{r.texto}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
