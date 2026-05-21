// Cross-cutting enums shared between API and Web.
// IMPORTANT: keep these in sync with the Prisma enums in apps/api/prisma/schema.prisma.

/** Order lifecycle. Matches the brief's OMS state machine. */
export const ORDER_STATES = [
  'PENDING',
  'PICKED',
  'PACKED',
  'DISPATCHED',
  'DELIVERED',
  'FAILED',
  'RETURNED',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

/** Valid forward transitions between order states. */
export const ORDER_STATE_TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  PENDING:    ['PICKED'],
  PICKED:     ['PACKED'],
  PACKED:     ['DISPATCHED'],
  DISPATCHED: ['DELIVERED', 'FAILED'],
  DELIVERED:  ['RETURNED'],
  FAILED:     ['DISPATCHED', 'RETURNED'],
  RETURNED:   [],
};

/** RBAC roles. The 6 from the brief. */
export const USER_ROLES = [
  'SUPER_ADMIN',
  'WAREHOUSE_MANAGER',
  'PICKER',
  'DRIVER',
  'FINANCE',
  'CLIENT',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles that must enrol in TOTP 2FA. */
export const ROLES_REQUIRING_MFA: readonly UserRole[] = ['SUPER_ADMIN', 'FINANCE'];

/** Couriers supported by the last-mile integration layer. */
export const COURIERS = ['ARAMEX', 'BOSTA', 'R2S', 'MYLERZ', 'JT', 'IN_HOUSE'] as const;
export type Courier = (typeof COURIERS)[number];

/** End-customer payment methods. COD is dominant in EG and is treated first-class. */
export const PAYMENT_METHODS = ['COD', 'INSTAPAY', 'FAWRY', 'BANK_TRANSFER', 'WALLET'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Client payout rails for COD remittance and wallet withdrawals. */
export const PAYOUT_RAILS = ['INSTAPAY', 'FAWRY', 'SWIFT'] as const;
export type PayoutRail = (typeof PAYOUT_RAILS)[number];

/** Where an order originated. */
export const INTAKE_SOURCES = [
  'SHOPIFY',
  'WOOCOMMERCE',
  'SALLA',
  'ZID',
  'CSV',
  'MANUAL',
  'API',
] as const;
export type IntakeSource = (typeof INTAKE_SOURCES)[number];

/** Return reason codes. */
export const RETURN_REASONS = [
  'DAMAGED',
  'WRONG_ITEM',
  'CUSTOMER_REFUSAL',
  'CHANGE_OF_MIND',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

/** KYC document types collected during client onboarding. */
export const KYC_DOC_TYPES = ['COMMERCIAL_REGISTRATION', 'TAX_CARD', 'NATIONAL_ID'] as const;
export type KycDocType = (typeof KYC_DOC_TYPES)[number];

/** Supported UI languages. Arabic is the default per the brief. */
export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
