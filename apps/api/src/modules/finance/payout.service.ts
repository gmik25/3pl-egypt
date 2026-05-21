import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { AuditAction, PayoutStatus, WalletEntryType, type PayoutRail } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WalletService } from './wallet.service';

@Injectable()
export class PayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wallet: WalletService,
  ) {}

  list(clientId?: string, status?: PayoutStatus) {
    return this.prisma.payout.findMany({
      where: { clientId, status },
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { legalName: true } } },
    });
  }

  /** Create a payout, reserving the funds by debiting the wallet immediately. */
  async create(clientId: string, amountPiastres: number, rail: PayoutRail, externalRef: string | undefined, createdById: string) {
    return this.prisma.$transaction(async (tx) => {
      const walletId = await this.wallet.ensureWallet(clientId, tx);
      const wallet = await tx.clientWallet.findUniqueOrThrow({ where: { id: walletId } });
      if (wallet.balancePiastres < amountPiastres) {
        throw new BadRequestException('Insufficient wallet balance for payout');
      }
      const payout = await tx.payout.create({
        data: {
          reference: `PAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          clientId,
          walletId,
          amountPiastres,
          rail,
          externalRef: externalRef ?? null,
          createdById,
        },
      });
      await this.wallet.post(
        { walletId, type: WalletEntryType.PAYOUT, amountPiastres: -amountPiastres, payoutId: payout.id, note: `Payout via ${rail}` },
        tx,
      );
      await this.audit.record({ userId: createdById, action: AuditAction.CREATE, entity: 'payout', entityId: payout.id, after: { amountPiastres, rail } });
      return payout;
    });
  }

  async markPaid(id: string, externalRef: string | undefined, actorId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== PayoutStatus.PENDING) throw new BadRequestException(`Payout is ${payout.status}`);
    const updated = await this.prisma.payout.update({
      where: { id },
      data: { status: PayoutStatus.PAID, paidAt: new Date(), externalRef: externalRef ?? payout.externalRef },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'payout', entityId: id, after: { status: 'PAID' } });
    return updated;
  }

  /** Mark failed and refund the reserved amount back to the wallet. */
  async markFailed(id: string, actorId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== PayoutStatus.PENDING) throw new BadRequestException(`Payout is ${payout.status}`);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.wallet.post(
        { walletId: payout.walletId, type: WalletEntryType.ADJUSTMENT, amountPiastres: payout.amountPiastres, payoutId: id, note: 'Payout failed — refund' },
        tx,
      );
      return tx.payout.update({ where: { id }, data: { status: PayoutStatus.FAILED } });
    });
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'payout', entityId: id, after: { status: 'FAILED' } });
    return updated;
  }
}
