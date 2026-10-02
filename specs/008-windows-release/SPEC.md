# Spec 008: Distribuicao Windows

Gerar uma pasta portatil com interface estatica, agente empacotado e scripts
de iniciar/parar/configurar. Requer Node.js 24, sem pnpm em runtime.
Dados e credenciais permanecem fora da distribuicao.

## Aceitacao

- O pacote inicia em 3001/4317 e recusa portas ocupadas sem encerrar terceiros.
- O encerramento verifica PID e linha de comando dos processos registrados.
- A interface estatica e o agente respondem na maquina de desenvolvimento.
- CI executa lint, tipos, testes, build e fluxos Playwright.
- Documentar backup, restauracao, credenciais e limitacoes de hardware.
