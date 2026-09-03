// content/content.js
window.IS = window.IS || {};

window.IS.init = async function() {
  window.IS.log("Inicializando Inmovya Scale Extension...");
  
  // Opcional: injetar CSS de painel se necessrio no futuro
  // O Observer e Shortcuts sero as principais funcionalidades
  
  if (window.IS.Observer) window.IS.Observer.init();
  if (window.IS.Shortcuts) window.IS.Shortcuts.init();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.IS.init);
} else {
  window.IS.init();
}

// Lidar com mensagens do popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'insert_message') {
    const contactName = window.IS.WhatsAppDOM.getCurrentChatName();
    const finalMessage = await window.IS.Variables.parseMessage(request.message, contactName);
    window.IS.WhatsAppDOM.insertMessage(finalMessage);
    sendResponse({ success: true });
  }
});
