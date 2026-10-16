import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Bot, CheckCircle2, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { getMeuNome, setMeuNome } from "@/lib/esteiras";
import { lerChaveGemini, salvarChaveGemini, testarChaveGemini } from "@/lib/iaGratis";
import {
  ConfigPrimeiroContato,
  PassoTeste,
  testarEnvio,
  INSTRUCOES_PADRAO,
  MENSAGEM_RESERVA_PADRAO,
  agendarRodada,
  assinarPrimeiroContato,
  exemploDeMensagem,
  getConfigPrimeiroContato,
  lerEstadoPrimeiroContato,
  limparLogPrimeiroContato,
  setConfigPrimeiroContato,
} from "@/lib/primeiroContato";

const hora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const COR: Record<string, string> = {
  enviado: "bg-green-50 text-green-700 border-green-200",
  enviando: "bg-blue-50 text-blue-700 border-blue-200",
  pulado: "bg-gray-50 text-gray-600 border-gray-200",
  ignorado: "bg-amber-50 text-amber-700 border-amber-200",
  erro: "bg-red-50 text-red-700 border-red-200",
};

export function PrimeiroContatoPainel() {
  const { toast } = useToast();
  const estado = useSyncExternalStore(assinarPrimeiroContato, lerEstadoPrimeiroContato);
  const [cfg, setCfg] = useState<ConfigPrimeiroContato>(getConfigPrimeiroContato);
  const [meuNome, setMeuNomeLocal] = useState(getMeuNome);
  const [chave, setChave] = useState("");
  const [chaveOk, setChaveOk] = useState<boolean | null>(null);
  const [testando, setTestando] = useState(false);
  const [exemplo, setExemplo] = useState<{ texto: string; via: string; aviso?: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [, setRelogio] = useState(0);
  const [telTeste, setTelTeste] = useState("");
  const [testando, setTestando] = useState(false);
  const [passosTeste, setPassosTeste] = useState<PassoTeste[]>([]);

  useEffect(() => {
    lerChaveGemini().then((k) => {
      setChave(k);
      if (k) setChaveOk(true);
    });
  }, []);

  // contagem até o próximo envio
  useEffect(() => {
    if (!estado.proximoEnvioEm) return;
    const t = window.setInterval(() => setRelogio((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [estado.proximoEnvioEm]);

  const salvar = (p: Partial<ConfigPrimeiroContato>) => {
    const novo = { ...getConfigPrimeiroContato(), ...p };
    setConfigPrimeiroContato(novo);
    setCfg(getConfigPrimeiroContato());
  };

  const ligar = (v: boolean) => {
    if (v && !meuNome.trim()) {
      toast({ title: "Preencha o seu nome", description: "O agente se apresenta com ele na mensagem.", variant: "destructive" });
      return;
    }
    if (v && cfg.usarIA && !chave.trim()) {
      toast({ title: "Sem chave do Gemini", description: "Vou usar a mensagem reserva até você colocar a chave grátis do Gemini." });
    }
    salvar({ ativo: v });
    toast({
      title: v ? "1º contato automático ligado" : "1º contato automático desligado",
      description: v ? "Vale para os leads que chegarem a partir de agora. Deixe este Chrome aberto com o Inmovya." : undefined,
    });
  };

  const testarChave = async () => {
    if (!chave.trim()) return;
    setTestando(true);
    try {
      const ok = await testarChaveGemini(chave);
      setChaveOk(ok);
      if (ok) await salvarChaveGemini(chave);
      toast({
        title: ok ? "Gemini conectado e chave salva" : "Chave do Gemini inválida",
        description: ok ? "O agente vai escrever as mensagens com a IA grátis do Google." : "Confira a chave criada no Google AI Studio.",
        variant: ok ? undefined : "destructive",
      });
    } catch {
      setChaveOk(false);
      toast({ title: "Não foi possível testar o Gemini", variant: "destructive" });
    } finally {
      setTestando(false);
    }
  };

  const gerarExemplo = async () => {
    setGerando(true);
    try {
      setExemplo(await exemploDeMensagem(getConfigPrimeiroContato()));
    } finally {
      setGerando(false);
    }
  };

  const segundos = estado.proximoEnvioEm ? Math.max(0, Math.round((estado.proximoEnvioEm - Date.now()) / 1000)) : 0;
  const enviadosHoje = estado.log.filter((r) => r.status === "enviado" && new Date(r.em).toDateString() === new Date().toDateString()).length;

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
              Lead novo entrou → em cerca de 1 minuto ele recebe a primeira mensagem no WhatsApp, escrita pela IA grátis do Google. 24 horas por
              dia, sem custo.
            </p>
          </div>
          <Switch checked={cfg.ativo} onCheckedChange={ligar} />
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            Precisa deste <b>Chrome aberto com o Inmovya</b> (qualquer aba) e o Inmovya Scale. Com o computador desligado, os leads esperam e são
            atendidos quando ele voltar (até 3 dias).
          </div>
          <div>
            Nunca manda duas vezes: confere no Inmovya se o lead (ou o mesmo número) já recebeu e, antes de enviar, lê a conversa no WhatsApp — se já
            existe mensagem sua, pula.
          </div>
        </div>
        {cfg.ativo && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {estado.aviso ? (
              <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" /> {estado.aviso}
              </span>
            ) : estado.atual ? (
              <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Atendendo {estado.atual}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ligado — esperando lead novo
              </span>
            )}
            {segundos > 0 && <span className="text-muted-foreground">próximo envio em {segundos}s</span>}
            {estado.verificadoEm && <span className="text-muted-foreground">conferido às {hora(estado.verificadoEm)}</span>}
            <span className="text-muted-foreground">· {enviadosHoje} enviado(s) hoje</span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => agendarRodada(0)}>
              Conferir agora
            </Button>
          </div>
        )}
      </div>

      {/* Configuração */}
      <div className="rounded-lg border bg-white p-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pc-nome">Seu nome (o agente se apresenta com ele)</Label>
          <Input
            id="pc-nome"
            value={meuNome}
            placeholder="Ex.: Estevão"
            onChange={(e) => {
              setMeuNomeLocal(e.target.value);
              setMeuNome(e.target.value);
            }}
          />
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
            <Button variant="outline" onClick={testarChave} disabled={testando || !chave.trim()}>
              {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Testar e salvar"}
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
              <input type="radio" className="h-4 w-4" checked={cfg.quais === "captura"} onChange={() => salvar({ quais: "captura" })} />
              Só da captura automática (Meta Ads, Bitrix, formulários)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" className="h-4 w-4" checked={cfg.quais === "todos"} onChange={() => salvar({ quais: "todos" })} />
              Todos os leads novos (inclusive cadastrados à mão)
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Quem escreve</Label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={cfg.usarIA} onCheckedChange={(v) => salvar({ usarIA: v })} />
            {cfg.usarIA ? "IA (Gemini) escreve uma mensagem para cada lead" : "Sempre a mensagem reserva (sem IA)"}
          </label>
        </div>

        {cfg.usarIA && (
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pc-instr">Instruções para a IA</Label>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => salvar({ instrucoes: INSTRUCOES_PADRAO })}>
                <RotateCcw className="w-3 h-3 mr-1" /> Padrão
              </Button>
            </div>
            <Textarea id="pc-instr" rows={4} value={cfg.instrucoes} onChange={(e) => salvar({ instrucoes: e.target.value })} />
          </div>
        )}

        <div className="space-y-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pc-reserva">Mensagem reserva {cfg.usarIA && "(se a IA não responder)"}</Label>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => salvar({ mensagemReserva: MENSAGEM_RESERVA_PADRAO })}>
              <RotateCcw className="w-3 h-3 mr-1" /> Padrão
            </Button>
          </div>
          <Textarea id="pc-reserva" rows={3} value={cfg.mensagemReserva} onChange={(e) => salvar({ mensagemReserva: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            Variáveis: {"{{nome}}"}, {"{{saudacao}}"}, {"{{meu_nome}}"}, {"{{empreendimento}}"}
          </p>
        </div>

        <div className="md:col-span-2 space-y-2">
          <Button variant="outline" onClick={gerarExemplo} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Ver exemplo (não envia nada)
          </Button>
          {exemplo && (
            <div className="rounded-lg border bg-green-50/50 p-3 text-sm space-y-1">
              <div className="whitespace-pre-wrap">{exemplo.texto}</div>
              <div className="text-xs text-muted-foreground">
                Lead de exemplo: Mariana Souza, Residencial Jardim das Flores · escrito por: {exemplo.via}
                {exemplo.aviso && ` (${exemplo.aviso})`}
              </div>
            </div>
          )}
        </div>
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
            disabled={testando || !telTeste.trim()}
            onClick={async () => {
              setTestando(true);
              setPassosTeste([]);
              try {
                await testarEnvio(telTeste, setPassosTeste);
              } finally {
                setTestando(false);
              }
            }}
          >
            {testando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
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
          <h3 className="font-semibold text-sm">Últimos atendimentos neste computador</h3>
          {estado.log.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={limparLogPrimeiroContato}>
              Limpar
            </Button>
          )}
        </div>
        {estado.log.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum ainda. Quando um lead novo chegar, ele aparece aqui.</p>
        ) : (
          <ul className="divide-y">
            {estado.log.map((r) => (
              <li key={`${r.leadId}-${r.em}`} className="py-2 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs rounded-full border px-2 py-0.5 ${COR[r.status] || ""}`}>{r.status}</span>
                  <span className="font-medium">{r.nome}</span>
                  <span className="text-xs text-muted-foreground">{r.telefone}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{hora(r.em)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{r.detalhe}</div>
                {r.texto && r.status === "enviado" && <div className="text-xs whitespace-pre-wrap rounded bg-muted/50 p-2">{r.texto}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
