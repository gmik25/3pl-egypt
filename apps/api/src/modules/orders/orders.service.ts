import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  AuditAction,
  CodLedgerType,
  IntakeSource,
  OrderState,
  type GovernorateCode,
  type Prisma,
} from '@prisma/client';
import { ORDER_STATE_TRANSITIONS } from '@3pl/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertGovernorateInScope, governorateFilter } from '../../common/governorate-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { RoutingService } from './routing.service';
import { OrderValidationService } from './order-validation.service';
import { CodService } from './cod.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { NormalizedOrder } from './intake/normalized-order';

interface PersistInput {
  clientId: string;
  warehouseId?: string;
  externalRef?: string | null;
  intakeSource: IntakeSource;
  intakePayload?: Prisma.InputJsonValue;
  customerName: string;
  customerPhone: string;
  customerPhoneAlt?: string | null;
  address: {
    apartment?: string | null;
    floor?: string | null;
    building?: string | null;
    street?: string | null;
    district?: string | null;
  };
  governorate: GovernorateCode;
  notes?: string | null;
  paymentMethod: CreateOrderDto['paymentMethod'];
  codAmountPiastres?: number | null;
  items: { skuCode: string; nameAr?: string; nameEn?: string; quantity: number; unitPricePiastres: number }[];
}

export interface ListOrdersQuery {
  clientId?: string;
  state?: OrderState;
  governorate?: GovernorateCode;
  search?: string;
  from?: Date;
  to?: Date;
  flaggedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly routing: RoutingService,
    private readonly validation: OrderValidationService,
    private readonly cod: CodService,
  ) {}

  // ---------- create ----------

  create(dto: CreateOrderDto, actor: AuthenticatedUser) {
    assertGovernorateInScope(actor, dto.governorate);
    return this.persist(
      {
        clientId: dto.clientId,
        warehouseId: dto.warehouseId,
        externalRef: dto.externalRef ?? null,
        intakeSource: IntakeSource.MANUAL,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerPhoneAlt: dto.customerPhoneAlt ?? null,
        address: {
          apartment: dto.addressApartment ?? null,
          floor: dto.addressFloor ?? null,
          building: dto.addressBuilding ?? null,
          street: dto.addressStreet ?? null,
          district: dto.addressDistrict ?? null,
        },
        governorate: dto.governorate,
        notes: dto.notes ?? null,
        paymentMethod: dto.paymentMethod,
        codAmountPiastres: dto.codAmountPiastres ?? null,
        items: dto.items,
      },
      actor.id,
    );
  }

  createFromIntake(
    clientId: string,
    n: NormalizedOrder,
    source: IntakeSource,
    payload: Prisma.InputJsonValue,
    actorId: string | null,
  ) {
    return this.persist(
      {
        clientId,
        externalRef: n.externalRef,
        intakeSource: source,
        intakePayload: payload,
        customerName: n.customerName,
        customerPhone: n.customerPhone,
        customerPhoneAlt: n.customerPhoneAlt ?? null,
        address: n.address,
        governorate: n.governorate,
        notes: n.notes ?? null,
        paymentMethod: n.paymentMethod,
        codAmountPiastres: n.codAmountPiastres ?? null,
        items: n.items,
      },
      actorId,
    );
  }

  private async persist(input: PersistInput, actorId: string | null) {
    const client = await this.prisma.client.findUnique({
      where: { id: input.clientId },
      select: { id: true, isActive: true },
    });
    if (!client) throw new NotFoundException('Client not found');
    if (!client.isActive) throw new BadRequestException('Client is inactive');

    // Validation / fraud screening
    const { isDuplicate, flags } = await this.validation.validate({
      clientId: input.clientId,
      externalRef: input.externalRef,
      customerPhone: input.customerPhone,
      governorate: input.governorate,
      paymentMethod: input.paymentMethod,
      codAmountPiastres: input.codAmountPiastres,
    });
    if (isDuplicate) {
      throw new ConflictException(`Duplicate order for externalRef=${input.externalRef}`);
    }

    // Resolve/auto-create SKUs (WMS will own these later)
    const skuIdByCode = await this.resolveSkus(input.clientId, input.items);

    // Route to a warehouse (stock-aware, falls back to governorate match / first active)
    const warehouseId =
      input.warehouseId ??
      (await this.routing.pickWarehouse(
        input.governorate,
        input.items.map((i) => ({ skuId: skuIdByCode[i.skuCode]!, quantity: i.quantity })),
      ));

    const order = await this.prisma.order.create({
      data: {
        reference: this.genReference(),
        clientId: input.clientId,
        warehouseId,
        intakeSource: input.intakeSource,
        intakePayload: input.intakePayload,
        externalRef: input.externalRef,
        state: OrderState.PENDING,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerPhoneAlt: input.customerPhoneAlt,
        addressApartment: input.address.apartment ?? null,
        addressFloor: input.address.floor ?? null,
        addressBuilding: input.address.building ?? null,
        addressStreet: input.address.street ?? null,
        addressDistrict: input.address.district ?? null,
        governorate: input.governorate,
        notes: input.notes,
        paymentMethod: input.paymentMethod,
        codAmountPiastres: input.codAmountPiastres,
        flaggedReason: flags.length ? flags.join(', ') : null,
        items: {
          create: input.items.map((i) => ({
            skuId: skuIdByCode[i.skuCode]!,
            quantity: i.quantity,
            unitPricePiastres: i.unitPricePiastres,
          })),
        },
        transitions: { create: { toState: OrderState.PENDING, actorId } },
      },
      include: { items: true },
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entity: 'order',
      entityId: order.id,
      after: { reference: order.reference, source: input.intakeSource, flags },
    });
    return order;
  }

  /** Upsert SKUs by (clientId, code); returns code -> skuId. */
  private async resolveSkus(
    clientId: string,
    items: PersistInput['items'],
  ): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    for (const item of items) {
      if (!item.skuCode) throw new BadRequestException('Order item missing skuCode');
      const sku = await this.prisma.sku.upsert({
        where: { clientId_code: { clientId, code: item.skuCode } },
        update: {},
        // EG: name defaults to the code if the platform didn't send one; WMS enriches later.
        create: {
          clientId,
          code: item.skuCode,
          nameAr: item.nameAr ?? item.nameEn ?? item.skuCode,
          nameEn: item.nameEn ?? null,
          defaultUnitPricePiastres: item.unitPricePiastres,
        },
        select: { id: true },
      });
      map[item.skuCode] = sku.id;
    }
    return map;
  }

  private genReference(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `3PL-${ts}-${rand}`;
  }

  // ---------- read ----------

  async list(q: ListOrdersQuery, actor: AuthenticatedUser) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
    const scope = governorateFilter(actor);
    const governorate = q.governorate
      ? scope && !scope.in.includes(q.governorate)
        ? { in: [] as GovernorateCode[] }
        : { equals: q.governorate }
      : scope;

    const where: Prisma.OrderWhereInput = {
      clientId: q.clientId,
      state: q.state,
      governorate,
      flaggedReason: q.flaggedOnly ? { not: null } : undefined,
      createdAt: { gte: q.from, lte: q.to },
      OR: q.search
        ? [
            { reference: { contains: q.search, mode: 'insensitive' } },
            { customerName: { contains: q.search, mode: 'insensitive' } },
            { customerPhone: { contains: q.search } },
            { externalRef: { contains: q.search } },
          ]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          client: { select: { legalName: true } },
          warehouse: { select: { code: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getById(id: string, actor: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, legalName: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        items: { include: { sku: { select: { code: true, nameAr: true, nameEn: true } } } },
        transitions: { orderBy: { createdAt: 'asc' } },
        codLedger: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertGovernorateInScope(actor, order.governorate);
    return order;
  }

  // ---------- state machine ----------

  async transition(id: string, toState: OrderState, reason: string | undefined, actor: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    assertGovernorateInScope(actor, order.governorate);

    const allowed = ORDER_STATE_TRANSITIONS[order.state] ?? [];
    if (!allowed.includes(toState)) {
      throw new BadRequestException(
        `Illegal transition ${order.state} → ${toState}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }
    if ((toState === OrderState.FAILED || toState === OrderState.RETURNED) && !reason) {
      throw new BadRequestException(`A reason is required to move an order to ${toState}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.order.update({ where: { id }, data: { state: toState } });
      await tx.orderStateTransition.create({
        data: { orderId: id, fromState: order.state, toState, actorId: actor.id, reason: reason ?? null },
      });
      return u;
    });

    // EG: COD is collected on delivery — record it in the COD ledger automatically.
    if (
      toState === OrderState.DELIVERED &&
      order.paymentMethod === 'COD' &&
      (order.codAmountPiastres ?? 0) > 0
    ) {
      await this.cod.addEntry(
        id,
        CodLedgerType.COLLECTED,
        order.codAmountPiastres!,
        actor.id,
        'Auto-recorded on delivery',
      );
    }

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.STATE_TRANSITION,
      entity: 'order',
      entityId: id,
      before: { state: order.state },
      after: { state: toState, reason },
    });
    return updated;
  }
}
