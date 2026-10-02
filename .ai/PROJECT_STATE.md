# Project State

## Estado atual
Produto local implementado e pacote portatil Windows validado em 2026-10-02.
Interface em portugues brasileiro: http://127.0.0.1:3001.
API somente loopback em 4317. Nao usar a porta 3000: pertence a outro projeto.

## Concluido
- Descoberta Windows com varredura limitada, vizinhos, DNS local, mDNS e SSDP.
- Correlacao de evidencias, protecao de MAC privado e estados de presenca.
- SQLite com migracoes versionadas, historico, nomes e confianca persistentes.
- Dashboard responsivo, detalhes, filtros, cancelamento de varredura e historico.
- API com validacao de Host/Origin, token de sessao e corpos validados.
- Adaptador Huawei AX2 com confirmacao, protecao de alvos e auditoria.
- Configuracao local de credencial DPAPI; nenhuma senha no repositorio.
- Notificacoes locais, leitura persistida, preferencias e temas.
- Exportacao estatica, agente empacotado, scripts start/stop e guia Windows.
- CI com testes de navegador e artefato portatil.

## Verificacao
- Lint, typecheck, testes e build passaram.
- Tres testes Chromium passaram: persistencia/confirmacao, responsividade e temas.
- Pacote iniciou e reiniciou em 3001/4317; recusou portas ocupadas.
- Porta 3000 preservada.
- Descoberta real retornou cinco dispositivos e nove eventos.
- Banco anterior preservado em apps/agent/data; copia inicial em LocalAppData/WiFiControl.

## Pendencias e limites
- Credencial do roteador ainda nao configurada no agente; login do navegador nao
  e compartilhado. Adaptador real permanece desativado neste runtime.
- Aceitacao no hardware: configurar credencial local, testar leitura e escolher
  explicitamente um alvo nao critico para bloqueio/desbloqueio.
- Cloud opcional nao ativada; Tauri e instalador nativo adiados no ADR 0006.
- Notificacoes do sistema exigem permissao e navegador aberto.
- CI remoto ainda nao verificado.
- Aviso nao bloqueante do plugin ESLint Next.js no build.

## Arquivos-chave
- docs/WINDOWS.md
- docs/ROUTER_INTEGRATION.md
- docs/adr/0006-native-sqlite-and-portable-windows.md
- apps/agent/src/server.ts
- apps/agent/src/router.ts
- specs/008-windows-release/

## Operacao
- pnpm qa
- pnpm test:e2e
- pnpm package:windows
- powershell -File scripts/start.ps1
- powershell -File scripts/stop.ps1
- Configurar credencial somente no dialogo de scripts/configure-router.ps1.
- Nao bloquear dispositivos sem confirmacao especifica.
- dashboard-desktop.png e arquivo preexistente do usuario: nao incluir no commit.
