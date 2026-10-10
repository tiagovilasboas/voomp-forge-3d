# Prompt — gerar um snapshot do Voomp Forge a partir dos seus dados

Cole o prompt abaixo num assistente que tenha acesso aos seus dados (Jira, GitHub/GitLab/Azure DevOps, planilha de frentes, Confluence). Ele devolve **um único arquivo JSON** no formato que o Forge entende. Depois:

```bash
# salve como public/snapshot.private.json (já está no .gitignore — NUNCA commite dados reais)
npm run dev
# abra http://localhost:5173/?snapshot=/snapshot.private.json
```

> ⚠️ O site público (GitHub Pages) só mostra DEMO DATA. Snapshot com dados reais fica **local** ou num host privado (ex.: Cloudflare Pages + Access) e é aberto via `?snapshot=<url>`.

---

## Prompt (copie daqui para baixo)

Você vai gerar um arquivo JSON chamado `snapshot.private.json` para o **Voomp Forge** (visualização 3D de entregas de engenharia para PMs). Use **somente dados que você conseguir confirmar** nas fontes que eu te der. Regras:

**Regras de evidência (obrigatórias)**
1. *Merged ≠ produção.* Uma mudança só está "em produção" se houver evidência: `deployments` com `environment: "production"` e `status: "success"` (Git/CI), **ou** `workItems[].productionAt` preenchido a partir do Jira (status/transição de produção).
2. A planilha de frentes **nunca** prova produção: o "Finalizado" dela vira só `workstreams[].declaredDone = true`.
3. **Desconhecido ≠ zero.** Se uma fonte não existe, não invente: deixe a lista vazia e marque a capacidade como `"unavailable"` em `source.capabilities`. Se você deduziu algo (ex.: PR a partir de merge commit), marque `"inferred"`.
4. Frentes (`workstreams`) **não são squads**: uma frente pode ter várias squads e uma squad várias frentes.
5. Sem rankings ou métricas individuais. Pessoas aparecem só como autores/revisores/alocação.
6. Datas em ISO 8601 UTC (`2026-10-10T12:00:00Z`). IDs são strings estáveis e únicas (ex.: `repo-admin-api`, `cr-admin-api-208`).
7. Toda referência por ID deve existir (ex.: `repositoryId` aponta para um item de `repositories`). Não deixe referências soltas.

**Período**: últimos 30 dias até agora (`source.generatedAt` = agora).

**Formato (schemaVersion 1)** — devolva exatamente estas chaves de topo, todas presentes (listas podem ser vazias):

```jsonc
{
  "schemaVersion": 1,
  "source": {
    "kind": "imported",
    "provider": {
      "id": "github",                       // github | gitlab | azure-devops | bitbucket | git
      "name": "GitHub",
      "vocabulary": { "changeRequest": "Pull Request", "changeRequestShort": "PR", "pipeline": "Actions" }
    },
    "capabilities": {                       // native | inferred | unavailable
      "changeRequests": "native", "reviews": "native", "pipelines": "native", "deployments": "native",
      "documents": "unavailable", "workItems": "native", "workstreams": "native"
    },
    "generatedAt": "2026-10-10T12:00:00Z"
  },
  "organization": { "id": "org", "name": "Voomp", "slug": "voomp" },

  "squads":       [{ "id": "sq-admin", "code": "A", "name": "Admin", "description": "..." }],
  "repositories": [{ "id": "repo-admin-api", "squadId": "sq-admin", "name": "admin-api", "fullName": "org/admin-api",
                     "description": "...", "defaultBranch": "main", "language": "PHP", "webUrl": "https://..." }],
  "contributors": [{ "id": "p-ana", "displayName": "Ana S.", "handle": "ana", "squadId": "sq-admin",
                     "role": "developer" }],             // developer | reviewer | tech-lead | product-manager | null

  "changeRequests": [{
    "id": "cr-admin-api-208", "origin": "provider",     // provider | merge-commit
    "number": 208, "repositoryId": "repo-admin-api",
    "title": "...", "productSummary": "frase curta para PM ou null",
    "authorId": "p-ana", "state": "merged",              // open | closed | merged
    "draft": false,
    "createdAt": "...", "mergedAt": "... ou null", "closedAt": "... ou null",
    "headSha": "abc123", "mergeCommitSha": "def456 ou null", "targetBranch": "main",
    "requestedReviewerIds": ["p-bruno"],
    "initiativeId": "ini-101 ou null",
    "workItems": [{ "key": "ADM-123", "url": "https://jira/... ou null" }],   // chaves Jira citadas no título/branch/descrição
    "webUrl": "https://..."
  }],
  "reviews":      [{ "id": "rv-1", "changeRequestId": "cr-admin-api-208", "reviewerId": "p-bruno",
                     "verdict": "approved", "submittedAt": "..." }],          // approved | changes_requested | commented
  "commits":      [{ "sha": "def456", "repositoryId": "repo-admin-api", "authorId": "p-ana", "message": "...",
                     "committedAt": "...", "changeRequestId": "cr-admin-api-208 ou null", "webUrl": "https://..." }],
  "pipelineRuns": [{ "id": "run-1", "repositoryId": "repo-admin-api", "pipelineName": "ci", "headSha": "abc123",
                     "branch": "main", "changeRequestId": "... ou null",
                     "status": "success", "startedAt": "...", "webUrl": "https://..." }],   // running | success | failure | cancelled
  "deployments":  [{ "id": "dep-1", "repositoryId": "repo-admin-api", "environment": "production",   // staging | production
                     "sha": "def456", "ref": "v1.4.0", "createdAt": "...", "status": "success",           // running | success | failure
                     "changeRequestIds": ["cr-admin-api-208"], "triggeredById": "p-ana ou null", "webUrl": "https://..." }],

  "initiatives":  [{ "id": "ini-101", "key": "INI-101", "name": "...", "summary": "...",
                     "ownerSquadId": "sq-admin", "status": "in_delivery" }],   // discovery | in_delivery | released
  "documents":    [{ "id": "doc-1", "title": "...", "kind": "spec", "space": "ADM",   // spec | adr | runbook | postmortem | guide
                     "squadId": "sq-admin ou null", "initiativeIds": [], "repositoryIds": [], "updatedAt": "...", "webUrl": "https://..." }],

  "workItems": [{
    "key": "ADM-123", "title": "...", "type": "story",   // epic | story | task | bug
    "status": "done",                                    // todo | in_progress | done  (categoria do status)
    "statusName": "Em produção",                         // nome real do status no Jira
    "epicKey": "ADM-100 ou null", "sprint": "Sprint 42 ou null",
    "updatedAt": "...",
    "productionAt": "data em que chegou em produção (transição Jira) ou null",
    "url": "https://jira/browse/ADM-123 ou null"
  }],

  "workstreams": [{                                     // uma linha da planilha de frentes
    "id": "ws-saque", "name": "Tela de saque e antecipação",
    "category": "sprint_priority",                      // sprint_priority | closing | sustaining | open_topic
    "squadIds": ["sq-admin"], "initiativeId": "ini-101 ou null",
    "repositoryIds": ["repo-admin-api"], "epicKeys": ["ADM-100"],
    "team": [{ "role": "tl", "personId": "p-ana ou null", "displayName": "Ana S.", "specialty": "backend ou null" }],  // tl | dev | qa | pm | n2
    "plans": [{ "label": "Entrega 1", "target": "2026-10-20T00:00:00Z ou null", "recordedAt": "2026-09-30T00:00:00Z" }],  // cada replanejamento = novo item
    "dependencies": [{ "description": "Aguardando time de Pagamentos", "kind": "waiting" }],   // blocker | waiting
    "declaredDone": false,                               // "Finalizado" da planilha — NÃO é evidência de produção
    "links": [{ "label": "Épico no Jira", "url": "https://..." }],
    "notes": ["observações da planilha"]
  }]
}
```

**Como ligar as fontes**
- **Git (PRs/MRs, reviews, commits, pipelines, deploys):** por repositório da lista que eu passar. `workItems` de cada PR = chaves Jira (regex `[A-Z][A-Z0-9]+-\d+`) no título, branch ou descrição. Deploy de produção = environment/deployment de produção ou tag de release; ligue `changeRequestIds` pelos SHAs incluídos.
- **Jira:** issues citadas pelos PRs + épicos das frentes. `productionAt` = data da transição para o status de produção (diga qual status você usou).
- **Planilha de frentes:** cada linha vira um `workstream`; mapeie squads, épicos e pessoas para os IDs acima.
- **Confluence (opcional):** páginas ligadas às iniciativas/repos → `documents`.

**Antes de responder, valide:** JSON puro e válido (sem comentários), todas as chaves de topo presentes, todos os IDs referenciados existem, enums só com os valores listados, nenhuma produção sem evidência. No fim, fora do JSON, liste em 3–5 linhas o que ficou `unavailable`/`inferred` e por quê.

---

## Alternativa automática (sem assistente)

O mesmo snapshot pode ser gerado pelos conectores do próprio Forge — veja [`INGESTION.md`](INGESTION.md):

```bash
cp examples/forge.config.example.json forge.config.json   # ignorado pelo git
npm run ingest -- --config forge.config.json --out public/snapshot.private.json
```

O app valida o arquivo ao abrir (`parseSnapshot`, schema v1) e mostra o erro se algo estiver fora do formato.
