// Uma coisa por vez no WhatsApp: enquanto a esteira envia, o disparo da Oferta Ativa espera (e vice-versa).
let whatsappOcupado = false;
export const isWhatsAppOcupado = () => whatsappOcupado;
export const setWhatsAppOcupado = (v: boolean) => {
  whatsappOcupado = v;
};
