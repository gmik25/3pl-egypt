import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Client self-service portal: ownership-scoped reads.
 * EG: a CLIENT-role user must only ever see their own client record, regardless of governorate.
 * This is enforced by resolving the user's clientId server-side, never trusting a path param.
 */
@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveClientId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { clientId: true },
    });
    if (!user.clientId) {
      throw new ForbiddenException('This account is not linked to a client');
    }
    return user.clientId;
  }

  async getMyClient(userId: string) {
    const clientId = await this.resolveClientId(userId);
    return this.prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      select: {
        id: true,
        legalName: true,
        tradingName: true,
        governorate: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async getMyContracts(userId: string) {
    const clientId = await this.resolveClientId(userId);
    return this.prisma.contract.findMany({
      where: { clientId },
      orderBy: { startsOn: 'desc' },
      include: { sla: true },
    });
  }
}
