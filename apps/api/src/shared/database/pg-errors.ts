// Códigos de error de PostgreSQL usados por la aplicación.
const UNIQUE_VIOLATION = '23505';

/** true si el error es una violación de UNIQUE (opcionalmente de un constraint concreto). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  // Drizzle envuelve el error del driver en `cause`.
  const pgError = (error as { cause?: unknown })?.cause ?? error;
  const { code, constraint: name } = (pgError ?? {}) as { code?: string; constraint?: string };
  return code === UNIQUE_VIOLATION && (constraint === undefined || name === constraint);
}
