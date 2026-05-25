// 3PL Egypt — DB seed.
// Idempotent: safe to re-run; uses upsert keyed on stable identifiers.
// Run: pnpm db:seed

import { PrismaClient, UserRoleName, GovernorateCode } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ROLE_DESCRIPTIONS: Record<UserRoleName, string> = {
  SUPER_ADMIN:        'Full system access. Required to enrol in TOTP 2FA.',
  WAREHOUSE_MANAGER:  'Manages warehouse operations, staff, inventory at one or more sites.',
  PICKER:             'Warehouse-floor pick/pack execution. Handheld scanner UI.',
  DRIVER:             'Last-mile driver. POD capture, COD collection, route execution.',
  FINANCE:            'COD reconciliation, payouts, invoicing. Required to enrol in TOTP 2FA.',
  CLIENT:             'Self-service portal access scoped to one client.',
};

const PERMISSIONS: { key: string; description: string; roles: UserRoleName[] }[] = [
  // user/RBAC
  { key: 'users.read',          description: 'View user list',                roles: ['SUPER_ADMIN'] },
  { key: 'users.write',         description: 'Create/edit users + roles',     roles: ['SUPER_ADMIN'] },
  { key: 'audit.read',          description: 'View audit log',                roles: ['SUPER_ADMIN', 'FINANCE'] },
  // clients
  { key: 'clients.read',        description: 'View clients',                  roles: ['SUPER_ADMIN', 'FINANCE', 'WAREHOUSE_MANAGER'] },
  { key: 'clients.write',       description: 'Create/edit clients',           roles: ['SUPER_ADMIN', 'FINANCE'] },
  { key: 'contracts.read',      description: 'View contracts + pricing',      roles: ['SUPER_ADMIN', 'FINANCE', 'CLIENT'] },
  { key: 'contracts.write',     description: 'Create/edit contracts',         roles: ['SUPER_ADMIN', 'FINANCE'] },
  // orders
  { key: 'orders.read',         description: 'View orders',                   roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'PICKER', 'DRIVER', 'FINANCE', 'CLIENT'] },
  { key: 'orders.write',        description: 'Create/edit orders',            roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'CLIENT'] },
  { key: 'orders.transition',   description: 'Move orders through states',    roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'PICKER', 'DRIVER'] },
  // WMS — catalog, locations, inventory, inbound
  { key: 'catalog.read',        description: 'View SKUs',                     roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'PICKER', 'FINANCE', 'CLIENT'] },
  { key: 'catalog.write',       description: 'Create/edit SKUs',              roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
  { key: 'warehouse.read',      description: 'View warehouses/zones/locations', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'PICKER'] },
  { key: 'warehouse.write',     description: 'Manage warehouses/zones/locations', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
  { key: 'inventory.read',      description: 'View stock + movements',        roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'PICKER', 'FINANCE'] },
  { key: 'inventory.write',     description: 'Receive, putaway, adjust, count', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'PICKER'] },
  // COD & Finance
  { key: 'finance.read',        description: 'View wallets, remittances, payouts, invoices', roles: ['SUPER_ADMIN', 'FINANCE'] },
  { key: 'finance.write',       description: 'Confirm remittances, issue payouts + invoices',  roles: ['SUPER_ADMIN', 'FINANCE'] },
  { key: 'remittance.submit',   description: 'Submit a driver COD remittance',  roles: ['SUPER_ADMIN', 'DRIVER'] },
  { key: 'wallet.read.own',     description: 'View own wallet + statement (client portal)', roles: ['CLIENT'] },
  // Last-Mile & Fleet
  { key: 'fleet.read',          description: 'View shipments + drivers',        roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'DRIVER', 'FINANCE'] },
  { key: 'fleet.write',         description: 'Create shipments, assign carriers, manage drivers', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
  { key: 'delivery.execute',    description: 'Mark out-for-delivery, record attempts, capture POD', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'DRIVER'] },
  // Returns (reverse logistics)
  { key: 'returns.read',        description: 'View return requests',            roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE'] },
  { key: 'returns.write',       description: 'Process returns: approve, inspect, dispose, credit note', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
  // Customs & Compliance
  { key: 'customs.read',        description: 'View HS codes + import shipments', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE'] },
  { key: 'customs.write',       description: 'Manage HS codes + import shipments, clear/release', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
  // Reporting & Analytics
  { key: 'reports.read',        description: 'View reports + analytics',        roles: ['SUPER_ADMIN', 'FINANCE', 'WAREHOUSE_MANAGER'] },
  // Notifications & Communications
  { key: 'notifications.read',  description: 'View notification feed + alerts',  roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'FINANCE'] },
  { key: 'notifications.send',  description: 'Send messages, run alert checks, digests', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
  // Integrations (carrier onboarding + store-connect)
  { key: 'integrations.read',   description: 'View courier + store integrations', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
  { key: 'integrations.write',  description: 'Onboard couriers + manage store connections', roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
];

async function main() {
  // ---- Roles ----
  for (const name of Object.values(UserRoleName)) {
    await prisma.role.upsert({
      where: { name },
      update: { description: ROLE_DESCRIPTIONS[name] },
      create: { name, description: ROLE_DESCRIPTIONS[name] },
    });
  }
  console.log(`✓ Seeded ${Object.values(UserRoleName).length} roles`);

  // ---- Permissions + RolePermission mapping ----
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description },
    });
    for (const roleName of p.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }
  console.log(`✓ Seeded ${PERMISSIONS.length} permissions`);

  // ---- Warehouses (OMS needs at least one to route orders to) ----
  // EG: a Greater Cairo hub + an Alexandria hub cover the two biggest demand centres.
  const warehouses = [
    { code: 'CAI-1', name: 'Greater Cairo Hub', governorate: 'C' as const },
    { code: 'ALX-1', name: 'Alexandria Hub', governorate: 'ALX' as const },
  ];
  for (const w of warehouses) {
    const wh = await prisma.warehouse.upsert({
      where: { code: w.code },
      update: { name: w.name, governorate: w.governorate },
      create: w,
    });
    // Each warehouse gets the 4 standard zones; STORAGE gets a few starter bins.
    const zoneDefs = [
      { type: 'RECEIVING' as const, code: 'RCV', name: 'Receiving', bins: 1 },
      { type: 'STORAGE' as const, code: 'STG', name: 'Storage', bins: 6 },
      { type: 'PACKING' as const, code: 'PCK', name: 'Packing', bins: 1 },
      { type: 'DISPATCH' as const, code: 'DSP', name: 'Dispatch', bins: 1 },
    ];
    for (const z of zoneDefs) {
      const zone = await prisma.zone.upsert({
        where: { warehouseId_code: { warehouseId: wh.id, code: z.code } },
        update: { name: z.name, type: z.type },
        create: { warehouseId: wh.id, code: z.code, name: z.name, type: z.type },
      });
      for (let i = 1; i <= z.bins; i++) {
        const code = `${z.code}-${String(i).padStart(2, '0')}`;
        await prisma.location.upsert({
          where: { warehouseId_code: { warehouseId: wh.id, code } },
          update: {},
          create: {
            warehouseId: wh.id,
            zoneId: zone.id,
            code,
            type: z.type === 'STORAGE' ? 'BIN' : 'FLOOR',
            barcode: `${wh.code}-${code}`,
          },
        });
      }
    }
  }
  console.log(`✓ Seeded ${warehouses.length} warehouses with zones + locations`);

  // ---- Courier accounts (data-driven; credentials added later via onboarding) ----
  const builtInCouriers = [
    { code: 'ARAMEX', name: 'Aramex Egypt' },
    { code: 'BOSTA', name: 'Bosta' },
    { code: 'R2S', name: 'R2S' },
    { code: 'MYLERZ', name: 'Mylerz' },
    { code: 'JT', name: 'J&T Express Egypt' },
  ];
  const courierAccounts = [];
  for (const c of builtInCouriers) {
    courierAccounts.push(await prisma.courierAccount.upsert({ where: { code: c.code }, update: { name: c.name }, create: c }));
  }
  console.log(`✓ Seeded ${courierAccounts.length} courier accounts`);

  // ---- Courier coverage (every courier serves all 27 governorates) ----
  // EG: Greater Cairo / Alexandria get a 2-day ETA; the rest 4 days. Tune per real SLAs.
  const fastGovs: GovernorateCode[] = [GovernorateCode.C, GovernorateCode.GZ, GovernorateCode.ALX, GovernorateCode.KB];
  let coverageCount = 0;
  for (const account of courierAccounts) {
    for (const governorate of Object.values(GovernorateCode)) {
      await prisma.courierCoverage.upsert({
        where: { courierId_governorate: { courierId: account.id, governorate } },
        update: {},
        create: { courierId: account.id, governorate, etaDays: fastGovs.includes(governorate) ? 2 : 4 },
      });
      coverageCount++;
    }
  }
  console.log(`✓ Seeded ${coverageCount} courier-coverage rows`);

  // ---- HS code tariff reference (sample rates; replace with the real ECA tariff schedule) ----
  const hsCodes = [
    { code: '6109.10', description: 'T-shirts, cotton', dutyRateBps: 3000 },
    { code: '8517.12', description: 'Mobile phones', dutyRateBps: 0 },
    { code: '3304.99', description: 'Cosmetics / skincare', dutyRateBps: 4000 },
    { code: '9503.00', description: 'Toys', dutyRateBps: 2000 },
    { code: '2106.90', description: 'Food preparations', dutyRateBps: 500 },
  ];
  for (const h of hsCodes) {
    await prisma.hsCode.upsert({ where: { code: h.code }, update: { description: h.description, dutyRateBps: h.dutyRateBps }, create: h });
  }
  console.log(`✓ Seeded ${hsCodes.length} HS codes`);

  // ---- Bootstrap super admin (dev only) ----
  // EG: in production, swap this for a one-time provisioning command behind 2FA.
  const adminEmail = 'admin@3pl-egypt.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await argon2.hash('ChangeMe!2026', { type: argon2.argon2id });
    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: 'Initial Super Admin',
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: superAdminRole.id },
    });
    console.log(`✓ Created bootstrap super admin: ${adminEmail} / ChangeMe!2026 (rotate immediately)`);
  } else {
    console.log(`• Super admin already exists: ${adminEmail}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
