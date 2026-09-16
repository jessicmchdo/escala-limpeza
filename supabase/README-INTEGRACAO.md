# Integração Supabase

Arquivos para adicionar à raiz do repositório `escala-limpeza`.

## Páginas
- `confirmar.html`: login e confirmação das próprias faxinas.
- `multas.html`: consulta de multas; administradores podem marcar PAGO/PENDENTE.
- `supabase-config.js`: URL e publishable key do Supabase. Esta chave é própria para frontend público.
- `confirmar.js` e `multas.js`: integração.
- `supabase-pages.css`: estilos complementares.

## Importante
O sistema está configurado para considerar tarefas/multas a partir da semana de 20/09/2026, evitando multas retroativas.

A tabela `atribuicoes` do Supabase precisa receber as escalas futuras. O próximo passo é automatizar a sincronização do `escalas.json` com essa tabela e criar as contas dos moradores.

## Links após publicar no GitHub Pages
- `/confirmar.html`
- `/multas.html`

Não coloque `service_role` em nenhum arquivo do GitHub Pages.
