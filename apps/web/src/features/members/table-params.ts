// Prefijo en la URL de la tabla de invitaciones (?invPage, ?invQ): convive con la de miembros.
// Vive en un módulo normal (no 'use client') porque lo usan la página (servidor) y el componente
// (cliente): importar una constante desde un archivo 'use client' en el servidor no da su valor.
export const INVITATIONS_PREFIX = 'inv';
