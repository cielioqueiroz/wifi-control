# Spec 007: Notificacoes e preferencias locais

Alertas de novos dispositivos e mudancas de presenca derivam dos eventos
persistidos. A leitura e armazenada no SQLite. Nenhum servico externo recebe
dados. Alertas do sistema exigem permissao do navegador e funcionam enquanto
o painel estiver aberto; o agente continua coletando o historico sozinho.

Preferencias persistentes: intervalo de 30 a 900 segundos, retencao de 7 a
365 dias, alertas locais, alertas do sistema e tema claro/escuro/sistema.
A primeira consulta carrega o historico sem disparar alertas retroativos.

## Aceitacao

- Eventos repetidos nao duplicam notificacoes.
- Leitura e preferencias persistem entre sessoes.
- Escritas exigem a mesma sessao protegida da API administrativa.
- Temas, notificacoes e preferencias sao acessiveis em desktop e celular.
