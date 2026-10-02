# Validation

Verificado em Windows em 2026-10-02:

- `pnpm qa`: lint, tipos, testes e build do monorepo.
- `pnpm test:e2e`: tres fluxos Chromium com API simulada, incluindo
  persistencia, confirmacao administrativa, temas e navegacao responsiva.
- `pnpm package:windows`: exportacao estatica e agente empacotado.
- `start.ps1 -NoBrowser`: API saudavel e painel HTTP 200 em 4317/3001.
- Segunda inicializacao recusada por portas ocupadas.
- `stop.ps1` seguido de `start.ps1`: reinicio concluido; processo da porta
  3000 preservado.
- Banco anterior copiado apenas quando o destino nao existia; origem preservada.
- Descoberta real retornou cinco dispositivos e nove eventos de historico.
- Teste SQLite confirma reabertura, preferencias persistidas e rejeicao de
  esquema mais novo que o suportado.

O CI esta configurado, mas sua execucao remota nao e comprovada por estes
testes locais. Nenhum bloqueio real de dispositivo foi realizado.
