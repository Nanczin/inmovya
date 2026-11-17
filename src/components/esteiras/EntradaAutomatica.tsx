// Entrada automática: "quem entrar com a etiqueta X entra na esteira Y".
// Quem coloca o lead na esteira é o banco (gatilho em supabase/esteira_entrada_automatica.sql),
// então funciona mesmo com o Inmovya fechado: o lead novo da Midrah já nasce dentro da esteira.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2, Pencil, Plus, Trash2, Zap } from "lucide-react";
import type { Esteira } from "@/lib/esteiras";
import { useLeads } from "@/context/LeadsContext";

type Regra = { id: string; etiqueta: string; esteira_id: string; comecar_hoje: boolean; ativo: boolean };

const ETAPAS: string[] = []; // etapas de negociação não entram em esteira automática

const norm = (t?: string | null) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
// quem nunca entra pela regra
// e quem está em negociação (20%, 50%, 70%) nunca é puxado para esteira automática
const FORA = new Set(["respondeu", "fechado", "perdido", "deny list", "20%", "50%", "70%", "75%"]);

/** Leads fora de esteira que têm a etiqueta (origem, tags, etiqueta de projeto ou etapa). */
async function leadsComEtiqueta(etiqueta: string) {
  const alvo = norm(etiqueta);
  if (!alvo) return [];
  const { data, error } = await supabase.from("leads").select("id, nome, status, tags, origem, etiqueta_projeto, esteira_id").is("esteira_id", null).limit(5000);
  if (error) throw error;
  return (data || []).filter((l: any) => !FORA.has(norm(l.status)) && [...(l.tags || []), ...(l.etiqueta_projeto || []), l.origem, l.status].some((v) => norm(v) === alvo));
}

/** Coloca os leads no 1º passo da esteira, começando hoje ou amanhã. */
async function colocarLeads(ids: string[], esteiraId: string, comecarHoje: boolean) {
  const inicio = new Date();
  if (!comecarHoje) {
    inicio.setDate(inicio.getDate() + 1);
    inicio.setHours(0, 0, 0, 0);
  }
  let erro = "";
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase
      .from("leads")
      .update({ esteira_id: esteiraId, esteira_passo: 0, esteira_proximo: inicio.toISOString() })
      .in("id", ids.slice(i, i + 200))
      .is("esteira_id", null);
    if (error) erro = error.message;
  }
  return erro;
}

const contarPorEtapa = (leads: any[]) =>
  Object.entries(
    leads.reduce((acc: Record<string, number>, l: any) => {
      const k = l.status || "Sem etapa";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => (b[1] as number) - (a[1] as number)) as [string, number][];

const SQL_ATIVACAO = "-- ENTRADA AUTOMÁTICA NAS ESTEIRAS (aba Esteiras do Inmovya → \"Entrada automática\")\n-- Regra: \"quem entrar com a etiqueta X entra na esteira Y\".\n-- Vale para lead novo (captura Midrah, Bitrix, Meta Ads, cadastro, importação) e para lead que GANHA a\n-- etiqueta depois. Olha tags, etiqueta de projeto, origem e etapa (ex.: 20%).\n-- Não mexe em quem já está numa esteira nem em quem já respondeu/fechou.\n-- Rode uma vez no Supabase: SQL Editor → colar tudo → Run.\n\ncreate table if not exists public.esteira_regras (\n  id uuid primary key default gen_random_uuid(),\n  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,\n  etiqueta text not null,\n  esteira_id uuid not null references public.esteiras(id) on delete cascade,\n  comecar_hoje boolean not null default false,\n  ativo boolean not null default true,\n  created_at timestamptz not null default now()\n);\nalter table public.esteira_regras enable row level security;\ndrop policy if exists esteira_regras_dono on public.esteira_regras;\ncreate policy esteira_regras_dono on public.esteira_regras\n  for all using (user_id = auth.uid()) with check (user_id = auth.uid());\ncreate index if not exists esteira_regras_user_idx on public.esteira_regras (user_id, ativo);\n\ncreate or replace function public.leads_esteira_automatica()\nreturns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  v_agora text[];\n  v_antes text[] := '{}';\n  v_regra record;\nbegin\n  if new.esteira_id is not null then return new; end if;\n  if coalesce(new.status, '') in ('Respondeu', 'Fechado', 'Perdido', 'Deny List', '20%', '50%', '70%', '75%') then return new; end if;\n\n  v_agora := coalesce(new.tags, '{}'::text[]) || coalesce(new.etiqueta_projeto, '{}'::text[])\n             || array[coalesce(new.origem, ''), coalesce(new.status, '')];\n  if tg_op = 'UPDATE' then\n    v_antes := coalesce(old.tags, '{}'::text[]) || coalesce(old.etiqueta_projeto, '{}'::text[])\n               || array[coalesce(old.origem, ''), coalesce(old.status, '')];\n  end if;\n\n  -- a etiqueta precisa ter acabado de chegar (lead novo ou etiqueta nova)\n  select r.esteira_id, r.comecar_hoje into v_regra\n  from public.esteira_regras r\n  join public.esteiras e on e.id = r.esteira_id\n  where r.user_id = new.user_id and r.ativo\n    and exists (select 1 from unnest(v_agora) x where public.projeto_norm(x) <> '' and public.projeto_norm(x) = public.projeto_norm(r.etiqueta))\n    and not exists (select 1 from unnest(v_antes) x where public.projeto_norm(x) <> '' and public.projeto_norm(x) = public.projeto_norm(r.etiqueta))\n  order by r.created_at\n  limit 1;\n\n  if found then\n    new.esteira_id := v_regra.esteira_id;\n    new.esteira_passo := 0;\n    -- padrão: começa no dia seguinte (o 1º contato sai hoje); ou hoje mesmo\n    new.esteira_proximo := case\n      when v_regra.comecar_hoje then now()\n      else (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo'\n    end;\n  end if;\n  return new;\nend;\n$$;\n\n-- \"zz_\" para rodar depois do gatilho que calcula a etiqueta de projeto\ndrop trigger if exists zz_leads_esteira_automatica on public.leads;\ncreate trigger zz_leads_esteira_automatica\nbefore insert or update of tags, etiqueta_projeto, origem, status, projeto_origem, observacoes on public.leads\nfor each row execute function public.leads_esteira_automatica();\n\nnotify pgrst, 'reload schema';\n";

export function EntradaAutomatica({ esteiras }: { esteiras: Esteira[] }) {
  const sqlAtivacao = SQL_ATIVACAO;
  const { toast } = useToast();
  const { refreshLeads } = useLeads();
  const [regras, setRegras] = useState<Regra[]>([]);
  const [faltaAtivar, setFaltaAtivar] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [nova, setNova] = useState({ etiqueta: "", esteira_id: "", comecar_hoje: false });
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await (supabase.from as any)("esteira_regras").select("*").order("created_at");
    if (error) {
      setFaltaAtivar(/esteira_regras|42P01|PGRST205|schema cache|does not exist/i.test(`${error.code} ${error.message}`));
      setRegras([]);
    } else {
      setFaltaAtivar(false);
      setRegras((data || []) as Regra[]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // etiquetas que já existem nos leads (origem, tags, etiqueta de projeto) + etapas
  useEffect(() => {
    if (!aberto || sugestoes.length) return;
    (async () => {
      const contagem = new Map<string, number>();
      const somar = (t?: string | null) => {
        const v = String(t || "").trim();
        if (v) contagem.set(v, (contagem.get(v) || 0) + 1);
      };
      const { data } = await supabase.from("leads").select("tags, etiqueta_projeto, origem").order("created_at", { ascending: false }).limit(1500);
      (data || []).forEach((l: any) => {
        (l.tags || []).forEach(somar);
        (l.etiqueta_projeto || []).forEach(somar);
        somar(l.origem);
      });
      const { data: proj } = await (supabase.from as any)("projeto_etiquetas").select("etiqueta");
      (proj || []).forEach((p: any) => somar(p.etiqueta));
      ETAPAS.forEach(somar);
      setSugestoes(Array.from(contagem.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 80));
    })();
  }, [aberto, sugestoes.length]);

  const nomeEsteira = useMemo(() => new Map(esteiras.map((e) => [e.id, e.nome])), [esteiras]);
  const ativas = regras.filter((r) => r.ativo && nomeEsteira.has(r.esteira_id));

  // ao criar a regra: quem JÁ tem a etiqueta entra junto, conforme as etapas marcadas
  const [previa, setPrevia] = useState<{ etiqueta: string; leads: any[]; marcadas: Record<string, boolean>; carregando: boolean } | null>(null);
  useEffect(() => {
    const etq = nova.etiqueta.trim();
    if (!etq || faltaAtivar) {
      setPrevia(null);
      return;
    }
    let cancelado = false;
    setPrevia((p) => ({ etiqueta: etq, leads: p?.etiqueta === etq ? p.leads : [], marcadas: p?.etiqueta === etq ? p.marcadas : {}, carregando: true }));
    const t = window.setTimeout(async () => {
      try {
        const leads = await leadsComEtiqueta(etq);
        if (cancelado) return;
        const marcadas: Record<string, boolean> = {};
        leads.forEach((l: any) => (marcadas[l.status || "Sem etapa"] = true));
        setPrevia({ etiqueta: etq, leads, marcadas, carregando: false });
      } catch {
        if (!cancelado) setPrevia(null);
      }
    }, 500);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [nova.etiqueta, faltaAtivar]);
  const previaEscolhidos = previa && !previa.carregando ? previa.leads.filter((l: any) => previa.marcadas[l.status || "Sem etapa"]) : [];

  const adicionar = async () => {
    const etiqueta = nova.etiqueta.trim();
    if (!etiqueta || !nova.esteira_id) return;
    if (regras.some((r) => r.etiqueta.trim().toLowerCase() === etiqueta.toLowerCase() && r.ativo)) {
      toast({ title: "Já existe uma regra para essa etiqueta", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const { error } = await (supabase.from as any)("esteira_regras").insert({ etiqueta, esteira_id: nova.esteira_id, comecar_hoje: nova.comecar_hoje });
    setSalvando(false);
    if (error) {
      toast({ title: "Não consegui salvar a regra", description: error.message, variant: "destructive" });
      return;
    }
    // quem já tem a etiqueta entra agora, só das etapas marcadas
    const ids = previa?.etiqueta === etiqueta ? previaEscolhidos.map((l: any) => l.id) : [];
    let extra = "";
    if (ids.length) {
      const erro = await colocarLeads(ids, nova.esteira_id, nova.comecar_hoje);
      extra = erro ? ` Alguns leads antigos não entraram: ${erro}` : ` ${ids.length} lead(s) que já tinham a etiqueta entraram agora.`;
      refreshLeads();
    }
    setNova({ etiqueta: "", esteira_id: nova.esteira_id, comecar_hoje: nova.comecar_hoje });
    setPrevia(null);
    toast({ title: "Regra criada", description: `Quem entrar com “${etiqueta}” vai para ${nomeEsteira.get(nova.esteira_id)}.${extra}` });
    carregar();
  };

  const mudar = async (r: Regra, campos: Partial<Regra>) => {
    setRegras((lista) => lista.map((x) => (x.id === r.id ? { ...x, ...campos } : x)));
    const { error } = await (supabase.from as any)("esteira_regras").update(campos).eq("id", r.id);
    if (error) {
      toast({ title: "Não consegui salvar", description: error.message, variant: "destructive" });
      carregar();
    }
  };

  // ---------- puxar quem JÁ tem a etiqueta (a regra sozinha só pega quem chega daqui para frente) ----------
  const [puxar, setPuxar] = useState<{ regra: Regra; leads: any[]; marcadas: Record<string, boolean>; carregando: boolean; colocando: boolean } | null>(null);
  const abrirPuxar = async (r: Regra) => {
    setPuxar({ regra: r, leads: [], marcadas: {}, carregando: true, colocando: false });
    let leads: any[] = [];
    try {
      leads = await leadsComEtiqueta(r.etiqueta);
    } catch (e: any) {
      toast({ title: "Não consegui buscar os leads", description: e?.message, variant: "destructive" });
      setPuxar(null);
      return;
    }
    const marcadas: Record<string, boolean> = {};
    leads.forEach((l: any) => (marcadas[l.status || "Sem etapa"] = true));
    setPuxar({ regra: r, leads, marcadas, carregando: false, colocando: false });
  };
  const escolhidos = puxar ? puxar.leads.filter((l: any) => puxar.marcadas[l.status || "Sem etapa"]) : [];
  const colocarEscolhidos = async () => {
    if (!puxar || !escolhidos.length) return;
    setPuxar({ ...puxar, colocando: true });
    const ids = escolhidos.map((l: any) => l.id);
    const erro = await colocarLeads(ids, puxar.regra.esteira_id, puxar.regra.comecar_hoje);
    if (erro) toast({ title: "Alguns leads não entraram", description: erro, variant: "destructive" });
    else toast({ title: `${ids.length} lead(s) entraram na esteira`, description: `${nomeEsteira.get(puxar.regra.esteira_id)} · começa ${puxar.regra.comecar_hoje ? "hoje" : "amanhã"}.` });
    setPuxar(null);
    refreshLeads();
  };

  // editar regra (não mexe em quem já está na esteira)
  const [editando, setEditando] = useState<{ id: string; etiqueta: string; esteira_id: string; comecar_hoje: boolean; salvando: boolean } | null>(null);
  const salvarEdicao = async () => {
    if (!editando) return;
    const etiqueta = editando.etiqueta.trim();
    if (!etiqueta || !editando.esteira_id) return;
    if (regras.some((r) => r.id !== editando.id && r.ativo && r.etiqueta.trim().toLowerCase() === etiqueta.toLowerCase())) {
      toast({ title: "Já existe outra regra para essa etiqueta", variant: "destructive" });
      return;
    }
    setEditando({ ...editando, salvando: true });
    const campos = { etiqueta, esteira_id: editando.esteira_id, comecar_hoje: editando.comecar_hoje };
    const { error } = await (supabase.from as any)("esteira_regras").update(campos).eq("id", editando.id);
    if (error) {
      toast({ title: "Não consegui salvar a regra", description: error.message, variant: "destructive" });
      setEditando({ ...editando, salvando: false });
      return;
    }
    setRegras((lista) => lista.map((x) => (x.id === editando.id ? { ...x, ...campos } : x)));
    setEditando(null);
    toast({ title: "Regra atualizada", description: `Quem entrar com “${etiqueta}” vai para ${nomeEsteira.get(campos.esteira_id)}. Quem já estava numa esteira continua onde está.` });
  };

  const apagar = async (r: Regra) => {
    setRegras((lista) => lista.filter((x) => x.id !== r.id));
    const { error } = await (supabase.from as any)("esteira_regras").delete().eq("id", r.id);
    if (error) {
      toast({ title: "Não consegui apagar", description: error.message, variant: "destructive" });
      carregar();
    }
  };

  const copiarSql = async () => {
    try {
      await navigator.clipboard.writeText(sqlAtivacao);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de copiar */
    }
  };

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${ativas.length ? "border-primary/40 bg-primary/[0.04]" : "bg-card"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Zap className={`w-5 h-5 shrink-0 ${ativas.length ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm font-extrabold">Entrada automática {ativas.length ? `· ${ativas.length} regra${ativas.length > 1 ? "s" : ""}` : ""}</div>
          <div className="text-xs text-muted-foreground">
            {faltaAtivar
              ? "Precisa ativar uma vez no Supabase."
              : ativas.length
                ? ativas.map((r) => `${r.etiqueta} → ${nomeEsteira.get(r.esteira_id)}`).join(" · ")
                : "Quem entrar com uma etiqueta (ex.: Midrah) entra sozinho na esteira que você escolher."}
          </div>
        </div>
        <Button variant="ghost" className="h-10 px-3 text-sm" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
          {aberto ? "Fechar" : "Regras"}
        </Button>
      </div>

      {aberto && (
        <div className="flex flex-col gap-3 border-t pt-3">
          {carregando ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : faltaAtivar ? (
            <div className="text-sm space-y-2">
              <p className="text-muted-foreground">
                Para a entrada automática funcionar até com o Inmovya fechado, ela fica no banco. Ative uma vez: abra o Supabase → <b className="text-foreground">SQL Editor</b>,
                cole o comando e clique em <b className="text-foreground">Run</b>. Depois toque em “Já ativei”.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="h-9" onClick={copiarSql}>
                  {copiado ? <Check className="w-4 h-4 mr-1" /> : null}
                  {copiado ? "Copiado" : "Copiar comando de ativação"}
                </Button>
                <Button size="sm" className="h-9" onClick={carregar}>
                  Já ativei
                </Button>
              </div>
            </div>
          ) : (
            <>
              {regras.length > 0 && (
                <div className="flex flex-col divide-y rounded-xl border bg-card">
                  {regras.map((r) =>
                    editando?.id === r.id ? (
                      <div key={r.id} className="flex flex-wrap items-end gap-2 px-3 py-2 text-sm bg-muted/40">
                        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                          Etiqueta
                          <Input
                            list="esteira-regra-etiquetas"
                            className="h-9 w-[170px]"
                            value={editando.etiqueta}
                            onChange={(ev) => setEditando({ ...editando, etiqueta: ev.target.value })}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") salvarEdicao();
                              if (ev.key === "Escape") setEditando(null);
                            }}
                            autoFocus
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                          Esteira
                          <select
                            className="h-9 w-[190px] rounded-md border bg-background px-2 text-sm text-foreground"
                            value={editando.esteira_id}
                            onChange={(ev) => setEditando({ ...editando, esteira_id: ev.target.value })}
                          >
                            {!nomeEsteira.has(editando.esteira_id) && <option value="">Escolha…</option>}
                            {esteiras.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.nome}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                          Começa
                          <select
                            className="h-9 w-[160px] rounded-md border bg-background px-2 text-sm text-foreground"
                            value={editando.comecar_hoje ? "hoje" : "amanha"}
                            onChange={(ev) => setEditando({ ...editando, comecar_hoje: ev.target.value === "hoje" })}
                          >
                            <option value="amanha">no dia seguinte</option>
                            <option value="hoje">no mesmo dia</option>
                          </select>
                        </label>
                        <Button className="h-9" disabled={!editando.etiqueta.trim() || !editando.esteira_id || editando.salvando} onClick={salvarEdicao}>
                          {editando.salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Salvar
                        </Button>
                        <Button variant="ghost" className="h-9" onClick={() => setEditando(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                    <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-semibold">“{r.etiqueta}”</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold">{nomeEsteira.get(r.esteira_id) || "esteira apagada"}</span>
                      <span className="text-xs text-muted-foreground">· começa {r.comecar_hoje ? "no mesmo dia" : "no dia seguinte"}</span>
                      <span className="flex-1" />
                      <Button variant="outline" size="sm" className="h-8" onClick={() => abrirPuxar(r)} disabled={!r.ativo || !nomeEsteira.has(r.esteira_id)}>
                        Puxar quem já tem
                      </Button>
                      <Switch checked={r.ativo} onCheckedChange={(v) => mudar(r, { ativo: v })} aria-label={`Ligar regra ${r.etiqueta}`} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditando({ id: r.id, etiqueta: r.etiqueta, esteira_id: nomeEsteira.has(r.esteira_id) ? r.esteira_id : "", comecar_hoje: r.comecar_hoje, salvando: false })}
                        aria-label={`Editar regra ${r.etiqueta}`}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => apagar(r)} aria-label={`Apagar regra ${r.etiqueta}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    )
                  )}
                </div>
              )}

              {puxar && (
                <div className="rounded-xl border border-primary/40 bg-card p-3 space-y-2 text-sm">
                  {puxar.carregando ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Procurando leads com “{puxar.regra.etiqueta}”…
                    </div>
                  ) : puxar.leads.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1">Nenhum lead com “{puxar.regra.etiqueta}” fora de esteira.</span>
                      <Button variant="ghost" size="sm" onClick={() => setPuxar(null)}>Fechar</Button>
                    </div>
                  ) : (
                    <>
                      <p>
                        <b>{puxar.leads.length}</b> lead(s) já têm “{puxar.regra.etiqueta}” e estão fora de esteira (sem contar 20%, 50%, 70%, quem respondeu, fechou ou está na Deny List).
                        Escolha as etapas que entram em <b>{nomeEsteira.get(puxar.regra.esteira_id)}</b>:
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {contarPorEtapa(puxar.leads).map(([etapa, n]) => (
                          <label key={etapa} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!puxar.marcadas[etapa]}
                              onChange={(ev) => setPuxar({ ...puxar, marcadas: { ...puxar.marcadas, [etapa]: ev.target.checked } })}
                            />
                            {etapa} <span className="text-muted-foreground">({n})</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Começam {puxar.regra.comecar_hoje ? "hoje" : "amanhã"} pelo 1º passo. O piloto automático manda no ritmo de sempre (2 a 3 min entre mensagens e as pausas da esteira),
                        então muitos leads podem levar mais de um dia para receber.
                      </p>
                      <div className="flex gap-2">
                        <Button className="h-9" disabled={!escolhidos.length || puxar.colocando} onClick={colocarEscolhidos}>
                          {puxar.colocando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                          Colocar {escolhidos.length} na esteira
                        </Button>
                        <Button variant="ghost" className="h-9" onClick={() => setPuxar(null)}>Cancelar</Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  Quem entrar com a etiqueta
                  <Input
                    list="esteira-regra-etiquetas"
                    className="h-9 w-[200px]"
                    placeholder="ex.: Midrah"
                    value={nova.etiqueta}
                    onChange={(ev) => setNova({ ...nova, etiqueta: ev.target.value })}
                  />
                  <datalist id="esteira-regra-etiquetas">
                    {sugestoes.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  entra na esteira
                  <select
                    className="h-9 w-[200px] rounded-md border bg-background px-2 text-sm text-foreground"
                    value={nova.esteira_id}
                    onChange={(ev) => setNova({ ...nova, esteira_id: ev.target.value })}
                  >
                    <option value="">Escolha…</option>
                    {esteiras.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  e começa
                  <select
                    className="h-9 w-[190px] rounded-md border bg-background px-2 text-sm text-foreground"
                    value={nova.comecar_hoje ? "hoje" : "amanha"}
                    onChange={(ev) => setNova({ ...nova, comecar_hoje: ev.target.value === "hoje" })}
                  >
                    <option value="amanha">no dia seguinte (recomendado)</option>
                    <option value="hoje">no mesmo dia</option>
                  </select>
                </label>
                <Button className="h-9" disabled={!nova.etiqueta.trim() || !nova.esteira_id || salvando || !!previa?.carregando} onClick={adicionar}>
                  {salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  {previaEscolhidos.length ? `Criar regra e puxar ${previaEscolhidos.length}` : "Criar regra"}
                </Button>
              </div>
              {previa && (
                <div className="rounded-xl border bg-card p-3 text-sm space-y-2">
                  {previa.carregando ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Procurando quem já tem “{previa.etiqueta}”…
                    </div>
                  ) : previa.leads.length === 0 ? (
                    <p className="text-muted-foreground">Ninguém fora de esteira tem “{previa.etiqueta}” hoje. A regra vale para quem chegar daqui para frente.</p>
                  ) : (
                    <>
                      <p>
                        <b>{previa.leads.length}</b> lead(s) já têm “{previa.etiqueta}” e estão fora de esteira. Ao criar a regra, entram junto os das etapas marcadas:
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {contarPorEtapa(previa.leads).map(([etapa, n]) => (
                          <label key={etapa} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!previa.marcadas[etapa]}
                              onChange={(ev) => setPrevia({ ...previa, marcadas: { ...previa.marcadas, [etapa]: ev.target.checked } })}
                            />
                            {etapa} <span className="text-muted-foreground">({n})</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Desmarque as etapas que não devem entrar. Eles começam {nova.comecar_hoje ? "hoje" : "amanhã"} pelo 1º passo, no ritmo do piloto automático.
                      </p>
                    </>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                A regra pega lead novo (Midrah, Bitrix, Meta Ads, cadastro, importação) e quem ganhar a etiqueta depois. Para quem já tinha a etiqueta antes da regra, use “Puxar quem já tem”. Confere origem, tags, etiqueta de projeto e etapa
                (20%, 50%…). Nunca puxa quem está em 20%, 50% ou 70%, nem quem já está numa esteira, respondeu ou fechou. “No dia seguinte” deixa o 1º contato sair antes, sem mensagem repetida
                no mesmo dia. O envio dos passos continua pelo piloto automático.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
