# 🔍 Diagnóstico de Lembretes - Instruções

## Problema
As notificações de lembretes criados via nós de funil no mapa do lead não estão aparecendo.

## Como Testar

### 1. Abra o Console do Navegador
- Pressione F12
- Vá para a aba "Console"

### 2. Configure um Lembrete de Teste
- Abra o mapa de jornada de um lead
- Edite um nó de funil
- Ative "🔔 Lembrete ao Conectar"
- Configure:
  - **Mensagem**: "Teste de lembrete"
  - **Data**: 08/02/2026 (hoje)
  - **Hora**: 15:45 (1-2 minutos no futuro)
- Salve as alterações

### 3. Conecte o Lead ao Funil
- Arraste uma conexão do lead para o nó de funil
- Observe os logs no console

### 4. Logs Esperados (ao conectar)

```
🔔 Triggering automatic reminder for funnel: [nome do funil]
📅 Reminder config: { date: "2026-02-08", time: "15:45", msg: "Teste de lembrete" }
📆 Due date created: 2026-02-08T18:45:00.000Z | Now: 2026-02-08T18:43:50.000Z
💾 Creating task: { title: "Teste de lembrete", ... }
✅ Task created successfully! ID: [uuid]
```

### 5. Aguarde o Horário do Lembrete
- Espere até 15:45
- O sistema de polling verifica a cada 5 segundos
- Você deve ver logs no console a cada 5 segundos:

```
🔍 [POLLING] Checking for due tasks at: 15:45:03
📋 [POLLING] Found 1 due tasks
📝 [POLLING] Due tasks: [array com a tarefa]
🔔 [POLLING] Creating notification for task: [uuid] Teste de lembrete
✅ [POLLING] Updated notified tasks list
```

### 6. Verificações

#### ✅ Se a tarefa foi criada:
- Verifique se apareceu "✅ Task created successfully!" nos logs
- A tarefa foi salva no banco de dados

#### ✅ Se o polling está funcionando:
- A cada 5 segundos deve aparecer "🔍 [POLLING] Checking for due tasks"
- Se não aparecer, o LeadsModule não está montado

#### ✅ Se a notificação foi criada:
- Deve aparecer "🔔 [POLLING] Creating notification for task"
- A notificação deve aparecer no canto superior direito

## Possíveis Problemas

### Problema 1: Tarefa não é criada
**Sintoma**: Não aparece "💾 Creating task" nos logs
**Causa**: Data/hora não estão sendo salvos
**Solução**: Verificar se os campos estão sendo persistidos

### Problema 2: Polling não detecta a tarefa
**Sintoma**: Aparece "📋 [POLLING] Found 0 due tasks" mesmo após o horário
**Causa**: 
- Fuso horário incorreto
- Tarefa criada com status diferente de 'pending'
- Data no formato errado

**Debug**: Execute no console:
```javascript
const now = new Date();
console.log('Now:', now.toISOString());

// Verificar tarefas no banco
const { data } = await supabase.from('tasks').select('*').eq('status', 'pending');
console.log('All pending tasks:', data);
```

### Problema 3: Notificação não aparece
**Sintoma**: Aparece "🔔 [POLLING] Creating notification" mas nada aparece na tela
**Causa**: Problema com o sistema de notificações
**Solução**: Verificar se `useNotifications` está funcionando

## Solução Rápida

Se quiser testar imediatamente, configure o lembrete para **1 minuto no passado**:
- Data: 08/02/2026
- Hora: 15:42 (se agora são 15:43)

Isso fará com que o lembrete seja detectado na próxima verificação (em até 5 segundos).
