-- Normaliza telefones brasileiros para armazenar sempre com DDI 55
-- Mantém a UI com formatação local, mas garante consistência no banco.

create or replace function public.normalize_brazil_phone(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g');

  if digits = '' then
    return coalesce(raw_phone, '');
  end if;

  if digits like '55%' and length(digits) > 11 then
    return digits;
  end if;

  if length(digits) <= 11 then
    return '55' || digits;
  end if;

  return digits;
end;
$$;

-- Backfill dos dados já persistidos.
update public.drivers
set phone = public.normalize_brazil_phone(phone)
where coalesce(phone, '') <> '';

update public.passageiros
set celular = public.normalize_brazil_phone(celular)
where coalesce(celular, '') <> '';

update public.parceiros_servico
set telefone = public.normalize_brazil_phone(telefone)
where coalesce(telefone, '') <> '';

update public.parceiros_contatos
set celular = public.normalize_brazil_phone(celular)
where coalesce(celular, '') <> '';

create or replace function public.normalize_driver_phone_trigger()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.normalize_brazil_phone(new.phone);
  return new;
end;
$$;

create or replace function public.normalize_passageiro_celular_trigger()
returns trigger
language plpgsql
as $$
begin
  new.celular := public.normalize_brazil_phone(new.celular);
  return new;
end;
$$;

create or replace function public.normalize_parceiro_telefone_trigger()
returns trigger
language plpgsql
as $$
begin
  new.telefone := public.normalize_brazil_phone(new.telefone);
  return new;
end;
$$;

create or replace function public.normalize_parceiro_contato_celular_trigger()
returns trigger
language plpgsql
as $$
begin
  new.celular := public.normalize_brazil_phone(new.celular);
  return new;
end;
$$;

drop trigger if exists normalize_driver_phone on public.drivers;
create trigger normalize_driver_phone
  before insert or update of phone on public.drivers
  for each row
  execute function public.normalize_driver_phone_trigger();

drop trigger if exists normalize_passageiro_celular on public.passageiros;
create trigger normalize_passageiro_celular
  before insert or update of celular on public.passageiros
  for each row
  execute function public.normalize_passageiro_celular_trigger();

drop trigger if exists normalize_parceiro_telefone on public.parceiros_servico;
create trigger normalize_parceiro_telefone
  before insert or update of telefone on public.parceiros_servico
  for each row
  execute function public.normalize_parceiro_telefone_trigger();

drop trigger if exists normalize_parceiro_contato_celular on public.parceiros_contatos;
create trigger normalize_parceiro_contato_celular
  before insert or update of celular on public.parceiros_contatos
  for each row
  execute function public.normalize_parceiro_contato_celular_trigger();
