export const formatCurrency = (value: string) => {
    if (!value) return '';

    // Remove tudo que não é dígito
    const numericValue = value.replace(/\D/g, '');

    if (!numericValue) return '';

    // Converte para número e divide por 100 para ter os centavos
    const amount = parseFloat(numericValue) / 100;

    // Formata para BRL
    return amount.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
};
