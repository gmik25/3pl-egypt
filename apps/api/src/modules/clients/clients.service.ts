import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type GovernorateCode, type Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertGovernorateInScope, governorateFilter } from '../../common/governorate-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';

export interface ListClientsQuery {
  governorate?: GovernorateCode;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListClientsQuery, actor: AuthenticatedUser) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));

    // EG: a regional manager only sees clients in their scoped governorates.
    const scope = governorateFilter(actor);
    const governorate = q.governorate
      ? scope && !scope.in.includes(q.governorate)
        ? { in: [] as GovernorateCode[] } // requested a governorate outside scope -> empty
        : { equals: q.governorate }
      : scope;

    const where: Prisma.ClientWhereInput = {
      isActive: q.isActive,
      governorate,
      OR: q.search
        ? [
            { legalName: { contains: q.search, mode: 'insensitive' } },
            { tradingName: { contains: q.search, mode: 'insensitive' } },
            { taxId: { contains: q.search } },
            { contactEmail: { contains: q.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { contracts: true, kycDocuments: true } },
        },
      }),
      this.prisma.client.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getById(id: string, actor: AuthenticatedUser) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        kycDocuments: { orderBy: { uploadedAt: 'desc' } },
        contracts: {
          orderBy: { startsOn: 'desc' },
          include: { sla: true },
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    assertGovernorateInScope(actor, client.governorate);
    return client;
  }

  async create(dto: CreateClientDto, actor: AuthenticatedUser) {
    assertGovernorateInScope(actor, dto.governorate);
    const client = await this.prisma.client.create({
      data: {
        legalName: dto.legalName,
        tradingName: dto.tradingName ?? null,
        taxId: dto.taxId ?? null,
        commercialRegistration: dto.commercialRegistration ?? null,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        addressApartment: dto.addressApartment ?? null,
        addressFloor: dto.addressFloor ?? null,
        addressBuilding: dto.addressBuilding ?? null,
        addressStreet: dto.addressStreet ?? null,
        addressDistrict: dto.addressDistrict ?? null,
        governorate: dto.governorate,
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: AuditAction.CREATE,
      entity: 'client',
      entityId: client.id,
      after: { legalName: client.legalName, governorate: client.governorate },
    });
    return client;
  }

  async update(id: string, dto: UpdateClientDto, actor: AuthenticatedUser) {
    const before = await this.prisma.client.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Client not found');
    assertGovernorateInScope(actor, before.governorate);
    if (dto.governorate) assertGovernorateInScope(actor, dto.governorate);

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        legalName: dto.legalName,
        tradingName: dto.tradingName,
        taxId: dto.taxId,
        commercialRegistration: dto.commercialRegistration,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        addressApartment: dto.addressApartment,
        addressFloor: dto.addressFloor,
        addressBuilding: dto.addressBuilding,
        addressStreet: dto.addressStreet,
        addressDistrict: dto.addressDistrict,
        governorate: dto.governorate,
        isActive: dto.isActive,
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'client',
      entityId: id,
      before: { legalName: before.legalName, isActive: before.isActive },
      after: { legalName: updated.legalName, isActive: updated.isActive },
    });
    return updated;
  }

  async deactivate(id: string, actor: AuthenticatedUser) {
    const before = await this.prisma.client.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Client not found');
    assertGovernorateInScope(actor, before.governorate);
    await this.prisma.client.update({ where: { id }, data: { isActive: false } });
    await this.audit.record({
      userId: actor.id,
      action: AuditAction.DELETE,
      entity: 'client',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: false },
    });
  }
}
