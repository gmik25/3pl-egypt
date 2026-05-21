import { BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { findGovernorate } from '@3pl/shared';
import type { IntakeSource } from '@prisma/client';
import type { NormalizedOrder, NormalizedOrderItem } from './normalized-order';

// EG: each platform sends a different payload shape. Adapters normalise to NormalizedOrder.
// These are pragmatic best-effort mappers; tighten per real webhook payloads when integrating.

type Raw = Record<string, any>;

function toPiastres(v: unknown): number {
  // platforms send major-unit decimals (EGP). Convert to integer piastres.
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

function resolveGov(raw: string | undefined): NormalizedOrder['governorate'] {
  const g = findGovernorate(raw ?? '');
  if (!g) throw new BadRequestException(`Unrecognised governorate: "${raw}"`);
  return g.code;
}

function shopify(p: Raw): NormalizedOrder {
  const ship = p.shipping_address ?? p.customer?.default_address ?? {};
  const items: NormalizedOrderItem[] = (p.line_items ?? []).map((li: Raw) => ({
    skuCode: String(li.sku ?? li.variant_id ?? li.id),
    nameEn: li.title,
    quantity: Number(li.quantity ?? 1),
    unitPricePiastres: toPiastres(li.price),
  }));
  const cod = (p.gateway ?? '').toLowerCase().includes('cash') || p.financial_status === 'pending';
  return {
    externalRef: String(p.id ?? p.order_number ?? p.name),
    customerName: [ship.first_name, ship.last_name].filter(Boolean).join(' ') || p.email || 'Unknown',
    customerPhone: String(ship.phone ?? p.phone ?? ''),
    governorate: resolveGov(ship.province ?? ship.city),
    address: { building: ship.address2, street: ship.address1, district: ship.city },
    paymentMethod: cod ? 'COD' : 'BANK_TRANSFER',
    codAmountPiastres: cod ? toPiastres(p.total_price) : undefined,
    items,
  };
}

function woocommerce(p: Raw): NormalizedOrder {
  const ship = p.shipping ?? p.billing ?? {};
  const items: NormalizedOrderItem[] = (p.line_items ?? []).map((li: Raw) => ({
    skuCode: String(li.sku ?? li.product_id),
    nameEn: li.name,
    quantity: Number(li.quantity ?? 1),
    unitPricePiastres: toPiastres(li.price),
  }));
  const cod = String(p.payment_method ?? '').toLowerCase() === 'cod';
  return {
    externalRef: String(p.id ?? p.number),
    customerName: [ship.first_name, ship.last_name].filter(Boolean).join(' ') || 'Unknown',
    customerPhone: String(p.billing?.phone ?? ''),
    governorate: resolveGov(ship.state ?? ship.city),
    address: { building: ship.address_2, street: ship.address_1, district: ship.city },
    paymentMethod: cod ? 'COD' : 'BANK_TRANSFER',
    codAmountPiastres: cod ? toPiastres(p.total) : undefined,
    items,
  };
}

function salla(p: Raw): NormalizedOrder {
  const d = p.data ?? p;
  const ship = d.shipping?.address ?? d.customer?.address ?? {};
  const items: NormalizedOrderItem[] = (d.items ?? []).map((li: Raw) => ({
    skuCode: String(li.sku ?? li.product?.sku ?? li.id),
    nameAr: li.name,
    quantity: Number(li.quantity ?? 1),
    unitPricePiastres: toPiastres(li.amounts?.price_without_tax?.amount ?? li.price?.amount ?? li.price),
  }));
  const cod = String(d.payment_method ?? '').toLowerCase().includes('cod') ||
    String(d.payment_method ?? '').includes('الدفع عند الاستلام');
  return {
    externalRef: String(d.id ?? d.reference_id),
    customerName: `${d.customer?.first_name ?? ''} ${d.customer?.last_name ?? ''}`.trim() || 'غير معروف',
    customerPhone: String(d.customer?.mobile ?? ''),
    governorate: resolveGov(ship.city ?? ship.country),
    address: { building: ship.block, street: ship.street, district: ship.district ?? ship.city },
    paymentMethod: cod ? 'COD' : 'BANK_TRANSFER',
    codAmountPiastres: cod ? toPiastres(d.amounts?.total?.amount ?? d.total?.amount) : undefined,
    items,
  };
}

function zid(p: Raw): NormalizedOrder {
  const o = p.order ?? p;
  const ship = o.shipping?.address ?? o.customer?.address ?? {};
  const items: NormalizedOrderItem[] = (o.products ?? o.items ?? []).map((li: Raw) => ({
    skuCode: String(li.sku ?? li.id),
    nameAr: li.name,
    quantity: Number(li.quantity ?? 1),
    unitPricePiastres: toPiastres(li.price),
  }));
  const cod = String(o.payment_method ?? '').toLowerCase().includes('cod');
  return {
    externalRef: String(o.id ?? o.code),
    customerName: o.customer?.name ?? 'غير معروف',
    customerPhone: String(o.customer?.mobile ?? o.customer?.phone ?? ''),
    governorate: resolveGov(ship.city ?? ship.governorate),
    address: { street: ship.street, district: ship.district ?? ship.city },
    paymentMethod: cod ? 'COD' : 'BANK_TRANSFER',
    codAmountPiastres: cod ? toPiastres(o.order_total ?? o.total) : undefined,
    items,
  };
}

const ADAPTERS: Partial<Record<IntakeSource, (p: Raw) => NormalizedOrder>> = {
  SHOPIFY: shopify,
  WOOCOMMERCE: woocommerce,
  SALLA: salla,
  ZID: zid,
};

export function normalizeWebhook(source: IntakeSource, payload: Raw): NormalizedOrder {
  const fn = ADAPTERS[source];
  if (!fn) throw new BadRequestException(`No webhook adapter for source: ${source}`);
  return fn(payload);
}

/** CSV row -> NormalizedOrder. Expected headers documented in intake.controller. */
export function normalizeCsvRow(row: Record<string, string>): NormalizedOrder {
  const cod = (row.payment_method ?? 'COD').toUpperCase() === 'COD';
  return {
    externalRef: row.external_ref || row.reference || crypto.randomUUID(),
    customerName: row.customer_name ?? '',
    customerPhone: row.customer_phone ?? '',
    customerPhoneAlt: row.customer_phone_alt || undefined,
    governorate: resolveGov(row.governorate),
    address: {
      apartment: row.apartment || undefined,
      floor: row.floor || undefined,
      building: row.building || undefined,
      street: row.street || undefined,
      district: row.district || undefined,
    },
    paymentMethod: cod ? 'COD' : 'BANK_TRANSFER',
    codAmountPiastres: cod ? Math.round(parseFloat(row.cod_amount_egp || '0') * 100) : undefined,
    notes: row.notes || undefined,
    items: [
      {
        skuCode: row.sku_code ?? '',
        nameAr: row.sku_name_ar || undefined,
        quantity: Number(row.quantity ?? 1),
        unitPricePiastres: Math.round(parseFloat(row.unit_price_egp || '0') * 100),
      },
    ],
  };
}
