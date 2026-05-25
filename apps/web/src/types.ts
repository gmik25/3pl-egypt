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
  hsCode: string | null;
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
  isBonded?: boolean;
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

// ---- Last-Mile & Fleet ----

export type CarrierType = 'COURIER' | 'IN_HOUSE';
export type CourierName = 'ARAMEX' | 'BOSTA' | 'R2S' | 'MYLERZ' | 'JT';
export type ShipmentStatus = 'PENDING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';
export type PodMethod = 'PHOTO' | 'SIGNATURE' | 'OTP';
export type DeliveryFailureReason =
  | 'CUSTOMER_UNREACHABLE'
  | 'ADDRESS_NOT_FOUND'
  | 'CUSTOMER_REFUSED'
  | 'POSTPONED'
  | 'OTHER';

export interface Driver {
  id: string;
  userId: string;
  vehicleType: string | null;
  plateNumber: string | null;
  isAvailable: boolean;
  zones: GovernorateCode[];
  user?: { id: string; fullName: string; phone: string | null; email: string };
}

export interface DeliveryAttempt {
  id: string;
  attemptNumber: number;
  success: boolean;
  failureReason: DeliveryFailureReason | null;
  note: string | null;
  createdAt: string;
}

export interface ProofOfDelivery {
  id: string;
  method: PodMethod;
  photoUrl: string | null;
  signatureUrl: string | null;
  otpVerified: boolean;
  recipientName: string | null;
  capturedAt: string;
}

export interface ShipmentListItem {
  id: string;
  reference: string;
  orderId: string;
  carrierType: CarrierType;
  courierId: string | null;
  courierAccount?: { code: string; name: string } | null;
  driverId: string | null;
  trackingNumber: string | null;
  status: ShipmentStatus;
  governorate: GovernorateCode;
  attemptCount: number;
  scheduledFor: string | null;
  createdAt: string;
  order?: { reference: string; customerName: string; customerPhone: string; codAmountPiastres: number | null; paymentMethod: PaymentMethod };
  driver?: { fullName: string } | null;
  _count?: { attempts: number };
}

export interface ShipmentDetail extends ShipmentListItem {
  order?: { reference: string; customerName: string; customerPhone: string; codAmountPiastres: number | null; paymentMethod: PaymentMethod; governorate: GovernorateCode };
  driver?: { id: string; fullName: string } | null;
  attempts: DeliveryAttempt[];
  pod: ProofOfDelivery | null;
}

export interface CarrierSuggestion {
  couriers: { courierId: string; code: string; name: string; etaDays: number }[];
  inHouseDrivers: { driverId: string; name: string }[];
}

// ---- Returns ----

export type ReturnReason = 'DAMAGED' | 'WRONG_ITEM' | 'CUSTOMER_REFUSAL' | 'CHANGE_OF_MIND';
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'INSPECTED' | 'CLOSED' | 'REJECTED';
export type ReturnDisposition = 'RESELLABLE' | 'DAMAGED';

export interface ReturnListItem {
  id: string;
  rmaNumber: string;
  orderId: string;
  clientId: string;
  reason: ReturnReason;
  status: ReturnStatus;
  createdAt: string;
  order?: { reference: string; customerName: string };
  client?: { legalName: string };
  _count?: { items: number };
}

export interface ReturnItemRow {
  id: string;
  skuId: string;
  quantity: number;
  unitPricePiastres: number;
  disposition: ReturnDisposition | null;
  restockLocationId: string | null;
  disposalApproved: boolean;
  sku?: { code: string; nameAr: string };
}

export interface CreditNoteLine {
  id: string;
  description: string;
  quantity: number;
  netPiastres: number;
  vatPiastres: number;
  grossPiastres: number;
}

export interface CreditNote {
  id: string;
  reference: string;
  netPiastres: number;
  vatPiastres: number;
  grossPiastres: number;
  lines?: CreditNoteLine[];
}

export interface ReturnDetail {
  id: string;
  rmaNumber: string;
  reason: ReturnReason;
  status: ReturnStatus;
  customerNote: string | null;
  createdAt: string;
  order?: { reference: string; customerName: string; customerPhone: string; governorate: GovernorateCode; warehouseId: string; state: string };
  client?: { id: string; legalName: string };
  items: ReturnItemRow[];
  creditNote: CreditNote | null;
}

export interface PortalLookup {
  orderReference: string;
  customerName: string;
  items: { skuId: string; code: string; nameAr: string; quantity: number }[];
}

// ---- Customs & Compliance ----

export type ImportStatus = 'DRAFT' | 'DECLARED' | 'UNDER_INSPECTION' | 'CLEARED' | 'RELEASED' | 'CANCELLED';

export interface HsCode {
  id: string;
  code: string;
  description: string;
  dutyRateBps: number;
  createdAt: string;
}

export interface ImportLine {
  id: string;
  skuId: string;
  hsCode: string;
  dutyRateBps: number;
  quantity: number;
  unitCostPiastres: number;
  sku?: { code: string; nameAr: string };
}

export interface ImportShipmentListItem {
  id: string;
  reference: string;
  clientId: string;
  status: ImportStatus;
  originCountry: string | null;
  supplierName: string | null;
  bonded: boolean;
  ecaDeclarationNumber: string | null;
  createdAt: string;
  client?: { legalName: string };
  _count?: { lines: number };
}

export interface ImportShipmentDetail extends ImportShipmentListItem {
  warehouseId: string | null;
  warehouse?: { id: string; code: string; name: string; isBonded: boolean } | null;
  freightCostPiastres: number;
  insuranceCostPiastres: number;
  declaredAt: string | null;
  clearedAt: string | null;
  releasedAt: string | null;
  lines: ImportLine[];
}

export interface LandedCost {
  goodsTotalPiastres: number;
  freightPiastres: number;
  insurancePiastres: number;
  cifPiastres: number;
  totalDutyPiastres: number;
  vatRateBps: number;
  vatPiastres: number;
  landedTotalPiastres: number;
  lines: { ref: string; goodsPiastres: number; cifSharePiastres: number; dutyPiastres: number }[];
  bonded: boolean;
  dutyDeferred: boolean;
}

// ---- Reporting & Analytics ----

export interface OpsKpis {
  totalOrders: number;
  stateCounts: Partial<Record<OrderState, number>>;
  fulfilmentRatePct: number;
  failedOrders: number;
  returnedOrders: number;
  onTimeDeliveryPct: number;
  onTimeMeasured: number;
  codExpectedPiastres: number;
  codCollectedPiastres: number;
  codCollectionRatePct: number;
}

export interface RevenueRow {
  client: string;
  revenuePiastres: number;
}

export interface CourierScore {
  courier: string;
  shipments: number;
  delivered: number;
  failed: number;
  returned: number;
  deliveryRatePct: number;
  avgAttempts: number;
}

export interface InventoryRow {
  warehouse: string;
  availableUnits: number;
  quarantineUnits: number;
  damagedUnits: number;
}

// ---- Notifications ----

export type NotificationChannel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'INTERNAL';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';
export type NotificationCategory =
  | 'ORDER_UPDATE'
  | 'DELIVERY'
  | 'RETURN'
  | 'LOW_STOCK'
  | 'SLA_BREACH'
  | 'FAILED_DELIVERY_SPIKE'
  | 'DIGEST'
  | 'OTHER';
export type SmsProvider = 'VODAFONE' | 'ETISALAT';

export interface Notification {
  id: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  recipient: string;
  locale: string;
  subject: string | null;
  body: string;
  status: NotificationStatus;
  provider: SmsProvider | null;
  createdAt: string;
  sentAt: string | null;
}

// ---- Dashboards ----

export interface PortalSummary {
  client: { id: string; legalName: string };
  totalOrders: number;
  ordersByState: Record<OrderState, number>;
  cod: { expectedPiastres: number; collectedPiastres: number; walletBalancePiastres: number };
  returns: { open: number; total: number };
  lowStock: { code: string; nameAr: string; available: number; reorderPointQty: number }[];
  recentInvoices: { reference: string; grossPiastres: number; status: InvoiceStatus; periodEnd: string }[];
}

export interface OpsOverview {
  totals: { activeClients: number; warehouses: number; drivers: number; openOrders: number; todayOrders: number; weekOrders: number };
  ordersByState: Record<OrderState, number>;
  cod: { collectedPiastres: number; walletLiabilityPiastres: number };
  queues: { returnsPending: number; remittancesPending: number; importsInFlight: number; shipmentsOut: number; failedShipments: number };
  warehouses: { code: string; name: string; isBonded: boolean; orders: number; availableUnits: number }[];
  couriers: CourierScore[];
  alerts: { lowStock: number; slaBreaches: number; failedSpike: number };
}

// ---- Integrations: couriers ----

export interface CourierAccount {
  id: string;
  code: string;
  name: string;
  apiBaseUrl: string | null;
  isActive: boolean;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { coverage: number; shipments: number };
  coverage?: CourierCoverage[];
}

export interface CourierCoverage {
  id: string;
  courierId: string;
  governorate: GovernorateCode;
  etaDays: number;
  isServiceable: boolean;
}

export interface CourierTestResult {
  ok: boolean;
  courier: string;
  apiBaseUrl: string | null;
  hasCredentials: boolean;
  note: string;
}

export type StorePlatform = 'SHOPIFY' | 'WOOCOMMERCE' | 'SALLA' | 'ZID';
export type StoreConnectionStatus = 'PENDING' | 'CONNECTED' | 'REVOKED';

export interface StoreConnection {
  id: string;
  clientId: string;
  platform: StorePlatform;
  shopDomain: string;
  status: StoreConnectionStatus;
  hasAccessToken: boolean;
  hasWebhookSecret: boolean;
  scopes: string | null;
  installedAt: string | null;
  lastEventAt: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; legalName: string };
}

export interface ConnectStoreResult {
  id: string;
  shopDomain: string;
  authorizeUrl: string;
  webhookSecret?: string;
  simulated: boolean;
}
