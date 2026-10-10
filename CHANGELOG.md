# Changelog

Todas as mudanças relevantes do Voomp Forge. O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [0.1.0] - 2026-10-10

Primeiro protótipo funcional: data center 3D explorável sobre dados de entrega, com dados de demonstração fictícios e ingestão de snapshots a partir de Git, Jira, planilha e Confluence.

> **DEMO DATA.** O modo padrão usa dados fictícios. Nenhuma pessoa, repositório ou número representa a Voomp real.

### Added

**Data center 3D**
- Layout em grade: a Hub IA e uma sala por squad em duas fileiras voltadas uma para a outra, com corredor central e praça de produção (doca de staging, portão, quadro da semana, placa de créditos, parede de frentes e calendário).
- Sala por squad com tema, placa no piso, quadros de mudanças e de entregas, mesas e racks.
- Racks para repositórios, com quatro módulos (mudanças, pipeline, deploy e commits) e beacon de alerta.
- Androides ilustrativos por pessoa, com rosto em LEDs, etiqueta de função e dispositivo por função. Sem presença, carga ou ranking.
- Fluxos de luz por tipo de evento (merge, staging, produção) e conduítes holográficos ligando cada rack ao fundo da sala.
- Hub IA: terminal determinístico sobre o snapshot, pinball holográfico, cofre de conhecimento e mesa de automação (n8n).
- Forge Bot: NPC que patrulha o hub e inspeciona a mesa de automação.
- Scooter de deploy: quem disparou o deploy de produção leva a scooter até o portão, quando o CD informa quem disparou.
- Painéis holográficos de repositório, parede de frentes e calendário, alinhados à grade.

**Evidência e domínio**
- Regras de entrega por mudança: integrado não é produção; produção exige deploy bem-sucedido que contenha a mudança.
- Regras de frentes (workstreams): entregue só com evidência do tracker (Jira) ou do Git; a planilha apenas declara; divergência entre fontes é sinalizada.
- Modelo agnóstico de provedor (GitHub, GitLab, Bitbucket, Azure DevOps) com vocabulário nativo na interface ("PR", "MR").
- Níveis de capacidade por fonte (nativo, inferido, indisponível): ausência de dado é mostrada como "sem dados", nunca como zero.

**Ingestão**
- `npm run ingest`: executa os conectores de `forge.config.json`, une os fragmentos, valida e grava o snapshot JSON.
- Conector `git-local`: mudanças inferidas de merge commits; deploys inferidos de tags.
- Conector `jira`: tarefas, status, épico, sprint e data de produção.
- Conector `plan-csv`: frentes e planos a partir da planilha exportada em CSV, com histórico de replanejamentos.
- Conector `confluence`: documentos ligados a iniciativas e repositórios por rótulo.
- Segredos somente por variáveis de ambiente; o navegador nunca recebe tokens.
- Snapshot importado por URL (`?snapshot=`), validado antes de carregar.

**Visão e navegação**
- Product View com perguntas da semana ("O que chegou em produção?") e Engineering View com saúde técnica.
- Delivery Explorer com filtros e cards de evidência; linha do tempo de seis etapas por mudança.
- Inspetores de squad, repositório, pessoa, mudança, iniciativa e documento.
- Busca global (`/`), alertas por repositório, KPIs e abas de atividade.
- Mural de Frentes (Mural, Roadmap e Alocação) e calendário de entregas.
- Visão tabular acessível, sem 3D, com fallback automático quando não há WebGL.
- Tour guiado de seis passos e modal de boas-vindas.
- Object Screens: telas legíveis para quadros, mesas, Hub IA, terminal, pinball, automação, frentes e calendário.
- Quadro do time com notas locais (no navegador).

**Responsividade e plataforma**
- Três layouts (celular, tablet e desktop) com navegação inferior, folhas deslizantes e gaveta lateral.
- PWA instalável, com cache offline da aplicação e das fontes.
- Movimento reduzido e qualidade gráfica (alta ou leve), com rebaixamento automático em dispositivos fracos.

**Qualidade e processo**
- Testes automatizados (Vitest) para domínio, queries, conectores, snapshot demo, layout do mundo e animação.
- Teste de arquitetura que impede dependências entre camadas fora da regra.
- CI com typecheck, testes e build em cada PR.
- Documentação: README, arquitetura, design, especificação de HUD e responsividade, handoff, ingestão e decisões.

### Changed

- O layout do mundo passou de uma fileira horizontal para a grade de salas em duas fileiras.
- Os personagens de blocos foram trocados por androides ilustrativos.
- Os cabos dos racks viraram conduítes holográficos no chão, e a sinalização passou a seguir os eixos da grade.

### Fixed

- Barra superior contida em 1440 px, com botões de parede exibidos como ícones.
- Calendário de entregas cobre todas as datas do período.
- Câmera foca mudanças e iniciativas ao selecioná-las.
- Delivery Explorer abre com todas as entregas ainda não implantadas, e a disponibilidade da fonte é lida do store.
- Cabeças dos androides menores, para melhor proporção.

### Known limitations

- Não há modo conectado: a fonte "Conectado" é um stub desabilitado, sem backend nem autenticação.
- A ingestão roda fora do app, em lote (recomendado: diário); o app não atualiza dados ao vivo.
- A cena 3D não é navegável por teclado nem por leitor de tela; a visão tabular é a alternativa.
- Apenas pt-BR.
