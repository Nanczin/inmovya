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

function trySend() {
  if (!window.location.hostname.includes('web.whatsapp.com')) return;
  if (hasSent) return;

  console.log("Inmovya WA Sender: Tentando enviar...");

  const mainPanel = document.getElementById('main');
  if (!mainPanel) {
    scheduleRetry();
    return;
  }

  // 1. Procurar a caixa de texto
  const inputBox = mainPanel.querySelector('div[contenteditable="true"]');
  if (!inputBox) {
    scheduleRetry();
    return;
  }

  // 2. Inserir o texto (lido da URL como inmovya_msg)
  const urlParams = new URLSearchParams(window.location.search);
  const customMsg = urlParams.get('inmovya_msg');
  
  if (customMsg) {
    // Focar e inserir texto
    inputBox.focus();
    // Tenta usar execCommand que é o método mais robusto para disparar os eventos corretos do React no WhatsApp
    document.execCommand('insertText', false, customMsg);
  }

  // 3. Aguardar o botão de enviar aparecer e clicar nele
  setTimeout(() => {
    const sendButton = document.querySelector('span[data-icon="send"]')?.closest('button') || 
                       document.querySelector('button[aria-label="Enviar"]');
    
    if (sendButton) {
      console.log("Inmovya WA Sender: Botao encontrado! Enviando...");
      hasSent = true;
      sendButton.click();
    } else {
      // Se não encontrou o botão de enviar mesmo com o texto (ou se era só link normal), tenta novamente
      scheduleRetry();
    }
  }, 1000);
}

function scheduleRetry() {
  checkCount++;
  if (checkCount < 60) { // Tenta por até 30 segundos (60 * 500ms)
    setTimeout(trySend, 500);
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
    setTimeout(trySend, 8000);
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
       setTimeout(trySend, 8000);
    }
  }
}).observe(document, {subtree: true, childList: true});
