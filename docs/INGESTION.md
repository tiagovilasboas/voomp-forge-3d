# Ingestão de dados (snapshot diário)

O Voomp Forge **não consulta nenhuma fonte ao vivo**. Ele lê um arquivo JSON (`ForgeSnapshot`) gerado periodicamente (por exemplo, uma vez por dia) por **conectores**: Git local, Jira, planilha de planejamento (CSV) e Confluence. O navegador nunca recebe tokens nem fala com o provedor.

## Como funciona

1. Um job (cron, CI agendado) mantém clones locais dos repositórios (`git fetch --all --tags`).
2. `npm run ingest` executa todos os conectores de `connectors[]`, une os fragmentos (`mergeFragments`), valida (`parseSnapshot`) e grava o JSON. O git-local lê o histórico (`git log --all` e `git for-each-ref refs/tags`, somente leitura).
3. O JSON é publicado em qualquer hospedagem estática.
4. O app abre com `?snapshot=<url-do-json>`. A fonte "Demo Mode" continua disponível no seletor.

O agendamento pode ser um job de CI ou um fluxo no n8n (a tela Automações do Hub IA descreve o fluxo sugerido). Segredos ficam nas credenciais de quem executa o job, nunca no JSON nem no navegador. Nada é executado a partir do Forge.

## Rodando o CLI

```bash
npm run ingest -- --config forge.config.json --out public/snapshot.json [--since 30]
```

- `--config`: arquivo de configuração (modelo em `examples/forge.config.example.json`). Caminhos `path` são relativos ao arquivo de configuração.
- `--out`: arquivo de saída. O snapshot é validado (`parseSnapshot`) antes de ser gravado.
- `--since`: limita a leitura aos últimos N dias de commits (padrão: todo o histórico).

## Conectores

`forge.config.json` aceita `connectors: [{ "type": "...", ... }]`. As chaves de topo (`organization`, `provider`, `people`, `initiatives`…) são herdadas pelo `git-local` (e `people` pelo `plan-csv`). **Compatibilidade:** sem `connectors`, o arquivo inteiro é tratado como um único conector `git-local` (formato antigo).

Quando fragmentos conflitam, o último conector da lista vence (por id/chave). Capacidades: vale o melhor nível (`native` > `inferred` > `indisponível`). Organização e provedor vêm do primeiro fragmento que os informa.

### Regra de evidência

**"Em produção" só vem do Jira (status de produção ou versão liberada) ou de deploys no Git (tags).** A planilha apenas declara planos e times: um `Finalizado` na planilha vira `declaredDone` e nunca prova produção. Merge ≠ produção. Dado desconhecido não é zero.

### `git-local`

Campos descritos em [Configuração](#configuração). Sem segredos (lê clones locais).

### `jira`

```json
{ "type": "jira", "baseUrl": "https://suaempresa.atlassian.net", "project": "PAY",
  "epicLinkField": "customfield_10014", "sprintField": "customfield_10020",
  "productionStatuses": ["Em Produção", "Deployed"], "productionByFixVersionReleased": false }
```

- Use `project` ou `jql`. Pagina `/rest/api/3/search`.
- Segredos (variáveis de ambiente): `JIRA_EMAIL` e `JIRA_API_TOKEN` (Basic auth). Nunca vão para o JSON nem para logs.
- Tipo vem do `issuetype`; status vira `todo`/`in_progress`/`done` pela categoria do status; épico vem de `parent` (se for épico) ou `epicLinkField`; sprint ativa (ou a última) de `sprintField`.
- `productionAt`: data de mudança de categoria (ou resolução) quando o status está em `productionStatuses`; ou `releaseDate` da versão corrigida já liberada, se `productionByFixVersionReleased` for `true`. Caso contrário, `null`.

### `plan-csv`

```json
{ "type": "plan-csv", "path": "frentes.csv", "previous": ["frentes-sprint4.csv"], "sprintStart": "2026-01-05",
  "fronts": { "Rota da Coleta": { "epicKeys": ["ATL-1"], "initiativeId": "ini-ini-12", "squadIds": ["sq-atelie"], "links": [{ "label": "Spec", "url": "https://..." }] } } }
```

Lê a planilha exportada em CSV no layout matriz: linhas de título opcionais (`FECHAMENTOS`, `PRIORIDADES DE ENTREGA NA SPRINT`, `TEMAS ABERTOS`, `SUSTENTAÇÃO`) definem a categoria (padrão: prioridade da sprint); uma linha de cabeçalho com os nomes das frentes; e linhas cujo primeiro campo é o papel (`TL`, `DEV`, `QA`, `PM`, `N2`), `Entrega` ou `Obs`.

- Pessoas: células separadas por `/`, `,`, `;` ou quebra de linha. Especialidade entre parênteses (`Nome (Front)`) ou após ` - ` (`Nome - Back`). O nome vira `displayName`. `personId` só é preenchido se o nome casar com `people[].displayName`; o id do contribuidor vem do e-mail.
- `Entrega`: rótulo do plano. A data-alvo vem de `dd/mm`, `(dd)` ou `Semana N` (+ dia da semana) relativo a `sprintStart`; sem `sprintStart`, `Semana N` não gera data. Sem data reconhecível, a frente fica sem alvo. Na categoria Plantão, sem alvo, ela aparece como "sob demanda". `Finalizado`/`Entregue` marca `declaredDone`, que é só declaração.
- `Obs`: contendo "depend"/"bloque" vira bloqueio; "aguard"/"retorno" vira espera; o restante vira nota.
- `previous`: exports anteriores, do mais antigo ao mais novo (data = data do arquivo, ou `{ "path", "date" }`). Um novo plano entra no histórico só se rótulo ou data-alvo mudaram (replanejamento).
- `fronts`: vínculo opcional por nome da frente com épicos, links, iniciativa e squads. Sem segredos.

### `confluence`

```json
{ "type": "confluence", "baseUrl": "https://suaempresa.atlassian.net", "spaceKeys": ["ENG"],
  "labelToInitiative": { "ini-12": "ini-ini-12" }, "labelToRepo": { "payments-api": "repo-payments-api" } }
```

- Segredos: `CONFLUENCE_EMAIL` e `CONFLUENCE_API_TOKEN` (se ausentes, usa `JIRA_EMAIL`/`JIRA_API_TOKEN`).
- Tipo do documento pelos rótulos: `adr`, `runbook`, `postmortem`, `spec`, `guide` (padrão `guide`). Vínculos com iniciativas/repositórios só pelos rótulos mapeados, nunca por texto.

## Configuração

| Campo | Descrição |
|-------|-----------|
| `organization` | `{ name, slug?, id? }` |
| `provider` | `{ name?, vocabulary? }`. Vocabulário exibido na interface. Padrão: "Merge" / "Merge" / "Pipeline" |
| `squads[]` | `{ id, code, name, description, repositories[] }`; cada repositório: `{ path, name?, webUrl?, defaultBranch?, language? }` |
| `people[]` | `{ email, displayName?, handle?, role?, squadId? }`. `role` (`developer`, `reviewer`, `tech-lead`, `product-manager`) só existe se configurada; nunca é deduzida |
| `initiatives[]` | `{ key, name, summary?, ownerSquadId?, status? }` |
| `initiativePattern` | Regex (ex.: `INI-\d+`) procurada no título/branch/corpo do merge e ligada a `initiatives[].key`. Sem correspondência, a mudança fica sem iniciativa |
| `workItemPattern` | Regex das tarefas. Padrão: `[A-Z][A-Z0-9]+-\d+` |
| `workItemUrlTemplate` | Ex.: `https://tracker/browse/{key}`. Sem ele, a tarefa não tem link |
| `deployments[]` | Regras `{ environment: "staging" \| "production", tagPattern }` |
| `changeRequestUrlTemplate`, `commitUrlTemplate` | Opcionais; placeholders `{webUrl}`, `{sha}`, `{number}` |

## O que é inferido e o que não existe

| Dado | Situação | Como |
|------|----------|------|
| Mudanças (PR/MR) | **inferido** | Commits de merge/squash: GitHub (`Merge pull request #12`, `Título (#123)`), GitLab (`Merge branch 'x' into 'main'` + `See merge request g/p!34`), Bitbucket (`Merged in x (pull request #7)`), Azure DevOps (`Merged PR 45: título`). Sempre `state: merged`, `origin: merge-commit`. Commits da branch = alcançáveis pelo 2º pai e não pelo 1º |
| Autor / criação | inferido | Autor e data do primeiro commit da branch |
| Deploys | **inferido** se houver `deployments`, senão indisponível | Uma tag que casa com a regra = deploy bem-sucedido naquele commit. As mudanças ligadas são as mergeadas até a tag e não incluídas na tag anterior do mesmo ambiente. O Git não informa quem disparou: `triggeredById` fica vazio e nenhuma scooter de deploy aparece no mapa |
| Tarefas (work items) | **inferido** no Git (chaves no título ou na branch, `workItemPattern`); **nativo** com `jira` | Git: o padrão é `[A-Z][A-Z0-9]+-\d+`. Jira: tipo, status, épico, sprint e data de produção vêm do tracker |
| Frentes (fronts) | **nativo** com `plan-csv` | Declaração da planilha: plano, time, dependências. Produção continua vindo só de tarefas (Jira) ou de deploys (Git) |
| Documentos | **nativo** com `confluence` | Tipo e vínculos pelos rótulos mapeados |
| Reviews, pipelines | **indisponível** | O Git puro não sabe. A interface mostra "sem dados", nunca "0". Documentos ficam indisponíveis sem o conector `confluence` |
| Mudanças abertas, rascunhos, fechadas sem merge | indisponível | Só existem no provedor |

Pessoas são deduplicadas pelo e-mail em minúsculas. IDs são determinísticos: rodar duas vezes sobre o mesmo histórico gera o mesmo conteúdo (exceto `generatedAt`).

## Publicando e abrindo

Hospede o JSON em um local estático com CORS liberado para a origem do app (bucket S3/GCS, GitHub Pages, servidor interno) e abra:

```
https://seu-forge.example.com/?snapshot=https://dados.example.com/snapshot.json
```

Se o arquivo estiver inválido, a tela de erro lista os problemas encontrados e oferece voltar ao Demo Mode.
