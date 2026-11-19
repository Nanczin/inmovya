// Oferta Ativa: junta numa lista nova quem caiu na Caixa Postal / não atendeu, para ligar de novo de uma vez.
// Os contatos saem da lista de origem (para não ligar duas vezes) e entram "zerados" na lista nova,
// levando junto o número de tentativas de caixa postal (a regra das 8 tentativas continua valendo).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, PhoneMissed } from "lucide-react";

export const CAIXA_POSTAL = "Caixa Postal/Cliente Não Atendeu";
const MOVIDO = "Movido para lista de Caixa Postal";

type Extrair = (contato: any, lista?: any) => { nome: string; telefone: string; email: string | null };

const digitos = (t?: string | null) => String(t || "").replace(/\D/g, "");

export function ListaCaixaPostal({ listas, extrair, onCriada }: { listas: any[]; extrair: Extrair; onCriada: (listaId: string) => void }) {
  const { toast } = useToast();
  const [total, setTotal] = useState<number | null>(null);
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState<number>(0);
  const [nome, setNome] = useState("");
  const [gerando, setGerando] = useState(false);

  const contar = useCallback(async () => {
    const { count, error } = await supabase
      .from("contatos")
      .select("id", { count: "exact", head: true })
      .eq("dados_extras->>classificacao", CAIXA_POSTAL);
    setTotal(error ? null : count || 0);
  }, []);

  useEffect(() => {
    contar();
    const t = window.setInterval(contar, 60000);
    return () => window.clearInterval(t);
  }, [contar, listas.length]);

  const abrir = () => {
    setQtd(total || 0);
    setNome(`Caixa Postal — ${new Date().toLocaleDateString("pt-BR")}`);
    setAberto(true);
  };

  const gerar = async () => {
    setGerando(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("faça login de novo");
      // busca todos (em páginas de 1000)
      const todos: any[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await supabase
          .from("contatos")
          .select("*")
          .eq("dados_extras->>classificacao", CAIXA_POSTAL)
          .range(de, de + 999);
        if (error) throw error;
        todos.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      // menos tentativas primeiro; um contato por telefone
      todos.sort((a, b) => (a.dados_extras?.tentativas_caixa_postal || 0) - (b.dados_extras?.tentativas_caixa_postal || 0));
      const vistos = new Set<string>();
      const escolhidos: { orig: any; dados: ReturnType<Extrair> }[] = [];
      for (const c of todos) {
        const dados = extrair(c, listas.find((l) => l.id === c.lista_id));
        const k = digitos(dados.telefone).slice(-9);
        if (k.length < 8 || vistos.has(k)) continue;
        vistos.add(k);
        escolhidos.push({ orig: c, dados });
        if (qtd > 0 && escolhidos.length >= qtd) break;
      }
      if (!escolhidos.length) throw new Error("nenhum contato de caixa postal com telefone válido");

      const { data: lista, error: e1 } = await supabase
        .from("listas_contatos")
        .insert({
          user_id: user.id,
          nome: nome.trim() || `Caixa Postal — ${new Date().toLocaleDateString("pt-BR")}`,
          descricao: `Quem caiu na caixa postal / não atendeu (${escolhidos.length} contato(s))`,
          origem: "Caixa Postal",
          total_contatos: escolhidos.length,
          validados: escolhidos.length,
          duplicados: 0,
          invalidos: 0,
          campanhas_ativas: 0,
          taxa_entrega: 100,
          status: "Ativa",
          configuracoes: { tipo: "caixa_postal" },
          metadados: { geradaEm: new Date().toISOString(), tipo: "caixa_postal" },
        } as any)
        .select()
        .single();
      if (e1) throw e1;

      // contatos na lista nova, sem classificação (entram na fila de novo)
      const novos = escolhidos.map(({ orig, dados }) => ({
        user_id: user.id,
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email,
        lista_id: (lista as any).id,
        status: "ativo",
        dados_extras: {
          tentativas_caixa_postal: orig.dados_extras?.tentativas_caixa_postal || 0,
          veio_da_lista: orig.lista_id,
          contato_original: orig.id,
        },
      }));
      for (let i = 0; i < novos.length; i += 500) {
        const { error } = await supabase.from("contatos").insert(novos.slice(i, i + 500) as any);
        if (error) throw error;
      }
      // na lista de origem, saem da fila (para não ligar duas vezes)
      const fila = [...escolhidos];
      const trabalhar = async () => {
        for (let x = fila.shift(); x; x = fila.shift()) {
          await supabase
            .from("contatos")
            .update({ dados_extras: { ...(x.orig.dados_extras || {}), classificacao: MOVIDO, movido_para_lista: (lista as any).id } })
            .eq("id", x.orig.id);
        }
      };
      await Promise.all(Array.from({ length: 8 }, trabalhar));

      toast({ title: "Lista de caixa postal criada", description: `${escolhidos.length} contato(s) em "${(lista as any).nome}".` });
      setAberto(false);
      await contar();
      onCriada((lista as any).id);
    } catch (e: any) {
      toast({ title: "Não consegui gerar a lista", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="h-10" onClick={abrir} disabled={!total} title="Junta numa lista nova quem caiu na caixa postal ou não atendeu">
        <PhoneMissed className="w-4 h-4 mr-1.5" />
        Gerar lista da caixa postal
        <span className="ml-1.5 rounded-full bg-warning/20 text-foreground px-2 text-xs font-bold tabular-nums">{total ?? "…"}</span>
      </Button>
      <Dialog open={aberto} onOpenChange={(v) => !gerando && setAberto(v)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Gerar lista da caixa postal</DialogTitle>
            <DialogDescription>
              Tem <b>{total}</b> contato(s) classificados como Caixa Postal/Não atendeu. Eles vão para uma lista nova, prontos para ligar de novo, e saem da lista de
              origem para você não ligar duas vezes. As tentativas de caixa postal continuam contando.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">
              Nome da lista
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Quantos contatos
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={total || undefined}
                  className="w-28"
                  value={qtd || ""}
                  onChange={(e) => setQtd(Math.max(0, Math.min(total || 0, parseInt(e.target.value) || 0)))}
                />
                <span className="text-xs font-normal text-muted-foreground">de {total} disponíveis (quem tem menos tentativas vem primeiro)</span>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={gerando}>
              Cancelar
            </Button>
            <Button onClick={gerar} disabled={gerando || !qtd}>
              {gerando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Gerar lista com {qtd || 0}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
