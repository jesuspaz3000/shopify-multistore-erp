'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { ApiError } from '@/lib/http';

/**
 * Manejo mínimo de formularios con un esquema Zod compartido (@erp/contracts):
 * valida en el cliente, envía y muestra los errores de la API por campo o generales.
 */
export function useZodForm<TInput extends Record<string, string | undefined>, TOutput>(
  schema: z.ZodType<TOutput, TInput>,
  initial: TInput,
  onValid: (values: TOutput) => Promise<void>,
) {
  const [values, setValues] = useState<TInput>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const initialRef = useRef(initial);

  // Next 16 (Cache Components) no desmonta las páginas al navegar: las oculta con <Activity> y
  // conserva su estado. Sin esto, al volver al login tras cerrar sesión el botón seguía "cargando"
  // y la contraseña seguía escrita. La limpieza corre cuando la página se oculta (guía de Next).
  useLayoutEffect(() => {
    const initialValues = initialRef.current;
    return () => {
      setValues(initialValues);
      setFieldErrors({});
      setFormError(null);
      setSubmitting(false);
    };
  }, []);

  /** Asigna el valor de un campo (para selectores/autocompletar) y limpia su error. */
  const setValue = (name: keyof TInput & string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  /** onChange para TextField (también TextField select). */
  const setField = (name: keyof TInput & string) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValue(name, event.target.value);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await onValid(parsed.data);
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Ocurrió un error inesperado');
      }
      setSubmitting(false);
    }
  };

  return { values, setField, setValue, fieldErrors, formError, submitting, handleSubmit };
}
