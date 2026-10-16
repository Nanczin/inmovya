import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Bot, CheckCircle2, Loader2, RefreshCw, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import { checarExtensao, extensaoAtualizada, versaoExtensao } from "@/lib/esteiras";
import {
  ConfigPrimeiroContato,
  MENSAGEM_RESERVA_PADRAO,
  PassoTeste,
  RegistroContato,
  SinalAgente,
  VERSAO_SCALE_AGENTE,
  LeadNaFila,
  carregarConfigAgente,
  entregarParaExtensao,
  colocarNaFila,
  lerFilaAgente,
  tirarDaFila,
  exemploDeMensagem,
  lerHistoricoAgente,
  contarVariacoes,
  gerarSpintax,
  spintaxValido,
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
  const [exemplos, setExemplos] = useState<string[]>([]);
  const [telTeste, setTelTeste] = useState("");
  const [testandoEnvio, setTestandoEnvio] = useState(false);
  const [passosTeste, setPassosTeste] = useState<PassoTeste[]>([]);
  const [fila, setFila] = useState<LeadNaFila[]>([]);
  const [conferindo, setConferindo] = useState(false);
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [nomeTeste, setNomeTeste] = useState("");
  const [etiquetaTeste, setEtiquetaTeste] = useState("Meta Ads");

  const recarregar = useCallback(async () => {
    try {
      const r = await carregarConfigAgente();
      setCfg((atual) => (atual && alterado ? atual : r.cfg));
      setSinal(r.sinal);
      setErroBanco("");
      setFila(await lerFilaAgente(r.cfg));
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
    if (v && (!cfg.mensagemReserva.trim() || !spintaxValido(cfg.mensagemReserva))) {
      toast({ title: "Confira a sua mensagem", description: "A mensagem do 1º contato está vazia ou com chaves { } sobrando.", variant: "destructive" });
      return;
    }
    salvar(
      { ativo: v },
      v
        ? { title: "1º contato automático ligado", description: "Vale para os leads que chegarem a partir de agora. Pode fechar o Inmovya: a extensão continua." }
        : { title: "1º contato automático desligado" }
    );
  };

  const conferirAgora = async () => {
    if (!cfg) return;
    setConferindo(true);
    try {
      const ok = await entregarParaExtensao(true);
      const lista = await lerFilaAgente(cfg);
      setFila(lista);
      const naFila = lista.filter((l) => l.situacao === "na_fila").length;
      const fora = lista.filter((l) => l.situacao === "antes_de_ligar" || l.situacao === "desistiu" || l.situacao === "fora_da_regra").length;
      toast({
        title: !ok ? "A extensão não respondeu" : naFila ? `${naFila} lead(s) na fila` : "Nenhum lead esperando o 1º contato",
        description: !ok
          ? `Recarregue o Inmovya Scale em chrome://extensions (precisa da ${VERSAO_SCALE_AGENTE}) e esta página.`
          : naFila
            ? "A extensão começou a atender agora (1 por minuto). Acompanhe em Últimos atendimentos."
            : fora
              ? `${fora} lead(s) novo(s) estão fora da fila — veja o motivo na lista "Leads novos" logo abaixo.`
              : "Quando chegar um lead novo, ele é atendido em 1 a 2 minutos.",
        variant: ok ? undefined : "destructive",
      });
      window.setTimeout(recarregar, 15_000);
    } finally {
      setConferindo(false);
    }
  };

  const marcar = (id: string, v: boolean) =>
    setSelecionados((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });

  const acaoSelecionados = async (acao: "atender" | "tirar") => {
    const ids = fila.filter((l) => selecionados.has(l.id) && l.situacao !== "atendendo").map((l) => l.id);
    if (!ids.length) return;
    setMexendo(acao);
    try {
      if (acao === "atender") {
        await colocarNaFila(ids);
        if (cfg?.ativo) await entregarParaExtensao(true);
        toast({
          title: `${ids.length} lead(s) na fila`,
          description: cfg?.ativo ? "A extensão atende 1 por minuto, a partir de agora." : "Ligue o agente para eles receberem.",
        });
      } else {
        await tirarDaFila(ids);
        toast({ title: `${ids.length} lead(s) tirado(s) da fila`, description: "O agente não vai chamar esses leads. Dá para pôr de volta selecionando e clicando em Atender." });
      }
      setSelecionados(new Set());
      await recarregar();
    } catch (e: any) {
      const msg = String(e?.message || "");
      toast({
        title: "Não consegui",
        description: /na_fila|check|constraint/i.test(msg) ? "Rode o SQL supabase/agente_fila_manual.sql no Supabase e tente de novo." : msg,
        variant: "destructive",
      });
    } finally {
      setMexendo(null);
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
              Lead novo entrou → em 1 a 2 minutos ele recebe a primeira mensagem no WhatsApp, com a sua mensagem pronta (spintax, sem IA). 24 horas por dia,
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
            Depois de enviar, <b>salva o contato</b> no WhatsApp com o nome do lead e marca a <b>etiqueta da origem</b>: Bitrix → “Bitrix”, Meta Ads →
            “Meta Ads” (as etiquetas precisam existir no seu WhatsApp Business). No Inmovya o lead já fica com a tag da mesma origem.
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
            <Button variant="ghost" size="sm" className="h-7 px-2" disabled={conferindo} onClick={conferirAgora}>
              {conferindo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Conferir agora
            </Button>
          </div>
        )}
      </div>

      {/* Fila: leads novos (7 dias) que ainda não receberam — você escolhe quem atender e quem tirar */}
      <div className="rounded-lg border bg-white p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-sm">Leads que ainda não receberam ({fila.length})</h3>
          <span className="text-xs text-muted-foreground">últimos 7 dias · selecione para atender ou tirar da fila</span>
        </div>
        {fila.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={fila.filter((l) => l.situacao !== "atendendo").length > 0 && fila.filter((l) => l.situacao !== "atendendo").every((l) => selecionados.has(l.id))}
                onChange={(e) => setSelecionados(e.target.checked ? new Set(fila.filter((l) => l.situacao !== "atendendo").map((l) => l.id)) : new Set())}
              />
              Selecionar todos
            </label>
            {[
              { k: "antes_de_ligar", t: "os que chegaram antes" },
              { k: "desistiu", t: "os que falharam" },
              { k: "fora_da_regra", t: "os fora da captura" },
            ]
              .filter((g) => fila.some((l) => l.situacao === g.k))
              .map((g) => (
                <button
                  key={g.k}
                  type="button"
                  className="text-xs underline text-muted-foreground"
                  onClick={() => setSelecionados(new Set(fila.filter((l) => l.situacao === g.k).map((l) => l.id)))}
                >
                  só {g.t}
                </button>
              ))}
            <div className="ml-auto flex gap-2">
              <Button size="sm" className="h-8" disabled={!selecionados.size || !!mexendo} onClick={() => acaoSelecionados("atender")}>
                {mexendo === "atender" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                Atender ({selecionados.size})
              </Button>
              <Button size="sm" variant="outline" className="h-8" disabled={!selecionados.size || !!mexendo} onClick={() => acaoSelecionados("tirar")}>
                {mexendo === "tirar" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                Tirar da fila ({selecionados.size})
              </Button>
            </div>
          </div>
        )}
        {fila.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum nos últimos 7 dias.</p>
        ) : (
          <ul className="divide-y">
            {fila.map((l) => (
              <li key={l.id} className="py-2 text-sm">
                <label className={`flex items-start gap-3 ${l.situacao === "atendendo" ? "" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 mt-0.5 shrink-0"
                    disabled={l.situacao === "atendendo"}
                    checked={selecionados.has(l.id)}
                    onChange={(e) => marcar(l.id, e.target.checked)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium break-words">
                      {l.nome} <span className="text-xs font-normal text-muted-foreground">{l.telefone} · chegou {hora(l.criadoEm)}</span>
                    </span>
                    <span
                      className={`block text-xs ${
                        l.situacao === "na_fila" || l.situacao === "escolhido" || l.situacao === "atendendo"
                          ? "text-green-700"
                          : l.situacao === "tirado"
                            ? "text-muted-foreground"
                            : "text-amber-700"
                      }`}
                    >
                      {l.motivo}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Configuração */}
      <div className="rounded-lg border bg-white p-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pc-nome">Seu nome (vai no {"{{meu_nome}}"})</Label>
          <Input id="pc-nome" value={cfg.meuNome} placeholder="Ex.: Estevão" onChange={(e) => mudar({ meuNome: e.target.value })} />
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

        <div className="space-y-1.5 md:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="pc-reserva">Sua mensagem do 1º contato (sem IA, com spintax)</Label>
            <div className="ml-auto flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                title="Troca expressões comuns da sua mensagem por variações {opção|opção}. Revise depois."
                onClick={() => {
                  const novo = gerarSpintax(cfg.mensagemReserva);
                  if (novo === cfg.mensagemReserva) {
                    toast({ title: "Nada para variar", description: "Não achei expressões comuns para trocar. Escreva as variações à mão: {Oi|Olá|Oii}." });
                    return;
                  }
                  mudar({ mensagemReserva: novo });
                  toast({ title: "Spintax gerado", description: `Agora são ${contarVariacoes(novo).toLocaleString("pt-BR")} combinações. Revise e salve.` });
                }}
              >
                <Shuffle className="w-3 h-3 mr-1" /> Gerar spintax da minha mensagem
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => mudar({ mensagemReserva: MENSAGEM_RESERVA_PADRAO })}>
                <RotateCcw className="w-3 h-3 mr-1" /> Exemplo
              </Button>
            </div>
          </div>
          <Textarea id="pc-reserva" rows={5} value={cfg.mensagemReserva} onChange={(e) => mudar({ mensagemReserva: e.target.value })} />
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>
              <b>Spintax:</b> escreva as opções entre chaves separadas por barra — {"{Oi|Olá|Oii}"} — e cada lead recebe uma combinação diferente
              (ajuda a não ser bloqueado no WhatsApp). Pode pôr um dentro do outro.
            </div>
            <div>
              <b>Variáveis:</b> {"{{nome}}"}, {"{{saudacao}}"} (bom dia/boa tarde/boa noite), {"{{meu_nome}}"}, {"{{empreendimento}}"}
            </div>
            {spintaxValido(cfg.mensagemReserva) ? (
              <div className="text-green-700">{contarVariacoes(cfg.mensagemReserva).toLocaleString("pt-BR")} combinação(ões) diferente(s)</div>
            ) : (
              <div className="text-red-600">Tem chave sobrando ou faltando no spintax: confira os {"{ }"}.</div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          <Button onClick={() => salvar()} disabled={salvando || !alterado || !spintaxValido(cfg.mensagemReserva) || !cfg.mensagemReserva.trim()}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Salvar configuração
          </Button>
          {alterado && <span className="text-xs text-amber-700">alterações ainda não salvas</span>}
          <Button
            variant="outline"
            onClick={async () => {
              const lista = [];
              for (let i = 0; i < 3; i++) lista.push(await exemploDeMensagem(cfg));
              setExemplos(lista.map((e) => e.texto));
            }}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Ver 3 exemplos (não envia nada)
          </Button>
        </div>
        {exemplos.length > 0 && (
          <div className="md:col-span-2 rounded-lg border bg-green-50/50 p-3 text-sm space-y-2">
            {exemplos.map((t, i) => (
              <div key={i} className="whitespace-pre-wrap border-b last:border-0 pb-2 last:pb-0">
                {t}
              </div>
            ))}
            <div className="text-xs text-muted-foreground">Lead de exemplo: Mariana Souza, Residencial Jardim das Flores</div>
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
          <Input
            value={nomeTeste}
            placeholder="Nome p/ salvar o contato (opcional)"
            onChange={(e) => setNomeTeste(e.target.value)}
            className="sm:w-60"
            title="Se preencher, o teste também salva o contato com esse nome e marca a etiqueta escolhida"
          />
          <select
            className="h-10 rounded-md border bg-background px-2 text-sm"
            value={etiquetaTeste}
            onChange={(e) => setEtiquetaTeste(e.target.value)}
            disabled={!nomeTeste.trim()}
          >
            <option value="Meta Ads">etiqueta Meta Ads</option>
            <option value="Bitrix">etiqueta Bitrix</option>
          </select>
          <Button
            variant="outline"
            disabled={testandoEnvio || !telTeste.trim()}
            onClick={async () => {
              setTestandoEnvio(true);
              setPassosTeste([]);
              try {
                await testarEnvio(telTeste, cfg, setPassosTeste, nomeTeste.trim() ? { nome: nomeTeste, etiqueta: etiquetaTeste } : undefined);
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
