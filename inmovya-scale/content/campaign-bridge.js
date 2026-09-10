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

  window.addEventListener('INMOVYA_PICK_CAMPAIGN_IMAGE', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'campaign_pick_image', localId: detail.localId }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_CAMPAIGN_IMAGE_RESULT', {
        detail: {
          token: detail.token,
          ok: !!response?.ok && !error,
          file: response?.file || null,
          error: error || response?.error || ''
        }
      }));
    });
  });

  announceReady();
})();
