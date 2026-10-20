# Resumo diário do grupo do WhatsApp

Bot que lê um grupo do WhatsApp (o da escola) e, todo dia às **20h**, envia para uma lista de números um resumo só com o que importa: avisos, tarefas, datas, eventos e recados de saúde.

O bot não fica ligado o dia todo. Ele roda uma vez por dia, faz o trabalho e encerra.

## Como funciona

1. Conecta ao WhatsApp como um **aparelho conectado** (igual ao WhatsApp Web) de um número secundário que participa do grupo.
2. Recebe as mensagens que chegaram desde a última conexão.
3. Junta as mensagens do grupo desde o último resumo enviado.
4. Pede o resumo a uma IA: **Claude** (Anthropic) ou **Gemini** (Google), conforme a chave preenchida no `.env`.
5. Envia o resumo para cada número configurado e encerra.

As mensagens ficam salvas em disco antes de irem para a IA. Se algo falhar num dia, elas entram no resumo do dia seguinte, e o bot manda um alerta `⚠️` no WhatsApp.

## Requisitos

- Linux com Node.js 20 ou superior
- Um número de WhatsApp **secundário** para o bot, já adicionado ao grupo
- Chave de API do [Claude](https://platform.claude.com/) **ou** do [Gemini](https://aistudio.google.com/)

## Instalação

```bash
cd ~/Desenvolvimento/Bot-Whatsapp
npm install
cp .env.example .env
chmod 600 .env
```

## Configuração (`.env`)

| Variável | Para que serve |
|---|---|
| `ANTHROPIC_API_KEY` | Chave do Claude |
| `GEMINI_API_KEY` | Chave do Gemini |
| `PROVEDOR_IA` | Opcional: `claude` ou `gemini`. Sem ela, o bot usa a chave preenchida (se houver as duas, usa o Claude) |
| `CLAUDE_MODEL` / `GEMINI_MODEL` | Modelo de cada IA (padrão: `claude-opus-5-5` / `gemini-3.5-flash`) |
| `NOME_GRUPO` | Nome do grupo, como aparece no WhatsApp (maiúsculas e acentos não importam) |
| `GRUPO_ID` | Opcional: ID do grupo. Se preenchido, tem prioridade sobre o nome |
| `DESTINATARIOS` | Números que recebem o resumo, separados por vírgula (ex.: `55819XXXXXXXX,55819YYYYYYYY`) |
| `NUMERO_ALERTA` | Número que recebe os alertas de falha (se vazio, usa o primeiro destinatário) |
| `FUSO_HORARIO` | Fuso usado nos horários das mensagens (padrão: `America/Recife`) |

## Uso

| Comando | O que faz |
|---|---|
| `npm run parear` | Mostra o QR Code para conectar o número do bot e lista os grupos (nome e ID) |
| `npm run teste` | Gera o resumo e só mostra no terminal, **sem enviar** |
| `npm run resumo` | Gera e **envia** o resumo (é o que o agendamento roda) |

### Primeiro uso

1. Rode `npm run parear`.
2. No celular do bot, abra **WhatsApp > Aparelhos conectados > Conectar um aparelho** e escaneie o QR Code.
3. Logo depois aparece `Conexão fechada (código 515). Reconectando...`. É normal.
4. Copie o nome (ou o ID) do grupo para o `.env`.
5. Rode `npm run teste` para conferir o resumo.

## Agendamento (todo dia às 20h)

O bot é disparado por um timer do systemd do usuário:

- `~/.config/systemd/user/whatsapp-resumo.service`: roda o `resumo.js` nesta pasta.
- `~/.config/systemd/user/whatsapp-resumo.timer`: dispara às 20:00 (America/Recife). Se a máquina estiver desligada nesse horário, roda assim que ela ligar.

```bash
systemctl --user list-timers whatsapp-resumo.timer   # próxima execução
systemctl --user start whatsapp-resumo.service        # roda agora
journalctl --user -u whatsapp-resumo -n 30            # logs
```

Para o bot rodar mesmo sem você logado no computador (só precisa fazer uma vez):

```bash
sudo loginctl enable-linger $USER
```

> O serviço aponta para o Node do nvm (`~/.nvm/versions/node/v22.14.0/bin/node`). Se trocar a versão do Node, atualize o `ExecStart` do `.service` e rode `systemctl --user daemon-reload`.

## Estrutura

```
Bot-Whatsapp/
├── resumo.js        # execução diária: coleta, resume e envia
├── parear.js        # pareamento por QR Code e lista de grupos
├── whatsapp.js      # conexão com o WhatsApp (reconexão, QR, filtro de logs)
├── .env             # configuração e chaves (secreto, fora do git)
├── .env.example     # modelo do .env
├── auth_info/       # sessão do WhatsApp (secreta, fora do git)
├── dados/           # mensagens coletadas e data do último resumo (fora do git)
└── guia_de_implementa_o_whatsapp_daily_summary_bot.md   # guia detalhado
```

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Log com `LOGOUT` ou `SEM_SESSAO` | A sessão expirou ou o aparelho foi desconectado no celular. Rode `npm run parear` de novo |
| Alerta `Nenhum grupo se chama ...` | O grupo foi renomeado. Atualize `NOME_GRUPO` ou use `GRUPO_ID` |
| `Nada para resumir hoje` | Não houve mensagem no grupo desde o último resumo |
| O resumo parou de chegar e não veio alerta | Veja os logs com `journalctl`. Sem sessão, o bot não consegue avisar pelo WhatsApp |
| A conexão falha sem motivo aparente | O WhatsApp pode ter mudado o protocolo. Rode `npm update baileys` |

O WhatsApp desconecta os aparelhos conectados se o celular do bot ficar **14 dias** sem internet. Mantenha-o ligado.

## Segurança e privacidade

- A pasta `auth_info/` dá **acesso total** à conta do WhatsApp do bot. Não compartilhe nem versione.
- As mensagens do grupo ficam em `dados/mensagens.json` por até 7 dias e são enviadas à IA escolhida. No plano gratuito do Gemini, o Google pode usar esse conteúdo para melhorar os produtos dele. A API do Claude não usa os dados para treinar modelos por padrão.
- O Baileys **não é oficial**, e automação viola os termos do WhatsApp. Por isso o bot usa um número secundário.
- O resumo é gerado por IA e pode errar ou omitir algo. Para saúde e prazos, confira a mensagem original no grupo.

Detalhes de implementação e decisões de projeto estão no [guia](guia_de_implementa_o_whatsapp_daily_summary_bot.md).
