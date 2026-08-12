# Sistema de Progresso da Oferta Ativa

## Data: 2026-02-04
## Funcionalidade Implementada

### 📍 **Continuidade de Progresso**

O sistema agora salva automaticamente o progresso de cada lista de contatos na Oferta Ativa, permitindo que você continue de onde parou ao invés de sempre começar do primeiro contato.

---

## Como Funciona

### **1. Salvamento Automático e Imediato**
- Assim que um contato é exibido na tela (seja ao abrir a oferta ou ir para o próximo), o sistema salva o ID no `localStorage`
- Isso garante que se você der refresh na página **enquanto visualiza um contato**, ele voltará exatamente para o mesmo contato
- O progresso é salvo localmente no navegador

### **2. Continuação Inteligente**
Quando você clica em "Solicitar Oferta" em uma lista:

1. **Primeira vez**: Começa do primeiro contato não processado
2. **Próximas vezes**: Continua do **último contato visualizado** (se ainda não foi finalizado) ou do próximo
3. **Se não houver mais contatos após o ponto de parada**: O sistema faz um loop e verifica do início
4. **Se todos os contatos foram processados**: Mostra a mensagem "Oferta ativa esgotada"

### **3. Botão de Reset** 🔄
- Cada lista agora tem um botão de reset (ícone de seta circular) ao lado do botão "Solicitar Oferta"
- Clicando nele, você pode resetar o progresso e recomeçar do início da lista
- Útil quando você quer revisar contatos ou começar uma nova rodada

---

## Exemplo de Uso

### Cenário 1: Processamento Normal
```
Lista: "Campanha Janeiro 2026" (150 contatos)

1. Clica "Solicitar Oferta" → Mostra contato #1 (João Silva)
2. Classifica como "Caixa Postal" e clica "Salvar e Solicitar Nova Oferta"
3. Sistema salva progresso e mostra contato #2 (Maria Santos)
4. Classifica como "Cliente Interessado" e clica "Salvar e Sair"
5. Fecha a oferta ativa

[Mais tarde...]

6. Clica "Solicitar Oferta" novamente
7. Sistema continua do contato #3 (Pedro Costa) ✅
   (Não volta para o #1!)
```

### Cenário 2: Reset de Progresso
```
Lista: "Campanha Janeiro 2026"

1. Já processou 50 contatos
2. Quer recomeçar do início
3. Clica no botão de reset (🔄)
4. Próxima vez que clicar "Solicitar Oferta", começa do contato #1
```

---

## Detalhes Técnicos

### **Armazenamento**
- **Chave**: `oferta_ativa_progress_{listaId}`
- **Valor**: ID do último contato processado
- **Local**: `localStorage` do navegador

### **Lógica de Busca**
```typescript
1. Recupera último ID processado do localStorage
2. Encontra o índice desse contato na lista ordenada
3. Começa a buscar do próximo índice (índice + 1)
4. Procura o primeiro contato não processado
5. Se não encontrar até o final, faz loop do início
6. Se não encontrar nenhum, mostra "esgotado"
```

### **Critérios de "Não Processado"**
Um contato é considerado não processado se:
- Não tem classificação (`classificacao` é `null` ou `undefined`)
- OU está classificado como "Caixa Postal/Cliente Não Atendeu"

Contatos classificados como "Cliente Interessado" ou "Deny List" são removidos da lista automaticamente.

---

## Arquivos Modificados

### `src/components/LigacoesModule.tsx`

**Mudanças principais:**

1. **Novo import**:
   ```typescript
   import { RotateCcw } from "lucide-react";
   ```

2. **Nova função `handleResetarProgresso`**:
   ```typescript
   const handleResetarProgresso = (listaId: string, e: React.MouseEvent) => {
     e.stopPropagation();
     const progressKey = `oferta_ativa_progress_${listaId}`;
     localStorage.removeItem(progressKey);
     toast({
       title: "Progresso Resetado",
       description: "A oferta ativa desta lista começará do início na próxima vez.",
       duration: 3000
     });
   };
   ```

3. **Atualização em `handleSolicitarOferta`**:
   - Recupera último contato processado do localStorage
   - Busca a partir do ponto de parada
   - Implementa lógica de loop circular

4. **Atualização em `salvarInteresseEClassificacao`**:
   - Salva o progresso após processar cada contato
   - Armazena o ID do contato no localStorage

5. **Novo botão de reset na UI**:
   - Botão com ícone `RotateCcw`
   - Posicionado ao lado do botão "Solicitar Oferta"
   - Tooltip explicativo

---

## Benefícios

✅ **Produtividade**: Não perde tempo navegando por contatos já processados
✅ **Flexibilidade**: Pode pausar e retomar o trabalho a qualquer momento
✅ **Controle**: Botão de reset permite recomeçar quando necessário
✅ **Independência**: Cada lista mantém seu próprio progresso
✅ **Persistência**: Progresso mantido mesmo após fechar o navegador

---

## Notas Importantes

⚠️ **Limpeza do Navegador**: Se você limpar os dados do navegador (cache/localStorage), o progresso será perdido

⚠️ **Diferentes Navegadores**: O progresso é específico de cada navegador. Se usar Chrome e depois Firefox, cada um terá seu próprio progresso

⚠️ **Diferentes Dispositivos**: O progresso não sincroniza entre dispositivos (é local)

💡 **Dica**: Use o botão de reset se quiser fazer uma nova rodada de contatos ou se achar que o progresso está incorreto

---

## Próximas Melhorias Possíveis

- [ ] Sincronizar progresso no banco de dados (Supabase)
- [ ] Mostrar indicador visual de progresso (ex: "15/150 contatos processados")
- [ ] Adicionar opção de "pular" contato sem processar
- [ ] Histórico de progresso por data
- [ ] Exportar relatório de contatos processados
