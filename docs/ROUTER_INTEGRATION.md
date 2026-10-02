# Integracao com o roteador

Huawei WiFi AX2, gateway 192.168.3.1. O proprietario autorizou o controle
administrativo; a ativacao exige credenciais locais. A sessao do navegador
nao e compartilhada com o agente.

## Configuracao

Execute `powershell -File scripts/configure-router.ps1` no computador.
A senha e solicitada pelo Windows e salva com DPAPI, vinculada ao usuario
atual, em `%LOCALAPPDATA%/WiFiControl/wifi-control-router.credential.xml`.
O frontend nunca recebe a senha. O inicializador Windows ativa o adaptador
quando essa credencial existe. Configuracao manual:

- `ROUTER_ADAPTER=huawei-ax2`
- `ROUTER_BASE_URL=http://192.168.3.1`
- `ROUTER_GATEWAY_IP=192.168.3.1`
- `ROUTER_CREDENTIAL_REF=wifi-control-router`

## Protocolo observado

Implementacao baseada nos scripts servidos pelo proprio painel local,
firmware observado WS7001-20-2.0.0.322_SP1C947. Nao e uma API publica
garantida pelo fabricante; respostas inesperadas impedem a operacao.

- GET /html/index.html: tokens CSRF e cookie inicial.
- POST /api/system/user_login_nonce e user_login_proof: SCRAM SHA-256.
- GET /api/system/HostInfo: dispositivos.
- GET/POST /api/ntwk/wlanfilterenhance: filtros nas duas bandas.
- Cada POST possui um unico envelope { data, csrf }.
- Atualizacoes sao serializadas e verificadas por uma leitura posterior.
- Nao ha repeticao automatica de escritas quando a resposta e incerta.

## API local

GET /router/devices e /router/audit consultam estado e auditoria.
POST /router/block e /router/unblock recebem deviceId e confirmation.
O agente resolve o MAC a partir da observacao persistida, verifica o alvo
no roteador e protege gateway, interfaces locais e enderecos reservados.
A origem/host sao validados e toda escrita exige o token de /session.

## Aceitacao no equipamento

Testes de protocolo e interface usam respostas simuladas. Credenciais ainda
precisam ser fornecidas localmente para validar leitura no AX2 real.
Nenhum equipamento foi bloqueado durante os testes automatizados.
A validacao de hardware permanece pendente ate a escolha explicita do alvo.
