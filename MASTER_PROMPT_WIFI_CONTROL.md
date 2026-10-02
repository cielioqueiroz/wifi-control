# MASTER PROMPT — WiFi Control

## Papel
Você é o engenheiro principal responsável por estruturar e iniciar o projeto **WiFi Control**, um sistema local-first para monitoramento de dispositivos conectados à rede doméstica e, futuramente, controle de bloqueio/desbloqueio via roteador.

O projeto deve ser profissional, seguro, escalável, bem documentado e econômico em contexto/tokens para uso contínuo com agentes de IA como Codex.

---

# 1. Objetivo do produto

Criar uma aplicação capaz de:

- detectar dispositivos presentes na rede local;
- identificar IP, MAC, hostname e outras evidências disponíveis;
- inferir nome/tipo/sistema operacional do dispositivo quando houver evidência suficiente;
- classificar dispositivos como conhecidos, desconhecidos, confiáveis ou bloqueados;
- manter histórico local de presença;
- mostrar status online/offline;
- permitir nomes personalizados;
- mostrar origem/evidência da identificação;
- futuramente integrar-se ao roteador para bloquear/desbloquear dispositivos.

## Importante

A integração de bloqueio com o roteador **NÃO faz parte do MVP inicial**.

O roteador atual é um **Huawei WiFi AX2**, gateway local observado em `192.168.3.1`.

O proprietário ainda está aguardando do provedor a senha administrativa do roteador.

Portanto:

- criar a arquitetura para suportar integração futura;
- NÃO tentar contornar autenticação;
- NÃO implementar técnicas agressivas de desconexão;
- NÃO usar ARP spoofing, deauthentication, packet injection ou métodos equivalentes;
- criar apenas uma interface/adaptador abstrato para futuras integrações;
- deixar a implementação Huawei AX2 pendente até que acesso legítimo ao painel seja disponibilizado.

---

# 2. Princípio arquitetural

O sistema deve ser **local-first**.

A descoberta da rede precisa continuar funcionando:

- sem internet;
- sem Neon;
- sem Vercel;
- sem qualquer serviço externo.

A nuvem será opcional e poderá ser adicionada posteriormente para:

- sincronização;
- autenticação;
- histórico remoto;
- backup;
- notificações;
- múltiplas redes/residências.

Nunca fazer da nuvem uma dependência para o scanner da LAN.

---

# 3. Stack principal

Use preferencialmente:

## Monorepo
- pnpm
- Turborepo

## Frontend
- Next.js
- React
- TypeScript strict
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide Icons
- Zustand somente quando estado global realmente for necessário

## Backend / agente local
- Node.js
- TypeScript
- APIs nativas sempre que possível

## Validação
- Zod

## Banco local
- SQLite

## ORM
- Drizzle ORM

## Testes
- Vitest
- Playwright

## Qualidade
- ESLint
- Prettier

## Versionamento
- Git
- GitHub privado

## Futuro
- Neon PostgreSQL
- Vercel
- Tauri, caso seja decidido empacotar como aplicativo Windows

Não introduzir Python, Java, Spring, n8n ou outro runtime sem justificativa técnica concreta.

---

# 4. Compatibilidade inicial

Prioridade inicial:

- Windows 10/11
- PowerShell 7 disponível
- Node.js instalado

A arquitetura deve permitir futuramente implementar:

- Linux
- macOS

Não espalhar lógica específica do Windows pela aplicação.

Criar abstrações de plataforma quando necessário.

Exemplo:

```ts
interface NetworkPlatformAdapter {
  getNeighbors(): Promise<NeighborEntry[]>
  getInterfaces(): Promise<NetworkInterface[]>
  ping(ip: string): Promise<PingResult>
}
```

Implementação inicial:

```text
WindowsNetworkAdapter
```

Futuramente:

```text
LinuxNetworkAdapter
MacOSNetworkAdapter
```

---

# 5. Estrutura desejada

Use como referência:

```text
wifi-control/
├── apps/
│   ├── web/
│   └── agent/
│
├── packages/
│   ├── ui/
│   ├── database/
│   ├── network/
│   ├── router-adapters/
│   ├── shared/
│   └── config/
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DESIGN_SYSTEM.md
│   ├── NETWORK_DISCOVERY.md
│   ├── DATA_MODEL.md
│   ├── ROUTER_INTEGRATION.md
│   ├── ROADMAP.md
│   └── adr/
│
├── specs/
│   ├── 001-foundation/
│   ├── 002-network-discovery/
│   ├── 003-device-identification/
│   ├── 004-dashboard/
│   ├── 005-history/
│   └── 006-router-control/
│
├── capabilities/
│   ├── retomar-projeto/
│   ├── encerrar-projeto/
│   ├── qa/
│   ├── security-review/
│   ├── architecture-review/
│   ├── ui-review/
│   └── release-check/
│
├── .ai/
│   ├── CONTEXT_INDEX.md
│   ├── PROJECT_STATE.md
│   └── DECISIONS.md
│
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

A estrutura pode ser ajustada se houver motivo forte, mas documente qualquer mudança estrutural relevante em ADR.

---

# 6. Economia de tokens e contexto

Este é um requisito de primeira classe.

## AGENTS.md

O `AGENTS.md` deve ser curto, objetivo e permanente.

Não obrigue o agente a ler toda a documentação antes de qualquer alteração.

Use regras contextuais, por exemplo:

- alterações de arquitetura → consultar `docs/ARCHITECTURE.md`;
- alterações de banco → consultar `docs/DATA_MODEL.md`;
- alterações de UI → consultar `docs/DESIGN_SYSTEM.md`;
- rede/scanner → consultar `docs/NETWORK_DISCOVERY.md`;
- segurança → consultar `docs/SECURITY.md`;
- roteador → consultar `docs/ROUTER_INTEGRATION.md`.

Inclua instrução explícita:

> Leia apenas o contexto necessário para a tarefa atual. Não faça varredura completa do repositório sem necessidade.

## CONTEXT_INDEX.md

Criar um índice curto apontando para a fonte de verdade de cada domínio.

Exemplo:

```text
Network discovery:
- docs/NETWORK_DISCOVERY.md
- packages/network/

UI:
- docs/DESIGN_SYSTEM.md
- packages/ui/

Database:
- docs/DATA_MODEL.md
- packages/database/

Router integrations:
- docs/ROUTER_INTEGRATION.md
- packages/router-adapters/

Security:
- docs/SECURITY.md
```

Não transformar o índice em documentação duplicada.

## PROJECT_STATE.md

Manter extremamente conciso:

```text
Current phase:
In progress:
Completed:
Next:
Known issues:
Relevant files:
Last updated:
```

Não incluir longos resumos históricos.

## DECISIONS.md

Somente decisões recentes/operacionais que ainda não justificam ADR.

Decisões arquiteturais duradouras devem virar ADR.

---

# 7. Skills

Criar skills seguindo o padrão de diretórios com `SKILL.md`.

Cada skill deve:

- ter uma descrição curta;
- ser carregada somente quando relevante;
- evitar repetir documentação já existente;
- apontar para arquivos de referência específicos;
- não instruir leitura completa do repositório.

Criar inicialmente:

## retomar-projeto
Objetivo:
- ler `PROJECT_STATE.md`;
- entender onde o trabalho parou;
- ler apenas arquivos relevantes à próxima tarefa;
- retornar um resumo curto do estado e próximos passos.

## encerrar-projeto
Objetivo:
- atualizar `PROJECT_STATE.md`;
- registrar o que foi concluído;
- registrar próximo passo;
- registrar arquivos relevantes;
- atualizar ADR somente se uma decisão arquitetural real tiver ocorrido.

## qa
Objetivo:
- rodar lint;
- typecheck;
- testes;
- verificar build;
- apontar regressões;
- evitar refatoração não solicitada.

## security-review
Objetivo:
- revisar superfícies de ataque;
- command injection;
- validação;
- secrets;
- logs;
- dependências;
- endpoints locais;
- privilégios;
- ações destrutivas.

## architecture-review
Objetivo:
- verificar limites entre pacotes;
- acoplamento;
- duplicação;
- dependências cíclicas;
- abstrações inadequadas.

## ui-review
Objetivo:
- Design System;
- acessibilidade;
- responsividade;
- estados vazios;
- loading;
- erros;
- feedback de ações;
- experiência em desktop.

## release-check
Objetivo:
- lint;
- typecheck;
- testes;
- build;
- migrations;
- segurança básica;
- changelog quando aplicável;
- git status limpo.

---

# 8. PRD

Criar `docs/PRD.md`.

Deve conter:

- visão;
- problema;
- objetivo;
- usuário-alvo;
- escopo;
- não-escopo;
- casos de uso;
- requisitos funcionais;
- requisitos não funcionais;
- requisitos de segurança;
- métricas técnicas;
- critérios de aceitação;
- limitações conhecidas;
- roadmap.

Não escrever marketing.

Seja técnico e objetivo.

---

# 9. Arquitetura

Criar `docs/ARCHITECTURE.md`.

O desenho principal deve separar:

```text
Web UI
  |
Local Agent/API
  |
Discovery Engine
  |
Correlation / Identification Engine
  |
SQLite
  |
Router Adapter Layer
```

## O frontend não pode:

- executar shell;
- executar PowerShell diretamente;
- acessar credenciais de roteador;
- montar comandos;
- acessar SQLite diretamente.

Tudo isso fica no agente/backend local.

---

# 10. Network Discovery Engine

Criar uma arquitetura de descoberta baseada em múltiplas fontes.

Fontes previstas:

1. interfaces de rede;
2. gateway/subnet;
3. ICMP/ping;
4. ARP;
5. Windows Neighbor Table;
6. reverse DNS;
7. mDNS;
8. SSDP/UPnP;
9. MAC OUI quando aplicável;
10. fingerprinting leve de serviços, apenas quando necessário.

Não depender exclusivamente de ping.

Alguns dispositivos ignoram ICMP.

## Correlation Engine

Combinar evidências para gerar uma entidade de dispositivo.

Exemplo conceitual:

```ts
type DiscoveryEvidence = {
  source: 'arp' | 'neighbor' | 'icmp' | 'dns' | 'mdns' | 'ssdp' | 'oui'
  value: unknown
  observedAt: Date
  confidence: number
}
```

Produzir algo similar a:

```ts
type Device = {
  id: string
  ip: string | null
  mac: string | null
  hostname: string | null
  displayName: string
  manufacturer: string | null
  deviceType: string | null
  operatingSystem: string | null
  status: 'online' | 'offline' | 'unknown'
  trusted: boolean
  firstSeenAt: Date
  lastSeenAt: Date
}
```

Não tratar inferência como fato.

A UI deve distinguir:

- detectado;
- inferido;
- definido manualmente.

---

# 11. MAC privado

Considerar explicitamente MAC randomization.

Exemplo real já observado na rede:

```text
Galaxy-A23-5G
IP: 192.168.3.57
MAC: EA-57-FD-A3-38-C8
SO: Android
```

MAC localmente administrado não deve receber fabricante OUI inventado.

O sistema deve identificar e sinalizar:

```text
Private/Randomized MAC: true
```

Não usar MAC como única identidade permanente.

---

# 12. Banco de dados

SQLite é a fonte local.

Criar modelo para, no mínimo:

- devices;
- device_addresses;
- observations;
- device_aliases;
- trust_status;
- discovery_evidence;
- activity_events;
- router_actions futuramente.

Evitar overengineering.

Não criar dezenas de tabelas sem necessidade.

Drizzle migrations devem ser versionadas no Git.

---

# 13. Router Adapter Layer

Criar apenas contrato e mocks no início.

Exemplo:

```ts
interface RouterAdapter {
  getInfo(): Promise<RouterInfo>
  listConnectedDevices(): Promise<RouterDevice[]>
  blockDevice(mac: string): Promise<RouterActionResult>
  unblockDevice(mac: string): Promise<RouterActionResult>
  listBlockedDevices(): Promise<RouterDevice[]>
}
```

Implementações futuras:

```text
HuaweiAX2Adapter
OpenWrtAdapter
TPLinkAdapter
AsusAdapter
```

Nesta fase, criar:

```text
MockRouterAdapter
UnsupportedRouterAdapter
```

Não implementar Huawei AX2 até receber acesso legítimo.

---

# 14. Segurança

Criar `docs/SECURITY.md`.

Requisitos obrigatórios:

## Local API
- bind padrão somente em `127.0.0.1`;
- não expor API na LAN por padrão;
- CORS restrito;
- validação Zod;
- limites de payload;
- tratamento seguro de erros.

## Shell
Nunca concatenar entrada do usuário em comandos.

Preferir APIs Node.

Quando shell for inevitável:

- argumentos em lista;
- allowlist;
- sem `shell: true`;
- timeout;
- limite de saída;
- sanitização;
- comando fixo.

## Credenciais
Nunca:

- salvar senha do roteador em SQLite;
- commitar senha;
- registrar senha em log;
- retornar senha ao frontend.

Futuramente, para Windows:

- Credential Manager;
- DPAPI;
- ou solução segura equivalente.

## Proteções contra lockout

Bloqueio futuro deve impedir por padrão:

- gateway;
- próprio host;
- broadcast;
- endereços inválidos;
- ação em massa acidental.

Exigir confirmação para bloqueio.

Implementar auditoria de ações.

---

# 15. Design System

Criar `docs/DESIGN_SYSTEM.md`.

Objetivo visual:

**Network Operations Dashboard moderno, profissional, limpo e discreto.**

Evitar:

- excesso de gradientes;
- glassmorphism gratuito;
- animações desnecessárias;
- aparência genérica de dashboard de IA;
- excesso de cards.

Priorizar:

- hierarquia;
- legibilidade;
- densidade adequada;
- tabelas excelentes;
- feedback claro;
- acessibilidade.

## Componentes previstos

- AppShell
- Sidebar
- Topbar
- NetworkOverview
- DeviceTable
- DeviceCard
- DeviceDrawer
- StatusBadge
- TrustBadge
- DiscoverySourceBadge
- ScanProgress
- EmptyState
- ErrorState
- SecurityAlert
- ConfirmActionDialog
- ActivityTimeline
- RouterStatus

## Estados

Definir para cada fluxo:

- loading;
- success;
- empty;
- degraded;
- error;
- offline.

Dark e light mode.

Responsividade com foco principal em desktop, mas sem quebrar em tablet/mobile.

---

# 16. UI/UX inicial

Dashboard principal:

```text
WiFi Control

Network
192.168.3.0/24

Devices      Online      Unknown
   6            4            2

--------------------------------------------------

Devices

Name               IP              Type         Status
Galaxy-A23-5G      192.168.3.57    Smartphone   Online
Unknown            192.168.3.151   Unknown      Online
Unknown            192.168.3.156   Unknown      Online
Unknown            192.168.3.174   Unknown      Online
```

Ao abrir um dispositivo:

```text
Galaxy-A23-5G
Online

Type
Smartphone

Operating system
Android

IP
192.168.3.57

MAC
EA-57-FD-A3-38-C8

Private MAC
Yes

First seen
...

Last seen
...

Identification evidence
...

[Rename]
[Mark as trusted]

[Block device]
Unavailable until router integration is configured.
```

Não criar botão de bloqueio funcional nesta fase.

Pode haver botão visual desabilitado com explicação clara.

---

# 17. Specs

Usar specs pequenas por feature.

Cada diretório pode conter:

```text
SPEC.md
TASKS.md
TESTS.md
```

Uma spec deve incluir:

- objetivo;
- requisitos;
- comportamento;
- edge cases;
- critérios de aceitação;
- testes.

Não duplicar PRD ou arquitetura.

---

# 18. ADRs

Criar inicialmente:

```text
0001-local-first.md
0002-typescript-stack.md
0003-sqlite-local-storage.md
0004-local-agent-boundary.md
0005-router-adapter-pattern.md
```

ADRs devem ser curtos:

- Context
- Decision
- Consequences

---

# 19. Git e GitHub

Inicializar Git se necessário.

Criar `.gitignore` correto.

Nunca commitar:

- `.env`;
- credenciais;
- tokens;
- dumps sensíveis;
- cache;
- bancos SQLite locais com dados reais.

Criar `.env.example` somente com nomes de variáveis e valores fictícios.

O repositório deve ser:

```text
wifi-control
```

e **PRIVATE** no GitHub.

Se GitHub CLI/conector/autenticação estiver disponível, criar o repositório privado e configurar `origin`.

Nunca tornar público automaticamente.

Criar commits pequenos e claros.

---

# 20. CI

Criar GitHub Actions simples para:

- install;
- lint;
- typecheck;
- unit tests;
- build.

Playwright pode ser separado caso aumente muito o custo/tempo inicial.

Não adicionar pipelines complexos sem necessidade.

---

# 21. Neon

Neon **não deve ser usado no MVP**.

Somente preparar arquitetura para futura sincronização.

Não criar projeto, banco ou migration no Neon agora.

SQLite é suficiente.

---

# 22. Vercel

Não fazer deploy do agente local no Vercel.

O agente precisa de acesso à LAN do usuário.

Vercel pode futuramente hospedar:

- interface cloud;
- autenticação;
- API cloud;
- portal remoto.

Não fazer deployment nesta etapa.

---

# 23. Observabilidade e logs

Criar logging estruturado.

Níveis:

- debug
- info
- warn
- error

Nunca registrar:

- credenciais;
- secrets;
- tokens;
- senha de Wi-Fi;
- senha do roteador.

Logs de dispositivos devem ser minimizados.

Implementar retenção local simples futuramente.

---

# 24. Performance

Uma varredura não deve:

- saturar a LAN;
- disparar centenas de processos simultâneos;
- travar o PC;
- executar scan contínuo agressivo.

Usar:

- concurrency limitada;
- timeouts;
- cancelamento;
- intervalos configuráveis;
- cache;
- debounce.

Não fazer port scan amplo por padrão.

---

# 25. Privacidade

Todo dado da rede é privado.

Por padrão:

- armazenar localmente;
- não enviar telemetria;
- não enviar MAC/IP para serviços externos;
- não usar analytics de terceiros;
- não consultar APIs externas com identificadores de dispositivos sem consentimento explícito.

---

# 26. Fases do projeto

## Phase 0 — Foundation
- monorepo;
- tooling;
- docs;
- AGENTS;
- skills;
- design system base;
- banco base;
- CI.

## Phase 1 — Network Discovery
- interfaces;
- subnet;
- gateway;
- ping sweep controlado;
- neighbor/ARP;
- scanner API.

## Phase 2 — Device Identification
- reverse DNS;
- mDNS;
- SSDP;
- MAC flags;
- evidence engine;
- confidence.

## Phase 3 — Dashboard
- overview;
- device table;
- device details;
- renaming;
- trusted/untrusted.

## Phase 4 — History
- observations;
- first/last seen;
- online/offline transitions;
- timeline.

## Phase 5 — Router Integration
Aguardar credenciais legítimas do Huawei WiFi AX2.

Somente então:
- analisar interface;
- documentar endpoints/capacidades;
- criar HuaweiAX2Adapter;
- bloquear/desbloquear com segurança.

## Phase 6 — Notifications
Opcional.

## Phase 7 — Cloud Sync
Opcional:
- Neon;
- autenticação;
- Vercel.

## Phase 8 — Desktop Packaging
Avaliar Tauri.

---

# 27. Regras de implementação

1. Não implemente tudo em uma única sessão.
2. Não comece pela UI antes da fundação estar consistente.
3. Não crie abstrações para problemas inexistentes.
4. Não crie microserviços.
5. Não adicione dependência sem necessidade.
6. Não reescreva código estável apenas por preferência estética.
7. Não faça refatoração fora do escopo da tarefa.
8. Use TypeScript strict.
9. Prefira funções pequenas e interfaces explícitas.
10. Trate erros de maneira previsível.
11. Escreva testes para lógica crítica.
12. Mantenha docs sincronizadas somente quando a mudança realmente as afeta.

---

# 28. Primeira execução

Nesta primeira tarefa, faça apenas **Phase 0 — Foundation**.

Você deve:

1. inspecionar o ambiente atual;
2. criar a estrutura inicial;
3. configurar pnpm workspace + Turborepo;
4. criar `apps/web`;
5. criar `apps/agent`;
6. criar os packages base;
7. configurar TypeScript strict;
8. configurar ESLint/Prettier;
9. configurar Vitest;
10. preparar Playwright sem criar testes complexos;
11. configurar SQLite + Drizzle;
12. criar documentação;
13. criar AGENTS.md;
14. criar CONTEXT_INDEX.md;
15. criar PROJECT_STATE.md;
16. criar ADRs iniciais;
17. criar as skills;
18. criar design system inicial;
19. criar GitHub Actions básico;
20. inicializar Git;
21. criar repositório GitHub privado `wifi-control` se houver autenticação disponível;
22. executar lint/typecheck/test/build;
23. corrigir erros;
24. atualizar PROJECT_STATE.md;
25. fazer commit da fundação.

---

# 29. Não implementar agora

Não implementar nesta etapa:

- scanner completo;
- port scanning;
- bloqueio;
- login do roteador;
- engenharia reversa do roteador;
- Neon;
- Vercel;
- autenticação cloud;
- notificações;
- Tauri;
- aplicativo mobile.

Apenas preparar limites arquiteturais para isso.

---

# 30. Saída final esperada

Ao terminar, responda de forma curta com:

```text
Foundation criada.

Principais decisões:
- ...
- ...

Validações:
- lint: ...
- typecheck: ...
- tests: ...
- build: ...

Git:
- repo: ...
- visibility: private
- commit: ...

Próxima fase:
Network Discovery

Arquivos que devem ser lidos na próxima sessão:
- ...
```

Não despeje código na resposta.

O código deve estar no repositório.

---

# 31. Regra final sobre contexto

Ao trabalhar neste projeto:

> leia primeiro a tarefa atual, depois consulte apenas os documentos e diretórios necessários para executá-la.

Não leia todo o repositório por padrão.

Não carregue todas as skills.

Não repita documentação existente dentro de prompts ou arquivos.

Use referências curtas e fontes únicas de verdade.

O objetivo é manter o projeto sustentável tanto para humanos quanto para agentes de IA.
