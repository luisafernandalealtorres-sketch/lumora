-- Muestra de instantes y su lunes calculado por SQL (lunes_semana_bogota), para compararla con `inicioSemana` de JavaScript.
-- Salida CSV: instante_utc_iso,lunes_sql
copy (
  with base as (
    select g as ts from generate_series('2019-12-28 00:00+00'::timestamptz, '2029-01-10 00:00+00', interval '1 hour') g
    union
    select x from unnest(array[
      '2026-11-09 04:59:59.999+00', '2026-11-09 05:00:00+00', '2026-11-09 00:00:00+00', '2026-11-09 05:00:00.001+00',
      '2028-03-01 04:59:59.999+00', '2028-03-01 05:00:00+00', '2024-03-01 04:59:59.999+00', '2020-03-01 04:59:59.999+00',
      '2027-01-01 04:59:59.999+00', '2027-01-01 05:00:00+00', '2027-01-04 04:59:59.999+00', '2027-01-04 05:00:00+00',
      '2024-12-31 04:59:59.999+00', '2025-01-01 04:59:59.999+00', '2025-01-01 05:00:00+00']::timestamptz[]) x
  )
  select to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ',' || public.lunes_semana_bogota(ts)::text
  from base order by ts
) to stdout;
