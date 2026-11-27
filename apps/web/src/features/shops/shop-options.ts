import type { ShopStatus } from '@erp/contracts';
import { countryName } from '@/lib/countries';

// Opciones de tiendas y bodegas (los códigos se validan en @erp/contracts).

export const COUNTRIES = [
  { code: 'PE', label: 'Perú' },
  { code: 'CL', label: 'Chile' },
  { code: 'MX', label: 'México' },
  { code: 'CO', label: 'Colombia' },
  { code: 'AR', label: 'Argentina' },
  { code: 'BR', label: 'Brasil' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'ES', label: 'España' },
];

export const STATUS_LABELS: Record<ShopStatus, { label: string; color: 'warning' | 'success' | 'default' | 'error' }> = {
  pending_connection: { label: 'Desconectada', color: 'warning' }, // se creó al conectar y luego se desconectó
  installed: { label: 'Conectada', color: 'success' },
  uninstalled: { label: 'Desinstalada', color: 'default' },
  frozen: { label: 'Congelada', color: 'error' },
  paused: { label: 'Pausada', color: 'default' },
};

/** Nombre del país en español para cualquier código ISO (los de Shopify pueden ser cualquiera). */
export const countryLabel = (code: string | null) => (code ? countryName(code) : '—');
