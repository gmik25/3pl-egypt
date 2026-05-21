import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GovernorateCode } from '@prisma/client';

import { ClientsService } from './clients.service';
import { ContractsService } from './contracts.service';
import { KycService } from './kyc.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { UploadKycDto, ReviewKycDto } from './dto/upload-kyc.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

const MAX_KYC_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly contracts: ContractsService,
    private readonly kyc: KycService,
  ) {}

  // ---- Clients ----

  @Get()
  @RequirePermissions('clients.read')
  @ApiQuery({ name: 'governorate', required: false, enum: GovernorateCode })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('governorate') governorate?: GovernorateCode,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.clients.list(
      {
        governorate,
        search,
        isActive: isActive === undefined ? undefined : isActive === 'true',
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      actor,
    );
  }

  @Get(':id')
  @RequirePermissions('clients.read')
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.clients.getById(id, actor);
  }

  @Post()
  @RequirePermissions('clients.write')
  create(@Body() dto: CreateClientDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.clients.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('clients.write')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.clients.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('clients.write')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.clients.deactivate(id, actor);
  }

  // ---- KYC documents ----

  @Get(':id/kyc')
  @RequirePermissions('clients.read')
  listKyc(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.kyc.listForClient(id, actor);
  }

  @Post(':id/kyc')
  @RequirePermissions('clients.write')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['COMMERCIAL_REGISTRATION', 'TAX_CARD', 'NATIONAL_ID'] },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadKyc(
    @Param('id') id: string,
    @Body() dto: UploadKycDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (file.size > MAX_KYC_BYTES) throw new BadRequestException('File exceeds 10 MB');
    return this.kyc.upload(id, dto.type, file, actor);
  }

  @Patch('kyc/:docId/review')
  @RequirePermissions('clients.write')
  reviewKyc(
    @Param('docId') docId: string,
    @Body() dto: ReviewKycDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.kyc.review(docId, dto.approved, actor);
  }

  // ---- Contracts (nested list/create) ----

  @Get(':id/contracts')
  @RequirePermissions('contracts.read')
  listContracts(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.contracts.listForClient(id, actor);
  }

  @Post(':id/contracts')
  @RequirePermissions('contracts.write')
  createContract(
    @Param('id') id: string,
    @Body() dto: CreateContractDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.contracts.create(id, dto, actor);
  }
}
