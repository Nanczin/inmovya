import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bot, CheckCircle2, Loader2, Play, RefreshCw, Smartphone } from "lucide-react";

/**
 * Robô de anúncios: mostra o QR Code da sessão do OpenWA que roda NO PC do Estevão.
 * O Inmovya (site) não fala com o OpenWA por conta própria: é o navegador deste PC que
 * chama http://localhost:2785. Por isso só funciona abrindo o Inmovya no mesmo PC do OpenWA.
 * A chave do OpenWA fica só neste navegador (localStorage) — nunca vai para o Supabase nem para o GitHub.
 */

const LS_URL = "inmovya_robo_openwa_url";
const LS_KEY = "inmovya_robo_openwa_key";
const SESSAO = "atendimento-anuncios";
// Números que NUNCA podem ser o WhatsApp do robô (pessoal e Business principal)
const NUMEROS_PROIBIDOS = ["5511988782027"];

type Sessao = {
  id: string;
  name: string;
  status: string;
  phone: string | null;
  pushName: string | null;
  lastError?: string | null;
};

const ler = (k: string, padrao = "") => {
  try {
    return localStorage.getItem(k) ?? padrao;
  } catch {
    return padrao;
  }
};
const gravar = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

const STATUS_PT: Record<string, string> = {
  created: "Criada (parada)",
  initializing: "Ligando…",
  starting: "Ligando…",
  qr_ready: "Esperando ler o QR Code",
  authenticating: "Conectando…",
  ready: "Conectado",
  connected: "Conectado",
  disconnected: "Desconectado",
  failed: "Falhou",
  stopped: "Parada",
};

export function RoboAnunciosModule() {
  const [url, setUrl] = useState(() => ler(LS_URL, "http://localhost:2785/api"));
  const [chave, setChave] = useState(() => ler(LS_KEY));
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const ocupado = useRef(false);

  const api = useCallback(
    async (metodo: string, caminho: string, corpo?: unknown) => {
      const base = url.replace(/\/+$/, "");
      const r = await fetch(base + caminho, {
        method: metodo,
        headers: { "X-API-Key": chave.trim(), ...(corpo ? { "Content-Type": "application/json" } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const texto = await r.text();
      let dados: any = null;
      try {
        dados = texto ? JSON.parse(texto) : null;
      } catch {
        dados = texto;
      }
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) throw new Error("Chave do OpenWA inválida. Confira a chave colada acima.");
        throw new Error(`OpenWA respondeu ${r.status}: ${typeof dados === "string" ? dados : dados?.message || ""}`);
      }
      return dados;
    },
    [url, chave],
  );

  const atualizar = useCallback(async () => {
    if (!chave.trim() || ocupado.current) return;
    ocupado.current = true;
    try {
      const lista = await api("GET", "/sessions");
      const arr: Sessao[] = Array.isArray(lista) ? lista : lista?.items || lista?.sessions || [];
      const s = arr.find((x) => x.name === SESSAO) || null;
      setSessao(s);
      if (s?.status === "qr_ready") {
        const q = await api("GET", `/sessions/${s.id}/qr`);
        setQr(q?.qrCode || null);
      } else {
        setQr(null);
      }
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (e: any) {
      const msg = String(e?.message || e);
      setErro(
        /Failed to fetch|NetworkError|Load failed/i.test(msg)
          ? "Não consegui falar com o OpenWA neste computador. Ele está ligado (janela preta aberta)? Se o navegador perguntar se o Inmovya pode acessar aparelhos/apps da rede local, clique em Permitir."
          : msg,
      );
    } finally {
      ocupado.current = false;
    }
  }, [api, chave]);

  useEffect(() => {
    atualizar();
    const t = setInterval(atualizar, 5000);
    return () => clearInterval(t);
  }, [atualizar]);

  const salvarConfig = () => {
    gravar(LS_URL, url.trim());
    gravar(LS_KEY, chave.trim());
    atualizar();
  };

  const ligarSessao = async () => {
    setCarregando(true);
    try {
      let s = sessao;
      if (!s) s = await api("POST", "/sessions", { name: SESSAO });
      await api("POST", `/sessions/${s!.id}/start`);
      await atualizar();
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setCarregando(false);
    }
  };

  const fone = (sessao?.phone || "").replace(/\D/g, "");
  const numeroErrado = !!fone && NUMEROS_PROIBIDOS.some((n) => n.slice(-8) === fone.slice(-8));
  const conectado = sessao && ["ready", "connected"].includes(sessao.status);

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6" /> Robô de anúncios
        </h2>
        <p className="text-muted-foreground text-sm">
          Conexão do WhatsApp do <b>chip dos anúncios</b> com o robô. Funciona só neste computador, com o OpenWA ligado.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuração (só neste navegador)</CardTitle>
          <CardDescription>
            A chave fica guardada apenas neste computador. Ela está no arquivo <code>OpenWA\data\.api-key</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="robo-url">Endereço do OpenWA</Label>
            <Input id="robo-url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="robo-chave">Chave do OpenWA</Label>
            <Input id="robo-chave" type="password" autoComplete="off" placeholder="owa_k1_..." value={chave} onChange={(e) => setChave(e.target.value)} />
          </div>
          <Button onClick={salvarConfig}>Salvar e conectar</Button>
        </CardContent>
      </Card>

      {erro && (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          <span>{erro}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            Sessão “{SESSAO}”
            {sessao ? (
              <Badge variant={conectado ? "default" : "secondary"}>{STATUS_PT[sessao.status] || sessao.status}</Badge>
            ) : (
              <Badge variant="outline">{chave ? "não encontrada" : "sem chave"}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {atualizadoEm ? `Atualiza sozinho a cada 5 segundos · última: ${atualizadoEm.toLocaleTimeString("pt-BR")}` : "Cole a chave acima para começar."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {numeroErrado && (
            <div className="flex gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <span>
                ATENÇÃO: está conectado no número +{fone}, que NÃO é o chip dos anúncios. O robô fica parado. No celular, vá em
                Aparelhos conectados, desconecte, e leia o QR com o chip certo.
              </span>
            </div>
          )}

          {conectado && !numeroErrado && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Conectado no número <b>+{fone || "?"}</b> {sessao?.pushName ? `(${sessao.pushName})` : ""}. Agora é só ligar o <code>3-ligar-robo</code>.
            </div>
          )}

          {sessao?.status === "qr_ready" && (
            <div className="flex flex-col items-center gap-3 text-center">
              {qr ? (
                <img src={qr} alt="QR Code do WhatsApp" className="w-72 h-72 rounded border bg-white p-2" style={{ imageRendering: "pixelated" }} />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin" />
              )}
              <div className="text-sm space-y-1">
                <p className="font-semibold flex items-center justify-center gap-1">
                  <Smartphone className="h-4 w-4" /> Leia com o celular do CHIP DOS ANÚNCIOS
                </p>
                <p className="text-muted-foreground">WhatsApp → ⋮ → Aparelhos conectados → Conectar aparelho.</p>
                <p className="text-destructive font-medium">Não use o WhatsApp Business principal nem o seu número pessoal.</p>
                <p className="text-muted-foreground text-xs">O QR muda sozinho a cada ~20 segundos.</p>
              </div>
            </div>
          )}

          {chave && (!sessao || ["created", "disconnected", "failed", "stopped"].includes(sessao.status)) && (
            <Button onClick={ligarSessao} disabled={carregando}>
              {carregando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {sessao ? "Ligar sessão e mostrar QR Code" : "Criar sessão e mostrar QR Code"}
            </Button>
          )}

          {sessao?.lastError && <p className="text-xs text-muted-foreground">Último erro do OpenWA: {sessao.lastError}</p>}

          <Button variant="outline" size="sm" onClick={atualizar}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar agora
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default RoboAnunciosModule;
