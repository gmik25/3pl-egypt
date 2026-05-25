# 3PL Operations Management System — Egypt
> Place this file at the root of your project repo. Claude Code reads it automatically.

---

## Project Overview

You are building a **production-ready, end-to-end Third-Party Logistics (3PL) Operations Management System** for the Egyptian market. The operator is an Egyptian 3PL provider serving e-commerce sellers, FMCG brands, and importers across Egyptian governorates.

This is a large-scale, modular system. Build one module at a time. Always start with the **data schema → API layer → UI screens** sequence for each module.

---

## Egypt-Specific Rules (Always Apply)

- All monetary values stored and displayed in **EGP (Egyptian Pound)**
- **VAT at 14%** applied to all service fees (law 67/2016)
- **E-invoicing** must comply with Egyptian Tax Authority (ETA) portal format
- **Timezone:** `Africa/Cairo` for all dates and scheduling; offer Hijri calendar toggle
- **Address format:** Apartment / Floor / Building / Street / District / Governorate (no postcodes in rural areas; handle Arabic street names)
- **27 governorates** must be mappable for delivery zone logic
- **Language:** Arabic (RTL) as primary UI language; English toggle. Use `i18next` for all strings
- **Data residency:** Store data in Egypt where required; comply with Egyptian Personal Data Protection Law (PDPL)
- **Payment rails:** Instapay, Fawry, direct SWIFT bank transfer
- **SMS providers:** Vodafone Egypt API, Etisalat Egypt API
- **Customs:** Link to Egyptian Customs Authority (ECA) declaration numbers for import shipments

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Tailwind CSS (RTL-ready) |
| i18n | i18next (Arabic + English) |
| Backend | Node.js (Express) or Python (FastAPI) |
| Database | PostgreSQL (core) + Redis (cache/queue) |
| Auth | JWT + RBAC middleware; 2FA for Finance & Admin |
| Infra | AWS Bahrain (me-south-1) or Orange Egypt Business Cloud |
| Maps | Google Maps Egypt / OSRM for route optimisation |
| Courier APIs | Aramex Egypt, Bosta, R2S, Mylerz, J&T Egypt |
| E-commerce | Shopify, WooCommerce, Salla, Zid webhooks |

---

## Modules

### 1. Client & Contract Management
- KYC onboarding: commercial registration, tax card, national ID docs
- SLA definition per client (handling time, delivery windows, return rate thresholds)
- Pricing engine: per-unit storage, pick & pack, COD commission %, return fees
- Client self-service portal: shipment creation, invoices, reporting

### 2. Warehouse Management System (WMS)
- Multi-warehouse, multi-zone layout: Receiving → Storage → Packing → Dispatch
- SKU & barcode management (EAN-13, QR); Arabic product name support
- Inbound: PO creation, ASN, receiving inspection, putaway rules
- Outbound: wave picking, batch picking, Arabic/English packing slips
- Inventory: real-time stock, expiry tracking (FEFO), damage quarantine
- Cycle counting and full physical inventory
- Bin/rack/shelf location mapping

### 3. Order Management System (OMS)
- Order intake: API (Shopify/WooCommerce/Salla/Zid), CSV upload, manual entry
- Validation: fraud flagging, duplicate detection
- Smart routing: assign to nearest warehouse by stock level and governorate
- Lifecycle: `Pending → Picked → Packed → Dispatched → Delivered / Failed / Returned`
- COD order management with reconciliation workflow

### 4. Last-Mile Delivery & Fleet Management
- Courier integrations: Aramex Egypt, Bosta, R2S, Mylerz, J&T Egypt
- In-house fleet: driver assignment, route optimisation across governorates
- POD: photo capture, e-signature, OTP confirmation
- Failed delivery: re-attempt scheduling, Arabic SMS/WhatsApp notifications
- Governorate-level delivery zone mapping (all 27)

### 5. COD & Financial Reconciliation
- COD cash tracking per driver per day
- Remittance workflow: driver deposits → finance confirms → client credited
- EGP wallet per client; payout via Instapay / Fawry / SWIFT
- ETA-compliant e-invoice generation with 14% VAT line items
- Client statement of account

### 6. Returns Management (Reverse Logistics)
- Arabic-first end-customer return request portal
- Return reason codes: damaged, wrong item, customer refusal, change of mind
- Inspection workflow: resellable → back to stock; damaged → quarantine → disposal approval
- Automated credit note generation per return

### 7. Customs & Compliance (Importers)
- Import shipment tracking linked to ECA declaration numbers
- HS code management per SKU
- Landed cost calculator: duties + taxes in EGP
- Bonded warehouse zone support

### 8. Reporting & Analytics
- Ops KPIs: fulfilment rate, pick accuracy, on-time delivery %, COD collection rate
- Financial: revenue per client, storage utilisation, P&L per warehouse
- Courier performance scorecard
- Custom date-range reports; export to Excel / PDF
- All charts support Arabic labels

### 9. Notifications & Communications
- SMS (Vodafone Egypt / Etisalat API) and WhatsApp Business in Arabic
- Internal alerts: low stock, SLA breach, failed delivery spike
- Client daily/weekly email digest

### 10. Admin, Roles & Access Control
- Roles: Super Admin, Warehouse Manager, Picker, Driver, Finance, Client
- Governorate-scoped access for regional managers
- Full audit log with user, timestamp, action, and before/after values

---

## Development Rules

1. **Schema first.** Define the full ERD before writing any API or UI code for a module.
2. **API second.** RESTful endpoints with OpenAPI spec; webhook-ready for courier callbacks.
3. **UI third.** Mobile-responsive; warehouse floor screens must work on Android handheld scanners.
4. **Never hardcode Arabic strings.** All copy goes through i18next translation keys.
5. **Flag Egypt-specific edge cases** as inline `// EG:` comments in code (e.g. missing postcodes, Arabic address parsing, EGP decimal handling).
6. **Always validate EGP amounts** as integers in piastres (1 EGP = 100 piastres) to avoid float errors.
7. **COD is the dominant payment method** in Egypt — treat it as a first-class flow, not an edge case.

---

## Current Build Status

| Module | Schema | API | UI |
|---|---|---|---|
| Client & Contract | ✅ | ✅ | ✅ |
| WMS | ✅ | ✅ | ✅ |
| OMS | ✅ | ✅ | ✅ |
| Last-Mile & Fleet | ✅ | ✅ | ✅ |
| COD & Finance | ✅ | ✅ | ✅ |
| Returns | ✅ | ✅ | ✅ |
| Customs | ✅ | ✅ | ✅ |
| Reporting | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ |
| Admin & RBAC | ✅ | ✅ | ✅ |
| Integrations (carrier onboarding + store-connect) | ✅ | ✅ | ✅ |

> Integrations: data-driven `CourierAccount` onboarding (encrypted credentials, per-courier
> webhook HMAC) + OAuth store-connect for Shopify/Salla/Zid/WooCommerce (credentials-deferred,
> simulated token exchange in sandbox; inbound order webhooks resolved by domain + HMAC-verified)
> + ops & seller self-serve store management. Two-way sync: **inbound** — on connect we auto-register
> order webhooks on the platform + queue a historical **backfill** (BullMQ), then live orders arrive
> by HMAC-verified webhook → OMS; **outbound** — fulfillment/tracking push (us → store) on
> dispatch/delivery via BullMQ (retries + backoff), recorded per-shipment (`storeSyncStatus`).
> Shopify wired live, others stubbed; sandbox-simulated. Inbound HMAC accepts the platform app
> secret (live) or the per-store secret (sandbox/manual).

> Schema rows for Client & Contract and OMS are marked done because their Prisma models
> live in the shared `apps/api/prisma/schema.prisma`; their API + UI are still pending.

Update this table as modules are completed.
