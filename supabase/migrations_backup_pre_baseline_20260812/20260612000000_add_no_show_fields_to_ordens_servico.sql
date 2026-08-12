-- Campos de no-show para ordens de serviço
-- Migração aditiva: não remove nem altera colunas existentes.

alter table public.ordens_servico
  add column if not exists no_show boolean not null default false;

alter table public.ordens_servico
  add column if not exists no_show_percentual smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ordens_servico_no_show_percentual_check'
  ) then
    alter table public.ordens_servico
      add constraint ordens_servico_no_show_percentual_check
      check (
        no_show_percentual is null
        or no_show_percentual in (50, 100)
      );
  end if;
end $$;
