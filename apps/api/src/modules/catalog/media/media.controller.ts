import { Body, Controller, Get, Header, Param, Patch, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MEDIA_MAX_BYTES, type MediaDetailResponse, type MediaResponse, type UpdateMediaData, updateMediaSchema } from '@erp/contracts';
import { z } from 'zod';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { CurrentTenant, RequirePermission } from '../../../shared/tenancy/current-tenant.decorator.js';
import { TenantGuard } from '../../identity/index.js';
import { MediaService } from './media.service.js';

const mediaIdSchema = z.coerce.number().int().positive();
/** Campos de texto del multipart: el nombre se manda aparte (en UTF-8; el del archivo puede llegar mal codificado). */
const uploadFieldsSchema = z.object({ filename: z.string().max(1000).optional() });

@ApiTags('media')
@ApiCookieAuth()
@UseGuards(TenantGuard)
@Controller('tenants/:tenant/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @RequirePermission('catalog:write')
  // En memoria (almacenamiento por defecto de multer) con límite de tamaño y un solo archivo:
  // el tipo real se verifica por los bytes antes de guardar nada.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MEDIA_MAX_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, filename: { type: 'string' } } } })
  @ApiOperation({ summary: 'Subir una imagen (JPG, PNG, GIF o WebP, hasta 20 MB)' })
  upload(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body({ schema: uploadFieldsSchema }) fields: z.output<typeof uploadFieldsSchema>,
  ): Promise<MediaResponse> {
    return this.media.upload(tenant, file, fields.filename ?? file?.originalname);
  }

  @Get(':mediaId')
  @RequirePermission('catalog:read')
  @ApiOperation({ summary: 'Detalle de una imagen (nombre, tamaño, fecha y en cuántos productos se usa)' })
  detail(
    @CurrentTenant() tenant: TenantContext,
    @Param('mediaId', { schema: mediaIdSchema }) mediaId: number,
  ): Promise<MediaDetailResponse> {
    return this.media.detail(tenant, mediaId);
  }

  @Patch(':mediaId')
  @RequirePermission('catalog:write')
  @ApiOperation({ summary: 'Renombrar una imagen' })
  rename(
    @CurrentTenant() tenant: TenantContext,
    @Param('mediaId', { schema: mediaIdSchema }) mediaId: number,
    @Body({ schema: updateMediaSchema }) body: UpdateMediaData,
  ): Promise<MediaDetailResponse> {
    return this.media.rename(tenant, mediaId, body);
  }

  @Get(':mediaId/file')
  @RequirePermission('catalog:read')
  // Una imagen nunca cambia con el mismo id: el navegador puede guardarla (solo para este usuario).
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  // El navegador no "adivina" otro tipo (ej. ejecutar como HTML): explícito aquí, sin depender de helmet.
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Archivo de una imagen de la empresa' })
  async file(
    @CurrentTenant() tenant: TenantContext,
    @Param('mediaId', { schema: mediaIdSchema }) mediaId: number,
  ): Promise<StreamableFile> {
    const file = await this.media.open(tenant, mediaId);
    return new StreamableFile(file.stream, { type: file.mimeType, length: file.size, disposition: 'inline' });
  }
}
