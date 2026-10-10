# Ingestão de dados (snapshot diário)

O Voomp Forge **não consulta o Git ao vivo**. Ele lê um arquivo JSON (`ForgeSnapshot`) gerado periodicamente (por exemplo, uma vez por dia) a partir do histórico Git dos repositórios. O navegador nunca recebe tokens nem fala com o provedor.

## Como funciona

1. Um job (cron, CI agendado) mantém clones locais dos repositórios (`git fetch --all --tags`).
2. `npm run ingest` lê o histórico (`git log --all` e `git for-each-ref refs/tags`, somente leitura), infere o que for possível e grava o JSON.
3. O JSON é publicado em qualquer hospedagem estática.
4. O app abre com `?snapshot=<url-do-json>`. A fonte "Demo Mode" continua disponível no seletor.

## Rodando o CLI

```bash
npm run ingest -- --config forge.config.json --out public/snapshot.json [--since 30]
```

- `--config`: arquivo de configuração (modelo em `examples/forge.config.example.json`). Caminhos `path` são relativos ao arquivo de configuração.
- `--out`: arquivo de saída. O snapshot é validado (`parseSnapshot`) antes de ser gravado.
- `--since`: limita a leitura aos últimos N dias de commits (padrão: todo o histórico).

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
| Deploys | **inferido** se houver `deployments`, senão indisponível | Uma tag que casa com a regra = deploy bem-sucedido naquele commit. As mudanças ligadas são as mergeadas até a tag e não incluídas na tag anterior do mesmo ambiente |
| Reviews, pipelines, documentos | **indisponível** | O Git puro não sabe. A interface mostra "sem dados", nunca "0" |
| Mudanças abertas, rascunhos, fechadas sem merge | indisponível | Só existem no provedor |

Pessoas são deduplicadas pelo e-mail em minúsculas. IDs são determinísticos: rodar duas vezes sobre o mesmo histórico gera o mesmo conteúdo (exceto `generatedAt`).

## Publicando e abrindo

Hospede o JSON em um local estático com CORS liberado para a origem do app (bucket S3/GCS, GitHub Pages, servidor interno) e abra:

```
https://seu-forge.example.com/?snapshot=https://dados.example.com/snapshot.json
```

Se o arquivo estiver inválido, a tela de erro lista os problemas encontrados e oferece voltar ao Demo Mode.
