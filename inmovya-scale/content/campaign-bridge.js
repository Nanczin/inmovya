(() => {
  const announceReady = () => window.dispatchEvent(new CustomEvent('INMOVYA_EXTENSION_READY', { detail: { version: chrome.runtime.getManifest().version } }));

  window.addEventListener('INMOVYA_CHECK_EXTENSION', announceReady);
  window.addEventListener('INMOVYA_OPEN_WHATSAPP', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'campaign_send', ...detail }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_WHATSAPP_RESULT', {
        detail: {
          token: detail.token,
          ok: !!response?.ok && !error,
          error: error || response?.error || '',
          labelError: response?.labelError || ''
        }
      }));
    });
  });

  // Etiquetas em lote (modo rápido)
  window.addEventListener('INMOVYA_LABEL_BATCH', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'labels_batch', items: detail.items || [] }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_LABEL_BATCH_RESULT', {
        detail: {
          token: detail.token,
          ok: !!response?.ok && !error,
          results: response?.results || [],
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

  // Inmovya lê as esteiras/etiquetas guardadas no Scale (para unificar no CRM)
  window.addEventListener('INMOVYA_SCALE_EXPORT', async event => {
    const detail = event.detail || {};
    try {
      const keys = ['replies', 'categories', 'settings', 'waLabels', 'leadCategoryAssignments', 'leadStageAssignments'];
      const data = await chrome.storage.local.get(keys);
      // anexos vão só com nome/tipo (sem o arquivo em si)
      if (Array.isArray(data.replies)) {
        data.replies = data.replies.map(reply => ({
          ...reply,
          attachments: (reply.attachments || []).map(att => ({ name: att.name, type: att.type }))
        }));
      }
      window.dispatchEvent(new CustomEvent('INMOVYA_SCALE_DATA', {
        detail: { token: detail.token, ok: true, json: JSON.stringify({ backupVersion: 2, data }) }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('INMOVYA_SCALE_DATA', {
        detail: { token: detail.token, ok: false, error: error?.message || String(error) }
      }));
    }
  });

  announceReady();
})();
