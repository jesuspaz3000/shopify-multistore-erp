// Menú lateral del dashboard. `segment` se agrega a /{tenant}/{shop}.
// `scope: 'tenant'` = la ruta no depende de una tienda (/{tenant}/...).

export type NavIcon =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'fulfillment'
  | 'marketing'
  | 'reports'
  | 'sync'
  | 'settings';

export type NavItem = {
  label: string;
  segment: string;
  icon: NavIcon;
  scope?: 'shop' | 'tenant';
};

export type NavSection = { title?: string; items: NavItem[] };

export const NAVIGATION: NavSection[] = [
  { items: [{ label: 'Resumen', segment: '', icon: 'dashboard' }] },
  {
    title: 'Operación',
    items: [
      { label: 'Productos', segment: 'products', icon: 'products' },
      { label: 'Inventario', segment: 'inventory', icon: 'inventory' },
      { label: 'Órdenes', segment: 'orders', icon: 'orders' },
      { label: 'Clientes', segment: 'customers', icon: 'customers' },
      { label: 'Despachos', segment: 'fulfillment', icon: 'fulfillment' },
    ],
  },
  {
    title: 'Crecimiento',
    items: [
      { label: 'Marketing', segment: 'marketing/discounts', icon: 'marketing' },
      { label: 'Reportes', segment: 'reports', icon: 'reports' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Sincronización', segment: 'sync', icon: 'sync' },
      { label: 'Configuración', segment: 'settings', icon: 'settings', scope: 'tenant' },
    ],
  },
];

export function navHref(item: NavItem, tenant: string, shop: string): string {
  if (item.scope === 'tenant') return `/${tenant}/${item.segment}`;
  return item.segment ? `/${tenant}/${shop}/${item.segment}` : `/${tenant}/${shop}`;
}
