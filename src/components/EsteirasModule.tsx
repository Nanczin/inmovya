import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLeads, Lead } from "@/context/LeadsContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NEGOCIO_STAGES, getStageForStatus } from "@/lib/negociosStages";
import {
  Esteira,
  EsteiraPasso,
  avancarLead,
  checarExtensao,
  colocarNaEsteira,
  enviarPeloWhatsApp,
  executarImportacao,
  getMeuNome,
  intervaloAleatorio,
  lerDadosDoScale,
  montarMensagem,
  planejarImportacao,
  PlanoImportacao,
  setMeuNome,
  telefoneWhatsApp,
  tirarDaEsteira,
} from "@/lib/esteiras";
import {
  Play,
  Square,
  Send,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Clock,
  Workflow,
} from "lucide-react";

type LeadEsteira = Lead & {
  esteira_id?: string | null;
  esteira_passo?: number | null;
  esteira_proximo?: string | null;
  esteira_ultimo_envio?: string | null;
};

type ItemFila = {
  lead: LeadEsteira;
  esteira: Esteira;
  passos: EsteiraPasso[];
  passo: EsteiraPasso;
  mensagem: string;
  telefone: string;
};

type EstadoItem = "pendente" | "enviando" | "enviado" | "erro" | "pulado";

const fimDeHoje = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

const fmtData = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "agora";

export function EsteirasModule() {
  const { leads, refreshLeads } = useLeads();
  const { toast } = useToast();

  const [esteiras, setEsteiras] = useState<Esteira[]>([]);
  const [passos, setPassos] = useState<EsteiraPasso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semTabelas, setSemTabelas] = useState(false);
  const [extensaoOk, setExtensaoOk] = useState<boolean | null>(null);
  const [aba, setAba] = useState("hoje");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: e, error: e1 }, { data: p, error: e2 }] = await Promise.all([
      supabase.from("esteiras").select("*").order("ordem").order("created_at"),
      supabase.from("esteira_passos").select("*").order("ordem"),
    ]);
    if (e1 || e2) {
      console.error("Erro ao carregar esteiras:", e1 || e2);
      setSemTabelas(true);
    } else {
      setSemTabelas(false);
      setEsteiras((e as Esteira[]) || []);
      setPassos((p as EsteiraPasso[]) || []);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    checarExtensao().then(setExtensaoOk);
  }, [carregar]);

  const [projetos, setProjetos] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    supabase
      .from("empreendimentos")
      .select("id, nome")
      .order("nome")
      .then(({ data, error }) => !error && setProjetos((data as any) || []));
  }, []);
  const nomeProjeto = (id?: string | null) => (id ? projetos.find((p) => p.id === id)?.nome : null);

  const passosDe = useCallback(
    (esteiraId: string) => passos.filter((p) => p.esteira_id === esteiraId).sort((a, b) => a.ordem - b.ordem),
    [passos]
  );

  const leadsEmEsteira = useMemo(
    () => ((leads || []) as LeadEsteira[]).filter((l) => l.esteira_id && esteiras.some((e) => e.id === l.esteira_id)),
    [leads, esteiras]
  );

  // ---------------- HOJE ----------------
  const fila = useMemo<ItemFila[]>(() => {
    const limite = fimDeHoje();
    const itens: ItemFila[] = [];
    leadsEmEsteira.forEach((lead) => {
      const prox = lead.esteira_proximo ? new Date(lead.esteira_proximo).getTime() : 0;
      if (prox > limite) return;
      const esteira = esteiras.find((e) => e.id === lead.esteira_id)!;
      const ps = passosDe(esteira.id);
      if (!ps.length) return;
      const passo = ps[Math.min(Math.max(lead.esteira_passo || 0, 0), ps.length - 1)];
      itens.push({
        lead,
        esteira,
        passos: ps,
        passo,
        mensagem: montarMensagem(passo.mensagem, lead.nome),
        telefone: telefoneWhatsApp(lead.telefone),
      });
    });
    return itens.sort((a, b) => a.esteira.ordem - b.esteira.ordem || (a.passo.ordem - b.passo.ordem));
  }, [leadsEmEsteira, esteiras, passosDe]);

  const agendados = useMemo(() => {
    const limite = fimDeHoje();
    return leadsEmEsteira
      .filter((l) => l.esteira_proximo && new Date(l.esteira_proximo).getTime() > limite)
      .map((lead) => {
        const esteira = esteiras.find((e) => e.id === lead.esteira_id)!;
        const ps = passosDe(esteira.id);
        const passo = ps.length ? ps[Math.min(Math.max(lead.esteira_passo || 0, 0), ps.length - 1)] : null;
        return { lead, esteira, passo, total: ps.length, quando: new Date(lead.esteira_proximo as string) };
      })
      .sort((a, b) => a.quando.getTime() - b.quando.getTime());
  }, [leadsEmEsteira, esteiras, passosDe]);
  const proximosDias = agendados.length;
  const [verAgendados, setVerAgendados] = useState(false);

  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  const [estado, setEstado] = useState<Record<string, { s: EstadoItem; erro?: string }>>({});
  const [rodando, setRodando] = useState(false);
  const [contagem, setContagem] = useState(0);
  const pararRef = useRef(false);
  // {{meu_nome}} vem do login (sem precisar digitar)
  useEffect(() => {
    if (getMeuNome()) return;
    supabase.auth.getUser().then(({ data }) => {
      const m = (data.user?.user_metadata || {}) as Record<string, string>;
      const nome = (m.full_name || m.name || m.nome || "").trim().split(/\s+/)[0] || "";
      if (nome) setMeuNome(nome);
    });
  }, []);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  // Bloco do dia: rodar uma esteira por vez (ex.: 70% de manhã, 50% à tarde)
  const [filtroEsteira, setFiltroEsteira] = useState<string>("todas");
  const contagemPorEsteira = useMemo(() => {
    const c: Record<string, number> = {};
    fila.forEach((i) => {
      if (estado[i.lead.id]?.s === "enviado") return;
      c[i.esteira.id] = (c[i.esteira.id] || 0) + 1;
    });
    return c;
  }, [fila, estado]);
  const filaVisivel = filtroEsteira === "todas" ? fila : fila.filter((i) => i.esteira.id === filtroEsteira);
  // "Só colar" do Scale agora também entra no envio: a mensagem pode ser personalizada aqui antes de rodar
  const filaAuto = filaVisivel;
  const filaManual: ItemFila[] = [];
  const [editados, setEditados] = useState<Record<string, string>>({});
  const textoDo = (item: ItemFila) => editados[item.lead.id] ?? montarMensagem(item.passo.mensagem, item.lead.nome);
  const selecionados = filaAuto.filter((i) => !desmarcados.has(i.lead.id) && i.telefone && estado[i.lead.id]?.s !== "enviado");

  const esperar = (segundos: number) =>
    new Promise<void>((resolve) => {
      let restante = segundos;
      setContagem(restante);
      const t = setInterval(() => {
        restante -= 1;
        setContagem(restante);
        if (restante <= 0 || pararRef.current) {
          clearInterval(t);
          setContagem(0);
          resolve();
        }
      }, 1000);
    });

  const rodar = async () => {
    const ok = await checarExtensao();
    setExtensaoOk(ok);
    if (!ok) {
      toast({
        title: "Inmovya Scale não encontrado",
        description: "Abra este Inmovya no Chrome onde a extensão está instalada e ativa.",
        variant: "destructive",
      });
      return;
    }
    const lista = [...selecionados];
    if (!lista.length) return;
    pararRef.current = false;
    setRodando(true);
    let enviados = 0;
    for (let i = 0; i < lista.length; i++) {
      if (pararRef.current) break;
      const item = lista[i];
      setEstado((s) => ({ ...s, [item.lead.id]: { s: "enviando" } }));
      try {
        // monta de novo na hora (saudação pode mudar ao longo do dia)
        const texto = textoDo(item);
        await enviarPeloWhatsApp(item.telefone, texto);
        await avancarLead(item.lead, item.esteira, item.passos, item.passo, texto);
        enviados++;
        setEstado((s) => ({ ...s, [item.lead.id]: { s: "enviado" } }));
        setEditados((m) => { const n = { ...m }; delete n[item.lead.id]; return n; });
      } catch (err: any) {
        console.error("Falha no envio da esteira:", err);
        setEstado((s) => ({ ...s, [item.lead.id]: { s: "erro", erro: err?.message || "Falha" } }));
      }
      if (i < lista.length - 1 && !pararRef.current) await esperar(intervaloAleatorio());
    }
    setRodando(false);
    pararRef.current = false;
    await refreshLeads();
    toast({ title: "Esteira de hoje", description: `${enviados} mensagem(ns) enviada(s).` });
  };

  const marcarManualEnviado = async (item: ItemFila) => {
    try {
      await avancarLead(item.lead, item.esteira, item.passos, item.passo, montarMensagem(item.passo.mensagem, item.lead.nome));
      setEstado((s) => ({ ...s, [item.lead.id]: { s: "enviado" } }));
      await refreshLeads();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const pularHoje = async (item: ItemFila) => {
    const amanha = new Date(Date.now() + 86400000).toISOString();
    const { error } = await supabase.from("leads").update({ esteira_proximo: amanha }).eq("id", item.lead.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setEstado((s) => ({ ...s, [item.lead.id]: { s: "pulado" } }));
    await refreshLeads();
  };

  const trazerParaHoje = async (leadId: string) => {
    const { error } = await supabase.from("leads").update({ esteira_proximo: new Date().toISOString() }).eq("id", leadId);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    await refreshLeads();
  };

  const tirarLead = async (leadId: string, nome: string) => {
    if (!window.confirm(`Tirar ${nome} da esteira? Os envios agendados dele param.`)) return;
    try {
      await tirarDaEsteira([leadId]);
      toast({ title: "Lead tirado da esteira", description: nome });
      await refreshLeads();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  // ---------------- EDITOR ----------------
  const [esteiraSel, setEsteiraSel] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{ esteira: Esteira; passos: EsteiraPasso[] } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!esteiraSel && esteiras.length) setEsteiraSel(esteiras[0].id);
  }, [esteiras, esteiraSel]);

  useEffect(() => {
    const e = esteiras.find((x) => x.id === esteiraSel);
    setRascunho(e ? { esteira: { ...e }, passos: passosDe(e.id).map((p) => ({ ...p })) } : null);
  }, [esteiraSel, esteiras, passosDe]);

  const novaEsteira = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("esteiras")
      .insert({ nome: "Nova esteira", ordem: esteiras.length, user_id: user.id, ao_concluir_tag: "disparo" })
      .select("*")
      .single();
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    await carregar();
    setEsteiraSel(data.id);
  };

  const salvarEsteira = async () => {
    if (!rascunho) return;
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { esteira, passos: ps } = rascunho;
      const { error } = await supabase
        .from("esteiras")
        .update({
          nome: esteira.nome,
          ao_concluir_tag: esteira.ao_concluir_tag || null,
          etapa: esteira.etapa || null,
          empreendimento_id: (esteira as any).empreendimento_id || null,
        })
        .eq("id", esteira.id);
      if (error) throw error;

      const atuais = passosDe(esteira.id);
      const manter = new Set(ps.filter((p) => !p.id.startsWith("novo-")).map((p) => p.id));
      const remover = atuais.filter((p) => !manter.has(p.id)).map((p) => p.id);
      if (remover.length) {
        const { error: eDel } = await supabase.from("esteira_passos").delete().in("id", remover);
        if (eDel) throw eDel;
      }
      for (const [ordem, p] of ps.entries()) {
        const row = {
          esteira_id: esteira.id,
          ordem,
          titulo: p.titulo,
          mensagem: p.mensagem,
          dias_espera: Math.max(0, Number(p.dias_espera) || 0),
          so_colar: !!p.so_colar,
        };
        const { error: eUp } = p.id.startsWith("novo-")
          ? await supabase.from("esteira_passos").insert({ ...row, user_id: user?.id })
          : await supabase.from("esteira_passos").update(row).eq("id", p.id);
        if (eUp) throw eUp;
      }
      toast({ title: "Esteira salva" });
      await carregar();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const excluirEsteira = async () => {
    if (!rascunho) return;
    const qtd = leadsEmEsteira.filter((l) => l.esteira_id === rascunho.esteira.id).length;
    if (!window.confirm(`Excluir a esteira "${rascunho.esteira.nome}"?${qtd ? ` ${qtd} lead(s) saem dela.` : ""}`)) return;
    const { error } = await supabase.from("esteiras").delete().eq("id", rascunho.esteira.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setEsteiraSel(null);
    await carregar();
    await refreshLeads();
  };

  const mudarPasso = (idx: number, campo: keyof EsteiraPasso, valor: any) =>
    setRascunho((r) => (r ? { ...r, passos: r.passos.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)) } : r));

  const moverPasso = (idx: number, dir: -1 | 1) =>
    setRascunho((r) => {
      if (!r) return r;
      const ps = [...r.passos];
      const j = idx + dir;
      if (j < 0 || j >= ps.length) return r;
      [ps[idx], ps[j]] = [ps[j], ps[idx]];
      return { ...r, passos: ps };
    });

  const [buscaLead, setBuscaLead] = useState("");
  const resultadosBusca = useMemo(() => {
    const t = buscaLead.trim().toLowerCase();
    if (t.length < 2 || !rascunho) return [] as LeadEsteira[];
    const dig = t.replace(/\D/g, "");
    return ((leads || []) as LeadEsteira[])
      .filter((l) => l.esteira_id !== rascunho.esteira.id)
      .filter((l) => (l.nome || "").toLowerCase().includes(t) || (dig.length >= 3 && (l.telefone || "").replace(/\D/g, "").includes(dig)))
      .slice(0, 10);
  }, [buscaLead, leads, rascunho]);

  // ---------------- IMPORTAR ----------------
  const [plano, setPlano] = useState<PlanoImportacao | null>(null);
  const [importando, setImportando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const prepararPlano = (backup: any) => {
    const p = planejarImportacao(backup, (leads || []) as any);
    if (!p.esteiras.length) throw new Error("Não encontrei categorias (esteiras) nesse backup.");
    setPlano(p);
  };

  const lerDoScale = async () => {
    setLendo(true);
    try {
      prepararPlano(await lerDadosDoScale());
    } catch (err: any) {
      toast({ title: "Não consegui ler o Scale", description: err?.message, variant: "destructive" });
    } finally {
      setLendo(false);
    }
  };

  const lerArquivo = async (file?: File | null) => {
    if (!file) return;
    try {
      prepararPlano(JSON.parse(await file.text()));
    } catch (err: any) {
      toast({ title: "Arquivo inválido", description: err?.message, variant: "destructive" });
    }
  };

  const importar = async () => {
    if (!plano) return;
    setImportando(true);
    try {
      await executarImportacao(plano);
      toast({ title: "Importação concluída", description: `${plano.esteiras.length} esteira(s) e ${plano.leads.length} lead(s).` });
      setPlano(null);
      await carregar();
      await refreshLeads();
      setAba("hoje");
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err?.message, variant: "destructive" });
    } finally {
      setImportando(false);
    }
  };

  // Leads que já estão na etapa ligada mas fora da esteira (ex.: antes da ligação existir)
  const foraDaEsteira = useMemo(() => {
    const etapa = rascunho?.esteira.etapa;
    if (!etapa || esteiras.find((e) => e.id === rascunho?.esteira.id)?.etapa !== etapa) return [];
    const alvo = getStageForStatus(etapa)?.id;
    const proj = (rascunho!.esteira as any).empreendimento_id || null;
    return ((leads || []) as LeadEsteira[]).filter(
      (l) =>
        l.esteira_id !== rascunho!.esteira.id &&
        alvo &&
        getStageForStatus(l.status)?.id === alvo &&
        (!proj || l.empreendimento_id === proj)
    );
  }, [rascunho, esteiras, leads]);

  const colocarEtapaNaEsteira = async () => {
    if (!rascunho || !foraDaEsteira.length) return;
    try {
      await colocarNaEsteira(foraDaEsteira.map((l) => l.id), rascunho.esteira.id);
      toast({ title: "Leads colocados na esteira", description: `${foraDaEsteira.length} lead(s) no primeiro passo.` });
      await refreshLeads();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  // ---------------- UI ----------------
  if (semTabelas) {
    return (
      <div className="max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        <p className="font-semibold text-amber-800">Falta ativar as esteiras no banco de dados.</p>
        <p className="mt-1 text-amber-800">
          Rode o arquivo <code>supabase/esteiras.sql</code> no SQL Editor do Supabase (botão Run) e recarregue esta página.
        </p>
      </div>
    );
  }

  const leadsDaEsteiraSel = rascunho ? leadsEmEsteira.filter((l) => l.esteira_id === rascunho.esteira.id) : [];

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="w-6 h-6" /> Esteiras
          </h1>
          <p className="text-sm text-muted-foreground">
            As esteiras ficam no Inmovya. O Inmovya Scale só envia as mensagens no WhatsApp Web.
          </p>
        </div>
        <div
          className={`text-xs rounded-full px-3 py-1 border w-fit ${
            extensaoOk ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {extensaoOk === null ? "Verificando Inmovya Scale..." : extensaoOk ? "Inmovya Scale conectado" : "Inmovya Scale não encontrado neste navegador"}
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba} className="min-w-0">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="hoje">Hoje ({fila.length})</TabsTrigger>
          <TabsTrigger value="esteiras">Esteiras ({esteiras.length})</TabsTrigger>
          <TabsTrigger value="importar">Importar do Scale</TabsTrigger>
        </TabsList>

        {/* HOJE */}
        <TabsContent value="hoje" className="mt-4 space-y-4">
          {carregando ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <>
              <div className="flex flex-col lg:flex-row lg:items-end gap-3 rounded-lg border bg-white p-3">
                <div className="text-xs text-muted-foreground flex-1 min-w-0">
                  <div>
                    Intervalo entre envios: <b>2 a 3 minutos</b> (aleatório)
                  </div>
                  <button type="button" className="underline text-blue-700 hover:text-blue-900" onClick={() => setVerAgendados((v) => !v)}>
                    {proximosDias} lead(s) agendado(s) para os próximos dias {verAgendados ? "▲" : "▼"}
                  </button>
                </div>
                {rodando ? (
                  <Button variant="destructive" className="h-10" onClick={() => (pararRef.current = true)}>
                    <Square className="w-4 h-4 mr-1" /> Parar {contagem > 0 ? `(próximo em ${Math.floor(contagem / 60)}:${String(contagem % 60).padStart(2, "0")})` : ""}
                  </Button>
                ) : (
                  <Button className="h-10 bg-green-600 hover:bg-green-700 text-white" disabled={!selecionados.length} onClick={rodar}>
                    <Play className="w-4 h-4 mr-1" /> Rodar envio ({selecionados.length})
                  </Button>
                )}
              </div>

              {verAgendados && (
                <div className="rounded-lg border bg-white p-3 space-y-1 max-h-96 overflow-y-auto">
                  <h3 className="text-sm font-semibold mb-1">Agendados</h3>
                  {agendados.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lead agendado.</p>}
                  {agendados.map((a) => (
                    <div key={a.lead.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 border-b last:border-0 py-1.5 text-sm">
                      <span className="w-24 shrink-0 text-xs font-medium text-blue-800">
                        {a.quando.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                      </span>
                      <span className="font-medium truncate flex-1 min-w-0">{a.lead.nome}</span>
                      <span className="text-[11px] rounded border px-1.5 py-0.5 bg-slate-50 truncate">
                        {a.esteira.nome}
                        {a.passo ? ` · ${a.passo.titulo || `Passo ${a.passo.ordem + 1}`} (${(a.lead.esteira_passo || 0) + 1}/${a.total})` : ""}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={rodando} onClick={() => trazerParaHoje(a.lead.id)}>
                          Enviar hoje
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" disabled={rodando} onClick={() => tirarLead(a.lead.id, a.lead.nome)}>
                          Tirar da esteira
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {fila.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={rodando}
                    onClick={() => setFiltroEsteira("todas")}
                    className={`text-xs rounded-full border px-3 py-1 ${filtroEsteira === "todas" ? "bg-blue-800 text-white border-blue-800" : "bg-white hover:bg-slate-50"}`}
                  >
                    Todas ({Object.values(contagemPorEsteira).reduce((a: number, b: number) => a + b, 0)})
                  </button>
                  {esteiras
                    .filter((e) => fila.some((i) => i.esteira.id === e.id))
                    .map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        disabled={rodando}
                        onClick={() => setFiltroEsteira(e.id)}
                        className={`text-xs rounded-full border px-3 py-1 ${filtroEsteira === e.id ? "bg-blue-800 text-white border-blue-800" : "bg-white hover:bg-slate-50"}`}
                      >
                        {e.nome} ({contagemPorEsteira[e.id] || 0})
                      </button>
                    ))}
                  <span className="text-[11px] text-muted-foreground self-center ml-1">
                    Escolha uma esteira para rodar só ela agora e as outras em outro horário.
                  </span>
                </div>
              )}

              {fila.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhum envio de esteira para hoje.
                  {esteiras.length === 0 && " Importe suas esteiras do Scale ou crie uma na aba Esteiras."}
                </div>
              )}

              {filaAuto.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Confira as mensagens antes de rodar (clique no texto para personalizar). Desmarque quem não deve receber hoje.
                  </p>
                  {filaAuto.map((item) => {
                    const st = estado[item.lead.id]?.s || "pendente";
                    const aberto = abertos.has(item.lead.id);
                    return (
                      <div key={item.lead.id} className="rounded-lg border bg-white p-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0"
                            disabled={rodando || st === "enviado" || !item.telefone}
                            checked={!desmarcados.has(item.lead.id) && !!item.telefone}
                            onChange={() =>
                              setDesmarcados((s) => {
                                const n = new Set(s);
                                n.has(item.lead.id) ? n.delete(item.lead.id) : n.add(item.lead.id);
                                return n;
                              })
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-semibold text-sm truncate">{item.lead.nome}</span>
                              <span className="text-xs text-muted-foreground">{item.lead.telefone || "sem telefone"}</span>
                              <span className="text-[11px] rounded border px-1.5 py-0.5 bg-slate-50">
                                {item.esteira.nome} · {item.passo.titulo || `Passo ${item.passo.ordem + 1}`} ({item.passos.indexOf(item.passo) + 1}/{item.passos.length})
                              </span>
                              {st === "enviando" && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                              {st === "enviado" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                              {st === "erro" && (
                                <span className="text-xs text-red-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {estado[item.lead.id]?.erro}
                                </span>
                              )}
                              {st === "pulado" && <span className="text-xs text-muted-foreground">adiado para amanhã</span>}
                              {item.passo.so_colar && (
                                <span className="text-[11px] rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">personalizar</span>
                              )}
                            </div>
                            {aberto ? (
                              <div className="mt-1 space-y-1">
                                <Textarea
                                  value={textoDo(item)}
                                  disabled={rodando || st === "enviado"}
                                  onChange={(ev) => setEditados((m) => ({ ...m, [item.lead.id]: ev.target.value }))}
                                  className="text-xs min-h-[120px]"
                                />
                                <div className="flex gap-2 text-[11px]">
                                  <button type="button" className="text-blue-700 underline" onClick={() => setAbertos((x) => { const n = new Set(x); n.delete(item.lead.id); return n; })}>
                                    Fechar
                                  </button>
                                  {editados[item.lead.id] !== undefined && (
                                    <button type="button" className="text-slate-500 underline" onClick={() => setEditados((m) => { const n = { ...m }; delete n[item.lead.id]; return n; })}>
                                      Voltar ao texto da esteira
                                    </button>
                                  )}
                                  <span className="text-muted-foreground">Partes separadas por === viram mensagens separadas.</span>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="mt-1 text-left text-xs text-slate-600 whitespace-pre-wrap break-words w-full"
                                onClick={() => setAbertos((x) => new Set(x).add(item.lead.id))}
                              >
                                {`${textoDo(item).replace(/\s+/g, " ").slice(0, 140)}${textoDo(item).length > 140 ? "… (ver / editar)" : " (editar)"}`}
                              </button>
                            )}
                          </div>
                          {!rodando && st !== "enviado" && (
                            <Button size="sm" variant="ghost" className="shrink-0 h-8 text-xs" onClick={() => pularHoje(item)} title="Adiar para amanhã">
                              <Clock className="w-3.5 h-3.5 mr-1" /> Amanhã
                            </Button>
                          )}
                          {!rodando && st !== "enviado" && (
                            <Button size="sm" variant="ghost" className="shrink-0 h-8 text-xs text-red-600 hover:text-red-700" onClick={() => tirarLead(item.lead.id, item.lead.nome)} title="Tirar da esteira">
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Tirar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filaManual.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold mt-2">Envio manual (passos “só colar”)</h3>
                  {filaManual.map((item) => {
                    const st = estado[item.lead.id]?.s;
                    return (
                      <div key={item.lead.id} className="rounded-lg border bg-white p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {item.lead.nome} <span className="font-normal text-xs text-muted-foreground">· {item.esteira.nome} · {item.passo.titulo}</span>
                          </div>
                          <div className="text-xs text-slate-600 truncate">{item.mensagem}</div>
                        </div>
                        {st === "enviado" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`https://web.whatsapp.com/send?phone=${item.telefone}&text=${encodeURIComponent(item.mensagem.replace(/\n*===\n*/g, "\n\n"))}`, "_blank")}
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir WhatsApp
                            </Button>
                            <Button size="sm" onClick={() => marcarManualEnviado(item)}>
                              <Send className="w-3.5 h-3.5 mr-1" /> Marcar enviado
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ESTEIRAS */}
        <TabsContent value="esteiras" className="mt-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="lg:w-64 shrink-0 space-y-2">
              {esteiras.map((e) => {
                const qtd = leadsEmEsteira.filter((l) => l.esteira_id === e.id).length;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEsteiraSel(e.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${esteiraSel === e.id ? "border-blue-500 bg-blue-50" : "bg-white hover:bg-slate-50"}`}
                  >
                    <div className="font-medium truncate">{e.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {nomeProjeto((e as any).empreendimento_id) ? `${nomeProjeto((e as any).empreendimento_id)} · ` : ""}
                      {e.etapa ? `Etapa ${e.etapa} · ` : ""}
                      {passosDe(e.id).length} passo(s) · {qtd} lead(s)
                    </div>
                  </button>
                );
              })}
              <Button variant="outline" className="w-full" onClick={novaEsteira}>
                <Plus className="w-4 h-4 mr-1" /> Nova esteira
              </Button>
            </div>

            {rascunho ? (
              <div className="flex-1 min-w-0 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3 rounded-lg border bg-white p-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Nome da esteira</Label>
                    <Input value={rascunho.esteira.nome} onChange={(ev) => setRascunho({ ...rascunho, esteira: { ...rascunho.esteira, nome: ev.target.value } })} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Etiqueta ao concluir (no Inmovya)</Label>
                    <Input
                      value={rascunho.esteira.ao_concluir_tag || ""}
                      placeholder="disparo"
                      onChange={(ev) => setRascunho({ ...rascunho, esteira: { ...rascunho.esteira, ao_concluir_tag: ev.target.value } })}
                    />
                  </div>
                  <div className="grid gap-1 sm:col-span-2">
                    <Label className="text-xs">Projeto (empreendimento)</Label>
                    <Select
                      value={(rascunho.esteira as any).empreendimento_id || "geral"}
                      onValueChange={(v) =>
                        setRascunho({ ...rascunho, esteira: { ...rascunho.esteira, empreendimento_id: v === "geral" ? null : v } as any })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[50vh]">
                        <SelectItem value="geral">Geral (qualquer projeto)</SelectItem>
                        {projetos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Com projeto definido, só os leads desse projeto entram nesta esteira. Ex.: “50% Hípica” para quem tem interesse no Jardim da Hípica, “50% TOM” para o T.O.M. Paraíso.
                    </p>
                  </div>
                  <div className="grid gap-1 sm:col-span-2">
                    <Label className="text-xs">Etapa de Negócios ligada</Label>
                    <Select
                      value={rascunho.esteira.etapa || "nenhuma"}
                      onValueChange={(v) => setRascunho({ ...rascunho, esteira: { ...rascunho.esteira, etapa: v === "nenhuma" ? null : v } })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[50vh]">
                        <SelectItem value="nenhuma">Nenhuma (só manual)</SelectItem>
                        {NEGOCIO_STAGES.map((st) => {
                          const proj = (rascunho.esteira as any).empreendimento_id || null;
                          const usadaPor = esteiras.find(
                            (x) => x.id !== rascunho.esteira.id && x.etapa === st.value && ((x as any).empreendimento_id || null) === proj
                          );
                          return (
                            <SelectItem key={st.id} value={st.value}>
                              {st.name}
                              {usadaPor ? ` (já ligada a ${usadaPor.nome})` : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Quem for movido para essa etapa em Negócios (ou em Leads) entra nesta esteira no primeiro passo — se a esteira tiver projeto, só os leads daquele projeto. Ao sair da etapa, sai da esteira.
                    </p>
                    {foraDaEsteira.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-2 py-1.5 text-xs">
                        <span>
                          {foraDaEsteira.length} lead(s) já estão na etapa <b>{rascunho.esteira.etapa}</b> e fora desta esteira.
                        </span>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={colocarEtapaNaEsteira}>
                          Colocar no D1
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                    Variáveis: {"{{nome}}"} (primeiro nome), {"{{saudacao}}"}, {"{{meu_nome}}"}, {"{{data}}"}, {"{{hora}}"}. Separe mensagens com uma linha <code>===</code>.
                  </p>
                </div>

                <div className="space-y-3">
                  {rascunho.passos.map((p, idx) => (
                    <div key={p.id} className="rounded-lg border bg-white p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold rounded bg-slate-100 px-2 py-0.5">{idx + 1}</span>
                        <Input className="h-8 flex-1 min-w-[140px]" value={p.titulo} placeholder={`D${idx + 1}`} onChange={(ev) => mudarPasso(idx, "titulo", ev.target.value)} />
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">enviar</span>
                          <Input type="number" min={0} className="h-8 w-16" value={p.dias_espera} onChange={(ev) => mudarPasso(idx, "dias_espera", parseInt(ev.target.value) || 0)} />
                          <span className="text-muted-foreground">{idx === 0 ? "dia(s) após entrar" : "dia(s) após o anterior"}</span>
                        </div>
                        <label className="flex items-center gap-1 text-xs">
                          <Switch checked={!!p.so_colar} onCheckedChange={(v) => mudarPasso(idx, "so_colar", v)} /> só colar
                        </label>
                        <div className="flex gap-1 ml-auto">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moverPasso(idx, -1)} disabled={idx === 0}>
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moverPasso(idx, 1)} disabled={idx === rascunho.passos.length - 1}>
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            onClick={() => setRascunho({ ...rascunho, passos: rascunho.passos.filter((_, i) => i !== idx) })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <Textarea rows={4} value={p.mensagem} onChange={(ev) => mudarPasso(idx, "mensagem", ev.target.value)} placeholder="Oi {{nome}}, {{saudacao}}! ..." />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() =>
                      setRascunho({
                        ...rascunho,
                        passos: [
                          ...rascunho.passos,
                          {
                            id: `novo-${crypto.randomUUID()}`,
                            esteira_id: rascunho.esteira.id,
                            ordem: rascunho.passos.length,
                            titulo: `D${rascunho.passos.length + 1}`,
                            mensagem: "",
                            dias_espera: rascunho.passos.length ? 1 : 0,
                            so_colar: false,
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar passo
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button className="bg-blue-800 hover:bg-blue-900 text-white" onClick={salvarEsteira} disabled={salvando}>
                    <Save className="w-4 h-4 mr-1" /> {salvando ? "Salvando..." : "Salvar esteira"}
                  </Button>
                  <Button variant="outline" className="text-red-600" onClick={excluirEsteira}>
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir esteira
                  </Button>
                </div>

                <div className="rounded-lg border bg-white p-3">
                  <h3 className="text-sm font-semibold mb-2">Leads nesta esteira ({leadsDaEsteiraSel.length})</h3>
                  <div className="mb-3">
                    <Input
                      value={buscaLead}
                      onChange={(ev) => setBuscaLead(ev.target.value)}
                      placeholder="Adicionar lead: buscar por nome ou telefone..."
                      className="h-9"
                    />
                    {resultadosBusca.length > 0 && (
                      <div className="mt-1 rounded-md border divide-y max-h-56 overflow-y-auto">
                        {resultadosBusca.map((l) => {
                          const atual = l.esteira_id ? esteiras.find((e) => e.id === l.esteira_id)?.nome : null;
                          return (
                            <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                              <span className="flex-1 min-w-0 truncate">
                                {l.nome} <span className="text-xs text-muted-foreground">{l.telefone}</span>
                                {atual && <span className="text-[11px] text-amber-700"> · hoje em {atual}</span>}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs shrink-0"
                                onClick={async () => {
                                  try {
                                    await colocarNaEsteira([l.id], rascunho.esteira.id);
                                    toast({ title: "Lead adicionado", description: `${l.nome} no primeiro passo.` });
                                    setBuscaLead("");
                                    await refreshLeads();
                                  } catch (err: any) {
                                    toast({ title: "Erro", description: err?.message, variant: "destructive" });
                                  }
                                }}
                              >
                                {atual ? "Mover para cá" : "Adicionar"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {leadsDaEsteiraSel.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Busque acima, ou na aba Negócios use “Selecionar vários” → “Pôr na esteira”, ou o botão de esteira no card.</p>
                  ) : (
                    <div className="divide-y max-h-80 overflow-y-auto">
                      {leadsDaEsteiraSel.map((l) => {
                        const ps = passosDe(rascunho.esteira.id);
                        const passo = ps[Math.min(l.esteira_passo || 0, Math.max(ps.length - 1, 0))];
                        return (
                          <div key={l.id} className="flex items-center gap-2 py-1.5 text-sm">
                            <span className="flex-1 min-w-0 truncate">{l.nome}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {passo?.titulo || "-"} · {fmtData(l.esteira_proximo)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs shrink-0"
                              onClick={async () => {
                                await tirarDaEsteira([l.id]);
                                await refreshLeads();
                              }}
                            >
                              Tirar
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Crie uma esteira ou importe do Scale.
              </div>
            )}
          </div>
        </TabsContent>

        {/* IMPORTAR */}
        <TabsContent value="importar" className="mt-4 space-y-4">
          <div className="rounded-lg border bg-white p-4 space-y-3 max-w-2xl">
            <p className="text-sm">
              Traz para o Inmovya as categorias (esteiras), as mensagens D1, D2… e o passo em que cada lead está no Inmovya Scale. Os leads são
              encontrados pelo telefone ou, se não houver, pelo nome exato.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={lerDoScale} disabled={lendo}>
                {lendo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                Ler direto do Inmovya Scale
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Usar arquivo de backup (.json)
              </Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => lerArquivo(e.target.files?.[0])} />
            </div>
          </div>

          {plano && (
            <div className="rounded-lg border bg-white p-4 space-y-3 max-w-2xl">
              <h3 className="font-semibold">O que será importado</h3>
              <ul className="text-sm space-y-1">
                {plano.esteiras.map((e) => (
                  <li key={e.scaleId}>
                    <b>{e.nome}</b> — {e.passos.length} passo(s): {e.passos.map((p) => p.titulo).join(", ") || "nenhum"}
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                <b>{plano.leads.length}</b> lead(s) encontrados no Inmovya e posicionados no passo em que estavam.
                {plano.concluidos > 0 && ` ${plano.concluidos} já tinham concluído (não entram).`}
              </p>
              {plano.semCorrespondencia.length > 0 && (
                <p className="text-xs text-amber-700">
                  {plano.semCorrespondencia.length} contato(s) do Scale não foram achados no Inmovya: {plano.semCorrespondencia.slice(0, 15).join(", ")}
                  {plano.semCorrespondencia.length > 15 ? "…" : ""}
                </p>
              )}
              {plano.anexosIgnorados > 0 && (
                <p className="text-xs text-amber-700">
                  {plano.anexosIgnorados} anexo(s) das mensagens não são importados (só o texto). Passos com anexo podem ser marcados como “só colar”.
                </p>
              )}
              <p className="text-xs text-muted-foreground">Importar de novo atualiza as mesmas esteiras, sem duplicar.</p>
              <Button className="bg-blue-800 hover:bg-blue-900 text-white" onClick={importar} disabled={importando}>
                {importando ? "Importando..." : "Importar agora"}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
