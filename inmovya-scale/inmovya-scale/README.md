# Inmovya Scale

Inmovya Scale é uma extensão para Google Chrome desenvolvida especificamente para aumentar a produtividade no atendimento pelo WhatsApp Web através de respostas rápidas, atalhos, variáveis dinâmicas e organização por categorias.

## Funcionalidades

- **Respostas Rápidas**: Encontre rapidamente mensagens prontas e insira na conversa ativa.
- **Atalhos**: Digite um atalho como `/bv` + Espaço e ele será substituído automaticamente.
- **Variáveis Dinâmicas**: Suporte a `{{nome}}`, `{{saudacao}}`, `{{meu_nome}}`, `{{data}}` e `{{hora}}`.
- **Categorias e Favoritos**: Organize suas mensagens e fixe as principais no topo.
- **Painel Lateral Integrado**: Um painel nativo dentro do WhatsApp Web com redimensionamento.
- **Sincronização**: Gerenciamento de respostas via popup que sincroniza instantaneamente com o painel lateral.
- **Backup Local**: Exportação e importação completa em formato JSON. Tudo roda localmente!

## Segurança e Privacidade

- **Local-first**: Suas respostas, métricas e configurações nunca saem do seu computador.
- **Sem Servidor Externo**: A Inmovya Scale não usa nenhum banco de dados ou backend externo.
- **Não coleta dados**: Não há captura de conversas, envio automático ou qualquer mecanismo de rastreio.

## Como Instalar (Passo a Passo)

1. Crie uma pasta chamada `inmovya-scale` (se você está lendo isso, provavelmente já extraiu os arquivos nela).
2. Certifique-se que todos os arquivos (`manifest.json`, `content/`, `popup/`, etc.) estão dentro dela.
3. Abra o Google Chrome e acesse `chrome://extensions`.
4. Ative o botão **Modo do desenvolvedor** no canto superior direito.
5. Clique em **Carregar sem compactação** no canto superior esquerdo.
6. Selecione a pasta `inmovya-scale`.
7. Acesse `https://web.whatsapp.com` (se já estava aberto, aperte F5 para recarregar).
8. Espere o WhatsApp carregar. O ícone da extensão ou o painel aparecerá na lateral direita!

## Como Usar

- **Criar Resposta**: Clique no ícone da extensão (ao lado da barra de endereços do Chrome) para abrir o Popup. Vá em "Nova", preencha o Título e a Mensagem, defina um atalho opcional e salve.
- **Inserir Mensagem**: No WhatsApp Web, abra uma conversa e clique na resposta desejada no painel lateral.
- **Atalhos**: Na conversa, digite o atalho (ex: `/teste`) e aperte `Espaço`. A mensagem será inserida automaticamente com o nome do contato.

## Guia de Testes (Checklist)

- [ ] Criação de resposta (Popup)
- [ ] Edição, Exclusão e Duplicação (Popup)
- [ ] Organização por categorias (Popup)
- [ ] Favoritar mensagens
- [ ] Pesquisa (Popup e Painel)
- [ ] Painel carrega mensagens criadas e exibe botão flutuante.
- [ ] Substituição do atalho (`/atalho` + Espaço no campo do WhatsApp).
- [ ] Substituição das variáveis: `{{nome}}`, `{{saudacao}}`, `{{meu_nome}}`.
- [ ] Redimensionamento do painel lateral.
- [ ] Exportação/Importação de JSON (Backup).
- [ ] Manter dados ao fechar e abrir navegador.

## Depuração (Para Desenvolvedores)

- **Popup**: Vá em `chrome://extensions` > Encontre Inmovya Scale > clique em `Inspecionar exibição popup`.
- **Painel e Atalhos**: No WhatsApp Web, aperte `F12` e veja o Console. Use os logs filtrando por `[Inmovya Scale]`.
- **Recarregar Extensão**: Toda vez que modificar um arquivo do código, vá em `chrome://extensions`, clique no ícone de "Recarregar" (setinha giratória) na caixa da Inmovya Scale, e depois aperte F5 no WhatsApp Web.

## Estrutura do Código para Manutenção

A extensão foi desenvolvida em JavaScript Vanilla para garantir leveza e ausência de complexidade.

- `content/whatsapp-dom.js`: Centraliza toda a interação com o HTML do WhatsApp (encontrar a caixa de texto, capturar nome do contato, inserir texto). **Se o WhatsApp atualizar o layout, altere APENAS este arquivo!**
- `content/variables.js`: Onde você adiciona novas variáveis futuramente.
- `content/panel.js`: A UI lateral dentro do WhatsApp Web.
- `utils/storage.js`: A camada de persistência usando `chrome.storage.local`.

