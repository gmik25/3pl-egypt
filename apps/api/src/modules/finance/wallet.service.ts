import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletEntryType, type Prisma, type PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaClient;

export interface WalletPostInput {
  walletId: string;
  type: WalletEntryType;
  /** signed: credits positive, debits negative */
  amountPiastres: number;
  orderId?: string | null;
  remittanceId?: string | null;
  payoutId?: string | null;
  note?: string | null;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /** Find-or-create the wallet for a client. */
  async ensureWallet(clientId: string, tx: Tx = this.prisma): Promise<string> {
    const existing = await tx.clientWallet.findUnique({ where: { clientId }, select: { id: true } });
    if (existing) return existing.id;
    const created = await tx.clientWallet.create({ data: { clientId }, select: { id: true } });
    return created.id;
  }

  /** Append a ledger entry and move the running balance atomically. */
  async post(input: WalletPostInput, tx: Tx = this.prisma) {
    await tx.walletEntry.create({
      data: {
        walletId: input.walletId,
        type: input.type,
        amountPiastres: input.amountPiastres,
        orderId: input.orderId ?? null,
        remittanceId: input.remittanceId ?? null,
        payoutId: input.payoutId ?? null,
        note: input.note ?? null,
      },
    });
    await tx.clientWallet.update({
      where: { id: input.walletId },
      data: { balancePiastres: { increment: input.amountPiastres } },
    });
  }

  async getByClient(clientId: string) {
    const wallet = await this.prisma.clientWallet.findUnique({
      where: { clientId },
      include: { client: { select: { legalName: true } } },
    });
    if (!wallet) {
      // lazily expose a zero wallet so the UI doesn't 404 before any COD lands
      const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { legalName: true } });
      if (!client) throw new NotFoundException('Client not found');
      return { id: null, clientId, balancePiastres: 0, client };
    }
    return wallet;
  }

  /** Statement of account: ledger entries in a date range with opening/closing balances. */
  async statement(clientId: string, from?: Date, to?: Date) {
    const wallet = await this.prisma.clientWallet.findUnique({ where: { clientId } });
    if (!wallet) return { clientId, openingPiastres: 0, closingPiastres: 0, entries: [] };

    const before = await this.prisma.walletEntry.aggregate({
      _sum: { amountPiastres: true },
      where: { walletId: wallet.id, createdAt: from ? { lt: from } : undefined },
    });
    const opening = from ? (before._sum.amountPiastres ?? 0) : 0;

    const entries = await this.prisma.walletEntry.findMany({
      where: { walletId: wallet.id, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'asc' },
    });

    let running = opening;
    const withRunning = entries.map((e) => {
      running += e.amountPiastres;
      return { ...e, runningBalancePiastres: running };
    });

    return {
      clientId,
      openingPiastres: opening,
      closingPiastres: running,
      currentBalancePiastres: wallet.balancePiastres,
      entries: withRunning,
    };
  }
}
