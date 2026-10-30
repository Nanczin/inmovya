// dinheiro-na-mesa-bg.js — parte do service worker do modo "Dinheiro na Mesa".
// A tela (content/dinheiro-na-mesa.js, dentro do WhatsApp Web) pede para gravar cada ligação no Inmovya;
// aqui usamos o mesmo token do agente (agenteCredenciais/agenteRpc do agente-primeiro-contato.js).

const DNM_FUNCOES = new Set(['agente_dnm_registrar', 'agente_dnm_placar']);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== 'dnm_rpc') return;
  (async () => {
    if (!DNM_FUNCOES.has(request.nome)) throw new Error('função não permitida');
    const cred = await agenteCredenciais();
    if (!cred) throw new Error('Abra o Inmovya uma vez neste Chrome para ligar a extensão à sua conta.');
    return agenteRpc(cred, request.nome, { p_token: cred.token, ...(request.args || {}) });
  })()
    .then(dados => sendResponse({ ok: true, dados }))
    .catch(err => {
      const msg = String(err?.message || err);
      sendResponse({ ok: false, erro: /agente_dnm|PGRST202|does not exist|Falta rodar/i.test(msg) ? 'Falta instalar o Dinheiro na Mesa no banco do Inmovya.' : msg });
    });
  return true;
});
