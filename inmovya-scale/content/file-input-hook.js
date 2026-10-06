// Roda no "MAIN world" da página (não no mundo isolado da extensão).
// O WhatsApp Web passou a criar o <input type="file"> só no clique em
// "Fotos e vídeos"/"Documento", sem deixá-lo no DOM. Quando a extensão arma a
// captura (atributo data-is-capture-file-input no <html>), interceptamos o
// input.click(), não abrimos o seletor do Windows e colocamos o input num
// contêiner oculto para o whatsapp-dom.js preencher os arquivos.
(() => {
  const ARM_ATTR = 'data-is-capture-file-input';
  const HOLDER_ID = 'inmovya-scale-captured-inputs';

  const shouldCapture = input => {
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return false;
    const armedAt = Number(document.documentElement.getAttribute(ARM_ATTR) || 0);
    return armedAt && Date.now() - armedAt < 5000;
  };

  const capture = input => {
    document.documentElement.removeAttribute(ARM_ATTR);
    let holder = document.getElementById(HOLDER_ID);
    if (!holder) {
      holder = document.createElement('div');
      holder.id = HOLDER_ID;
      holder.style.display = 'none';
      document.documentElement.appendChild(holder);
    }
    holder.replaceChildren();
    input.setAttribute('data-is-captured', String(Date.now()));
    // Se o WhatsApp já colocou o input em algum lugar, não mexemos na posição.
    if (!input.isConnected) holder.appendChild(input);
    else input.setAttribute('data-is-captured-inplace', '1');
  };

  const originalClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function (...args) {
    if (shouldCapture(this)) return capture(this);
    return originalClick.apply(this, args);
  };

  if (HTMLInputElement.prototype.showPicker) {
    const originalShowPicker = HTMLInputElement.prototype.showPicker;
    HTMLInputElement.prototype.showPicker = function (...args) {
      if (shouldCapture(this)) return capture(this);
      return originalShowPicker.apply(this, args);
    };
  }
})();
