// Frente inicial de cada formulario. Valores EXPLÍCITOS, aprobados el 8 nov 2026 (decisión D-F3).
//
// Por qué existe: antes, tres formularios tomaban su frente inicial de `frentes[0]`, es decir, del campo
// `orden` de la tabla `frentes`. Agregar un frente o cambiar un orden habría cambiado el frente por
// defecto de un formulario sin que nadie lo decidiera. Ahora cada formulario declara el suyo aquí.
//
// Estos valores conservan exactamente el comportamiento que había antes. Cambiar uno es editar una línea.
// Cada valor es el `slug` ORIGINAL de la tabla `frentes`, no un frente de diseño.
// tests/formularios.test.mjs exige que sean frentes existentes y que ningún componente use `frentes[0]`.

export const FRENTE_INICIAL = Object.freeze({
  miDiaPendiente: 'ticketcode-eventos', // Mi día: nuevo pendiente
  metaNueva: 'ticketcode-eventos', //      Metas: nueva meta
  notaNueva: 'ticketcode-eventos', //      Cerebro: nueva nota
  notaEdicionSinFrente: 'personal', //     Cerebro: editar una nota que no tiene frente
  gastoNuevo: 'personal', //               Gastos: nuevo gasto
  ingresoNuevo: 'personal', //             Finanzas: nuevo ingreso
  recurrenteNuevo: 'personal', //          Finanzas: nuevo pago recurrente
});

/** Frente inicial (slug) de un formulario. Un formulario desconocido es un error de programación. */
export function frenteInicial(formulario) {
  if (!Object.hasOwn(FRENTE_INICIAL, formulario)) {
    throw new RangeError(`Formulario sin frente inicial definido: "${formulario}"`);
  }
  return FRENTE_INICIAL[formulario];
}
