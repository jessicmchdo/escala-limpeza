-- Execute no SQL Editor do Supabase.
-- Remove a dependência de Supabase Auth para confirmações e permite o modo "somente nome".

alter table public.confirmacoes alter column user_id drop not null;

-- O frontend público NÃO recebe INSERT direto.
drop policy if exists "confirmacoes_insert_own" on public.confirmacoes;
drop policy if exists "Usuário insere próprias confirmações" on public.confirmacoes;
drop policy if exists "confirmacoes_select_own_admin" on public.confirmacoes;
drop policy if exists "Usuário vê próprias confirmações ou admin vê todas" on public.confirmacoes;

-- Como o modo por nome não possui autenticação, as confirmações precisam ser visíveis
-- para que a página saiba se uma tarefa já foi confirmada.
drop policy if exists "confirmacoes_public_select" on public.confirmacoes;
create policy "confirmacoes_public_select"
on public.confirmacoes for select
to anon, authenticated
using (semana >= date '2026-09-20');

drop policy if exists "atribuicoes_public_select" on public.atribuicoes;
create policy "atribuicoes_public_select"
on public.atribuicoes for select
to anon, authenticated
using (semana >= date '2026-09-20');

drop policy if exists "multas_public_select" on public.multas;
create policy "multas_public_select"
on public.multas for select
to anon, authenticated
using (semana >= date '2026-09-20');

create or replace function public.confirmar_faxina(
  p_pessoa text,
  p_semana date,
  p_bloco text,
  p_tarefa text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prazo timestamptz;
begin
  if p_semana < date '2026-09-20' then
    raise exception 'Confirmações anteriores a 20/09/2026 não estão habilitadas.';
  end if;

  if not exists (
    select 1 from public.atribuicoes
    where pessoa=p_pessoa and semana=p_semana and bloco=p_bloco and tarefa=p_tarefa
      and upper(tarefa) not in ('FOLGA','AUSENTE')
  ) then
    raise exception 'Essa faxina não corresponde à escala cadastrada.';
  end if;

  v_prazo := public.prazo_faxina(p_semana,p_bloco);
  if now() > v_prazo then
    raise exception 'O prazo para confirmar esta faxina terminou.';
  end if;

  insert into public.confirmacoes(user_id,pessoa,semana,bloco,tarefa,concluida_em)
  values(null,p_pessoa,p_semana,p_bloco,p_tarefa,now())
  on conflict (semana,pessoa,bloco) do nothing;
end;
$$;

revoke all on function public.confirmar_faxina(text,date,text,text) from public;
grant execute on function public.confirmar_faxina(text,date,text,text) to anon, authenticated;
