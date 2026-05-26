import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { AuditAction, InvoiceStatus, WalletEntryType } from '@prisma/client';
import { extractVat, piastresToEgp } from '@3pl/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  list(clientId?: string, status?: InvoiceStatus) {
    return this.prisma.invoice.findMany({
      where: { clientId, status },
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { legalName: true } }, _count: { select: { lines: true } } },
    });
  }

  async getById(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true, lines: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  /**
   * Generate a draft invoice for the 3PL service fees (COD commission) charged to a client
   * in a period. EG: commission is VAT-inclusive in the wallet ledger, so we back out the
   * 14% VAT to produce ETA-compliant net + tax line items.
   */
  async generate(clientId: string, periodStartIso: string, periodEndIso: string, actorId: string | null) {
    const periodStart = new Date(periodStartIso);
    const periodEnd = new Date(periodEndIso);
    const vatBps = this.config.get<number>('vatRateBps', 1400);

    const wallet = await this.prisma.clientWallet.findUnique({ where: { clientId } });
    if (!wallet) throw new BadRequestException('Client has no wallet activity to invoice');

    const period = { gte: periodStart, lte: periodEnd };
    const sumFee = async (type: WalletEntryType) => {
      const agg = await this.prisma.walletEntry.aggregate({ _sum: { amountPiastres: true }, where: { walletId: wallet.id, type, createdAt: period } });
      return Math.abs(agg._sum.amountPiastres ?? 0); // fees are stored as gross (VAT-inclusive) debits
    };
    const grossCommission = await sumFee(WalletEntryType.COMMISSION_FEE);
    const grossStorage = await sumFee(WalletEntryType.STORAGE_FEE);
    if (grossCommission + grossStorage === 0) throw new BadRequestException('No billable fees in this period');

    const period10 = `${periodStartIso.slice(0, 10)} → ${periodEndIso.slice(0, 10)}`;
    const lines: { description: string; gross: number }[] = [];
    if (grossCommission > 0) lines.push({ description: `COD commission & handling — ${period10}`, gross: grossCommission });
    if (grossStorage > 0) lines.push({ description: `Dedicated storage — ${period10}`, gross: grossStorage });

    let netTotal = 0;
    let vatTotal = 0;
    let grossTotal = 0;
    const lineData = lines.map((l) => {
      const { net, vat, gross } = extractVat(l.gross, vatBps);
      netTotal += net;
      vatTotal += vat;
      grossTotal += gross;
      return { description: l.description, quantity: 1, unitNetPiastres: net, netPiastres: net, vatPiastres: vat, grossPiastres: gross };
    });

    const invoice = await this.prisma.invoice.create({
      data: {
        reference: `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        clientId,
        periodStart,
        periodEnd,
        netPiastres: netTotal,
        vatPiastres: vatTotal,
        grossPiastres: grossTotal,
        lines: { create: lineData },
      },
      include: { lines: true },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.CREATE, entity: 'invoice', entityId: invoice.id, after: { reference: invoice.reference, gross: grossTotal } });
    return invoice;
  }

  async issue(id: string, actorId: string | null) {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status !== InvoiceStatus.DRAFT) throw new BadRequestException(`Invoice is ${inv.status}`);
    // EG: real ETA submission signs + posts to the Egyptian Tax Authority portal and returns a
    // UUID. That integration is out of scope here — we mint a placeholder UUID to model the field.
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.ISSUED, issuedAt: new Date(), etaUuid: crypto.randomUUID() },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'invoice', entityId: id, after: { status: 'ISSUED', etaUuid: updated.etaUuid } });
    return updated;
  }

  /** ETA-shaped document representation (not a signed/submitted portal document). */
  async etaDocument(id: string) {
    const inv = await this.getById(id);
    const vatRatePct = this.config.get<number>('vatRateBps', 1400) / 100;
    return {
      documentType: 'I',
      documentTypeVersion: '1.0',
      // EG: placeholder issuer — replace with the operator's real ETA registration before go-live.
      issuer: {
        type: 'B',
        name: '3PL Egypt Operations',
        taxNumber: '000000000',
      },
      receiver: {
        type: 'B',
        name: inv.client.legalName,
        taxNumber: inv.client.taxId ?? 'UNREGISTERED',
      },
      reference: inv.reference,
      etaUuid: inv.etaUuid,
      dateTimeIssued: (inv.issuedAt ?? inv.createdAt).toISOString(),
      taxpayerActivityCode: '5229', // logistics support
      invoiceLines: inv.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitValue: { currencySold: 'EGP', amountEGP: Number(piastresToEgp(l.unitNetPiastres)) },
        salesTotal: Number(piastresToEgp(l.netPiastres)),
        netTotal: Number(piastresToEgp(l.netPiastres)),
        taxableItems: [
          {
            taxType: 'T1', // value-added tax
            amount: Number(piastresToEgp(l.vatPiastres)),
            rate: vatRatePct,
          },
        ],
        total: Number(piastresToEgp(l.grossPiastres)),
      })),
      totalSalesAmount: Number(piastresToEgp(inv.netPiastres)),
      totalAmount: Number(piastresToEgp(inv.grossPiastres)),
      taxTotals: [{ taxType: 'T1', amount: Number(piastresToEgp(inv.vatPiastres)) }],
    };
  }
}
