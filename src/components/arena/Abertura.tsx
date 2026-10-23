import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImagePlus, Images, Loader2, Trash2 } from "lucide-react";

// ABERTURA estilo tela de carregamento do GTA: as SUAS imagens passando uma a uma, cada uma com movimento lento de
// câmera (zoom + panorâmica) e a próxima entrando em faixas inclinadas que deslizam da direita. Sem legenda.
// As imagens ficam no Storage do Inmovya (bucket "materiais", pasta <seu id>/arena-abertura/).

const BUCKET = "materiais";
const PASTA = "arena-abertura";
const TEMPO = 6500; // ms por imagem
const ATUALIZOU = "inmovya-abertura-atualizou";

const CSS = `
@keyframes ab-kb-1 { from { transform: scale(1.06) translate(2%, 1%); } to { transform: scale(1.2) translate(-3%, -2%); } }
@keyframes ab-kb-2 { from { transform: scale(1.22) translate(-4%, 0); } to { transform: scale(1.22) translate(4%, -1%); } }
@keyframes ab-kb-3 { from { transform: scale(1.2) translate(0, -3%); } to { transform: scale(1.07) translate(-1%, 2%); } }
@keyframes ab-kb-4 { from { transform: scale(1.18) translate(4%, 2%); } to { transform: scale(1.18) translate(-4%, -2%); } }
@keyframes ab-faixa { from { transform: translateX(115%); filter: blur(6px) brightness(1.25); } to { transform: translateX(0); filter: blur(0) brightness(1); } }
@keyframes ab-sai { from { transform: translateX(0); filter: blur(0); opacity: 1; } to { transform: translateX(-28%); filter: blur(5px); opacity: .25; } }
@keyframes ab-brilho { 0% { opacity: 0; } 20% { opacity: .35; } 100% { opacity: 0; } }
.ab-raiz { position: relative; overflow: hidden; background: #050505; }
.ab-camada { position: absolute; inset: 0; overflow: hidden; }
.ab-camada.sai { animation: ab-sai .75s cubic-bezier(.7,0,.2,1) forwards; z-index: 1; }
.ab-camada.entra { z-index: 2; }
.ab-faixa { position: absolute; inset: 0; overflow: hidden; animation: ab-faixa .65s cubic-bezier(.75,0,.2,1) both; will-change: transform; }
.ab-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; animation-duration: ${TEMPO + 1200}ms; animation-timing-function: linear; animation-fill-mode: both; filter: contrast(1.08) saturate(1.12); }
.ab-vinheta { position: absolute; inset: 0; z-index: 3; pointer-events: none; background: radial-gradient(120% 95% at 50% 45%, transparent 55%, rgba(0,0,0,.55)); }
.ab-flash { position: absolute; inset: 0; z-index: 3; pointer-events: none; background: #fff; mix-blend-mode: overlay; animation: ab-brilho .6s ease-out both; }
@media (prefers-reduced-motion: reduce) { .ab-img, .ab-faixa, .ab-camada.sai, .ab-flash { animation: none !important; } }
`;

// faixas inclinadas (como as do GTA): se sobrepõem um pouco para não aparecer emenda
const FAIXAS = [
  "polygon(-20% 0, 42% 0, 22% 100%, -40% 100%)",
  "polygon(40% 0, 76% 0, 56% 100%, 20% 100%)",
  "polygon(74% 0, 130% 0, 130% 100%, 54% 100%)",
];

interface Imagem {
  path: string;
  url: string;
}

let cache: { quando: number; imgs: Imagem[] } | null = null;

async function listar(forcar = false): Promise<Imagem[]> {
  if (!forcar && cache && Date.now() - cache.quando < 30 * 60 * 1000) return cache.imgs;
  const { data: s } = await supabase.auth.getSession();
  const uid = s?.session?.user?.id;
  if (!uid) return [];
  const pasta = `${uid}/${PASTA}`;
  const { data, error } = await supabase.storage.from(BUCKET).list(pasta, { limit: 100, sortBy: { column: "name", order: "asc" } });
  if (error || !data?.length) {
    cache = { quando: Date.now(), imgs: [] };
    return [];
  }
  const paths = data.filter((f) => f.name && !f.name.startsWith(".")).map((f) => `${pasta}/${f.name}`);
  const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 7);
  const imgs = (urls || []).filter((u) => u.signedUrl).map((u) => ({ path: u.path as string, url: u.signedUrl }));
  cache = { quando: Date.now(), imgs };
  return imgs;
}

// reduz a imagem antes de enviar (até 1800 px, JPEG) para carregar rápido
async function comprimir(arquivo: File): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo);
  const max = 1800;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((r) => c.toBlob((b) => r(b || arquivo), "image/jpeg", 0.86));
}

export function Abertura({ largura, altura, className = "", editavel = false }: { largura: number; altura: number; className?: string; editavel?: boolean }) {
  const { toast } = useToast();
  const [imgs, setImgs] = useState<Imagem[] | null>(null);
  const [atual, setAtual] = useState(0);
  const [anterior, setAnterior] = useState<number | null>(null);
  const [geracao, setGeracao] = useState(0);
  const [gerir, setGerir] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async (forcar = false) => {
    try {
      setImgs(await listar(forcar));
    } catch {
      setImgs([]);
    }
  }, []);

  useEffect(() => {
    carregar();
    const f = () => carregar(true);
    window.addEventListener(ATUALIZOU, f);
    return () => window.removeEventListener(ATUALIZOU, f);
  }, [carregar]);

  // pré-carrega todas
  useEffect(() => {
    imgs?.forEach((i) => {
      const im = new Image();
      im.src = i.url;
    });
  }, [imgs]);

  const qtd = useRef(0);
  qtd.current = imgs?.length || 0;
  const atualRef = useRef(0);
  const avancar = useCallback(() => {
    const n = qtd.current;
    if (n < 2) return;
    const a = atualRef.current % n;
    const prox = (a + 1) % n;
    atualRef.current = prox;
    setAnterior(a);
    setAtual(prox);
    setGeracao((g) => g + 1);
  }, []);

  useEffect(() => {
    if (!imgs || imgs.length < 2) return;
    const t = window.setInterval(avancar, TEMPO);
    return () => window.clearInterval(t);
  }, [imgs, avancar]);

  // some com a camada que saiu depois da transição
  useEffect(() => {
    if (anterior === null) return;
    const t = window.setTimeout(() => setAnterior(null), 800);
    return () => window.clearTimeout(t);
  }, [anterior, geracao]);

  const enviar = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setEnviando(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;
      if (!uid) throw new Error("Entre no Inmovya.");
      for (const [n, a] of Array.from(arquivos).entries()) {
        if (!a.type.startsWith("image/")) continue;
        const blob = await comprimir(a);
        const nome = `${Date.now()}-${n}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(`${uid}/${PASTA}/${nome}`, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
      }
      toast({ title: "Imagens adicionadas à abertura" });
      window.dispatchEvent(new Event(ATUALIZOU));
    } catch (e: any) {
      toast({ title: "Não consegui enviar", description: e?.message, variant: "destructive" });
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const apagar = async (path: string) => {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) return toast({ title: "Não consegui apagar", description: error.message, variant: "destructive" });
    atualRef.current = 0;
    setAtual(0);
    setAnterior(null);
    window.dispatchEvent(new Event(ATUALIZOU));
  };

  const kb = (i: number) => `ab-kb-${(i % 4) + 1}`;
  const camada = (i: number, tipo: "entra" | "sai" | "fixa", chave: string) => {
    const im = imgs![i];
    if (!im) return null;
    // a que está saindo continua do ponto em que parou (fim do movimento), sem pulo
    const imagem = <img src={im.url} alt="" className="ab-img" style={{ animationName: kb(i), animationDelay: tipo === "sai" ? `-${TEMPO}ms` : undefined }} draggable={false} />;
    if (tipo !== "entra")
      return (
        <div key={chave} className={`ab-camada ${tipo === "sai" ? "sai" : ""}`}>
          {imagem}
        </div>
      );
    return (
      <div key={chave} className="ab-camada entra">
        {FAIXAS.map((clip, k) => (
          <div key={k} className="ab-faixa" style={{ clipPath: clip, WebkitClipPath: clip, animationDelay: `${k * 90}ms` }}>
            {imagem}
          </div>
        ))}
      </div>
    );
  };

  const vazio = imgs && imgs.length === 0;

  return (
    <>
      <style>{CSS}</style>
      <div className={`ab-raiz ${className}`} style={{ width: largura, height: altura }}>
        {imgs === null && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>}
        {vazio && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 text-white/70">
            <Images className="w-10 h-10 text-orange-300/80" />
            <div className="text-sm font-semibold">Sua abertura</div>
            <div className="text-xs text-white/50">Adicione as suas imagens e elas passam aqui, no estilo GTA.</div>
            {editavel && (
              <Button size="sm" className="mt-1 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setGerir(true)}>
                <ImagePlus className="w-4 h-4 mr-1" /> Adicionar imagens
              </Button>
            )}
          </div>
        )}
        {imgs && imgs.length > 0 && (
          <>
            {anterior !== null && anterior !== atual && camada(anterior, "sai", `s-${geracao}`)}
            {camada(atual, imgs.length > 1 && geracao > 0 ? "entra" : "fixa", `e-${geracao}`)}
            {geracao > 0 && <div key={`f-${geracao}`} className="ab-flash" />}
            <div className="ab-vinheta" />
          </>
        )}
        {editavel && imgs && imgs.length > 0 && (
          <button
            className="absolute right-2 bottom-2 z-10 rounded-full bg-black/55 p-1.5 text-white/80 hover:bg-black/75 hover:text-white"
            onClick={() => setGerir(true)}
            title="Imagens da abertura"
          >
            <Images className="w-4 h-4" />
          </button>
        )}
      </div>

      {editavel && (
        <Dialog open={gerir} onOpenChange={setGerir}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Imagens da abertura</DialogTitle>
              <DialogDescription>Elas passam em sequência, na ordem em que foram adicionadas. Imagens em pé (retrato) ficam melhores.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
              {(imgs || []).map((im) => (
                <div key={im.path} className="relative group aspect-[3/4] rounded-md overflow-hidden bg-muted">
                  <img src={im.url} alt="" className="w-full h-full object-cover" />
                  <button
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-80 hover:opacity-100 hover:bg-red-600"
                    onClick={() => apagar(im.path)}
                    title="Tirar da abertura"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                className="aspect-[3/4] rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted"
                onClick={() => entrada.current?.click()}
                disabled={enviando}
              >
                {enviando ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
                <span className="text-xs">{enviando ? "Enviando..." : "Adicionar"}</span>
              </button>
            </div>
            <input ref={entrada} type="file" accept="image/*" multiple className="hidden" onChange={(e) => enviar(e.target.files)} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
