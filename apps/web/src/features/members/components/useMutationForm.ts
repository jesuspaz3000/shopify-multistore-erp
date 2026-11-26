'use client';

import { useState } from 'react';
import type { z } from 'zod';
import { ApiError } from '@/lib/http';

/**
 * Estado de envío para formularios con campos no textuales (listas, booleanos):
 * valida con el esquema compartido y mapea los errores de la API por campo.
 */
export function useMutationForm<T>(schema: z.ZodType<T>) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (values: unknown, action: (data: T) => Promise<void>) => {
    setFormError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await action(parsed.data);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Ocurrió un error inesperado');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return { errors, setErrors, formError, submitting, submit };
}
