let hasSent = false;

function clickSendButton() {
  // So executa se a URL tiver a tag inmovya_auto=1 e ainda nao tiver enviado nesta sessao
  if (!window.location.href.includes('inmovya_auto=1') || hasSent) return;

  console.log("Inmovya WA Sender: Procurando botao de enviar...");

  // O botao de enviar costuma ter o ícone "send" dentro do whatsapp web
  // Podemos procurar de varias formas:
  const sendButton = document.querySelector('span[data-icon="send"]')?.closest('button') || 
                     document.querySelector('button[aria-label="Enviar"]');

  if (sendButton) {
    console.log("Inmovya WA Sender: Botao encontrado! Enviando em 1 segundo...");
    hasSent = true;
    
    setTimeout(() => {
      sendButton.click();
      console.log("Inmovya WA Sender: Mensagem enviada. Fechando aba em 2 segundos...");
      
      // Fecha a aba depois de enviar
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "closeTab" });
      }, 2000);
      
    }, 1000); // Pequeno atraso para garantir que a interface atualizou
  } else {
    // Tenta de novo apos 500ms
    setTimeout(clickSendButton, 500);
  }
}

// Inicia se a url conter os parametros
if (window.location.href.includes('inmovya_auto=1')) {
  // Espera a página estar totalmente carregada
  setTimeout(clickSendButton, 2000);
}

// Monitora mudancas de URL no modo SPA do WhatsApp
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (url.includes('inmovya_auto=1')) {
       hasSent = false;
       setTimeout(clickSendButton, 2000);
    }
  }
}).observe(document, {subtree: true, childList: true});
