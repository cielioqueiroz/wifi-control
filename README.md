# WiFi Control

Painel local para acompanhar os dispositivos da rede doméstica no Windows.
Descoberta, histórico, nomes, confiança, notificações e preferências funcionam
sem serviços em nuvem.

## Executar

Requisitos: Windows 10/11, Node.js 24 e pnpm 11.19.0 para desenvolvimento.

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @wifi-control/agent dev
```

Em outro terminal:

```powershell
pnpm --filter @wifi-control/web exec next dev --hostname 127.0.0.1 --port 3001
```

Abra http://127.0.0.1:3001. O agente escuta em 127.0.0.1:4317.
A porta 3000 não é utilizada.

## Pacote Windows

```powershell
pnpm package:windows
powershell -File scripts/start.ps1
```

A pasta `release/wifi-control-windows` funciona sem pnpm, com Node.js 24
instalado. O [guia Windows](docs/WINDOWS.md) descreve início, encerramento,
backup e configuração do roteador.

## Recursos

- Descoberta limitada por interfaces, ICMP, vizinhos, DNS reverso, mDNS e SSDP.
- Nomes e classificação persistentes, evidências e indicação de MAC privado.
- Histórico local com migrações, retenção e transições de presença.
- Central de notificações, tema claro/escuro e preferências de monitoramento.
- Integração Huawei AX2 com confirmação explícita e auditoria administrativa.

A integração AX2 requer configuração local da credencial. O protocolo foi
testado com respostas simuladas; a aceitação no equipamento permanece pendente.
Veja [integração do roteador](docs/ROUTER_INTEGRATION.md).
Inferências não são tratadas como identidade garantida. MACs privados não
recebem fabricante inventado. Nenhuma telemetria externa é enviada.

## Qualidade

```powershell
pnpm qa
pnpm test:e2e
```

Testes de navegador usam a porta 3011 e uma API simulada; não bloqueiam
dispositivos reais. CI verifica tipos, testes, interface e geração do pacote.

## Organização

`apps/web`: interface; `apps/agent`: API e orquestração local;
`packages/network`: descoberta; `packages/identification`: evidências;
`packages/database`: SQLite; `packages/router-adapters`: controle administrativo.

Consulte [.ai/CONTEXT_INDEX.md](.ai/CONTEXT_INDEX.md) para encontrar a fonte
de verdade de cada domínio. Sincronização cloud, aplicativo móvel e instalador
Tauri não fazem parte desta distribuição local.
