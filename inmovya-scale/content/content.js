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
        const input = await window.IS.WhatsAppDOM.waitForMessageInput(20000);
        if (!input) throw new Error('A conversa do WhatsApp não ficou pronta.');

        if (request.imageUrl) {
          const response = await fetch(request.imageUrl);
          if (!response.ok) throw new Error('Não foi possível baixar a imagem da campanha.');
          const blob = await response.blob();
          if (!blob.type.startsWith('image/')) throw new Error('O anexo da campanha não é uma imagem válida.');
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Não foi possível preparar a imagem.'));
            reader.readAsDataURL(blob);
          });
          const sent = await window.IS.WhatsAppDOM.sendAttachmentBatch([{
            id: window.IS.generateUUID(),
            name: request.imageName || 'imagem-campanha.jpg',
            type: blob.type,
            data
          }], request.text || '');
          if (!sent) throw new Error('O WhatsApp não confirmou o envio da imagem.');
        } else {
          if (!await window.IS.WhatsAppDOM.insertMessage(request.text || '')) {
            throw new Error('O WhatsApp não aceitou a mensagem.');
          }
          if (!await window.IS.WhatsAppDOM.triggerSend()) {
            throw new Error('O botão de envio não foi encontrado.');
          }
        }

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
