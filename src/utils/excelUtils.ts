import * as XLSX from "xlsx";

export async function findBestSheetData(workbook: XLSX.WorkBook): Promise<any[]> {
    // Procurar em TODAS as abas por dados válidos
    let bestSheetName = '';
    let bestSheetScore = 0;
    let bestHeaderIndex = 0;
    let bestSheetData: any[] = [];

    const keywords = ['nome', 'name', 'cliente', 'email', 'mail', 'telefone', 'celular', 'contato', 'fone'];

    console.log(`[Import] Arquivo contém ${workbook.SheetNames.length} abas: ${workbook.SheetNames.join(', ')}`);

    for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (!rawData || rawData.length === 0) continue;

        // Tentar encontrar cabeçalho nesta aba
        let currentMaxScore = 0;
        let currentHeaderIndex = -1;

        for (let i = 0; i < Math.min(rawData.length, 20); i++) {
            const row = rawData[i];
            if (!row || !Array.isArray(row)) continue;

            const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
            let score = 0;
            keywords.forEach(keyword => {
                if (rowStr.includes(keyword)) score++;
            });

            if (score > currentMaxScore) {
                currentMaxScore = score;
                currentHeaderIndex = i;
            }
        }

        // Se encontrou um bom cabeçalho, pontuar a aba
        if (currentMaxScore > 0) {
            const dataRowsCount = rawData.length - currentHeaderIndex - 1;
            const sheetScore = currentMaxScore + (dataRowsCount > 0 ? 1 : 0) + (dataRowsCount > 2 ? 0.5 : 0);

            console.log(`[Import] Aba "${sheetName}": Score ${sheetScore} (Header Score: ${currentMaxScore}, Rows: ${dataRowsCount})`);

            if (sheetScore > bestSheetScore) {
                bestSheetScore = sheetScore;
                bestSheetName = sheetName;
                bestHeaderIndex = currentHeaderIndex;
                bestSheetData = rawData;
            }
        }
    }

    // Fallback
    if (!bestSheetName) {
        console.log("Nenhuma aba com cabeçalho óbvio encontrada. Tentando encontrar a maior aba.");
        let maxRows = -1;

        for (const sheetName of workbook.SheetNames) {
            const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];
            if (rawData && rawData.length > maxRows) {
                maxRows = rawData.length;
                bestSheetName = sheetName;
                bestSheetData = rawData;
                bestHeaderIndex = 0;
            }
        }
    }

    if (!bestSheetName) {
        throw new Error("Não foi possível encontrar uma aba com dados na planilha.");
    }

    console.log(`[Import] Usando a aba: "${bestSheetName}" com header na linha ${bestHeaderIndex}`);

    // Construir JSON manualmente
    const headers = bestSheetData[bestHeaderIndex].map((h: any) => String(h || '').trim());
    const jsonData = bestSheetData.slice(bestHeaderIndex + 1).map((row: any) => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
            if (header && index < row.length) {
                obj[header] = row[index];
            }
        });
        return obj;
    });

    console.log(`[Import] ${jsonData.length} linhas extraídas.`);
    return jsonData;
}
