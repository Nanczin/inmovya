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

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action !== 'native_pick_files' && request?.action !== 'native_read_file') return false;
  const nativeAction = request.action === 'native_pick_files' ? 'pick' : 'read';
  callNativeFileHost({ action: nativeAction, path: request.path || '', multiple: true })
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
