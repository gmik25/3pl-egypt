import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { CreateSkuDto } from './dto/create-sku.dto';
import type { UpdateSkuDto } from './dto/update-sku.dto';

export interface ListSkusQuery {
  clientId?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListSkusQuery) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
    const where: Prisma.SkuWhereInput = {
      clientId: q.clientId,
      isActive: q.isActive,
      OR: q.search
        ? [
            { code: { contains: q.search, mode: 'insensitive' } },
            { nameAr: { contains: q.search } },
            { nameEn: { contains: q.search, mode: 'insensitive' } },
            { barcode: { contains: q.search } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sku.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { client: { select: { legalName: true } } },
      }),
      this.prisma.sku.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getById(id: string) {
    const sku = await this.prisma.sku.findUnique({
      where: { id },
      include: { client: { select: { id: true, legalName: true } } },
    });
    if (!sku) throw new NotFoundException('SKU not found');
    return sku;
  }

  /** Resolve a SKU by scannable barcode (handheld terminals). */
  async getByBarcode(barcode: string) {
    const sku = await this.prisma.sku.findFirst({ where: { barcode } });
    if (!sku) throw new NotFoundException('No SKU with that barcode');
    return sku;
  }

  async create(dto: CreateSkuDto, actorId: string | null) {
    const sku = await this.prisma.sku.create({
      data: {
        clientId: dto.clientId,
        code: dto.code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn ?? null,
        barcode: dto.barcode ?? null,
        hsCode: dto.hsCode ?? null,
        unitOfMeasure: dto.unitOfMeasure ?? 'EA',
        expiryTracked: dto.expiryTracked ?? false,
        reorderPointQty: dto.reorderPointQty ?? 0,
        defaultUnitPricePiastres: dto.defaultUnitPricePiastres ?? 0,
      },
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entity: 'sku',
      entityId: sku.id,
      after: { code: sku.code, clientId: sku.clientId },
    });
    return sku;
  }

  async update(id: string, dto: UpdateSkuDto, actorId: string | null) {
    const before = await this.prisma.sku.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('SKU not found');
    const sku = await this.prisma.sku.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        barcode: dto.barcode,
        hsCode: dto.hsCode,
        unitOfMeasure: dto.unitOfMeasure,
        expiryTracked: dto.expiryTracked,
        reorderPointQty: dto.reorderPointQty,
        defaultUnitPricePiastres: dto.defaultUnitPricePiastres,
        isActive: dto.isActive,
      },
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entity: 'sku',
      entityId: id,
      before: { nameAr: before.nameAr, isActive: before.isActive },
      after: { nameAr: sku.nameAr, isActive: sku.isActive },
    });
    return sku;
  }
}
