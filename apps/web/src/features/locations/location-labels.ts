import type { LocationShopLink, LocationType, StockSyncMode } from '@erp/contracts';

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  warehouse: 'Bodega',
  retail_store: 'Tienda física',
  '3pl': 'Operador logístico (3PL)',
  virtual: 'Virtual',
};

export const STOCK_MODE_LABELS: Record<StockSyncMode, { label: string; help: string }> = {
  MIRROR: { label: 'Todo el stock', help: 'Publica el 100 % de lo disponible en la bodega' },
  PERCENTAGE: { label: 'Porcentaje', help: 'Publica solo un % de lo disponible' },
  BUFFER: { label: 'Reserva de unidades', help: 'Publica lo disponible menos N unidades de reserva' },
  MANUAL: { label: 'Manual', help: 'El stock se ajusta a mano en la tienda' },
  NONE: { label: 'No sincronizar', help: 'La bodega no publica stock en esta tienda' },
};

/** Resumen corto de la regla: "50 %", "−3 u.", "Todo"... */
export function stockRuleSummary(link: LocationShopLink): string {
  switch (link.stockSyncMode) {
    case 'PERCENTAGE':
      return `${link.stockPercentage} %`;
    case 'BUFFER':
      return `−${link.stockBuffer} u.`;
    case 'MIRROR':
      return 'Todo';
    default:
      return STOCK_MODE_LABELS[link.stockSyncMode].label;
  }
}
