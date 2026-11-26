import { bigint, timestamp } from 'drizzle-orm/pg-core';

// Helpers de columnas comunes. Los nombres en BD quedan en snake_case (casing: 'snake_case').

/** PK bigint autoincremental (GENERATED ALWAYS AS IDENTITY). mode 'number': seguro hasta 2^53. */
export const id = () => bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();

/** FK bigint. */
export const fk = () => bigint({ mode: 'number' });

/** timestamptz (cada tienda tiene su zona horaria: siempre guardar con zona). */
export const tsz = () => timestamp({ withTimezone: true, mode: 'date' });

export const timestamps = {
  createdAt: tsz().notNull().defaultNow(),
  updatedAt: tsz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
