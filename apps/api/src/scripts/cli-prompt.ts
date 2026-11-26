// Utilidades de consola para los comandos administrativos (superadmin:create, tenant:create).
import { passwordSchema } from '@erp/contracts';
import { createInterface } from 'node:readline/promises';
import type { z } from 'zod';

/**
 * En Windows, `npm run x -- --company "Mi Empresa"` llega como `^Mi^ Empresa^`: npm escapa los
 * argumentos para cmd.exe y el escape queda en el texto. Se revierte aquí.
 */
export function cleanArg(value: string | undefined, platform: NodeJS.Platform = process.platform): string | undefined {
  if (value === undefined || platform !== 'win32' || !value.includes('^')) return value;
  return value.replace(/\^(.)/g, '$1').replace(/\^$/, '');
}

/** Pregunta un dato visible por consola, validándolo con un esquema; repite hasta que sea válido. */
export async function ask<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  if (!process.stdin.isTTY) throw new Error(`Falta el dato "${prompt.trim()}" (pásalo como argumento).`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const parsed = schema.safeParse(await rl.question(prompt));
      if (parsed.success) return parsed.data;
      console.error(`  ${parsed.error.issues[0].message}`);
    }
  } finally {
    rl.close();
  }
}

/** Usa el argumento si viene y es válido; si no viene, lo pregunta. */
export async function argOrAsk<T>(raw: string | undefined, prompt: string, schema: z.ZodType<T>, flag: string): Promise<T> {
  const value = cleanArg(raw);
  if (value === undefined) return ask(prompt, schema);
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`${flag}: ${parsed.error.issues[0].message}`);
  return parsed.data;
}

/** Lee una línea sin mostrarla (muestra * por cada carácter). */
export function askHidden(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  stdout.write(prompt);
  if (!stdin.isTTY) {
    throw new Error('Ejecuta el comando en una terminal interactiva o pasa la contraseña en una variable de entorno.');
  }

  return new Promise((resolve) => {
    let value = '';
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdout.write('\nCancelado.\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        value += char;
        stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

/**
 * Pide una contraseña nueva (dos veces) validando las reglas compartidas.
 * Si `envVar` está definida en el entorno, la usa sin preguntar (para automatizar).
 */
export async function readNewPassword(envVar: string): Promise<string> {
  const fromEnv = process.env[envVar];
  if (fromEnv) return passwordSchema.parse(fromEnv);

  for (;;) {
    const password = await askHidden('Contraseña: ');
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      console.error(`  ${parsed.error.issues[0].message}`);
      continue;
    }
    if ((await askHidden('Repite la contraseña: ')) !== password) {
      console.error('  Las contraseñas no coinciden.');
      continue;
    }
    return password;
  }
}
