// Tema claro / oscuro / sistema.
//
// - La preferencia se guarda en el navegador (localStorage). Es una comodidad por
//   dispositivo, no un dato del usuario: si no se puede leer o escribir, el tema
//   sigue al sistema.
// - "sistema" no pone atributo; manda prefers-color-scheme.
// - SCRIPT_TEMA se inyecta en <head> y se ejecuta antes del primer pintado para
//   evitar el parpadeo de un tema equivocado.

export const CLAVE_TEMA = 'sb-theme';
export const TEMAS = ['light', 'dark', 'system'];

export const SCRIPT_TEMA =
  "(function(){try{var t=localStorage.getItem('" + CLAVE_TEMA + "');" +
  "if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();";

export function leerTema() {
  try {
    const t = window.localStorage.getItem(CLAVE_TEMA);
    return TEMAS.includes(t) ? t : 'system';
  } catch {
    return 'system';
  }
}

export function aplicarTema(tema) {
  const el = document.documentElement;
  if (tema === 'light' || tema === 'dark') el.setAttribute('data-theme', tema);
  else el.removeAttribute('data-theme');
  try {
    if (tema === 'system') window.localStorage.removeItem(CLAVE_TEMA);
    else window.localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Sin almacenamiento disponible: el cambio vale solo para esta visita.
  }
}
