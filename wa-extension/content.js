let hasSent = false;

function handleInterstitial() {
  // Se estivermos na tela de confirmacao (api.whatsapp.com ou wa.me)
  const actionButton = document.getElementById('action-button');
  if (actionButton) {
    console.log("Inmovya WA Sender: Clicando em Continuar para o chat...");
    actionButton.click();
    
    // Depois de clicar no botão principal, precisamos clicar no link "usar o WhatsApp Web"
    setTimeout(() => {
      const fallbackLink = Array.from(document.querySelectorAll('a')).find(
        a => a.href && a.href.includes('web.whatsapp.com')
      );
      if (fallbackLink) {
        console.log("Inmovya WA Sender: Clicando em usar WhatsApp Web...");
        fallbackLink.click();
      }
    }, 500);
  }
}

function clickSendButton() {
  // Só executa no web.whatsapp.com
  if (!window.location.hostname.includes('web.whatsapp.com')) return;
  
  if (hasSent) return;

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

// Verifica se tem flag inmovya_auto (agora passamos via URL para api.whatsapp e web.whatsapp)
if (window.location.href.includes('inmovya_auto=1')) {
  if (window.location.hostname.includes('api.whatsapp.com') || window.location.hostname === 'wa.me') {
    // Estamos na tela de interrupcao
    handleInterstitial();
  } else if (window.location.hostname.includes('web.whatsapp.com')) {
    // Estamos na interface principal web
    setTimeout(clickSendButton, 2000);
  }
}

// Monitora mudancas de URL no modo SPA do WhatsApp
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (url.includes('inmovya_auto=1') && url.includes('web.whatsapp.com')) {
       hasSent = false;
       setTimeout(clickSendButton, 2000);
    }
  }
}).observe(document, {subtree: true, childList: true});
