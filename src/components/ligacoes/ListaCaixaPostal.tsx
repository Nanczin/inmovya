// Oferta Ativa: baixa um arquivo (planilha .csv) com quem caiu na Caixa Postal / não atendeu, para fazer disparo.
// Só lê: não cria lista e não mexe nos contatos — a oferta ativa segue o curso dela.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, PhoneMissed } from "lucide-react";

export const CAIXA_POSTAL = "Caixa Postal/Cliente Não Atendeu";

type Extrair = (contato: any, lista?: any) => { nome: string; telefone: string; email: string | null };

const digitos = (t?: string | null) => String(t || "").replace(/\D/g, "");

// Por mailing: só os contatos daquela lista (lista)
export function ListaCaixaPostal({ lista, listas, extrair, onCriada }: { lista: any; listas: any[]; extrair: Extrair; onCriada?: (listaId: string, nome?: string) => void }) {
  const { toast } = useToast();
  const [total, setTotal] = useState<number | null>(null); // de hoje
  const [totalGeral, setTotalGeral] = useState<number>(0); // todos os dias
  const [incluirAntigos, setIncluirAntigos] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState<number>(0);
  const [nome, setNome] = useState("");
  const [gerando, setGerando] = useState(false);

  // "de hoje" = classificado como caixa postal hoje (a hora da última mudança do contato)
  const inicioHoje = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };
  const contar = useCallback(async () => {
    const [hoje, geral] = await Promise.all([
      supabase
        .from("contatos")
        .select("id", { count: "exact", head: true })
        .eq("lista_id", lista.id)
        .eq("dados_extras->>classificacao", CAIXA_POSTAL)
        .gte("updated_at", inicioHoje()),
      supabase.from("contatos").select("id", { count: "exact", head: true }).eq("lista_id", lista.id).eq("dados_extras->>classificacao", CAIXA_POSTAL),
    ]);
    setTotal(hoje.error ? null : hoje.count || 0);
    setTotalGeral(geral.count || 0);
  }, [lista.id]);
  const disponiveis = incluirAntigos ? totalGeral : total || 0;

  useEffect(() => {
    contar();
    const t = window.setInterval(contar, 60000);
    return () => window.clearInterval(t);
  }, [contar, listas.length]);

  const abrir = () => {
    setIncluirAntigos(false);
    setQtd(total || 0);
    setNome(`${lista.nome} — Caixa Postal ${new Date().toLocaleDateString("pt-BR")}`);
    setAberto(true);
  };

  const gerar = async () => {
    setGerando(true);
    try {
      // busca todos (em páginas de 1000) — só lê, não muda nada na oferta ativa
      const todos: any[] = [];
      for (let de = 0; ; de += 1000) {
        let q = supabase.from("contatos").select("*").eq("lista_id", lista.id).eq("dados_extras->>classificacao", CAIXA_POSTAL);
        if (!incluirAntigos) q = q.gte("updated_at", inicioHoje());
        const { data, error } = await q.range(de, de + 999);
        if (error) throw error;
        todos.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      // menos tentativas primeiro; um contato por telefone
      todos.sort((a, b) => (a.dados_extras?.tentativas_caixa_postal || 0) - (b.dados_extras?.tentativas_caixa_postal || 0));
      const vistos = new Set<string>();
      const linhas: string[][] = [];
      for (const c of todos) {
        const dados = extrair(c, listas.find((l) => l.id === c.lista_id));
        let tel = digitos(dados.telefone).replace(/^0+/, "");
        const k = tel.slice(-9);
        if (k.length < 8 || vistos.has(k)) continue;
        vistos.add(k);
        if (tel.length <= 11) tel = `55${tel}`; // formato do WhatsApp (55 + DDD + número)
        const nomeC = String(dados.nome || "").trim();
        linhas.push([nomeC, nomeC.split(/\s+/)[0] || "", tel, dados.email || "", String(c.dados_extras?.tentativas_caixa_postal || 0)]);
        if (qtd > 0 && linhas.length >= qtd) break;
      }
      if (!linhas.length) throw new Error("nenhum contato de caixa postal com telefone válido");

      const cel = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [["Nome", "Primeiro nome", "Telefone", "Email", "Tentativas caixa postal"], ...linhas].map((l) => l.map(cel).join(";")).join("\r\n");
      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const arquivo = (nome.trim() || `${lista.nome} - Caixa Postal`).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_");
      link.href = url;
      link.download = `${arquivo}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Arquivo baixado", description: `${linhas.length} contato(s) para disparo. A oferta ativa continua igual.` });
      setAberto(false);
    } catch (e: any) {
      toast({ title: "Não consegui gerar o arquivo", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs sm:text-sm"
        onClick={(e) => {
          e.stopPropagation();
          abrir();
        }}
        disabled={!total && !totalGeral}
        title={`Hoje: ${total ?? 0} na caixa postal neste mailing (no total: ${totalGeral})`}
      >
        <PhoneMissed className="w-3.5 h-3.5 mr-1.5 shrink-0" />
        <span className="truncate">Arquivo da caixa postal (disparo)</span>
        <span className="ml-1.5 rounded-full bg-warning/20 text-foreground px-2 text-xs font-bold tabular-nums">{total ?? "…"} hoje</span>
      </Button>
      <Dialog open={aberto} onOpenChange={(v) => !gerando && setAberto(v)}>
        <DialogContent className="sm:max-w-[440px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Arquivo da caixa postal para disparo</DialogTitle>
            <DialogDescription>
              Hoje, <b>{total}</b> contato(s) do mailing <b>{lista.nome}</b> caíram na Caixa Postal/Não atenderam. Baixe um arquivo (abre no Excel) com nome e telefone para fazer o disparo.
              A oferta ativa não muda: eles continuam na fila para você ligar de novo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">
              Nome do arquivo
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={incluirAntigos}
                onChange={(e) => {
                  setIncluirAntigos(e.target.checked);
                  setQtd(e.target.checked ? totalGeral : total || 0);
                }}
              />
              Incluir também os de dias anteriores ({totalGeral} no total)
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Quantos contatos
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={disponiveis || undefined}
                  className="w-28"
                  value={qtd || ""}
                  onChange={(e) => setQtd(Math.max(0, Math.min(disponiveis, parseInt(e.target.value) || 0)))}
                />
                <span className="text-xs font-normal text-muted-foreground">
                  de {disponiveis} disponíveis {incluirAntigos ? "(todos os dias)" : "(de hoje)"}
                </span>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={gerando}>
              Cancelar
            </Button>
            <Button onClick={gerar} disabled={gerando || !qtd}>
              {gerando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Baixar arquivo com {qtd || 0}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
