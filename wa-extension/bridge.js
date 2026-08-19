window.addEventListener('INMOVYA_CHECK_EXTENSION', () => {
  window.dispatchEvent(new CustomEvent('INMOVYA_EXTENSION_READY'));
});

window.addEventListener('INMOVYA_OPEN_WHATSAPP', (e) => {
  if (e.detail && e.detail.url) {
    chrome.runtime.sendMessage({ action: "openTabBackground", url: e.detail.url });
  }
});
