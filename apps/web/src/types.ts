import type { GovernorateCode, UserRole, OrderState, PaymentMethod, IntakeSource } from '@3pl/shared';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  mfaRequired?: boolean;
}

export interface RoleRef {
  id: string;
  name: UserRole;
}

export interface UserSummary {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  isActive: boolean;
  scopedGovernorates: GovernorateCode[];
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  roles: { role: { name: UserRole } }[];
}

export interface UserDetail extends Omit<UserSummary, 'roles'> {
  roles: { role: RoleRef }[];
  mfaSecret: { confirmed: boolean } | null;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
}

export interface Role {
  id: string;
  name: UserRole;
  description: string | null;
  permissions: { permission: Permission }[];
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'MFA_ENROL'
  | 'MFA_VERIFY'
  | 'STATE_TRANSITION';

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; email: string; fullName: string } | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Client & Contract ----

export type KycDocType = 'COMMERCIAL_REGISTRATION' | 'TAX_CARD' | 'NATIONAL_ID';

export interface ClientSummary {
  id: string;
  legalName: string;
  tradingName: string | null;
  taxId: string | null;
  governorate: GovernorateCode;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  createdAt: string;
  _count?: { contracts: number; kycDocuments: number };
}

export interface ClientDetail extends ClientSummary {
  commercialRegistration: string | null;
  addressApartment: string | null;
  addressFloor: string | null;
  addressBuilding: string | null;
  addressStreet: string | null;
  addressDistrict: string | null;
  kycDocuments: KycDocument[];
  contracts: Contract[];
}

export interface KycDocument {
  id: string;
  clientId: string;
  type: KycDocType;
  fileUrl: string;
  uploadedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approved: boolean | null;
}

export interface Sla {
  id: string;
  contractId: string;
  handlingTimeMinutes: number;
  deliveryWindowDaysCairo: number;
  deliveryWindowDaysOther: number;
  maxReturnRateBps: number;
}

export interface Contract {
  id: string;
  clientId: string;
  startsOn: string;
  endsOn: string | null;
  storagePerSkuPerDayPiastres: number;
  pickAndPackPiastres: number;
  codCommissionBps: number;
  returnFeePiastres: number;
  isActive: boolean;
  sla: Sla | null;
}

export interface QuoteLine {
  key: 'storage' | 'pickAndPack' | 'codCommission' | 'returnFees';
  amountPiastres: number;
}

export interface Quote {
  lines: QuoteLine[];
  netPiastres: number;
  vatPiastres: number;
  grossPiastres: number;
  vatRateBps: number;
}

// ---- OMS ----

export type CodLedgerType = 'COLLECTED' | 'REMITTED' | 'ADJUSTMENT';

export interface OrderListItem {
  id: string;
  reference: string;
  clientId: string;
  state: OrderState;
  governorate: GovernorateCode;
  customerName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  codAmountPiastres: number | null;
  flaggedReason: string | null;
  intakeSource: IntakeSource;
  createdAt: string;
  client: { legalName: string };
  warehouse: { code: string };
  _count: { items: number };
}

export interface OrderItemRow {
  id: string;
  skuId: string;
  quantity: number;
  unitPricePiastres: number;
  sku: { code: string; nameAr: string; nameEn: string | null };
}

export interface OrderTransition {
  id: string;
  fromState: OrderState | null;
  toState: OrderState;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface CodLedgerEntry {
  id: string;
  type: CodLedgerType;
  amountPiastres: number;
  actorId: string | null;
  note: string | null;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  reference: string;
  clientId: string;
  state: OrderState;
  intakeSource: IntakeSource;
  externalRef: string | null;
  governorate: GovernorateCode;
  customerName: string;
  customerPhone: string;
  customerPhoneAlt: string | null;
  addressApartment: string | null;
  addressFloor: string | null;
  addressBuilding: string | null;
  addressStreet: string | null;
  addressDistrict: string | null;
  notes: string | null;
  paymentMethod: PaymentMethod;
  codAmountPiastres: number | null;
  flaggedReason: string | null;
  serviceFeePiastres: number;
  createdAt: string;
  client: { id: string; legalName: string };
  warehouse: { id: string; code: string; name: string };
  items: OrderItemRow[];
  transitions: OrderTransition[];
  codLedger: CodLedgerEntry[];
}

export interface CodSummary {
  collectedPiastres: number;
  remittedPiastres: number;
  adjustmentsPiastres: number;
  outstandingPiastres: number;
}

export interface CsvImportResult {
  created: number;
  failed: { row: number; reason: string }[];
}
