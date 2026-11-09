# Instalar esta atualização

1. Extraia este ZIP.
2. Copie TODO o conteúdo da pasta `atualizacao-escala` para `C:\Users\Jéssica\Downloads\escala-git-temporario`, substituindo os arquivos de mesmo nome. Copie também a pasta `.github`, que começa com ponto. Não substitua apenas o gerador.
3. Esta atualização não contém `escalas.json`, CSV, Excel nem `config.js`: seus arquivos de dados e configuração permanecem na pasta.
4. Publique no PowerShell:

```powershell
cd C:\Users\Jéssica\Downloads\escala-git-temporario
git add gerar_escala.py verificar_multas.py supabase .github/workflows/verificar-multas.yml
git commit -m "Mantem tarefas essenciais e sincroniza registros de faxina"
git pull --rebase --autostash origin main
git push origin main
```

Se aparecer conflito no pull, resolva-o antes de continuar; não use force push.

## Ativar sincronização das próximas semanas

No repositório `jessicmchdo/escala-limpeza` no GitHub:

1. Abra **Settings > Secrets and variables > Actions**.
2. Crie, ou confira se já existem, estes dois **Repository secrets**:
   - `SUPABASE_URL`: URL do projeto Supabase que o seu site já usa.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave service_role do mesmo projeto. Essa chave fica somente no Secret, nunca em `config.js` ou em arquivos publicados.
3. Depois de publicar esta atualização, abra **Actions > Sincronizar escalas de faxina > Run workflow** para fazer uma primeira execução.
4. Confirme que a execução ficou verde.

O processo sincroniza ao publicar `escalas.json`, ao instalar/alterar o workflow, em execução manual e também periodicamente. Se a página pública já contiver tarefas ainda ausentes do banco, Minhas faxinas mostrará um aviso para NAMOITA em vez de ocultar o problema.

## Semana de 11/10/2026

A semana estava no JSON publicado, mas não no banco usado por Minhas faxinas. Os 11 registros foram recuperados diretamente no banco durante esta correção. Atualize a página e entre novamente para consultar.

Os prazos daquela semana já venceram. Pelas regras atuais, tarefas sem conclusão registrada recebem multa; NAMOITA deve corrigir as que foram feitas e não puderam ser registradas enquanto a semana estava ausente. A recuperação não inventou confirmações de conclusão.

## Novas regras do gerador

- Pergunta ausentes de DOM/SEG/TER e de QUI/SEX/SÁB separadamente.
- Cozinha, Sala e copa e Panos são obrigatórias nos DOIS blocos, inclusive no modo completo.
- Tenta manter todas as opcionais; procura as combinações por quantidade total decrescente e retira somente o necessário para cumprir as regras.
- Exibe quais opcionais precisaram sair e de qual bloco.
- Respeita as folgas obrigatórias e não coloca tarefas difíceis consecutivas.
- Panos continua proibido para NAZARÉ e CAMILA.
- Se nem as três essenciais couberem, informa a impossibilidade e não salva uma escala inválida.
- Não reescreve semanas antigas. Não é necessário gerar novamente a escala de 11/10 nem executar `supabase_setup.sql`.

## Filtros de multas

A página Multas ganha **Semana da tarefa**, usando o domingo de início da escala. O filtro pode ser combinado com **Mês do vencimento** e, para NAMOITA, **Pessoa**. Quantidades e totais acompanham os filtros. Uma semana sem multas mostra uma lista vazia, sem inventar cobranças.
