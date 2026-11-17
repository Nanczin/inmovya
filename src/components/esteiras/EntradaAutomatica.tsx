// Entrada automática: "quem entrar com a etiqueta X entra na esteira Y".
// Quem coloca o lead na esteira é o banco (gatilho em supabase/esteira_entrada_automatica.sql),
// então funciona mesmo com o Inmovya fechado: o lead novo da Midrah já nasce dentro da esteira.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2, Plus, Trash2, Zap } from "lucide-react";
import type { Esteira } from "@/lib/esteiras";

type Regra = { id: string; etiqueta: string; esteira_id: string; comecar_hoje: boolean; ativo: boolean };

const ETAPAS = ["20%", "50%", "70%"];

const SQL_ATIVACAO = "-- ENTRADA AUTOMÁTICA NAS ESTEIRAS (aba Esteiras do Inmovya → \"Entrada automática\")\n-- Regra: \"quem entrar com a etiqueta X entra na esteira Y\".\n-- Vale para lead novo (captura Midrah, Bitrix, Meta Ads, cadastro, importação) e para lead que GANHA a\n-- etiqueta depois. Olha tags, etiqueta de projeto, origem e etapa (ex.: 20%).\n-- Não mexe em quem já está numa esteira nem em quem já respondeu/fechou.\n-- Rode uma vez no Supabase: SQL Editor → colar tudo → Run.\n\ncreate table if not exists public.esteira_regras (\n  id uuid primary key default gen_random_uuid(),\n  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,\n  etiqueta text not null,\n  esteira_id uuid not null references public.esteiras(id) on delete cascade,\n  comecar_hoje boolean not null default false,\n  ativo boolean not null default true,\n  created_at timestamptz not null default now()\n);\nalter table public.esteira_regras enable row level security;\ndrop policy if exists esteira_regras_dono on public.esteira_regras;\ncreate policy esteira_regras_dono on public.esteira_regras\n  for all using (user_id = auth.uid()) with check (user_id = auth.uid());\ncreate index if not exists esteira_regras_user_idx on public.esteira_regras (user_id, ativo);\n\ncreate or replace function public.leads_esteira_automatica()\nreturns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  v_agora text[];\n  v_antes text[] := '{}';\n  v_regra record;\nbegin\n  if new.esteira_id is not null then return new; end if;\n  if coalesce(new.status, '') in ('Respondeu', 'Fechado', 'Perdido', 'Deny List') then return new; end if;\n\n  v_agora := coalesce(new.tags, '{}'::text[]) || coalesce(new.etiqueta_projeto, '{}'::text[])\n             || array[coalesce(new.origem, ''), coalesce(new.status, '')];\n  if tg_op = 'UPDATE' then\n    v_antes := coalesce(old.tags, '{}'::text[]) || coalesce(old.etiqueta_projeto, '{}'::text[])\n               || array[coalesce(old.origem, ''), coalesce(old.status, '')];\n  end if;\n\n  -- a etiqueta precisa ter acabado de chegar (lead novo ou etiqueta nova)\n  select r.esteira_id, r.comecar_hoje into v_regra\n  from public.esteira_regras r\n  join public.esteiras e on e.id = r.esteira_id\n  where r.user_id = new.user_id and r.ativo\n    and exists (select 1 from unnest(v_agora) x where public.projeto_norm(x) <> '' and public.projeto_norm(x) = public.projeto_norm(r.etiqueta))\n    and not exists (select 1 from unnest(v_antes) x where public.projeto_norm(x) <> '' and public.projeto_norm(x) = public.projeto_norm(r.etiqueta))\n  order by r.created_at\n  limit 1;\n\n  if found then\n    new.esteira_id := v_regra.esteira_id;\n    new.esteira_passo := 0;\n    -- padrão: começa no dia seguinte (o 1º contato sai hoje); ou hoje mesmo\n    new.esteira_proximo := case\n      when v_regra.comecar_hoje then now()\n      else (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo'\n    end;\n  end if;\n  return new;\nend;\n$$;\n\n-- \"zz_\" para rodar depois do gatilho que calcula a etiqueta de projeto\ndrop trigger if exists zz_leads_esteira_automatica on public.leads;\ncreate trigger zz_leads_esteira_automatica\nbefore insert or update of tags, etiqueta_projeto, origem, status, projeto_origem, observacoes on public.leads\nfor each row execute function public.leads_esteira_automatica();\n\nnotify pgrst, 'reload schema';\n";

export function EntradaAutomatica({ esteiras }: { esteiras: Esteira[] }) {
  const sqlAtivacao = SQL_ATIVACAO;
  const { toast } = useToast();
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
    setNova({ etiqueta: "", esteira_id: nova.esteira_id, comecar_hoje: nova.comecar_hoje });
    toast({ title: "Regra criada", description: `Quem entrar com “${etiqueta}” vai para ${nomeEsteira.get(nova.esteira_id)}.` });
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
                  {regras.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-semibold">“{r.etiqueta}”</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold">{nomeEsteira.get(r.esteira_id) || "esteira apagada"}</span>
                      <span className="text-xs text-muted-foreground">· começa {r.comecar_hoje ? "no mesmo dia" : "no dia seguinte"}</span>
                      <span className="flex-1" />
                      <Switch checked={r.ativo} onCheckedChange={(v) => mudar(r, { ativo: v })} aria-label={`Ligar regra ${r.etiqueta}`} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => apagar(r)} aria-label={`Apagar regra ${r.etiqueta}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
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
                <Button className="h-9" disabled={!nova.etiqueta.trim() || !nova.esteira_id || salvando} onClick={adicionar}>
                  {salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Criar regra
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Vale para lead novo (Midrah, Bitrix, Meta Ads, cadastro, importação) e para quem ganhar a etiqueta depois. Confere origem, tags, etiqueta de projeto e etapa
                (20%, 50%…). Não mexe em quem já está numa esteira nem em quem respondeu ou fechou. “No dia seguinte” deixa o 1º contato sair antes, sem mensagem repetida
                no mesmo dia. O envio dos passos continua pelo piloto automático.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
