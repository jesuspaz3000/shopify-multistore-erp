// Menú lateral del dashboard. `segment` se agrega a /{tenant}/{shop}.
// `scope: 'tenant'` = la ruta no depende de una tienda (/{tenant}/...).
// `children`: submódulos que se despliegan bajo el módulo (como en Shopify: Productos -> Colecciones, Inventario...).

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

export type NavChild = { label: string; segment: string; scope?: 'shop' | 'tenant' };

export type NavItem = NavChild & {
  icon: NavIcon;
  children?: NavChild[];
};

export type NavSection = { title?: string; items: NavItem[] };

export const NAVIGATION: NavSection[] = [
  { items: [{ label: 'Resumen', segment: '', icon: 'dashboard' }] },
  {
    title: 'Operación',
    items: [
      {
        label: 'Productos',
        segment: 'products',
        icon: 'products',
        children: [
          { label: 'Colecciones', segment: 'products/collections' },
          { label: 'Inventario', segment: 'inventory' },
          { label: 'Órdenes de compra', segment: 'products/purchase-orders' },
          { label: 'Transferencias', segment: 'products/transfers' },
        ],
      },
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

export function navHref(item: NavChild, tenant: string, shop: string): string {
  if (item.scope === 'tenant') return `/${tenant}/${item.segment}`;
  return item.segment ? `/${tenant}/${shop}/${item.segment}` : `/${tenant}/${shop}`;
}
