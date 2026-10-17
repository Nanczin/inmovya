// midrah-captura.js — captura de leads do CRM Midrah para o Inmovya (roda na aba do Midrah, crm.midrah.com.br).
// A cada 1 minuto lê os SEUS negócios novos no Midrah (com o login que já está aberto no Chrome) e manda para o
// Inmovya cadastrar (etapa Validação, origem/tag "Midrah", sem duplicar). Não faz 1º contato: o Midrah já faz.
// Só cadastra quem tem WhatsApp (o Scale confere o número no WhatsApp Web antes).
// Roleta: quando o Midrah oferece um lead para você, o Scale pega sozinho (aba: a cada 10 s; extensão: a cada 30 s).
// Precisa: o Midrah aberto numa aba (pode ficar em segundo plano) e o 1º contato configurado no Inmovya (token).
(() => {
  // Uma cópia viva por aba: quando a extensão é recarregada, a cópia nova assume e a antiga para sozinha.
  const MEU_ID = `${chrome.runtime.id}:${Date.now()}:${Math.random()}`;
  document.documentElement.dataset.inmovyaMidrah = MEU_ID;
  const souOAtual = () => {
    try { return document.documentElement.dataset.inmovyaMidrah === MEU_ID && !!chrome.runtime?.id; } catch (_) { return false; }
  };

  const PROJETO = 'inckgllwamnbnqoldngz';
  const BASE = `https://${PROJETO}.supabase.co/rest/v1/`;
  const CHAVE_SESSAO = `sb-${PROJETO}-auth-token`;
  const INTERVALO_MS = 60 * 1000;
  const log = (...a) => console.log('[Inmovya • Midrah]', ...a);

  const sessao = () => {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null');
      return s && s.access_token ? s : null;
    } catch (_) {
      return null;
    }
  };

  // chave pública do app (fica no código do site); guardada para não procurar toda vez
  async function chavePublica() {
    const { midrahAnonKey } = await chrome.storage.local.get('midrahAnonKey');
    if (midrahAnonKey) return midrahAnonKey;
    const srcs = Array.from(document.scripts).map(s => s.src).filter(Boolean);
    for (const u of srcs) {
      try {
        const t = await fetch(u).then(r => r.text());
        for (const c of t.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
          try {
            const p = JSON.parse(atob(c.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (p.ref === PROJETO && p.role === 'anon') {
              await chrome.storage.local.set({ midrahAnonKey: c });
              return c;
            }
          } catch (_) { /* outro token */ }
        }
      } catch (_) { /* script inacessível */ }
    }
    return null;
  }

  let rodando = false;
  async function conferir() {
    if (!souOAtual()) return;
    if (rodando) return;
    rodando = true;
    try {
      const s = sessao();
      if (!s) return; // não está logado no Midrah
      const apikey = await chavePublica();
      if (!apikey) return log('não achei a chave pública do Midrah');

      // 1.7.0: confere de novo as últimas 24 h (o Inmovya não duplica; recupera leads da roleta que ficaram de fora)
      const { midrahRevisado170 } = await chrome.storage.local.get('midrahRevisado170');
      if (!midrahRevisado170) {
        await chrome.storage.local.set({
          midrahRevisado170: true,
          midrahFeitos: [],
          midrahSemZap: {},
          midrahDesde: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        });
      }
      let { midrahDesde, midrahFeitos = [] } = await chrome.storage.local.get(['midrahDesde', 'midrahFeitos']);
      if (!midrahDesde) {
        // primeira vez: pega os negócios das últimas 2 horas
        midrahDesde = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
        await chrome.storage.local.set({ midrahDesde });
      }
      const desde = new Date(Math.max(new Date(midrahDesde).getTime(), Date.now() - 3 * 86400 * 1000)).toISOString();
      const h = { apikey, Authorization: `Bearer ${s.access_token}` };
      const campos = 'id,name,created_at,development_name,owner_user_id,client:clients(name,phone,whatsapp,email)';
      // 1) negócios criados para você (inclui os que você pega na roleta)
      const url = `${BASE}deals?select=${campos}` +
        `&owner_user_id=eq.${s.user.id}&created_at=gte.${encodeURIComponent(desde)}&order=created_at.desc&limit=100`;
      const r = await fetch(url, { headers: h });
      if (!r.ok) return log('Midrah respondeu', r.status);
      const deals = await r.json();
      // 2) leads da roleta que você pegou (mesmo se o negócio foi criado antes ou passado para você)
      try {
        const ro = await fetch(`${BASE}lead_offers?select=deal_id&user_id=eq.${s.user.id}&status=eq.aceito` +
          `&responded_at=gte.${encodeURIComponent(desde)}&deal_id=not.is.null&order=responded_at.desc&limit=50`, { headers: h });
        if (ro.ok) {
          const ja = new Set(deals.map(d => d.id));
          const ids = (await ro.json()).map(o => o.deal_id).filter(id => id && !ja.has(id));
          if (ids.length) {
            const rd = await fetch(`${BASE}deals?select=${campos}&id=in.(${ids.join(',')})`, { headers: h });
            if (rd.ok) deals.push(...(await rd.json()));
          }
        }
      } catch (_) { /* roleta indisponível: segue só com os negócios */ }
      deals.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      const feitos = new Set(midrahFeitos);
      const novos = deals.filter(d => !feitos.has(d.id)).map(d => ({
        id: d.id,
        nome: String(d.client?.name || String(d.name || '').split(' · ')[0] || '').normalize('NFKC').trim(),
        telefone: d.client?.whatsapp || d.client?.phone || '',
        email: d.client?.email || '',
        empreendimento: d.development_name || ''
      }));
      if (!novos.length) return;
      novos.splice(10); // até 10 por minuto (cada número é conferido no WhatsApp antes)
      const resp = await chrome.runtime.sendMessage({ action: 'midrah_capturar', leads: novos });
      if (!resp?.ok) return log('não cadastrou:', resp?.error);
      // "sem WhatsApp" só vale depois de conferir 2 vezes (evita perder lead por uma falha do WhatsApp Web)
      const { midrahSemZap = {} } = await chrome.storage.local.get('midrahSemZap');
      const ok = [];
      for (const x of resp.resultados || []) {
        if (!x.ok) continue;
        if (x.acao === 'sem_whatsapp' && (midrahSemZap[x.id] || 0) < 1) { midrahSemZap[x.id] = 1; continue; }
        ok.push(x.id);
      }
      await chrome.storage.local.set({ midrahSemZap });
      if (ok.length) {
        const lista = [...midrahFeitos, ...ok].slice(-3000);
        await chrome.storage.local.set({ midrahFeitos: lista });
        log(`${ok.length} negócio(s) enviados ao Inmovya`, resp.resultados);
      }
    } catch (e) {
      log('erro', e?.message || e);
    } finally {
      rodando = false;
    }
  }

  // ---------- Roleta: pega sozinho o lead oferecido para você (o Midrah dá 10 min; aqui confere a cada 15 s) ----------
  const ACEITOS = new Set();
  let pegando = false;
  async function pegarRoleta() {
    if (!souOAtual()) return;
    if (pegando) return;
    pegando = true;
    try {
      const s = sessao();
      if (!s) return;
      const apikey = await chavePublica();
      if (!apikey) return;
      // deixa o login do Midrah com a extensão: ela também confere a roleta a cada 30 s, mesmo com esta aba parada
      await chrome.storage.local.set({
        midrahSessao: { token: s.access_token, expira: s.expires_at || 0, usuario: s.user.id, apikey }
      });
      const h = { apikey, Authorization: `Bearer ${s.access_token}` };
      const agora = new Date().toISOString();
      const r = await fetch(`${BASE}lead_offers?select=id,status,expires_at&user_id=eq.${s.user.id}` +
        `&status=not.in.(aceito,expirado,recusado,passado)&expires_at=gt.${encodeURIComponent(agora)}&order=offered_at.asc&limit=5`, { headers: h });
      if (!r.ok) return;
      const ofertas = (await r.json()).filter(o => !ACEITOS.has(o.id));
      for (const o of ofertas) {
        ACEITOS.add(o.id);
        const a = await fetch(`${BASE}rpc/roulette_accept`, {
          method: 'POST',
          headers: { ...h, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_offer: o.id })
        });
        const txt = await a.text();
        if (a.ok) log('lead da roleta pego', o.id);
        else { log('não consegui pegar o lead da roleta', a.status, txt.slice(0, 200)); ACEITOS.delete(o.id); }
      }
      if (ofertas.length) setTimeout(conferir, 3000); // já manda para o Inmovya
    } catch (e) {
      log('roleta: erro', e?.message || e);
    } finally {
      pegando = false;
    }
  }

  setTimeout(conferir, 5000);
  setInterval(conferir, INTERVALO_MS);
  setTimeout(pegarRoleta, 3000);
  setInterval(pegarRoleta, 10 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pegarRoleta(); });
})();
