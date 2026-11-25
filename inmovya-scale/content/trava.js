// content/trava.js — Trava de Engajamento dentro do WhatsApp Web.
// 1) Fica de olho em AVISOS do WhatsApp (limite de mensagens, conta restrita/banida, mensagens sem resposta)
//    só em janelas/avisos do próprio WhatsApp (nunca no texto das conversas) → dispara o alarme (pausa tudo).
// 2) Mostra um pontinho colorido no botão do Inmovya Scale e um aviso no topo do painel — sem abrir o painel.
// 3) Responde ao background as perguntas sobre tracinhos e respostas (via dnm-store, no MAIN world).
(() => {
  if (window.__isTrava) return;
  window.__isTrava = true;
  window.IS = window.IS || {};

  // ---------- ponte com o dnm-store (MAIN world) ----------
  let seq = 0;
  const loja = (op, args, timeout = 20000) => new Promise(resolve => {
    const id = `trava${Date.now()}_${++seq}`;
    const fim = setTimeout(() => { window.removeEventListener('message', ouvir); resolve({ ok: false, erro: 'o WhatsApp não respondeu' }); }, timeout);
    function ouvir(ev) {
      if (ev.source !== window || !ev.data || ev.data.__isDnm !== 'resposta' || ev.data.id !== id) return;
      clearTimeout(fim);
      window.removeEventListener('message', ouvir);
      resolve(ev.data);
    }
    window.addEventListener('message', ouvir);
    window.postMessage({ __isDnm: 'pedido', id, op, args }, '*');
  });
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.action !== 'trava_wa') return;
    if (!['acks', 'respondeuDesde', 'etiquetas'].includes(msg.op)) return;
    loja(msg.op, msg.args || {}).then(r => sendResponse(r.ok ? { ok: true, dados: r.dados || [] } : { ok: false, error: r.erro || 'erro' }));
    return true;
  });

  // Agenda do Inmovya: abrir a conversa de um telefone nesta aba (só se nada estiver enviando aqui)
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.action !== 'abrir_conversa_aba') return;
    (async () => {
      const disparo = window.IS?.Disparo?._st;
      if (disparo?.atual) return { ok: false, ocupado: true }; // disparo mandando uma mensagem agora
      const tel = String(msg.telefone || '').replace(/\D/g, '');
      const achado = await loja('acharConversa', { telefone: tel }, 6000);
      const chatId = achado?.dados?.chatId;
      if (!chatId) return { ok: false, erro: 'sem conversa com esse número' };
      const ab = await loja('abrir', { chatId }, 8000);
      return ab?.ok ? { ok: true } : { ok: false, erro: ab?.erro || 'não abriu' };
    })().then(sendResponse).catch(e => sendResponse({ ok: false, erro: e?.message }));
    return true;
  });

  const enviar = (m) => new Promise(res => {
    try { chrome.runtime.sendMessage(m, r => res(chrome.runtime.lastError ? null : r)); } catch (_) { res(null); }
  });
  window.IS.trava = {
    pode: (dados) => enviar({ action: 'trava_pode', ...dados }),
    registrar: (dados) => enviar({ action: 'trava_registrar', ...dados }),
    alarme: (dados) => enviar({ action: 'trava_alarme', ...dados }),
    status: (teste) => enviar({ action: 'trava_status', teste: !!teste }),
    retomar: (alvo, teste) => enviar({ action: 'trava_retomar', alvo, teste: !!teste }),
    cfg: (dados) => enviar({ action: 'trava_cfg', ...dados }),
    teste: (dados) => enviar({ action: 'trava_teste', ...dados }),
  };

  // ---------- 1) avisos do WhatsApp ----------
  const RX_AVISO = [
    /conta (foi |está |esta )?(restringida|restrita|banida|suspensa|bloqueada)/i,
    /(seu|este) n[uú]mero (foi |está |esta )?(banido|bloqueado|restrito)/i,
    /restri[cç][aã]o (de|na|da) (sua )?conta/i,
    /limite de (mensagens|envios?|conversas|novas conversas)/i,
    /mensagens? (sem resposta|n[aã]o respondidas)/i,
    /muitas mensagens/i,
    /temporariamente (impedid|bloquead|restrit|banid)/i,
    /account (is |has been |was )?(restricted|banned|suspended)/i,
    /too many (messages|chats)|messaging limit|message limit|unanswered messages/i,
    /(cuenta|número) (ha sido |está )?(restringida|bloqueada|baneada|suspendida)/i,
  ];
  const SELETOR_AVISO = '[role="dialog"], [data-animate-modal-popup], [data-animate-modal-body], [data-testid*="alert"], [data-testid*="banner"], [data-testid*="restrict"]';
  let ultimoAviso = '';
  function procurarAviso() {
    const els = Array.from(document.querySelectorAll(SELETOR_AVISO));
    // faixas do topo da lista de conversas (fora da lista e fora da conversa aberta)
    const side = document.getElementById('side');
    if (side) for (const filho of side.children) if (filho.id !== 'pane-side') els.push(filho);
    for (const el of els) {
      if (!el || el.closest('[id^="is-"], [class*="is-dsp"]') || el.closest('#main [role="application"]')) continue;
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      const txt = String(el.innerText || '').slice(0, 600);
      const achou = RX_AVISO.find(rx => rx.test(txt));
      if (achou) {
        const trecho = txt.replace(/\s+/g, ' ').trim().slice(0, 140);
        if (trecho === ultimoAviso) return;
        ultimoAviso = trecho;
        enviar({ action: 'trava_alarme', forcar: true, motivo: `o WhatsApp mostrou um aviso: "${trecho}"` });
        return;
      }
    }
  }
  setInterval(procurarAviso, 4000);

  // ---------- 2) pontinho no botão + aviso no painel ----------
  function estilos() {
    if (document.getElementById('is-trava-style')) return;
    const css = document.createElement('style');
    css.id = 'is-trava-style';
    css.textContent = `
      #is-trava-ponto{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;border:2px solid #fff;z-index:2;pointer-events:none}
      #is-trava-ponto.vermelho{background:#dc2626;animation:isTravaPulso 1.4s infinite}
      #is-trava-ponto.amarelo{background:#f59e0b}
      @keyframes isTravaPulso{0%{box-shadow:0 0 0 0 rgba(220,38,38,.6)}70%{box-shadow:0 0 0 8px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}
      #is-trava-faixa{margin:8px 10px 0;padding:10px 12px;border-radius:10px;font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
        display:flex;flex-direction:column;gap:6px;border:1px solid}
      #is-trava-faixa.vermelho{background:rgba(220,38,38,.08);border-color:rgba(220,38,38,.35);color:var(--inmovya-text,#111b21)}
      #is-trava-faixa.amarelo{background:rgba(245,158,11,.10);border-color:rgba(245,158,11,.4);color:var(--inmovya-text,#111b21)}
      #is-trava-faixa b{font-weight:800}
      #is-trava-faixa button{align-self:flex-start;border:none;border-radius:8px;padding:6px 10px;font-weight:700;cursor:pointer;background:#0a8f4e;color:#fff;font-size:12px}
    `;
    document.head.appendChild(css);
  }

  async function lerEstado() {
    const { travaEstado } = await chrome.storage.local.get('travaEstado');
    const est = travaEstado || {};
    const agora = Date.now();
    const pausas = Object.entries(est.pausas || {}).filter(([, p]) => p && (!p.ate || p.ate > agora));
    const global = est.global && (!est.global.ate || est.global.ate > agora) ? est.global : null;
    const amarelos = Object.entries(est.aval || {}).filter(([o, a]) => a?.status === 'amarelo' && !est.pausas?.[o]);
    return { est, pausas, global, alarme: est.alarme || null, amarelos };
  }

  let ultimoDesenho = '';
  async function desenhar() {
    let e;
    try { e = await lerEstado(); } catch (_) { return; } // extensão recarregada
    estilos();
    const nomes = e.est.nomes || {};
    let cor = '';
    let html = '';
    if (e.alarme) {
      cor = 'vermelho';
      html = `<div><b>⚠️ Todos os envios automáticos estão pausados.</b></div><div>${esc(e.alarme.motivo)}</div><button type="button" data-trava-retomar="alarme">Retomar</button>`;
    } else if (e.global) {
      cor = 'vermelho';
      html = `<div><b>⏸️ Esteiras e disparo pausados.</b></div><div>${esc(e.global.motivo)}</div><button type="button" data-trava-retomar="global">Retomar mesmo assim</button>`;
    } else if (e.pausas.length) {
      cor = 'vermelho';
      html = e.pausas.map(([o, p]) => `<div><b>⏸️ ${esc(nomes[o] || o)}</b> — ${esc(p.motivo)}</div>`).join('') + '<div style="opacity:.8">As outras esteiras continuam normalmente.</div>';
    } else if (e.amarelos.length) {
      cor = 'amarelo';
      html = e.amarelos.map(([o, a]) => `<div><b>🟡 ${esc(nomes[o] || o)}</b> — poucas respostas (${a.taxa}%): intervalo entre envios dobrado.</div>`).join('');
    }
    const chave = cor + html;
    // pontinho no botão do painel (o painel não abre sozinho)
    const btn = document.getElementById('is-toggle-button');
    let ponto = document.getElementById('is-trava-ponto');
    if (btn && cor) {
      if (!ponto || ponto.parentElement !== btn) { ponto?.remove(); ponto = document.createElement('span'); ponto.id = 'is-trava-ponto'; btn.appendChild(ponto); }
      ponto.className = cor;
      btn.title = cor === 'vermelho' ? 'Inmovya Scale — envios pausados pela trava de engajamento' : 'Inmovya Scale — trava de engajamento: intervalo dobrado';
    } else if (ponto) {
      ponto.remove();
      if (btn) btn.title = 'Abrir Inmovya Scale';
    }
    // faixa no topo do painel (aparece quando você abrir)
    const main = document.getElementById('is-main-view');
    let faixa = document.getElementById('is-trava-faixa');
    if (main && cor) {
      if (!faixa || faixa.parentElement !== main) { faixa?.remove(); faixa = document.createElement('div'); faixa.id = 'is-trava-faixa'; main.prepend(faixa); ultimoDesenho = ''; }
      if (chave !== ultimoDesenho) { faixa.className = cor; faixa.innerHTML = html; ultimoDesenho = chave; }
    } else if (faixa) {
      faixa.remove();
      ultimoDesenho = '';
    }
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  document.addEventListener('click', ev => {
    const b = ev.target?.closest?.('[data-trava-retomar]');
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    enviar({ action: 'trava_retomar', alvo: b.getAttribute('data-trava-retomar') }).then(desenhar);
  }, true);

  try {
    chrome.storage.onChanged.addListener((mud, area) => { if (area === 'local' && mud.travaEstado) desenhar(); });
  } catch (_) { /* extensão recarregada */ }
  setInterval(desenhar, 5000); // o painel pode ser redesenhado; e as pausas vencem à meia-noite
  desenhar();
})();
