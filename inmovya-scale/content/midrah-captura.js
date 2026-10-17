// midrah-captura.js — captura de leads do CRM Midrah para o Inmovya (roda na aba do Midrah, crm.midrah.com.br).
// A cada 1 minuto lê os SEUS negócios novos no Midrah (com o login que já está aberto no Chrome) e manda para o
// Inmovya cadastrar (etapa Validação, origem/tag "Midrah", sem duplicar). Igual à captura do Bitrix e da Meta.
// Só cadastra quem tem WhatsApp (o Scale confere o número no WhatsApp Web antes).
// Precisa: o Midrah aberto numa aba (pode ficar em segundo plano) e o 1º contato configurado no Inmovya (token).
(() => {
  if (window.__inmovyaMidrah) return;
  window.__inmovyaMidrah = true;

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
    if (rodando) return;
    rodando = true;
    try {
      const s = sessao();
      if (!s) return; // não está logado no Midrah
      const apikey = await chavePublica();
      if (!apikey) return log('não achei a chave pública do Midrah');

      let { midrahDesde, midrahFeitos = [] } = await chrome.storage.local.get(['midrahDesde', 'midrahFeitos']);
      if (!midrahDesde) {
        // primeira vez: pega os negócios das últimas 2 horas
        midrahDesde = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
        await chrome.storage.local.set({ midrahDesde });
      }
      const desde = new Date(Math.max(new Date(midrahDesde).getTime(), Date.now() - 3 * 86400 * 1000)).toISOString();
      const url = `${BASE}deals?select=id,name,created_at,development_name,owner_user_id,client:clients(name,phone,whatsapp,email)` +
        `&owner_user_id=eq.${s.user.id}&created_at=gte.${encodeURIComponent(desde)}&order=created_at.asc&limit=100`;
      const r = await fetch(url, { headers: { apikey, Authorization: `Bearer ${s.access_token}` } });
      if (!r.ok) return log('Midrah respondeu', r.status);
      const deals = await r.json();
      const feitos = new Set(midrahFeitos);
      const novos = deals.filter(d => !feitos.has(d.id)).map(d => ({
        id: d.id,
        nome: String(d.client?.name || String(d.name || '').split(' · ')[0] || '').trim(),
        telefone: d.client?.whatsapp || d.client?.phone || '',
        email: d.client?.email || '',
        empreendimento: d.development_name || ''
      }));
      if (!novos.length) return;
      novos.splice(5); // até 5 por minuto (cada número é conferido no WhatsApp antes)
      const resp = await chrome.runtime.sendMessage({ action: 'midrah_capturar', leads: novos });
      if (!resp?.ok) return log('não cadastrou:', resp?.error);
      const ok = (resp.resultados || []).filter(x => x.ok).map(x => x.id);
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

  setTimeout(conferir, 5000);
  setInterval(conferir, INTERVALO_MS);
})();
