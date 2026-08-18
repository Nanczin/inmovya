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

export const parseSpintax = (text: string): string => {
    if (!text) return "";
    let result = text;
    // Regex para encontrar o spintax mais interno {A|B|C} (não contém { ou } dentro)
    const regex = /\{([^{}]*\|[^{}]*)\}/;
    
    let match;
    while ((match = regex.exec(result)) !== null) {
        const options = match[1].split('|');
        const randomOption = options[Math.floor(Math.random() * options.length)];
        result = result.substring(0, match.index) + randomOption + result.substring(match.index + match[0].length);
    }
    
    return result;
};
