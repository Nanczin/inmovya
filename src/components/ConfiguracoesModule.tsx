import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Database, HardDrive, Moon, Sun, Monitor, RefreshCw, AlertTriangle, Check } from "lucide-react";

type Uso = {
  banco_bytes: number;
  storage_bytes: number;
  tabelas: { nome: string; bytes: number; linhas: number }[];
  medido_em: string;
};

// Limites do Supabase por plano (banco / arquivos)
const PLANOS = {
  free: { nome: "Gratuito", banco: 500 * 1024 ** 2, storage: 1024 ** 3 },
  pro: { nome: "Pro", banco: 8 * 1024 ** 3, storage: 100 * 1024 ** 3 },
} as const;
type Plano = keyof typeof PLANOS;
const CHAVE_PLANO = "inmovya_plano_supabase";

// nomes amigáveis das tabelas mais comuns
const NOMES: Record<string, string> = {
  leads: "Leads",
  lead_timeline: "Histórico dos leads",
  contatos: "Contatos do mailing",
  listas_contatos: "Listas do mailing",
  ligacoes: "Ligações",
  tasks: "Agenda",
  esteiras: "Esteiras",
  esteira_passos: "Passos das esteiras",
  email_logs: "Registro de e-mails",
  email_queue: "Fila de e-mails",
  whatsapp_campaign_messages: "Mensagens de campanhas",
  whatsapp_campaigns: "Campanhas de WhatsApp",
  materiais: "Materiais",
  mensagem_templates: "Templates",
  notifications: "Notificações",
  profiles: "Perfis",
};

export const formatarBytes = (b: number) => {
  if (!b) return "0 MB";
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(b < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

const CORES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function Medidor({ usado, limite, partes }: { usado: number; limite: number; partes?: { nome: string; bytes: number }[] }) {
  const pct = Math.min(100, (usado / limite) * 100);
  const nivel = pct >= 90 ? "text-destructive" : pct >= 70 ? "text-warning" : "text-success";
  const top = (partes || []).slice(0, 5);
  const resto = Math.max(0, usado - top.reduce((t, p) => t + p.bytes, 0));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="text-3xl font-extrabold tracking-tight tabular-nums">
          {formatarBytes(usado)}
          <span className="text-base font-semibold text-muted-foreground"> de {formatarBytes(limite)}</span>
        </div>
        <div className={`text-sm font-bold tabular-nums ${nivel}`}>{pct.toFixed(pct < 1 ? 1 : 0)}% usado</div>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex" role="meter" aria-valuemin={0} aria-valuemax={limite} aria-valuenow={usado}>
        {top.length ? (
          <>
            {top.map((p, i) => (
              <div key={p.nome} className={`${CORES[i]} h-full`} style={{ width: `${(p.bytes / limite) * 100}%` }} title={`${NOMES[p.nome] || p.nome}: ${formatarBytes(p.bytes)}`} />
            ))}
            <div className="bg-chart-muted h-full" style={{ width: `${(resto / limite) * 100}%` }} title={`Outros: ${formatarBytes(resto)}`} />
          </>
        ) : (
          <div className="bg-chart-1 h-full" style={{ width: `${pct}%` }} />
        )}
      </div>
      {top.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-muted-foreground">
          {top.map((p, i) => (
            <span key={p.nome} className="inline-flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${CORES[i]}`} />
              {NOMES[p.nome] || p.nome} <span className="tabular-nums text-foreground/80">{formatarBytes(p.bytes)}</span>
            </span>
          ))}
          {resto > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-chart-muted" />
              Outros <span className="tabular-nums text-foreground/80">{formatarBytes(resto)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ConfiguracoesModule() {
  const { theme, setTheme } = useTheme();
  const [uso, setUso] = useState<Uso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [plano, setPlanoState] = useState<Plano>(() => {
    try {
      return (localStorage.getItem(CHAVE_PLANO) as Plano) || "free";
    } catch {
      return "free";
    }
  });
  const setPlano = (p: Plano) => {
    setPlanoState(p);
    try {
      localStorage.setItem(CHAVE_PLANO, p);
    } catch {
      /* ignore */
    }
  };

  const medir = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await (supabase.rpc as any)("uso_banco");
    if (error) {
      setErro(/uso_banco|PGRST202|does not exist/i.test(error.message) ? "sql" : error.message);
      setUso(null);
    } else setUso(data as Uso);
    setCarregando(false);
  }, []);

  useEffect(() => {
    medir();
  }, [medir]);

  const limites = PLANOS[plano];
  const tabelas = useMemo(() => (uso?.tabelas || []).filter((t) => t.bytes > 0), [uso]);

  const temas = [
    { id: "light", nome: "Claro", icon: Sun },
    { id: "dark", nome: "Escuro", icon: Moon },
    { id: "system", nome: "Do sistema", icon: Monitor },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Espaço do banco de dados</h2>
              <p className="text-sm text-muted-foreground">Leads, histórico, agenda, ligações e o resto dos seus dados.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border p-0.5 text-xs">
              {(Object.keys(PLANOS) as Plano[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlano(p)}
                  className={`px-2.5 py-1 rounded-md font-semibold ${plano === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Plano {PLANOS[p].nome}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={medir} disabled={carregando} title="Medir de novo">
              <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {erro === "sql" ? (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm flex gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Falta um passo no Supabase para medir o espaço</p>
              <p className="text-muted-foreground mt-1">
                Abra o SQL Editor do Supabase, cole o arquivo <code className="text-foreground">supabase/uso_banco.sql</code> e clique em Run. Depois toque em medir de novo.
              </p>
            </div>
          </div>
        ) : erro ? (
          <p className="text-sm text-destructive">Não consegui medir: {erro}</p>
        ) : !uso ? (
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
        ) : (
          <>
            <Medidor usado={uso.banco_bytes} limite={limites.banco} partes={tabelas} />
            {uso.banco_bytes / limites.banco >= 0.8 && (
              <p className="mt-4 text-sm text-warning font-medium">
                O banco está perto do limite do plano. Apague históricos antigos ou mude de plano no Supabase.
              </p>
            )}
            <div className="mt-6 grid sm:grid-cols-2 gap-x-8">
              {tabelas.slice(0, 10).map((t) => (
                <div key={t.nome} className="flex items-center justify-between gap-3 py-2 border-b last:border-0 sm:[&:nth-last-child(2)]:border-0 text-sm">
                  <span className="truncate">{NOMES[t.nome] || t.nome}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {t.linhas.toLocaleString("pt-BR")} linhas · <span className="text-foreground font-medium">{formatarBytes(t.bytes)}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {uso && (
        <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Arquivos guardados</h2>
              <p className="text-sm text-muted-foreground">Materiais, áudios e anexos que estão no Supabase (não conta o que fica no seu computador).</p>
            </div>
          </div>
          <Medidor usado={uso.storage_bytes} limite={limites.storage} />
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-card">
        <h2 className="font-bold text-lg leading-tight mb-1">Aparência</h2>
        <p className="text-sm text-muted-foreground mb-4">Fica salvo neste navegador.</p>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          {temas.map((t) => {
            const Icon = t.icon;
            const ativo = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`relative rounded-xl border p-3 text-left transition-colors ${ativo ? "border-primary ring-2 ring-primary/25" : "hover:bg-muted"}`}
              >
                <Icon className={`w-5 h-5 mb-2 ${ativo ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-sm font-semibold">{t.nome}</div>
                {ativo && <Check className="w-4 h-4 text-primary absolute top-3 right-3" />}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
