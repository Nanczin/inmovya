// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: 'web.whatsapp.com' }
          })
        ],
        actions: [new chrome.declarativeContent.ShowAction()]
      }
    ]);
  });
});


chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes("web.whatsapp.com")) {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_panel" });
  } else {
    chrome.tabs.create({ url: "https://web.whatsapp.com" });
  }
});

const NATIVE_FILE_HOST = 'com.inmovya.scale.files';

function callNativeFileHost(message) {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connectNative(NATIVE_FILE_HOST);
    const chunks = [];
    let metadata = {};
    let settled = false;
    const finish = (callback, value) => { if (settled) return; settled = true; port.disconnect(); callback(value); };
    port.onMessage.addListener(response => {
      if (!response || response.ok === false) return finish(reject, new Error(response?.error || 'Falha no aplicativo auxiliar.'));
      if (response.event === 'chunk') { chunks.push(response.data || ''); return; }
      if (response.event === 'start') { metadata = response; return; }
      if (response.event === 'complete') return finish(resolve, { ...metadata, ...response, data: chunks.join('') });
      finish(resolve, response);
    });
    port.onDisconnect.addListener(() => { if (!settled) finish(reject, new Error(chrome.runtime.lastError?.message || 'Aplicativo auxiliar desconectado.')); });
    port.postMessage(message);
  });
}

function debuggerCommand(target, method, params = {}) {
  return chrome.debugger.sendCommand(target, method, params);
}

function attributesToObject(attributes = []) {
  const result = {};
  for (let index = 0; index < attributes.length; index += 2) {
    result[attributes[index]] = attributes[index + 1] || '';
  }
  return result;
}

function scoreFileInput(attributes, kind) {
  const accept = (attributes.accept || '').toLowerCase();
  const hasCapture = Object.prototype.hasOwnProperty.call(attributes, 'capture');
  const multiple = Object.prototype.hasOwnProperty.call(attributes, 'multiple');
  if (hasCapture) return -1;

  if (kind === 'media') {
    if (!accept.includes('image/') && !accept.includes('video/')) return -1;
    return (accept.includes('video/') ? 100 : 0) + (accept.includes('image/') ? 50 : 0) + (multiple ? 10 : 0);
  }

  if (accept.includes('image/') || accept.includes('video/')) return -1;
  return (accept.includes('application/') || accept.includes('*') ? 100 : 20) + (multiple ? 10 : 0);
}

async function setFilesWithDebugger(tabId, paths, kind) {
  if (!tabId || !Array.isArray(paths) || !paths.length) throw new Error('Lista de arquivos inválida.');
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    const { root } = await debuggerCommand(target, 'DOM.getDocument', { depth: -1, pierce: true });
    const { nodeIds = [] } = await debuggerCommand(target, 'DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: 'input[type="file"]'
    });
    const candidates = [];
    for (const nodeId of nodeIds) {
      const { attributes } = await debuggerCommand(target, 'DOM.getAttributes', { nodeId });
      const parsed = attributesToObject(attributes);
      const score = scoreFileInput(parsed, kind);
      if (score >= 0) candidates.push({ nodeId, score });
    }
    candidates.sort((left, right) => right.score - left.score);
    if (!candidates.length) throw new Error(`Campo de ${kind === 'media' ? 'fotos e vídeos' : 'documentos'} não encontrado.`);
    await debuggerCommand(target, 'DOM.setFileInputFiles', { files: paths, nodeId: candidates[0].nodeId });
    return { ok: true };
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action === 'debugger_set_files') {
    setFilesWithDebugger(sender.tab?.id, request.paths, request.kind)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (request?.action !== 'native_pick_files' && request?.action !== 'native_read_file') return false;
  const nativeAction = request.action === 'native_pick_files' ? 'pick' : 'read';
  callNativeFileHost({ action: nativeAction, path: request.path || '', multiple: true })
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
