import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationStatus,
  SmsProvider,
  type GovernorateCode,
} from '@prisma/client';
import * as crypto from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../wms/inventory/inventory.service';

export interface SendInput {
  channel: NotificationChannel;
  category?: NotificationCategory;
  recipient: string;
  body: string;
  subject?: string;
  locale?: string;
  provider?: SmsProvider;
  relatedEntity?: string;
  relatedId?: string;
}

// EG: SLA thresholds for breach detection (mirror Reporting); Greater Cairo + Alexandria 2 days.
const FAST_GOVS: GovernorateCode[] = ['C', 'GZ', 'ALX', 'KB'] as GovernorateCode[];
const DAY_MS = 86_400_000;
const SPIKE_THRESHOLD = 5; // failed/returned shipments in 24h

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * Send a message. EG: dispatch is stubbed per channel/provider — swap in real
   * Vodafone/Etisalat SMS, WhatsApp Business, and email/SMTP clients (credentials
   * from the secret manager). Every attempt is logged as a Notification.
   */
  async send(input: SendInput) {
    const created = await this.prisma.notification.create({
      data: {
        channel: input.channel,
        category: input.category ?? NotificationCategory.OTHER,
        recipient: input.recipient,
        locale: input.locale ?? 'ar',
        subject: input.subject ?? null,
        body: input.body,
        provider: input.provider ?? (input.channel === NotificationChannel.SMS ? SmsProvider.VODAFONE : null),
        relatedEntity: input.relatedEntity ?? null,
        relatedId: input.relatedId ?? null,
      },
    });

    try {
      const providerRef = this.dispatch(created.channel, created.provider, created.recipient, created.body);
      return await this.prisma.notification.update({
        where: { id: created.id },
        data: { status: NotificationStatus.SENT, providerRef, sentAt: new Date() },
      });
    } catch (e) {
      return this.prisma.notification.update({
        where: { id: created.id },
        data: { status: NotificationStatus.FAILED, error: e instanceof Error ? e.message : 'send failed' },
      });
    }
  }

  /** Stubbed channel dispatch — returns a provider message reference. */
  private dispatch(channel: NotificationChannel, provider: SmsProvider | null, recipient: string, body: string): string {
    const tag = channel === NotificationChannel.SMS ? (provider ?? 'SMS') : channel;
    // TODO(integration): real provider HTTP calls here.
    this.logger.log(`[${tag}→${this.mask(recipient)}] ${body.slice(0, 80)}`);
    return `${tag}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private mask(r: string) {
    if (r.includes('@')) { const [u, d] = r.split('@'); return `${u.slice(0, 2)}***@${d}`; }
    return r.length > 5 ? `${r.slice(0, 4)}****${r.slice(-3)}` : '***';
  }

  list(filters: { channel?: NotificationChannel; category?: NotificationCategory; status?: NotificationStatus }) {
    return this.prisma.notification.findMany({
      where: { channel: filters.channel, category: filters.category, status: filters.status },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ---- Internal operational alerts ----

  async runAlertChecks() {
    const created: { category: string; count: number }[] = [];

    // 1) Low stock
    const low = await this.inventory.lowStock();
    if (low.length > 0) {
      await this.send({
        channel: NotificationChannel.INTERNAL,
        category: NotificationCategory.LOW_STOCK,
        recipient: 'warehouse-managers',
        subject: 'تنبيه: مخزون منخفض',
        body: `يوجد ${low.length} صنف عند أو تحت حد إعادة الطلب: ${low.slice(0, 5).map((l) => l.code).join('، ')}${low.length > 5 ? '…' : ''}`,
      });
      created.push({ category: 'LOW_STOCK', count: low.length });
    }

    // 2) SLA breach — open orders past their delivery window
    const open = await this.prisma.order.findMany({
      where: { state: { in: ['PENDING', 'PICKED', 'PACKED', 'DISPATCHED'] } },
      select: { reference: true, governorate: true, createdAt: true },
      take: 2000,
    });
    const now = Date.now();
    const breached = open.filter((o) => {
      const slaDays = FAST_GOVS.includes(o.governorate) ? 2 : 4;
      return now - o.createdAt.getTime() > slaDays * DAY_MS;
    });
    if (breached.length > 0) {
      await this.send({
        channel: NotificationChannel.INTERNAL,
        category: NotificationCategory.SLA_BREACH,
        recipient: 'ops',
        subject: 'تنبيه: تجاوز اتفاقية مستوى الخدمة',
        body: `${breached.length} طلب تجاوز نافذة التسليم: ${breached.slice(0, 5).map((o) => o.reference).join('، ')}${breached.length > 5 ? '…' : ''}`,
      });
      created.push({ category: 'SLA_BREACH', count: breached.length });
    }

    // 3) Failed-delivery spike in the last 24h
    const since = new Date(now - DAY_MS);
    const failed = await this.prisma.shipment.count({ where: { status: { in: ['FAILED', 'RETURNED'] }, updatedAt: { gte: since } } });
    if (failed >= SPIKE_THRESHOLD) {
      await this.send({
        channel: NotificationChannel.INTERNAL,
        category: NotificationCategory.FAILED_DELIVERY_SPIKE,
        recipient: 'ops',
        subject: 'تنبيه: ارتفاع فشل التسليم',
        body: `${failed} شحنة فشلت أو أُرجعت خلال 24 ساعة.`,
      });
      created.push({ category: 'FAILED_DELIVERY_SPIKE', count: failed });
    }

    return { alertsCreated: created.length, details: created };
  }

  /** Client daily/weekly digest — order + COD summary over a window. */
  async generateClientDigest(clientId: string, days = 7) {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { legalName: true, contactEmail: true } });
    const since = new Date(Date.now() - days * DAY_MS);
    const where = { clientId, createdAt: { gte: since } };
    const [total, delivered, codAgg] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: { ...where, state: 'DELIVERED' } }),
      this.prisma.order.aggregate({ _sum: { codAmountPiastres: true }, where: { ...where, paymentMethod: 'COD' } }),
    ]);
    const codEgp = ((codAgg._sum.codAmountPiastres ?? 0) / 100).toFixed(2);
    const body = `ملخص آخر ${days} أيام — ${client.legalName}\nالطلبات: ${total}\nتم التسليم: ${delivered}\nإجمالي الدفع عند الاستلام: ${codEgp} ج.م`;
    return this.send({
      channel: NotificationChannel.EMAIL,
      category: NotificationCategory.DIGEST,
      recipient: client.contactEmail,
      subject: `ملخص حسابك — ${client.legalName}`,
      body,
      relatedEntity: 'client',
      relatedId: clientId,
    });
  }
}
