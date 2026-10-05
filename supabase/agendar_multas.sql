-- Ative a extensão pg_cron em Database > Extensions antes, se necessário.
create extension if not exists pg_cron;
select cron.schedule('faxinas-multas-automaticas','* * * * *',
 $$select faxinas_private.processar_vencidas();$$);
-- O estado exibido nas páginas é calculado pelo servidor no instante da consulta.
-- O cron persiste as multas todo minuto, mesmo sem ninguém acessar o site.
