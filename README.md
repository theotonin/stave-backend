# stave-backend

## Orçamento e pagamento dos projetos

O modelo `Project` inclui três campos opcionais:

| Campo da API | Banco | Formato no JSON |
| --- | --- | --- |
| `budgetAmount` | `DECIMAL(12,2)` | String decimal em reais, como `"1500.10"`, ou `null` |
| `paymentAmount` | `DECIMAL(12,2)` | String decimal em reais, como `"750.05"`, ou `null` |
| `paymentDate` | `TIMESTAMP(3)` | Data/hora ISO em UTC, como `"2026-09-09T17:30:00.000Z"`, ou `null` |

`POST /projects` e `PUT /projects/:id` recebem esses campos. Os GETs de listagem geral, projetos por usuário e detalhe retornam os mesmos campos. O backend também aceita números JSON para os valores; strings decimais evitam conversões desnecessárias antes de persistir. Valores negativos, mais de duas casas decimais, valores acima de `9999999999.99` e datas inexistentes recebem HTTP 400.

No POST, campos omitidos ficam nulos. No PUT, omitir um campo financeiro preserva o valor existente; enviar `null` ou uma string vazia o limpa. Zero é um valor válido e diferente de não informado. Não há regra que obrigue o pagamento a ser menor ou igual ao orçamento.

Exemplo de corpo financeiro para PUT (também pode acompanhar os demais campos de criação):

```json
{
  "budgetAmount": "1500.10",
  "paymentAmount": "750.05",
  "paymentDate": "2026-09-09T17:30:00.000Z"
}
```

As regras de preservação descritas acima se referem aos três campos financeiros. O comportamento atual dos demais campos no PUT continua definido em `projectService.js`.

### Atualizar o banco e o Prisma Client

O banco configurado neste workspace e o Prisma Client já foram atualizados. Para aplicar a mesma alteração em outro ambiente que tenha as colunas financeiras criadas, execute a partir de `backend/`:

```bash
npx prisma db execute --file prisma/changes/20260909_project_datetime.sql --schema prisma/schema.prisma
npx prisma generate
```

Depois, reinicie o backend (`npm run dev` dentro de `backend/`, ou o processo conjunto na raiz).

O SQL converte apenas colunas que ainda sejam `DATE` para `TIMESTAMP(3)`, preservando a data local em São Paulo com horário 00:00. O Prisma armazena esses instantes em UTC. Campos já convertidos não são alterados novamente. Horários removidos pela conversão anterior para `DATE` precisam ser preenchidos novamente; o script não consegue recuperá-los.

Se o banco ainda não possuir as colunas financeiras, aplique primeiro `prisma/changes/20260909_project_payment.sql` e depois o script de data/hora acima. Para um banco novo de desenvolvimento, `npx prisma db push` aplica o schema completo atual e `npx prisma generate` gera o cliente.

Não execute o script antigo `20260909_delivery_date_only.sql` após essa atualização: ele corresponde à versão anterior sem horários. Não há baseline de migrations neste repositório; os arquivos em `prisma/changes/` são alterações SQL explícitas, não migrations gerenciadas por `prisma migrate deploy`.

### Testes

```bash
npm test
npm run test:integration
```

O primeiro comando testa validação e serialização sem acessar o banco. O segundo usa o `DATABASE_URL` configurado, inicia a API em uma porta local temporária, cria usuário/projetos exclusivos para o teste e os remove ao terminar. Ele valida POST, GET, PUT, preservação de dados financeiros, zero, limpeza, datas e rejeição de valores inválidos. Execute o teste de integração em um banco de desenvolvimento com o schema atualizado.


## Datas de entrega e pagamento

`scheduledTo` e `paymentDate` usam `DateTime?` no Prisma e `TIMESTAMP(3)` no PostgreSQL. A interface utiliza os controles nativos `datetime-local` com idioma pt-BR, permitindo selecionar data e horário locais; a disposição interna do controle depende das configurações regionais do navegador. Detalhes, agenda e notificações formatam os valores em DD/MM/AAAA e HH:mm. No dashboard, o card mantém o dia e as três letras do mês abaixo.

O frontend converte o horário local para ISO UTC antes do POST/PUT. A API aceita ISO com fuso (`Z` ou deslocamento explícito) e retorna a representação UTC completa, sem cortar o horário. Exemplo: `2026-09-09T14:30:00-03:00` é retornado como `2026-09-09T17:30:00.000Z` e exibido em São Paulo como `09/09/2026, 14:30`.

Datas impossíveis, horários inválidos e valores sem fuso recebem HTTP 400. Omitir `scheduledTo` ou `paymentDate` no PUT preserva o campo; `null` ou string vazia o limpa. As notificações continuam comparando o **dia local** do instante, não seu dia em UTC, para evitar avisos no dia errado perto da meia-noite.

## Notificações no header

O frontend usa os projetos retornados por `GET /projects/userProjects` para calcular os lembretes pelo dia local do usuário:

- Entrega: exatamente 7, 3 e 1 dia antes, e no próprio dia, para projetos não concluídos.
- Pagamento: apenas no dia cadastrado, inclusive se o projeto estiver concluído.

Os avisos são calculados ao abrir a aplicação, navegar, abrir o painel, voltar à aba e a cada minuto. São lembretes atuais no site, sem tabela de histórico ou agendamento de mensagens externas. Como não há um campo de quitação, o valor do pagamento não suprime o lembrete da data.

## Assistente musical e sessões

`POST /login` agora retorna `{ user, token }`, sem senha no objeto público. Envie `Authorization: Bearer <token>` nas requisições autenticadas; IDs de usuário isolados deixaram de ser aceitos. `POST /login/logout` revoga a sessão, que expira em sete dias. Projetos/arquivos exigem participação e o perfil só pode ser alterado pelo próprio usuário.

`src/assistant/` reúne conversa, pesquisa externa, propostas e processamento de áudio. Configure `GEMINI_API_KEY` e `GEMINI_MODEL` somente no `.env` do servidor para habilitar a conversa com Gemini. A busca geral na web está desativada; a conversa pesquisa referências pelo Internet Archive. Sem esses valores, consultas guiadas e pesquisa no Internet Archive funcionam. `DEMUCS_PYTHON` aponta ao Python isolado com Demucs para habilitar voz/acompanhamento. `.env.example` contém apenas exemplos, sem credenciais reais.

### Deploy da API

Use `backend/` como diretório do serviço. O comando de build é `npm ci && npm run build` e o comando de início é `npm start`. Configure `DATABASE_URL`, `PORT`, `GEMINI_API_KEY`, `GEMINI_MODEL` e, se houver Demucs instalado no servidor, `DEMUCS_PYTHON`. Em um banco existente, aplique os SQLs aditivos na ordem documentada antes de iniciar a API. O diretório `uploads/` precisa de armazenamento persistente; sem um disco persistente, arquivos enviados e resultados podem desaparecer quando o serviço reiniciar ou for publicado novamente. Use uma única instância da API enquanto o worker da fila estiver habilitado.

Em um banco existente já atualizado com finanças e datas, aplique uma vez `prisma/changes/20260909_assistant.sql` e gere o cliente. O SQL já foi aplicado neste workspace. Em banco novo de desenvolvimento, `prisma db push` usa o schema completo. Não há execução automática desses SQLs por `prisma migrate deploy`.

| Endpoint sob `/assistant` | Uso |
| --- | --- |
| `GET /capabilities` | Capacidades configuradas |
| `GET/POST /conversations` | Histórico privado e criação de conversa |
| `GET /conversations/:id` | Mensagens e propostas do solicitante |
| `POST /conversations/:id/messages` | `{ message }`; conversa com ferramentas controladas |
| `POST /search` | `{ query, source: "archive" ou "web" }`; texto e fontes |
| `POST /reference-files` | `{ url }` de um item do Internet Archive; lista áudios suportados |
| `GET /projects/:id` | Detalhes, arquivos e referências do projeto acessível |
| `GET/POST /actions` | Pendências ou proposta `{ projectId, kind, payload, conversationId? }` |
| `POST /actions/:id/decision` | `{ confirm: true ou false }`; aplica ou rejeita uma vez |
| `GET /jobs` | Estado das tarefas do solicitante |
| `GET /jobs/:id/download` | ZIP dos resultados ainda presentes no projeto |

Ações permitidas: `update_project`, `save_reference`, `rename_file`, `import_audio`, `separate_audio`. Uma proposta não aplica alterações. Confirmação repetida retorna a decisão anterior; dados alterados desde a proposta geram HTTP 409. O modelo não dispõe de ferramenta para confirmar ações. Referências e arquivos ficam no projeto; conversa e controle da tarefa são privados.

O servidor inicia um consumidor da fila `AssistantJob` a cada cinco segundos. Use apenas uma instância neste estágio. Importações aceitam áudio público do Archive até 50 MB; separação preserva o original e cria dois WAVs com `sourceFileId`. Um reinício torna tarefas em execução falhas explícitas. O arquivo original e o armazenamento de resultados precisam estar disponíveis no disco da API.

```bash
npm test
npm run test:integration
npm run test:assistant
```

O teste da assistente usa registros temporários no banco de desenvolvimento e simula apenas o provedor externo ao testar o ciclo de ferramentas; não consome créditos de IA. Para configuração de áudio, limites e apresentação, veja `docs/assistente-guia.md` no repositório agregador Stave. Busca, importação, player, separação real e ZIP também foram verificados no navegador no workspace.
