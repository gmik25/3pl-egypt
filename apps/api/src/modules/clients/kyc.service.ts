import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, KycDocType } from '@prisma/client';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertGovernorateInScope } from '../../common/governorate-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

// EG: local-disk storage stub. In prod swap for S3 (me-south-1) / Orange Egypt object storage
// to satisfy PDPL data-residency. KYC docs (national ID, tax card) are personal data.
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'kyc');

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    clientId: string,
    type: KycDocType,
    file: Express.Multer.File,
    actor: AuthenticatedUser,
  ) {
    await this.assertClientInScope(clientId, actor);
    await fs.mkdir(UPLOAD_ROOT, { recursive: true });

    const ext = path.extname(file.originalname).slice(0, 10);
    const safeName = `${clientId}_${type}_${crypto.randomUUID()}${ext}`;
    const dest = path.join(UPLOAD_ROOT, safeName);
    await fs.writeFile(dest, file.buffer);

    const doc = await this.prisma.kycDocument.create({
      data: {
        clientId,
        type,
        fileUrl: `/uploads/kyc/${safeName}`,
        approved: null, // pending review
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: AuditAction.CREATE,
      entity: 'kycDocument',
      entityId: doc.id,
      after: { clientId, type },
    });
    return doc;
  }

  async listForClient(clientId: string, actor: AuthenticatedUser) {
    await this.assertClientInScope(clientId, actor);
    return this.prisma.kycDocument.findMany({
      where: { clientId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async review(docId: string, approved: boolean, actor: AuthenticatedUser) {
    const doc = await this.prisma.kycDocument.findUnique({
      where: { id: docId },
      include: { client: { select: { governorate: true } } },
    });
    if (!doc) throw new NotFoundException('KYC document not found');
    assertGovernorateInScope(actor, doc.client.governorate);

    const updated = await this.prisma.kycDocument.update({
      where: { id: docId },
      data: { approved, reviewedBy: actor.id, reviewedAt: new Date() },
    });
    await this.audit.record({
      userId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'kycDocument',
      entityId: docId,
      before: { approved: doc.approved },
      after: { approved },
    });
    return updated;
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
