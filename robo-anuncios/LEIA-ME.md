# Robô de anúncios: como usar

O robô atende pelo **chip dedicado aos anúncios**, nunca pelo seu WhatsApp Business principal.
Ele responde só quem mandou mensagem primeiro, faz as 5 perguntas, cadastra no Inmovya e te avisa no seu WhatsApp pessoal: (11) 98878-2027.

Tudo fica em **Documentos\robo-anuncios**.

## Ligar (todo dia, ou depois de reiniciar o PC)

1. Clique duas vezes em **2-baixar-e-ligar-openwa**. Abre uma janela preta: **não feche**. É o OpenWA, a "ponte" com o WhatsApp.
2. Espere uns 30 segundos e clique duas vezes em **3-ligar-robo**. Abre outra janela preta: **não feche**. É o robô.
3. Para conferir, abra no navegador: http://localhost:3999. Deve aparecer "Robô de anúncios ligado — ATENDENDO".

## Desligar

Feche as duas janelas pretas (no X). Nada é apagado, e as conversas continuam salvas no Inmovya.

## Onde fica o QR Code

1. Com o OpenWA ligado, abra http://localhost:2886. É o painel do OpenWA. Se ele pedir a chave de administrador, ela está no arquivo `OpenWA\data\.api-key`.
2. Entre em **Sessions** e abra a sessão **atendimento-anuncios**. Clique em **Start** e o QR Code aparece na tela.
3. No celular **do chip dos anúncios**, abra o WhatsApp, vá em **Aparelhos conectados**, depois em **Conectar aparelho**, e leia o QR Code.

## Se desconectar

- Se o painel mostrar a sessão como "disconnected" ou "failed", clique em **Start** de novo. Se pedir QR Code, leia de novo com o chip dos anúncios.
- Se o celular do chip ficar muito tempo sem internet ou desligado, o WhatsApp pode desconectar sozinho. Deixe o celular carregando e com internet.
- Se o robô ligar no número errado, ele **para sozinho** e escreve "PARADO" na janela. Isso acontece, por exemplo, se alguém ler o QR Code com o seu número pessoal. Nesse caso, desconecte o aparelho no celular e leia o QR com o chip certo.

## O que o robô faz em cada caso

| Situação | O que acontece |
|---|---|
| Cliente responde as 5 perguntas | Manda "Perfeito! Já vou separar as opções…", cadastra no Inmovya, etiqueta 20% (se a etiqueta existir nesse WhatsApp) e te avisa 🟢 |
| Cliente pergunta preço, condição, desconto, FGTS, pede corretor ou humano, manda áudio, ou faz pergunta fora do roteiro | Manda "Vou te passar para o Estevão agora mesmo", para de responder, cadastra e te avisa 🔴 |
| Cliente que já é lead no Inmovya escreve | O robô não responde e só te avisa 📣 |
| Depois de terminar ou passar para você | Nunca mais responde aquele contato. Daí em diante a conversa é sua |
| Grupos, status, mensagens antigas e o seu número pessoal | São ignorados |

No Inmovya, o lead entra como os outros leads de fora: passa pela conferência do WhatsApp, cai em **Validação** e recebe as tags **anuncio** e **robo-anuncio**. As respostas ficam nas observações. O 1º contato automático **não** manda mensagem para esses leads, porque o robô já conversou com eles.

## Modo teste

No arquivo `config.json`, coloque o seu número de teste em `"testeSomenteNumeros": ["5511XXXXXXXXX"]`. Assim o robô só responde esse número. Para liberar para todos, volte para `[]` e feche e abra o **3-ligar-robo**.
Não use o seu número pessoal no teste: o robô ignora esse número de propósito, porque é para lá que vão os avisos.

## Empreendimentos

A lista fica em `config.json` → `"empreendimentos"`. Quando a mensagem do anúncio cita um deles, o robô fala o nome do empreendimento na saudação. Para incluir um novo, adicione o nome na lista.

## Arquivos de registro

- `robo-log.txt`: tudo o que o robô fez.
- `log-instalacao.txt` e `log-openwa.txt`: o que aconteceu com o OpenWA.

## Não apague nem envie para ninguém

`config.json` (tem a senha do robô) e `OpenWA\data` (tem a conexão do WhatsApp e a chave de administrador).
