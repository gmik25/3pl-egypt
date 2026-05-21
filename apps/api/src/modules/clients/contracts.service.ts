import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertGovernorateInScope } from '../../common/governorate-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PricingService, type Quote } from './pricing.service';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { UpdateContractDto } from './dto/update-contract.dto';
import type { UpsertSlaDto } from './dto/upsert-sla.dto';
import type { PriceQuoteDto } from './dto/price-quote.dto';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pricing: PricingService,
  ) {}

  async listForClient(clientId: string, actor: AuthenticatedUser) {
    await this.assertClientInScope(clientId, actor);
    return this.prisma.contract.findMany({
      where: { clientId },
      orderBy: { startsOn: 'desc' },
      include: { sla: true },
    });
  }

  async getById(id: string, actor: AuthenticatedUser) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { sla: true, client: { select: { governorate: true, legalName: true } } },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    assertGovernorateInScope(actor, contract.client.governorate);
    return contract;
  }

  async create(clientId: string, dto: CreateContractDto, actor: AuthenticatedUser) {
    await this.assertClientInScope(clientId, actor);
    const contract = await this.prisma.contract.create({
      data: {
        clientId,
        startsOn: new Date(dto.startsOn),
        endsOn: dto.endsOn ? new Date(dto.endsOn) : null,
        storagePerSkuPerDayPiastres: dto.storagePerSkuPerDayPiastres,
        pickAndPackPiastres: dto.pickAndPackPiastres,
        codCommissionBps: dto.codCommissionBps,
        returnFeePiastres: dto.returnFeePiastres,
      },
      include: { sla: true },
    });
    await this.audit.record({
      userId: actor.id,
      action: AuditAction.CREATE,
      entity: 'contract',
      entityId: contract.id,
      after: { clientId, codCommissionBps: dto.codCommissionBps },
    });
    return contract;
  }

  async update(id: string, dto: UpdateContractDto, actor: AuthenticatedUser) {
    const before = await this.getById(id, actor);
    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        startsOn: dto.startsOn ? new Date(dto.startsOn) : undefined,
        endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
        storagePerSkuPerDayPiastres: dto.storagePerSkuPerDayPiastres,
        pickAndPackPiastres: dto.pickAndPackPiastres,
        codCommissionBps: dto.codCommissionBps,
        returnFeePiastres: dto.returnFeePiastres,
        isActive: dto.isActive,
      },
      include: { sla: true },
    });
    await this.audit.record({
      userId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'contract',
      entityId: id,
      before: {
        codCommissionBps: before.codCommissionBps,
        pickAndPackPiastres: before.pickAndPackPiastres,
      },
      after: {
        codCommissionBps: updated.codCommissionBps,
        pickAndPackPiastres: updated.pickAndPackPiastres,
      },
    });
    return updated;
  }

  async upsertSla(contractId: string, dto: UpsertSlaDto, actor: AuthenticatedUser) {
    await this.getById(contractId, actor); // scope check
    const sla = await this.prisma.sla.upsert({
      where: { contractId },
      update: { ...dto },
      create: { contractId, ...dto },
    });
    await this.audit.record({
      userId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'sla',
      entityId: sla.id,
      after: { ...dto },
    });
    return sla;
  }

  async quote(contractId: string, dto: PriceQuoteDto, actor: AuthenticatedUser): Promise<Quote> {
    const contract = await this.getById(contractId, actor);
    return this.pricing.quote(
      {
        storagePerSkuPerDayPiastres: contract.storagePerSkuPerDayPiastres,
        pickAndPackPiastres: contract.pickAndPackPiastres,
        codCommissionBps: contract.codCommissionBps,
        returnFeePiastres: contract.returnFeePiastres,
      },
      dto,
    );
  }

  private async assertClientInScope(clientId: string, actor: AuthenticatedUser) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { governorate: true },
    });
    if (!client) throw new NotFoundException('Client not found');
    assertGovernorateInScope(actor, client.governorate);
  }
}
