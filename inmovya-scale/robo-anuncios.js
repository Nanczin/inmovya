// robo-anuncios.js — CADASTRO AUTOMÁTICO dos leads de anúncio que chegam direto no WhatsApp (Inmovya Scale).
//
// Não conversa e não manda NENHUMA mensagem. Só quando você liga no Inmovya (Esteiras → Leads de anúncio):
//   a cada 30 s (e na hora em que chega mensagem nova) lê a LISTA de conversas da aba do WhatsApp Web, sem abrir nada,
//   e cadastra no Inmovya quem: é número NÃO salvo, mandou a frase do anúncio (na prévia; se a última msg for sua, abre a conversa uma vez para conferir)
//   ("Olá! Tenho interesse…") e ainda não está no Inmovya. O lead entra pela fila de conferência (→ Validação),
//   com as tags "anuncio" e "robo-anuncio" e a mensagem dele nas observações. Cada número é cadastrado uma vez só.
// Usa funções do agente-primeiro-contato.js: agenteCredenciais, agenteRpc, agenteSemAcento, agenteTelefone.

const ROBO_ALARME = 'inmovya-robo-anuncios';

function roboGarantirAlarme() {
  chrome.alarms.get(ROBO_ALARME, a => {
    if (!a || a.periodInMinutes !== 0.5) chrome.alarms.create(ROBO_ALARME, { periodInMinutes: 0.5, delayInMinutes: 0.1 });
  });
}
roboGarantirAlarme();
chrome.runtime.onStartup.addListener(roboGarantirAlarme);
chrome.runtime.onInstalled.addListener(roboGarantirAlarme);
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === ROBO_ALARME) roboRodada().catch(err => console.error('[Inmovya anúncios]', err));
});
// a aba do WhatsApp avisa quando aparece mensagem não lida: confere na hora
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'robo_acordar') roboRodada().catch(err => console.error('[Inmovya anúncios]', err));
  if (msg?.action === 'robo_pode_usar_aqui') {
    // a aba principal só volta a usar o WhatsApp se nenhuma janelinha do 1º contato estiver aberta
    roboJanelaAutoAberta().then(aberta => sendResponse({ ok: !aberta })).catch(() => sendResponse({ ok: false }));
    return true;
  }
});

async function roboJanelaAutoAberta() {
  const abas = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  return abas.some(t => String(t.url || '').includes('inmovya_auto=1'));
}

async function roboAbaPrincipal() {
  const abas = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  return abas.find(t => !String(t.url || '').includes('inmovya_auto=1')) || null;
}

let roboEmCurso = false;
async function roboRodada() {
  if (roboEmCurso) return;
  roboEmCurso = true;
  try { await roboRodadaAgora(); } finally { roboEmCurso = false; }
}

async function roboRodadaAgora() {
  const cred = await agenteCredenciais();
  if (!cred) return;
  let estado;
  try {
    estado = await agenteRpc(cred, 'robo_ext_estado', { p_token: cred.token });
  } catch (err) {
    if (!/robo_ext_estado|não existe|does not exist|PGRST202|Falta rodar/i.test(err.message)) console.warn('[Inmovya anúncios]', err.message);
    return;
  }
  if (!estado?.ativo) return;
  const aviso = a => agenteRpc(cred, 'robo_ext_aviso', { p_token: cred.token, p_aviso: a || null }).catch(() => {});

  const aba = await roboAbaPrincipal();
  if (!aba?.id) return aviso('Abra o WhatsApp Web numa aba deste Chrome (pode deixar atrás das outras) para cadastrar os leads de anúncio.');
  // o Chrome não pode "adormecer" essa aba
  if (aba.autoDiscardable !== false) await chrome.tabs.update(aba.id, { autoDiscardable: false }).catch(() => {});
  if (aba.discarded) { await chrome.tabs.reload(aba.id).catch(() => {}); return aviso('Acordei a aba do WhatsApp Web (o Chrome tinha posto ela para dormir).'); }

  let lista;
  try {
    lista = await chrome.tabs.sendMessage(aba.id, { action: 'robo_listar_conversas' });
    if (!lista?.ok && lista?.usarAqui && !(await roboJanelaAutoAberta())) {
      await chrome.tabs.sendMessage(aba.id, { action: 'robo_usar_aqui' }).catch(() => {});
      await new Promise(r => setTimeout(r, 6000));
      lista = await chrome.tabs.sendMessage(aba.id, { action: 'robo_listar_conversas' });
    }
  } catch (err) {
    const { roboRecarregouAba = 0 } = await chrome.storage.local.get('roboRecarregouAba');
    if (/Receiving end|Could not establish/i.test(err?.message || '') && Date.now() - roboRecarregouAba > 10 * 60 * 1000) {
      await chrome.storage.local.set({ roboRecarregouAba: Date.now() });
      await chrome.tabs.reload(aba.id).catch(() => {});
      return aviso('Recarreguei a aba do WhatsApp Web (a extensão foi atualizada).');
    }
    return aviso('O WhatsApp Web ainda está carregando.');
  }
  if (!lista?.ok) {
    if (lista?.usarAqui) return; // uma janelinha do 1º contato está usando o WhatsApp agora; volta na próxima
    return aviso(lista?.error || 'Não consegui ler a lista de conversas.');
  }
  await aviso(null);

  const frases = (estado.frases_anuncio || []).map(agenteSemAcento).filter(Boolean);
  const pareceAnuncio = t => { const s = agenteSemAcento(t); return !!s && frases.some(f => s.includes(f)); };
  const pessoal = String(estado.numero_aviso || '').replace(/\D/g, '').slice(-8);

  let lidas = 0; // conversas abertas nesta rodada (no máximo 2, para não ficar abrindo janelas)
  for (const linha of lista.linhas || []) {
    const tel = agenteTelefone(linha.telefone);
    if (!tel || tel.length < 12) continue;
    if (pessoal && tel.slice(-8) === pessoal) continue;
    const vistos = await roboVistos();
    if (vistos[tel]) continue; // já conferido antes (cadastrado ou não é anúncio)
    let info;
    try { info = await agenteRpc(cred, 'robo_ext_conversa', { p_token: cred.token, p_telefone: tel }); } catch (_) { continue; }
    if (info?.conversa || info?.ja_e_lead) { await roboMarcarVisto(tel); continue; } // já cadastrado / já é lead

    let mensagem = null;
    if (!linha.ultimaSua && pareceAnuncio(linha.ultimaMensagem)) {
      mensagem = linha.ultimaMensagem; // a prévia já mostra a frase do anúncio: cadastra sem abrir nada
    } else if (linha.ultimaSua && lidas < 2) {
      // a última mensagem é sua (ex.: saudação automática do Business ou você já respondeu pelo celular):
      // abre a conversa numa janelinha UMA vez e procura a frase do anúncio nas mensagens dele
      lidas++;
      try {
        const leitura = await naVezWA(() => agenteNaConversa({ phone: tel, background: true, rapido: true }, 'agent_read_chat_tab'));
        const dele = (leitura?.mensagens || []).filter(m => m.dir === 'in' && pareceAnuncio(m.texto));
        if (dele.length) mensagem = dele[0].texto;
        else {
          await roboMarcarVisto(tel);
          continue; // não é lead de anúncio
        }
      } catch (_) {
        continue; // WhatsApp não respondeu: tenta na próxima rodada
      }
    } else {
      continue; // mensagem dele sem a frase (ainda): espera
    }

    try {
      const r = await agenteRpc(cred, 'robo_ext_registrar', {
        p_token: cred.token,
        p_nome: '',
        p_telefone: tel,
        p_observacoes: `Veio pelo anúncio (WhatsApp). Mensagem: "${String(mensagem || '').slice(0, 300)}"`,
      });
      await agenteRpc(cred, 'robo_ext_salvar', {
        p_token: cred.token,
        p_telefone: tel,
        p_dados: { situacao: 'cadastrado', resultado_inmovya: r?.acao || 'cadastrado' },
      });
      await roboMarcarVisto(tel);
      console.log('[Inmovya anúncios] cadastrado', tel, r?.acao);
    } catch (err) {
      await aviso(`Não consegui cadastrar +${tel}: ${err.message}`);
    }
  }
}

// números já conferidos (guardados por 30 dias neste Chrome, para não consultar o banco toda hora)
async function roboVistos() {
  const { roboVistos: v = {} } = await chrome.storage.local.get('roboVistos');
  return v;
}
async function roboMarcarVisto(tel) {
  const v = await roboVistos();
  const limite = Date.now() - 30 * 24 * 3600e3;
  for (const k of Object.keys(v)) if (v[k] < limite) delete v[k];
  v[tel] = Date.now();
  await chrome.storage.local.set({ roboVistos: v });
}
