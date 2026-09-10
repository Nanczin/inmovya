(() => {
  const announceReady = () => window.dispatchEvent(new CustomEvent('INMOVYA_EXTENSION_READY'));

  window.addEventListener('INMOVYA_CHECK_EXTENSION', announceReady);
  window.addEventListener('INMOVYA_OPEN_WHATSAPP', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'campaign_send', ...detail }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_WHATSAPP_RESULT', {
        detail: {
          token: detail.token,
          ok: !!response?.ok && !error,
          error: error || response?.error || ''
        }
      }));
    });
  });

  announceReady();
})();
