import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import {
  AuditAction,
  CodLedgerType,
  RemittanceStatus,
  WalletEntryType,
} from '@prisma/client';
import { applyVat } from '@3pl/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WalletService } from './wallet.service';
import type { CreateRemittanceDto } from './dto/remittance-dtos';

@Injectable()
export class RemittanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  /** Delivered COD orders whose cash hasn't been remitted yet. */
  async eligibleOrders(driverId?: string) {
    const remitted = await this.prisma.remittanceItem.findMany({ select: { orderId: true } });
    const remittedIds = remitted.map((r) => r.orderId);
    return this.prisma.order.findMany({
      where: {
        state: 'DELIVERED',
        paymentMethod: 'COD',
        codAmountPiastres: { gt: 0 },
        id: { notIn: remittedIds.length ? remittedIds : undefined },
      },
      select: {
        id: true,
        reference: true,
        clientId: true,
        codAmountPiastres: true,
        customerName: true,
        governorate: true,
        client: { select: { legalName: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  list(status?: RemittanceStatus, driverId?: string) {
    return this.prisma.driverRemittance.findMany({
      where: { status, driverId },
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async getById(id: string) {
    const r = await this.prisma.driverRemittance.findUnique({
      where: { id },
      include: { driver: { select: { fullName: true } }, items: true },
    });
    if (!r) throw new NotFoundException('Remittance not found');
    return r;
  }

  async create(dto: CreateRemittanceDto, callerId: string) {
    const driverId = dto.driverId ?? callerId;
    const orders = await this.prisma.order.findMany({
      where: { id: { in: dto.orderIds }, state: 'DELIVERED', paymentMethod: 'COD' },
      select: { id: true, clientId: true, codAmountPiastres: true },
    });
    if (orders.length !== dto.orderIds.length) {
      throw new BadRequestException('Some orders are not delivered COD orders');
    }
    // Reject any already-remitted order (RemittanceItem.orderId is unique)
    const already = await this.prisma.remittanceItem.findMany({
      where: { orderId: { in: dto.orderIds } },
      select: { orderId: true },
    });
    if (already.length) {
      throw new BadRequestException(`Already remitted: ${already.map((a) => a.orderId).join(', ')}`);
    }

    const remittance = await this.prisma.driverRemittance.create({
      data: {
        reference: `RMT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        driverId,
        declaredAmountPiastres: dto.declaredAmountPiastres,
        note: dto.note ?? null,
        items: {
          create: orders.map((o) => ({
            orderId: o.id,
            clientId: o.clientId,
            codAmountPiastres: o.codAmountPiastres ?? 0,
          })),
        },
      },
      include: { items: true },
    });
    await this.audit.record({ userId: callerId, action: AuditAction.CREATE, entity: 'remittance', entityId: remittance.id, after: { reference: remittance.reference, orders: orders.length } });
    return remittance;
  }

  /**
   * Finance confirms: marks each order's COD as REMITTED, credits each client's wallet with the
   * gross COD, and debits the 3PL commission (incl. 14% VAT) per the client's active contract.
   */
  async confirm(id: string, confirmedById: string) {
    const remittance = await this.prisma.driverRemittance.findUnique({ where: { id }, include: { items: true } });
    if (!remittance) throw new NotFoundException('Remittance not found');
    if (remittance.status !== RemittanceStatus.PENDING) {
      throw new BadRequestException(`Remittance is ${remittance.status}`);
    }
    const vatBps = this.config.get<number>('vatRateBps', 1400);

    const result = await this.prisma.$transaction(async (tx) => {
      let confirmedTotal = 0;
      for (const item of remittance.items) {
        confirmedTotal += item.codAmountPiastres;

        // COD now remitted by the driver
        await tx.codLedgerEntry.create({
          data: { orderId: item.orderId, type: CodLedgerType.REMITTED, amountPiastres: item.codAmountPiastres, actorId: confirmedById, note: `Remittance ${remittance.reference}` },
        });

        // Commission per the client's active contract
        const contract = await tx.contract.findFirst({
          where: { clientId: item.clientId, isActive: true },
          orderBy: { startsOn: 'desc' },
          select: { codCommissionBps: true },
        });
        const bps = contract?.codCommissionBps ?? 0;
        const commissionNet = Math.round((item.codAmountPiastres * bps) / 10_000);
        const { vat: commissionVat, gross: commissionGross } = applyVat(commissionNet, vatBps);

        const walletId = await this.wallet.ensureWallet(item.clientId, tx);
        await this.wallet.post(
          { walletId, type: WalletEntryType.COD_CREDIT, amountPiastres: item.codAmountPiastres, orderId: item.orderId, remittanceId: id, note: 'COD collected' },
          tx,
        );
        if (commissionGross > 0) {
          await this.wallet.post(
            { walletId, type: WalletEntryType.COMMISSION_FEE, amountPiastres: -commissionGross, orderId: item.orderId, remittanceId: id, note: `Commission ${(bps / 100).toFixed(2)}% + VAT ${commissionVat}` },
            tx,
          );
        }
      }

      return tx.driverRemittance.update({
        where: { id },
        data: {
          status: RemittanceStatus.CONFIRMED,
          confirmedAmountPiastres: confirmedTotal,
          confirmedById,
          confirmedAt: new Date(),
        },
      });
    });

    await this.audit.record({ userId: confirmedById, action: AuditAction.UPDATE, entity: 'remittance', entityId: id, after: { status: 'CONFIRMED', confirmedAmountPiastres: result.confirmedAmountPiastres } });
    return result;
  }

  async reject(id: string, note: string | undefined, actorId: string) {
    const remittance = await this.prisma.driverRemittance.findUnique({ where: { id } });
    if (!remittance) throw new NotFoundException('Remittance not found');
    if (remittance.status !== RemittanceStatus.PENDING) {
      throw new BadRequestException(`Remittance is ${remittance.status}`);
    }
    // Release the items so the orders can be remitted again.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.remittanceItem.deleteMany({ where: { remittanceId: id } });
      return tx.driverRemittance.update({ where: { id }, data: { status: RemittanceStatus.REJECTED, note: note ?? remittance.note } });
    });
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'remittance', entityId: id, after: { status: 'REJECTED' } });
    return updated;
  }

  /** COD collected per driver per day (from the COLLECTED ledger). */
  async codByDriverPerDay(from?: Date, to?: Date) {
    const entries = await this.prisma.codLedgerEntry.findMany({
      where: { type: CodLedgerType.COLLECTED, createdAt: { gte: from, lte: to } },
      select: { actorId: true, amountPiastres: true, createdAt: true },
    });
    const map = new Map<string, { driverId: string; day: string; totalPiastres: number; count: number }>();
    for (const e of entries) {
      const day = e.createdAt.toISOString().slice(0, 10);
      const key = `${e.actorId ?? 'system'}|${day}`;
      const row = map.get(key) ?? { driverId: e.actorId ?? 'system', day, totalPiastres: 0, count: 0 };
      row.totalPiastres += e.amountPiastres;
      row.count += 1;
      map.set(key, row);
    }
    const rows = [...map.values()];
    // attach driver names
    const driverIds = [...new Set(rows.map((r) => r.driverId).filter((d) => d !== 'system'))];
    const drivers = await this.prisma.user.findMany({ where: { id: { in: driverIds } }, select: { id: true, fullName: true } });
    const nameById = new Map(drivers.map((d) => [d.id, d.fullName]));
    return rows
      .map((r) => ({ ...r, driverName: nameById.get(r.driverId) ?? r.driverId }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));
  }
}
