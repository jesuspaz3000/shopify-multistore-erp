import { productInputSchema } from '@erp/contracts';
import { describe, expect, it } from 'vitest';
import { isShopifyCdnUrl } from './shopify-import.service.js';
import { type ShopifyProductNode, type ShopifyVariantNode, toProductInput } from './shopify-product.mapper.js';

const product = (over: Partial<ShopifyProductNode> = {}): ShopifyProductNode => ({
  id: 'gid://shopify/Product/1',
  handle: 'polera-basica',
  title: 'Polera básica',
  descriptionHtml: '<p>Algodón</p>',
  vendor: 'Yisus',
  productType: '',
  status: 'ACTIVE',
  tags: ['verano', ' '],
  updatedAt: '2026-11-27T10:00:00Z',
  seo: { title: null, description: null },
  options: [
    { name: 'Talla', position: 1, optionValues: [{ name: 'S', hasVariants: true }, { name: 'M', hasVariants: true }, { name: 'L', hasVariants: false }] },
  ],
  media: { nodes: [{ id: 'gid://shopify/MediaImage/9', alt: 'Frente', mediaContentType: 'IMAGE', image: { url: 'https://cdn.shopify.com/a.jpg', width: 1, height: 1 } }] },
  ...over,
});

const variant = (id: number, size: string, over: Partial<ShopifyVariantNode> = {}): ShopifyVariantNode => ({
  id: `gid://shopify/ProductVariant/${id}`,
  title: size,
  sku: `POL-${size}`,
  price: '49.90',
  compareAtPrice: null,
  inventoryPolicy: 'DENY',
  taxable: true,
  position: id,
  barcodes: { nodes: [] },
  selectedOptions: [{ name: 'Talla', value: size }],
  inventoryItem: {
    id: `gid://shopify/InventoryItem/${id}`,
    tracked: true,
    requiresShipping: true,
    unitCost: { amount: '20.0' },
    countryCodeOfOrigin: 'PE',
    harmonizedSystemCode: '610910',
    measurement: { weight: { value: 0.25, unit: 'KILOGRAMS' } },
  },
  ...over,
});

describe('toProductInput', () => {
  it('traduce opciones, variantes, imágenes y conserva las variantes ya vinculadas', () => {
    const { input, warnings } = toProductInput(
      product(),
      [variant(2, 'M'), variant(1, 'S', { compareAtPrice: '59.90' })],
      new Map([['gid://shopify/ProductVariant/1', 77]]),
      new Map([['gid://shopify/MediaImage/9', 5]]),
    );
    const data = productInputSchema.parse(input);
    expect(warnings).toEqual([]);
    expect(data).toMatchObject({
      title: 'Polera básica',
      vendor: 'Yisus',
      productType: null,
      status: 'ACTIVE',
      tags: ['verano'],
      handle: 'polera-basica',
      options: [{ name: 'Talla', values: ['S', 'M', 'L'] }],
      media: [{ id: 5, alt: 'Frente' }],
    });
    // Ordenadas por posición; la ya vinculada conserva su id.
    expect(data.variants.map((v) => [v.id, v.optionValues, v.compareAtPrice])).toEqual([
      [77, ['S'], '59.9'],
      [undefined, ['M'], null],
    ]);
    expect(data.variants[0]).toMatchObject({ cost: '20', weight: '0.25', harmonizedSystemCode: '610910', countryCodeOfOrigin: 'PE' });
  });

  it('un producto sin opciones ("Default Title") queda sin opciones', () => {
    const { input } = toProductInput(
      product({ options: [{ name: 'Title', position: 1, optionValues: [{ name: 'Default Title', hasVariants: true }] }] }),
      [variant(1, 'Default Title', { selectedOptions: [{ name: 'Title', value: 'Default Title' }] })],
      new Map(),
      new Map(),
    );
    const data = productInputSchema.parse(input);
    expect(data.options).toEqual([]);
    expect(data.variants[0].optionValues).toEqual([]);
  });

  it('ajusta lo que el ERP no acepta: SKU repetido, precio antes menor, UNLISTED, handle raro', () => {
    const { input, warnings } = toProductInput(
      product({ status: 'UNLISTED', handle: 'Polera_Ñ' }),
      [variant(1, 'S', { compareAtPrice: '10' }), variant(2, 'M', { sku: 'POL-S' })],
      new Map(),
      new Map(),
    );
    const data = productInputSchema.parse(input);
    expect(data.status).toBe('ACTIVE');
    expect(data.handle).toBeNull();
    expect(data.variants[0].compareAtPrice).toBeNull();
    expect(data.variants[1].sku).toBeNull();
    expect(warnings[0]).toMatch(/repetido/);
  });
});

describe('isShopifyCdnUrl', () => {
  it('solo acepta el CDN de Shopify por https', () => {
    expect(isShopifyCdnUrl('https://cdn.shopify.com/s/files/1/a.jpg')).toBe(true);
    expect(isShopifyCdnUrl('http://cdn.shopify.com/a.jpg')).toBe(false);
    expect(isShopifyCdnUrl('https://cdn.shopify.com.evil.com/a.jpg')).toBe(false);
    expect(isShopifyCdnUrl('https://169.254.169.254/latest')).toBe(false);
    expect(isShopifyCdnUrl('no es url')).toBe(false);
  });
});
