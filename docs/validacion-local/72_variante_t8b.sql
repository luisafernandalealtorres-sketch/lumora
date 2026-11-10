alter function public.registrar_cambios() security definer;
drop policy "agregar propios" on public.cambios_registro;
revoke insert on public.cambios_registro from authenticated, anon;
delete from zz.res;
