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

// ---- WMS ----

export type ZoneType = 'RECEIVING' | 'STORAGE' | 'PACKING' | 'DISPATCH';
export type LocationKind = 'BIN' | 'RACK' | 'SHELF' | 'FLOOR';
export type StockStatus = 'AVAILABLE' | 'QUARANTINE' | 'DAMAGED';
export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';
export type InspectionResult = 'PASS' | 'DAMAGED' | 'REJECTED';
export type CycleCountStatus = 'OPEN' | 'COUNTED' | 'RECONCILED';

export interface Sku {
  id: string;
  clientId: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  barcode: string | null;
  unitOfMeasure: string;
  expiryTracked: boolean;
  reorderPointQty: number;
  defaultUnitPricePiastres: number;
  isActive: boolean;
  createdAt: string;
  client?: { legalName: string };
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  governorate: GovernorateCode;
  isActive: boolean;
  _count?: { zones: number; locations: number };
}

export interface Zone {
  id: string;
  warehouseId: string;
  type: ZoneType;
  code: string;
  name: string;
  _count?: { locations: number };
}

export interface WarehouseDetail extends Warehouse {
  zones: Zone[];
}

export interface WmsLocation {
  id: string;
  warehouseId: string;
  zoneId: string;
  code: string;
  type: LocationKind;
  barcode: string | null;
  isActive: boolean;
  zone?: { type: ZoneType; name: string };
}

export interface StockLevel {
  id: string;
  skuId: string;
  locationId: string;
  lotId: string | null;
  status: StockStatus;
  quantity: number;
  location?: { code: string; warehouseId: string; zone?: { type: ZoneType } };
  sku?: { code: string; nameAr: string };
  lot?: { lotNumber: string; expiryDate: string | null } | null;
}

export interface LowStockRow {
  skuId: string;
  code: string;
  nameAr: string;
  available: number;
  reorderPointQty: number;
}

export interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  status: StockStatus;
  fromLocationId: string | null;
  toLocationId: string | null;
  note: string | null;
  createdAt: string;
}

export interface PoLine {
  id: string;
  skuId: string;
  quantityOrdered: number;
  quantityReceived: number;
  lotNumber: string | null;
  expiryDate: string | null;
  sku?: { code: string; nameAr: string; expiryTracked: boolean };
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  clientId: string;
  warehouseId: string;
  supplierName: string | null;
  status: PurchaseOrderStatus;
  expectedDate: string | null;
  notes: string | null;
  createdAt: string;
  client?: { legalName: string };
  warehouse?: { code: string; name: string };
  lines?: PoLine[];
  _count?: { lines: number };
}

export interface CycleCount {
  id: string;
  warehouseId: string;
  locationId: string;
  skuId: string;
  status: CycleCountStatus;
  expectedQty: number;
  countedQty: number | null;
  varianceQty: number | null;
  createdAt: string;
  sku?: { code: string; nameAr: string };
}

// ---- COD & Finance ----

export type WalletEntryType = 'COD_CREDIT' | 'COMMISSION_FEE' | 'PAYOUT' | 'ADJUSTMENT';
export type RemittanceStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type PayoutRail = 'INSTAPAY' | 'FAWRY' | 'SWIFT';
export type PayoutStatus = 'PENDING' | 'PAID' | 'FAILED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export interface Wallet {
  id: string | null;
  clientId: string;
  balancePiastres: number;
  client?: { legalName: string };
}

export interface StatementEntry {
  id: string;
  type: WalletEntryType;
  amountPiastres: number;
  note: string | null;
  createdAt: string;
  runningBalancePiastres: number;
}

export interface Statement {
  clientId: string;
  openingPiastres: number;
  closingPiastres: number;
  currentBalancePiastres?: number;
  entries: StatementEntry[];
}

export interface EligibleCodOrder {
  id: string;
  reference: string;
  clientId: string;
  codAmountPiastres: number | null;
  customerName: string;
  governorate: GovernorateCode;
  client: { legalName: string };
}

export interface RemittanceItem {
  id: string;
  orderId: string;
  clientId: string;
  codAmountPiastres: number;
}

export interface Remittance {
  id: string;
  reference: string;
  driverId: string;
  status: RemittanceStatus;
  declaredAmountPiastres: number;
  confirmedAmountPiastres: number | null;
  note: string | null;
  createdAt: string;
  driver?: { fullName: string };
  items?: RemittanceItem[];
  _count?: { items: number };
}

export interface CodByDriverRow {
  driverId: string;
  driverName: string;
  day: string;
  totalPiastres: number;
  count: number;
}

export interface Payout {
  id: string;
  reference: string;
  clientId: string;
  amountPiastres: number;
  rail: PayoutRail;
  status: PayoutStatus;
  externalRef: string | null;
  createdAt: string;
  paidAt: string | null;
  client?: { legalName: string };
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitNetPiastres: number;
  netPiastres: number;
  vatPiastres: number;
  grossPiastres: number;
}

export interface Invoice {
  id: string;
  reference: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  status: InvoiceStatus;
  netPiastres: number;
  vatPiastres: number;
  grossPiastres: number;
  etaUuid: string | null;
  createdAt: string;
  client?: { legalName: string };
  lines?: InvoiceLine[];
  _count?: { lines: number };
}
