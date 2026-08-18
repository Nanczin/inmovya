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

let checkCount = 0;

function clickSendButton() {
  // Só executa no web.whatsapp.com
  if (!window.location.hostname.includes('web.whatsapp.com')) return;
  
  if (hasSent) return;

  console.log("Inmovya WA Sender: Procurando botao de enviar...");

  // O botao de enviar costuma ter o ícone "send" dentro do whatsapp web
  // O painel principal do chat aberto tem id "main"
  const sendButton = document.querySelector('span[data-icon="send"]')?.closest('button') || 
                     document.querySelector('button[aria-label="Enviar"]');
  const chatPanel = document.getElementById('main');

  if (sendButton && chatPanel) {
    console.log("Inmovya WA Sender: Botao encontrado! Enviando em 2 segundos...");
    hasSent = true;
    
    setTimeout(() => {
      sendButton.click();
      console.log("Inmovya WA Sender: Mensagem enviada. Fechando aba em 4 segundos...");
      
      // Fecha a aba depois de enviar (maior delay para dar tempo do envio confirmar na rede)
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "closeTab" });
      }, 4000);
      
    }, 2000); // Atraso de 2s para garantir que o texto foi totalmente carregado no input
  } else {
    // Tenta de novo apos 500ms (máximo de 60 vezes = 30 segundos)
    checkCount++;
    if (checkCount < 60) {
      setTimeout(clickSendButton, 500);
    }
  }
}

// Verifica se tem flag inmovya_auto (agora passamos via URL para api.whatsapp e web.whatsapp)
if (window.location.href.includes('inmovya_auto=1')) {
  if (window.location.hostname.includes('api.whatsapp.com') || window.location.hostname === 'wa.me') {
    // Estamos na tela de interrupcao
    handleInterstitial();
  } else if (window.location.hostname.includes('web.whatsapp.com')) {
    // Estamos na interface principal web - aguarda 8 segundos iniciais para o chat da URL carregar 
    // e não correr o risco de pegar a conversa anterior
    setTimeout(clickSendButton, 8000);
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
       checkCount = 0;
       setTimeout(clickSendButton, 8000);
    }
  }
}).observe(document, {subtree: true, childList: true});
