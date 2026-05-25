import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StoreConnectionStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { IntakeService } from '../orders/intake/intake.service';
import { decryptSecret } from '../../common/crypto/secret-box';
import { pullRecentOrders } from './store-ingest';
import { PLATFORM_INTAKE } from './store-oauth';
import { STORE_BACKFILL_QUEUE, type StoreBackfillJobData } from './store-sync.constants';

@Processor(STORE_BACKFILL_QUEUE)
export class StoreBackfillProcessor extends WorkerHost {
  private readonly logger = new Logger(StoreBackfillProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intake: IntakeService,
  ) {
    super();
  }

  async process(job: Job<StoreBackfillJobData>): Promise<{ imported: number; skipped: number }> {
    const { storeConnectionId, limit } = job.data;

    const conn = await this.prisma.storeConnection.findUnique({ where: { id: storeConnectionId } });
    if (!conn || conn.status !== StoreConnectionStatus.CONNECTED || !conn.accessTokenEncrypted) {
      return { imported: 0, skipped: 0 };
    }

    const accessToken = decryptSecret(conn.accessTokenEncrypted);
    const orders = await pullRecentOrders({ platform: conn.platform, shopDomain: conn.shopDomain, accessToken, limit });

    const source = PLATFORM_INTAKE[conn.platform];
    let imported = 0;
    let skipped = 0;
    for (const raw of orders) {
      try {
        await this.intake.ingestWebhook(source, conn.clientId, raw, conn.id);
        imported++;
      } catch {
        // EG: duplicates (externalRef already ingested) or unmappable rows — skip, don't fail the batch.
        skipped++;
      }
    }

    await this.prisma.storeConnection.update({ where: { id: storeConnectionId }, data: { lastBackfillAt: new Date() } });
    this.logger.log(`backfill for ${conn.shopDomain}: imported ${imported}, skipped ${skipped} (pulled ${orders.length})`);
    return { imported, skipped };
  }
}
