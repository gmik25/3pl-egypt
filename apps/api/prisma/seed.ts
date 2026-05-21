// 3PL Egypt — DB seed.
// Idempotent: safe to re-run; uses upsert keyed on stable identifiers.
// Run: pnpm db:seed

import { PrismaClient, UserRoleName } from '@prisma/client';
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
    await prisma.warehouse.upsert({
      where: { code: w.code },
      update: { name: w.name, governorate: w.governorate },
      create: w,
    });
  }
  console.log(`✓ Seeded ${warehouses.length} warehouses`);

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
