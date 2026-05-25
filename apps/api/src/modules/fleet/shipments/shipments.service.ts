import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  AuditAction,
  CarrierType,
  DeliveryFailureReason,
  PodMethod,
  ShipmentStatus,
  type GovernorateCode,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { OrdersService } from '../../orders/orders.service';
import { NotificationsService } from '../../notifications/notifications.service';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';
import { createCourierShipment, mapCourierStatus } from './courier-adapters';
import { decryptSecret, hmacSha256Base64, safeEqual } from '../../../common/crypto/secret-box';
import type { CreateShipmentDto } from './dto/shipment-dtos';

const MAX_ATTEMPTS = 3;
const POD_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'pod');

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  // EG: Arabic WhatsApp/SMS to the customer on delivery events. Fire-and-forget so a
  // notification failure never blocks the delivery flow.
  private notify(phone: string, message: string) {
    void this.notifications
      .send({ channel: 'WHATSAPP', category: 'DELIVERY', recipient: phone, body: message })
      .catch((e) => this.logger.warn(`notify failed: ${e instanceof Error ? e.message : e}`));
  }
  private maskPhone(phone: string) {
    return phone.length > 5 ? `${phone.slice(0, 4)}****${phone.slice(-3)}` : '***';
  }

  list(filters: { status?: ShipmentStatus; governorate?: GovernorateCode; carrierType?: CarrierType; driverId?: string }) {
    return this.prisma.shipment.findMany({
      where: { status: filters.status, governorate: filters.governorate, carrierType: filters.carrierType, driverId: filters.driverId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { reference: true, customerName: true, customerPhone: true, codAmountPiastres: true, paymentMethod: true } },
        driver: { select: { fullName: true } },
        courierAccount: { select: { code: true, name: true } },
        _count: { select: { attempts: true } },
      },
      take: 200,
    });
  }

  async getById(id: string) {
    const s = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        order: { select: { reference: true, customerName: true, customerPhone: true, codAmountPiastres: true, paymentMethod: true, governorate: true } },
        driver: { select: { id: true, fullName: true } },
        courierAccount: { select: { code: true, name: true } },
        attempts: { orderBy: { createdAt: 'asc' } },
        pod: true,
      },
    });
    if (!s) throw new NotFoundException('Shipment not found');
    return s;
  }

  async create(dto: CreateShipmentDto, actor: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId }, include: { shipment: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.shipment) throw new BadRequestException('Order already has a shipment');
    // EG: dispatch happens once the order is packed.
    if (order.state !== 'PACKED') {
      throw new BadRequestException(`Order must be PACKED to dispatch (currently ${order.state})`);
    }

    let courierId: string | null = null;
    let driverId: string | null = null;
    let trackingNumber: string | null = null;

    if (dto.carrierType === CarrierType.COURIER) {
      if (!dto.courierId) throw new BadRequestException('courierId is required for COURIER shipments');
      const account = await this.prisma.courierAccount.findUnique({ where: { id: dto.courierId } });
      if (!account || !account.isActive) throw new BadRequestException('Courier account not found or inactive');
      courierId = account.id;
      const res = createCourierShipment(account.code, {
        orderReference: order.reference,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        governorate: order.governorate,
        codAmountPiastres: order.codAmountPiastres,
      });
      trackingNumber = res.trackingNumber;
    } else {
      if (!dto.driverId) throw new BadRequestException('driverId is required for IN_HOUSE shipments');
      const profile = await this.prisma.driverProfile.findUnique({ where: { userId: dto.driverId } });
      if (!profile) throw new BadRequestException('Driver has no fleet profile');
      driverId = dto.driverId;
    }

    const shipment = await this.prisma.shipment.create({
      data: {
        reference: `SHP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        orderId: order.id,
        carrierType: dto.carrierType,
        courierId,
        driverId,
        trackingNumber,
        governorate: order.governorate,
        status: ShipmentStatus.ASSIGNED,
      },
    });

    // Drive the OMS order to DISPATCHED.
    await this.orders.transition(order.id, 'DISPATCHED', `Shipment ${shipment.reference}`, actor);

    await this.audit.record({ userId: actor.id, action: AuditAction.CREATE, entity: 'shipment', entityId: shipment.id, after: { reference: shipment.reference, carrierType: dto.carrierType } });
    return shipment;
  }

  async markOutForDelivery(id: string, actorId: string | null) {
    const s = await this.prisma.shipment.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Shipment not found');
    const dispatchable: ShipmentStatus[] = [ShipmentStatus.ASSIGNED, ShipmentStatus.FAILED];
    if (!dispatchable.includes(s.status)) {
      throw new BadRequestException(`Cannot dispatch a shipment in status ${s.status}`);
    }
    return this.prisma.shipment.update({ where: { id }, data: { status: ShipmentStatus.OUT_FOR_DELIVERY, scheduledFor: null } });
  }

  async recordFailedAttempt(id: string, reason: DeliveryFailureReason, note: string | undefined, actor: AuthenticatedUser) {
    const s = await this.prisma.shipment.findUnique({ where: { id }, include: { order: { select: { customerPhone: true, state: true } } } });
    if (!s) throw new NotFoundException('Shipment not found');
    if (s.status === ShipmentStatus.DELIVERED || s.status === ShipmentStatus.RETURNED) {
      throw new BadRequestException(`Shipment is ${s.status}`);
    }

    const attemptNumber = s.attemptCount + 1;
    await this.prisma.deliveryAttempt.create({
      data: { shipmentId: id, attemptNumber, success: false, failureReason: reason, note: note ?? null, actorId: actor.id },
    });
    this.notify(s.order.customerPhone, `محاولة توصيل ${attemptNumber} لم تنجح (${reason}).`);

    if (attemptNumber >= MAX_ATTEMPTS) {
      await this.prisma.shipment.update({ where: { id }, data: { attemptCount: attemptNumber, status: ShipmentStatus.RETURNED } });
      // Order: DISPATCHED → FAILED → RETURNED
      if (s.order.state === 'DISPATCHED') {
        await this.orders.transition(s.orderId, 'FAILED', `Delivery failed ${MAX_ATTEMPTS}x: ${reason}`, actor);
        await this.orders.transition(s.orderId, 'RETURNED', 'Max delivery attempts reached', actor);
      }
    } else {
      await this.prisma.shipment.update({
        where: { id },
        data: { attemptCount: attemptNumber, status: ShipmentStatus.FAILED, scheduledFor: new Date(Date.now() + 86_400_000) },
      });
    }
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'shipment', entityId: id, after: { attempt: attemptNumber, reason } });
    return this.getById(id);
  }

  // ---- POD ----

  async requestOtp(id: string, actorId: string | null) {
    const s = await this.prisma.shipment.findUnique({ where: { id }, include: { order: { select: { customerPhone: true } } } });
    if (!s) throw new NotFoundException('Shipment not found');
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    await this.prisma.shipment.update({ where: { id }, data: { podOtpHash: hash, podOtpExpiresAt: new Date(Date.now() + 15 * 60_000) } });
    this.notify(s.order.customerPhone, `رمز تأكيد الاستلام: ${code}`);
    const isProd = this.config.get<string>('nodeEnv') === 'production';
    // EG: in prod the code only goes to the customer's phone. In dev we surface it for testing.
    return { sentTo: this.maskPhone(s.order.customerPhone), devCode: isProd ? undefined : code };
  }

  async capturePodOtp(id: string, code: string, recipientName: string | undefined, actor: AuthenticatedUser) {
    const s = await this.prisma.shipment.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Shipment not found');
    if (!s.podOtpHash || !s.podOtpExpiresAt || s.podOtpExpiresAt < new Date()) {
      throw new BadRequestException('No active OTP — request one first');
    }
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    if (hash !== s.podOtpHash) throw new BadRequestException('Invalid OTP');
    return this.finalizeDelivery(id, { method: PodMethod.OTP, otpVerified: true, recipientName: recipientName ?? null }, actor);
  }

  async capturePodFile(id: string, kind: 'PHOTO' | 'SIGNATURE', file: Express.Multer.File, recipientName: string | undefined, actor: AuthenticatedUser) {
    await fs.mkdir(POD_UPLOAD_ROOT, { recursive: true });
    const ext = path.extname(file.originalname).slice(0, 10);
    const safe = `${id}_${kind}_${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(POD_UPLOAD_ROOT, safe), file.buffer);
    const url = `/uploads/pod/${safe}`;
    return this.finalizeDelivery(
      id,
      {
        method: kind === 'PHOTO' ? PodMethod.PHOTO : PodMethod.SIGNATURE,
        photoUrl: kind === 'PHOTO' ? url : null,
        signatureUrl: kind === 'SIGNATURE' ? url : null,
        recipientName: recipientName ?? null,
      },
      actor,
    );
  }

  private async finalizeDelivery(
    id: string,
    pod: { method: PodMethod; photoUrl?: string | null; signatureUrl?: string | null; otpVerified?: boolean; recipientName?: string | null },
    actor: AuthenticatedUser,
  ) {
    const s = await this.prisma.shipment.findUnique({ where: { id }, include: { order: { select: { state: true, customerPhone: true } } } });
    if (!s) throw new NotFoundException('Shipment not found');
    if (s.status === ShipmentStatus.DELIVERED) throw new BadRequestException('Already delivered');

    await this.prisma.$transaction(async (tx) => {
      await tx.proofOfDelivery.upsert({
        where: { shipmentId: id },
        update: { ...pod, capturedById: actor.id, capturedAt: new Date() },
        create: { shipmentId: id, capturedById: actor.id, ...pod },
      });
      await tx.deliveryAttempt.create({ data: { shipmentId: id, attemptNumber: s.attemptCount + 1, success: true, actorId: actor.id } });
      await tx.shipment.update({ where: { id }, data: { status: ShipmentStatus.DELIVERED, attemptCount: s.attemptCount + 1, podOtpHash: null, podOtpExpiresAt: null } });
    });

    // Drive the OMS order to DELIVERED (books COD COLLECTED, attributed to this driver/actor).
    if (s.order.state === 'DISPATCHED') {
      await this.orders.transition(s.orderId, 'DELIVERED', `POD ${pod.method}`, actor);
    }
    this.notify(s.order.customerPhone, 'تم تسليم طلبك بنجاح. شكرًا لك.');
    await this.audit.record({ userId: actor.id, action: AuditAction.STATE_TRANSITION, entity: 'shipment', entityId: id, after: { status: 'DELIVERED', pod: pod.method } });
    return this.getById(id);
  }

  // ---- coverage / webhook ----

  async suggestCarriers(governorate: GovernorateCode) {
    const coverage = await this.prisma.courierCoverage.findMany({
      where: { governorate, isServiceable: true, courierAccount: { isActive: true } },
      orderBy: { etaDays: 'asc' },
      include: { courierAccount: { select: { id: true, code: true, name: true } } },
    });
    const couriers = coverage.map((c) => ({ courierId: c.courierAccount.id, code: c.courierAccount.code, name: c.courierAccount.name, etaDays: c.etaDays }));
    const inHouse = await this.prisma.driverProfile.findMany({
      where: { isAvailable: true, zones: { has: governorate } },
      include: { user: { select: { id: true, fullName: true } } },
    });
    return { couriers, inHouseDrivers: inHouse.map((d) => ({ driverId: d.userId, name: d.user.fullName })) };
  }

  /** Courier status webhook (public). Resolved by courier code; HMAC-verified when the courier has a secret. */
  async webhook(courierCode: string, shipmentId: string, payload: { status?: string }, rawBody?: Buffer, signature?: string | null) {
    const s = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { state: true } }, courierAccount: { select: { code: true, webhookSecretEncrypted: true } } },
    });
    if (!s || s.courierAccount?.code !== courierCode) throw new NotFoundException('Shipment not found for courier');

    // EG: verify HMAC only when the courier has a webhook secret configured (onboarded). Built-in
    // seeded couriers without a secret skip verification (dev) — onboarding a secret enforces it.
    if (s.courierAccount.webhookSecretEncrypted) {
      const secret = decryptSecret(s.courierAccount.webhookSecretEncrypted);
      const expected = hmacSha256Base64(secret, rawBody ?? Buffer.from(JSON.stringify(payload)));
      if (!signature || !safeEqual(signature, expected)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const mapped = mapCourierStatus(payload.status ?? '');
    if (!mapped) return { ok: true, ignored: payload.status };

    if (mapped === 'DELIVERED') {
      await this.prisma.shipment.update({ where: { id: shipmentId }, data: { status: ShipmentStatus.DELIVERED } });
      if (s.order.state === 'DISPATCHED') {
        // system actor (courier callback) — null actor on the COD ledger
        await this.orders.transitionSystem(s.orderId, 'DELIVERED', `Courier ${courierCode} webhook`);
      }
    } else {
      await this.prisma.shipment.update({ where: { id: shipmentId }, data: { status: ShipmentStatus[mapped] } });
    }
    return { ok: true, status: mapped };
  }
}
