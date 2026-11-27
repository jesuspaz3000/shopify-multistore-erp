// Punto de entrada de @erp/contracts: esquemas Zod y tipos compartidos API <-> Web.
import { z } from 'zod';

// Mensajes de validación por defecto en español (API y frontend comparten esta configuración).
z.config(z.locales.es());

export * from './common/index.js';
export * from './identity/index.js';
export * from './locations/index.js';
export * from './members/index.js';
export * from './roles/index.js';
export * from './shops/index.js';
