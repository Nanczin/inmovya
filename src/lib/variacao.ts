// Variação automática das mensagens (mesma do Disparo do Inmovya Scale):
// troca palavras por sinônimos e varia a pontuação, para cada lead receber um texto diferente.
export const SINONIMOS: string[][] = [
  ['oi', 'olá', 'oii', 'opa'],
  ['tudo bem', 'tudo bom', 'tudo certo', 'como vai'],
  ['bom dia', 'ótimo dia'],
  ['boa tarde', 'ótima tarde'],
  ['boa noite', 'ótima noite'],
  ['separei', 'selecionei', 'reservei'],
  ['oportunidade', 'opção'],
  ['excelente', 'espetacular', 'sensacional'],
  ['ótima', 'excelente', 'muito boa'],
  ['ótimo', 'excelente', 'muito bom'],
  ['incrível', 'espetacular', 'sensacional'],
  ['imperdível', 'muito vantajosa', 'que vale a pena'],
  ['gostaria', 'queria'],
  ['posso te enviar', 'posso te mandar', 'te envio'],
  ['posso te mostrar', 'posso te apresentar'],
  ['te mostrar', 'te apresentar'],
  ['enviar', 'mandar'],
  ['envio', 'mando'],
  ['mais informações', 'mais detalhes'],
  ['informações', 'detalhes'],
  ['agora', 'neste momento'],
  ['hoje', 'ainda hoje'],
  ['rapidinho', 'rapidamente'],
  ['me avisa', 'me fala', 'me diz'],
  ['me chama', 'me dá um toque', 'me responde'],
  ['fico à disposição', 'estou à disposição', 'qualquer dúvida, é só chamar'],
  ['obrigado', 'valeu', 'agradeço'],
  ['abraço', 'abraços', 'um abraço'],
  ['interessado', 'com interesse'],
  ['investimento', 'negócio'],
  ['localização', 'região'],
  ['lançamento', 'novo empreendimento'],
  ['apartamento', 'apto', 'imóvel'],
  ['condições', 'facilidades'],
  ['parcelas', 'prestações'],
  ['visitar', 'conhecer'],
  ['podemos', 'a gente pode'],
  ['conversar', 'bater um papo', 'falar'],
  ['aproveitar', 'garantir'],
  ['últimas unidades', 'poucas unidades'],
  ['lembrei de você', 'pensei em você'],
  ['faz sentido', 'te interessa'],
  ['quer', 'deseja'],
  ['muito', 'bastante'],
  ['porque', 'pois'],
  ['então', 'aí'],
];

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const LETRA = "A-Za-zÀ-ÖØ-öø-ÿ";
const mesmaCaixa = (modelo: string, palavra: string) => {
  if (modelo === modelo.toUpperCase() && modelo.length > 1) return palavra.toUpperCase();
  if (modelo[0] === modelo[0].toUpperCase()) return palavra[0].toUpperCase() + palavra.slice(1);
  return palavra;
};

/** "Oi, separei uma oportunidade" → "{Oi|Olá|Oii}, {separei|selecionei} uma {oportunidade|opção}". */
export function gerarSpintax(texto: string) {
  const guardados: string[] = [];
  const guardar = (m: string) => `\u0001${guardados.push(m) - 1}\u0001`;
  let t = String(texto || "").replace(/\{\{[^{}]*\}\}/g, guardar);
  for (let i = 0; i < 5; i++) t = t.replace(/\{[^{}]*\}/g, guardar);
  const itens: { p: string; g: string[] }[] = [];
  SINONIMOS.forEach((g) => g.forEach((p) => itens.push({ p, g })));
  itens.sort((a, b) => b.p.length - a.p.length);
  for (const { p, g } of itens) {
    const re = new RegExp(`(^|[^${LETRA}\u0001])(${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^${LETRA}\u0001])`, "gi");
    t = t.replace(re, (_m, antes: string, achado: string) => {
      const ops = [achado, ...g.filter((x) => semAcento(x) !== semAcento(achado)).map((x) => mesmaCaixa(achado, x))];
      return antes + guardar(`{${ops.join("|")}}`);
    });
  }
  const volta = (x: string) => x.replace(/\u0001(\d+)\u0001/g, (_m, i) => guardados[+i]);
  return volta(volta(t));
}

/** Sorteia uma opção de cada {a|b}; {{variáveis}} ficam como estão. */
export function sortear(texto: string) {
  const vars: string[] = [];
  let t = String(texto || "").replace(/\{\{[^{}]*\}\}/g, (m) => `\u0000${vars.push(m) - 1}\u0000`);
  for (let i = 0; i < 20; i++) {
    const antes = t;
    t = t.replace(/\{([^{}]*)\}/g, (_m, dentro: string) => {
      const op = dentro.split("|");
      return op[Math.floor(Math.random() * op.length)];
    });
    if (t === antes) break;
  }
  return t.replace(/\u0000(\d+)\u0000/g, (_m, i) => vars[+i]);
}

/** Texto pronto (já com nome) → versão com sinônimos e pontuação sorteados. Mantém as quebras "===". */
export function variarAutomatico(texto: string) {
  return String(texto || "")
    .split(/(^\s*===\s*$)/m)
    .map((p) => {
      if (/^\s*===\s*$/.test(p)) return p;
      return sortear(gerarSpintax(p)).replace(/!(?=\s|$)/g, () => {
        const r = Math.random();
        return r < 0.2 ? "." : r < 0.32 ? "!!" : "!";
      });
    })
    .join("");
}

// ---------- Tempo automático (igual ao Disparo): nunca menos de 2 min ----------
export const TEMPO_AUTO = { min: 120, max: 260, loteMin: 12, loteMax: 22, pausaMin: 10, pausaMax: 25 };
const sorteio = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
/** Segundos até o próximo lead: 2 a 4,3 min, às vezes um pouco mais (como uma pessoa que se distraiu). */
export function intervaloHumano() {
  let s = sorteio(TEMPO_AUTO.min, TEMPO_AUTO.max);
  if (Math.random() < 0.12) s += sorteio(60, 240);
  return s;
}
export const novoLote = () => sorteio(TEMPO_AUTO.loteMin, TEMPO_AUTO.loteMax);
export const pausaDeLoteMin = () => sorteio(TEMPO_AUTO.pausaMin, TEMPO_AUTO.pausaMax);
