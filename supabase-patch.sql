-- Точечное сохранение для «Мастерской миров».
-- Выполните один раз: Supabase → SQL Editor → вставить → Run.
-- Функция принимает список небольших правок и применяет их к вашей записи в таблице worlds,
-- вместо того чтобы каждый раз заменять её целиком.

create or replace function public.patch_world(ops jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  op      jsonb;
  it      jsonb;
  rec     record;
  d       jsonb;
  arr     jsonb;
  k       text;
  idx     int;
  ordarr  text[];
begin
  insert into public.worlds (user_id, data)
  values (auth.uid(), '{}'::jsonb)
  on conflict (user_id) do nothing;

  select data into d from public.worlds where user_id = auth.uid() for update;
  d := coalesce(d, '{}'::jsonb);

  for op in select value from jsonb_array_elements(ops) loop
    k := op->>'k';

    if op->>'t' = 'set' then
      -- целиком заменить значение верхнего уровня (настройки и т. п.)
      d := jsonb_set(d, array[k], op->'v', true);

    else
      -- правки списка записей с полем id (карты, персонажи, …)
      arr := case when jsonb_typeof(d->k) = 'array' then d->k else '[]'::jsonb end;

      -- добавить или обновить записи: меняются только присланные поля
      for it in select value from jsonb_array_elements(coalesce(op->'up', '[]'::jsonb)) loop
        idx := null;
        select (t.ord - 1)::int into idx
          from jsonb_array_elements(arr) with ordinality as t(e, ord)
         where t.e->>'id' = it->>'id'
         limit 1;
        if idx is null then
          arr := arr || jsonb_build_array(it);
        else
          arr := jsonb_set(arr, array[idx::text], (arr->idx) || it);
        end if;
      end loop;

      -- убрать поля, которых больше нет
      for rec in select key, value from jsonb_each(coalesce(op->'rm', '{}'::jsonb)) loop
        idx := null;
        select (t.ord - 1)::int into idx
          from jsonb_array_elements(arr) with ordinality as t(e, ord)
         where t.e->>'id' = rec.key
         limit 1;
        if idx is not null then
          arr := jsonb_set(arr, array[idx::text],
                 (arr->idx) - array(select jsonb_array_elements_text(rec.value)));
        end if;
      end loop;

      -- удалить записи
      if op ? 'del' then
        arr := coalesce((
          select jsonb_agg(t.e order by t.ord)
            from jsonb_array_elements(arr) with ordinality as t(e, ord)
           where not ((op->'del') @> to_jsonb(t.e->>'id'))
        ), '[]'::jsonb);
      end if;

      -- порядок записей
      if op ? 'ord' then
        ordarr := array(select jsonb_array_elements_text(op->'ord'));
        arr := coalesce((
          select jsonb_agg(t.e order by coalesce(array_position(ordarr, t.e->>'id'), 1000000000), t.ord)
            from jsonb_array_elements(arr) with ordinality as t(e, ord)
        ), '[]'::jsonb);
      end if;

      d := jsonb_set(d, array[k], arr, true);
    end if;
  end loop;

  update public.worlds set data = d, updated_at = now() where user_id = auth.uid();
end;
$$;

grant execute on function public.patch_world(jsonb) to authenticated;
