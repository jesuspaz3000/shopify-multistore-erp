import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una ruta (o controller) como accesible sin sesión. Todo lo demás exige sesión. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
