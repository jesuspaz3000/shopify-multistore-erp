// Carga (o actualiza) las categorías de producto: la taxonomía estándar de Shopify en español.
// Fuente: https://github.com/Shopify/product-taxonomy (licencia MIT), versión estable fijada abajo.
//
//   npm run taxonomy:import                       -> descarga la versión fijada desde GitHub
//   npm run taxonomy:import -- --version 2026-11  -> otra versión estable
//   npm run taxonomy:import -- --file ruta/categories.es.txt[.gz]   -> sin internet, desde un archivo
//
// Desde la raíz usa el build actual de la API (dist/, que npm run dev:api mantiene compilado) sin
// recompilar: así no interrumpe la API en desarrollo.
// Es repetible: actualiza nombres y jerarquía; las categorías que salieron de la versión se conservan.
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { parseTaxonomy } from '../modules/catalog/taxonomy/taxonomy-parser.js';
import { TaxonomyRepository } from '../modules/catalog/taxonomy/taxonomy.repository.js';

/** Última versión ESTABLE publicada (release "Latest" de Shopify/product-taxonomy). */
const DEFAULT_VERSION = '2026-11';
const LOCALE = 'es';
const MAX_BYTES = 50 * 1024 * 1024;

const releaseUrl = (version: string) =>
  `https://github.com/Shopify/product-taxonomy/releases/download/v${version}/categories.${LOCALE}.txt.gz`;

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`GitHub respondió ${res.status} para ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error('El archivo descargado es demasiado grande');
  return buffer;
}

async function main() {
  const { values } = parseArgs({ options: { version: { type: 'string' }, file: { type: 'string' } } });
  const version = values.version ?? DEFAULT_VERSION;
  if (!/^\d{4}-\d{2}$/.test(version)) throw new Error('Versión inválida (ej. 2026-11)');

  const source = values.file ?? releaseUrl(version);
  console.log(`Leyendo ${source}…`);
  const raw = values.file ? await readFile(values.file) : await download(source);
  const text = (raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw, { maxOutputLength: MAX_BYTES }) : raw).toString('utf8');

  const parsed = parseTaxonomy(text);
  if (parsed.entries.length < 1000) throw new Error(`El archivo solo tiene ${parsed.entries.length} categorías: no parece la taxonomía`);
  const loadedVersion = parsed.version ?? version;
  if (!values.file && loadedVersion !== version) throw new Error(`Se pidió la versión ${version} pero el archivo es ${loadedVersion}`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const repo = app.get(TaxonomyRepository);
    await repo.upsertAll(parsed.entries, loadedVersion);
    console.log(`✔ Taxonomía ${loadedVersion}: ${parsed.entries.length} categorías cargadas (${await repo.count()} en total).`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
