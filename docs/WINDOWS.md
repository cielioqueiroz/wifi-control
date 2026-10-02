# WiFi Control para Windows

Requisito: Node.js 24 instalado. O pacote usa somente portas locais 3001 e
4317. A porta 3000 fica livre para outros projetos.

## Iniciar

Na pasta do pacote, execute `powershell -File start.ps1`.
O navegador abre o painel em http://127.0.0.1:3001. Os processos ficam ocultos.
Para encerrar apenas os processos deste aplicativo, execute
`powershell -File stop.ps1`.

## Configurar o roteador

Execute `powershell -File configure-router.ps1` e informe a credencial no
dialogo do Windows. A senha fica protegida com DPAPI para o usuario atual.
Reinicie o aplicativo. A tela Roteador faz uma consulta de leitura.
Bloqueios exigem selecionar um dispositivo e digitar a confirmacao.

## Dados e backup

Banco, credencial protegida e logs ficam em `%LOCALAPPDATA%/WiFiControl`.
Pare o aplicativo antes de copiar `wifi-control.sqlite` como backup.
A credencial DPAPI nao e portavel entre usuarios ou computadores.
Para restaurar, pare o aplicativo e substitua somente o banco pelo backup.

Notificacoes do sistema exigem autorizacao no navegador e o painel aberto.
O agente continua registrando eventos enquanto estiver em execucao.
Nao existe servico de inicializacao automatica instalado no Windows.

## Gerar uma nova distribuicao

No repositorio: `pnpm install --frozen-lockfile` e `pnpm package:windows`.
O resultado fica em `release/wifi-control-windows`. Copie essa pasta para
outro computador Windows com Node.js 24. Nenhum dado real ou senha e incluido.

O empacotamento desktop usa a interface local no navegador. Tauri e um
instalador nativo ficam adiados: nao sao necessarios para a operacao local.
