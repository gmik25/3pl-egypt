import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, WalletEntryType } from '@prisma/client';
import { applyVat } from '@3pl/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WalletService } from './wallet.service';

const DAY_MS = 86_400_000;

export interface StorageBillingPreview {
  clientId: string;
  reservedBins: number;
  ratePerBinPerDayPiastres: number;
  days: number;
  periodStart: string;
  periodEnd: string;
  netPiastres: number;
  vatPiastres: number;
  grossPiastres: number;
  // utilisation context (capacity drives this, not the charge)
  reservedCapacity: number;
  storedUnits: number;
}

/**
 * Dedicated-storage billing. Basis = flat rate per reserved bin per day:
 *   charge = (bins allocated to the seller) × contract.storagePerBinPerDayPiastres × days.
 * EG: bin capacity informs the utilisation context only; the charge follows reserved bins.
 */
@Injectable()
export class StorageBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  private dayCount(start: Date, end: Date): number {
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  }

  async preview(clientId: string, periodStartIso: string, periodEndIso: string): Promise<StorageBillingPreview> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) throw new NotFoundException('Client not found');

    const start = new Date(periodStartIso);
    const end = new Date(periodEndIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('Invalid billing period');
    }

    const contract = await this.prisma.contract.findFirst({
      where: { clientId, isActive: true },
      orderBy: { startsOn: 'desc' },
      select: { storagePerBinPerDayPiastres: true },
    });
    const rate = contract?.storagePerBinPerDayPiastres ?? 0;

    const reservedBins = await this.prisma.location.count({ where: { allocatedClientId: clientId, isActive: true } });
    const capacityAgg = await this.prisma.location.aggregate({ _sum: { capacityUnits: true }, where: { allocatedClientId: clientId, isActive: true } });
    const storedAgg = await this.prisma.stockLevel.aggregate({ _sum: { quantity: true }, where: { location: { allocatedClientId: clientId } } });

    const days = this.dayCount(start, end);
    const net = reservedBins * rate * days;
    const vatBps = this.config.get<number>('vatRateBps', 1400);
    const { vat, gross } = applyVat(net, vatBps);

    return {
      clientId,
      reservedBins,
      ratePerBinPerDayPiastres: rate,
      days,
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
      netPiastres: net,
      vatPiastres: vat,
      grossPiastres: gross,
      reservedCapacity: capacityAgg._sum.capacityUnits ?? 0,
      storedUnits: storedAgg._sum.quantity ?? 0,
    };
  }

  /** Post the storage charge to the client's wallet (gross, VAT-inclusive debit) → flows into the next invoice. */
  async charge(clientId: string, periodStartIso: string, periodEndIso: string, actorId: string | null) {
    const preview = await this.preview(clientId, periodStartIso, periodEndIso);
    if (preview.grossPiastres <= 0) {
      throw new BadRequestException('Nothing to charge — no reserved bins or a zero per-bin rate');
    }
    const walletId = await this.wallet.ensureWallet(clientId);
    await this.wallet.post({
      walletId,
      type: WalletEntryType.STORAGE_FEE,
      amountPiastres: -preview.grossPiastres,
      note: `Storage ${preview.reservedBins} bins × ${preview.days}d (${periodStartIso.slice(0, 10)} → ${periodEndIso.slice(0, 10)})`,
    });
    await this.audit.record({ userId: actorId, action: AuditAction.CREATE, entity: 'storageFee', entityId: clientId, after: { bins: preview.reservedBins, days: preview.days, gross: preview.grossPiastres } });
    return { ...preview, posted: true };
  }
}
