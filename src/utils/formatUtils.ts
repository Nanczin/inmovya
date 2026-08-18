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

export const replaceVariables = (text: string, contactName: string | null | undefined) => {
    if (!text) return "";
    const nome = contactName || "Cliente";
    const primeiroNome = nome.split(" ")[0];
    
    let replaced = text;
    // Replace various formats of "nome"
    replaced = replaced.replace(/(\{\{\s*nome\s*\}\}|\{\s*nome\s*\}|\[\s*nome\s*\])/gi, nome);
    // Replace various formats of "primeiro_nome"
    replaced = replaced.replace(/(\{\{\s*primeiro_nome\s*\}\}|\{\s*primeiro_nome\s*\}|\[\s*primeiro_nome\s*\])/gi, primeiroNome);
    
    return replaced;
};
