// content/content.js
window.IS = window.IS || {};

window.IS.init = async function() {
  window.IS.log("Inicializando Inmovya Scale Extension...");
  
  const settings = await window.IS.Storage.getSettings();
  
  if (window.IS.Observer) window.IS.Observer.init();
  if (window.IS.Panel) window.IS.Panel.init();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.IS.init);
} else {
  window.IS.init();
}

// Lidar com mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle_panel') {
    if (window.IS.Panel) window.IS.Panel.toggle();
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'insert_message') {
    (async () => {
      const contactName = window.IS.WhatsAppDOM.getCurrentChatName();
      const finalMessage = await window.IS.Variables.parseMessage(request.message, contactName);
      await window.IS.WhatsAppDOM.insertSequenceAndAttachments(finalMessage, request.attachments);
      sendResponse({ success: true });
    })();
    return true; 
  }

  if (request.action === 'campaign_auto_send') {
    (async () => {
      try {
        let input = await window.IS.WhatsAppDOM.waitForMessageInput(30000);
        if (!input) throw new Error('A conversa do WhatsApp não ficou pronta.');
        input.focus();
        await window.IS.WhatsAppDOM.delay(1200);
        input = window.IS.WhatsAppDOM.findMessageInput();
        if (!input) throw new Error('A conversa do WhatsApp ainda está carregando.');

        const attachments = request.attachment?.nativePath
          ? [{
            id: window.IS.generateUUID(),
            name: request.attachment.name || 'imagem-campanha.jpg',
            type: request.attachment.type || 'image/jpeg',
            size: request.attachment.size || 0,
            nativePath: request.attachment.nativePath,
            messageIndex: 0,
            useCaption: !!String(request.text || '').trim()
          }]
          : [];
        const sent = await window.IS.WhatsAppDOM.insertSequenceAndAttachments(
          request.text || '',
          attachments,
          { sendSingleText: true }
        );
        if (!sent) throw new Error('O WhatsApp não confirmou o envio da campanha.');

        sendResponse({ ok: true });
      } catch (error) {
        window.IS.error('Falha no disparo da campanha', error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'start_scraper') {
    (async () => {
      const data = await window.IS.Scraper.run();
      sendResponse({ data });
    })();
    return true;
  }
});
