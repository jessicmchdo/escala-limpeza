-- Correção da sincronização: grava na tabela faxina_tarefas usada pelo site.
-- Não recria contas, não apaga históricos e preserva confirmações existentes.
create table if not exists faxinas_private.estado_sincronizacao (
 id boolean primary key default true check(id),
 verificada_em timestamptz,
 sucesso_em timestamptz,
 ultima_semana date,
 erro text
);
alter table faxinas_private.estado_sincronizacao enable row level security;
revoke all on faxinas_private.estado_sincronizacao from public,anon,authenticated;
insert into faxinas_private.estado_sincronizacao(id) values(true) on conflict do nothing;

create or replace function faxinas_private.sincronizar_do_github() returns integer
language plpgsql security definer set search_path='' as $$
declare r extensions.http_response; j jsonb; n integer;
begin
 -- Evita concorrência entre o cron e uma atualização manual de NAMOITA.
 if not pg_try_advisory_xact_lock(hashtextextended('faxinas:github:sincronizar',0)) then return 0; end if;
 if exists(select 1 from faxinas_private.estado_sincronizacao where id and erro is null
           and verificada_em>clock_timestamp()-interval '45 seconds') then return 0; end if;
 perform set_config('http.curlopt_timeout_msec','5000',true);
 select * into r from extensions.http_get(
   'https://raw.githubusercontent.com/jessicmchdo/escala-limpeza/main/escalas.json?atualizacao='||extract(epoch from clock_timestamp())::bigint::text);
 if r.status<>200 then raise exception 'GitHub retornou HTTP %.',r.status; end if;
 j:=r.content::jsonb;
 if jsonb_typeof(j)<>'object' or j='{}'::jsonb then raise exception 'A escala publicada está vazia ou inválida.'; end if;
 -- A origem é fixa: o navegador não pode enviar ou escolher uma escala.
 n:=faxinas_private.sincronizar(j);
 update faxinas_private.estado_sincronizacao set verificada_em=clock_timestamp(),sucesso_em=clock_timestamp(),
 ultima_semana=(select max(key::date) from jsonb_each(j)),erro=null where id;
 return n;
exception when others then
 update faxinas_private.estado_sincronizacao set verificada_em=clock_timestamp(),erro=sqlerrm where id;
 return -1;
end $$;
revoke all on function faxinas_private.sincronizar_do_github() from public,anon,authenticated;

-- Mantém o nome já usado pelo agendamento existente, corrigindo seu destino.
create or replace function public.sincronizar_escalas_github() returns integer
language sql security invoker set search_path='' as $$select faxinas_private.sincronizar_do_github()$$;
revoke all on function public.sincronizar_escalas_github() from public,anon,authenticated;

create or replace function faxinas_private.sincronizar_como_admin() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null or faxinas_private.minha_pessoa() is distinct from 'NAMOITA' then
  raise exception 'Somente NAMOITA pode sincronizar a escala.';
 end if;
 n:=faxinas_private.sincronizar_do_github();
 if n<0 then raise exception 'Não foi possível buscar a escala no GitHub. Tente novamente.'; end if;
 return n;
end $$;
revoke all on function faxinas_private.sincronizar_como_admin() from public,anon;
grant execute on function faxinas_private.sincronizar_como_admin() to authenticated;
create or replace function public.faxina_sincronizar_agora() returns integer
language sql security invoker set search_path='' as $$select faxinas_private.sincronizar_como_admin()$$;
revoke all on function public.faxina_sincronizar_agora() from public,anon;
grant execute on function public.faxina_sincronizar_agora() to authenticated;

select cron.schedule('sincronizar-escalas-github','* * * * *','select public.sincronizar_escalas_github();');
notify pgrst,'reload schema';
