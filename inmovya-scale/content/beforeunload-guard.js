// Roda no "MAIN world" só nas abas que a extensão abre para enviar a esteira/campanha
// (URL com inmovya_auto=1). Quando o envio termina, a extensão fecha essa aba; o WhatsApp
// mostrava "Sair do site? É possível que as alterações não sejam salvas" e a esteira parava.
// Aqui o WhatsApp não consegue registrar esse aviso nessa aba (o envio já foi confirmado antes).
(() => {
  if (!String(location.search || '').includes('inmovya_auto=1')) return;
  const addOriginal = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (type === 'beforeunload' && (this === window || this === document)) return;
    return addOriginal.call(this, type, listener, options);
  };
  try {
    Object.defineProperty(window, 'onbeforeunload', { configurable: true, get: () => null, set: () => {} });
  } catch (_) { /* ignore */ }
})();
