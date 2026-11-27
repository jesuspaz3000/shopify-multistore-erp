import { Module } from '@nestjs/common';
import { LocalMediaStorage } from './local-media-storage.js';
import { MediaStorage } from './media-storage.js';

/** Proveedor de almacenamiento de archivos (se inyecta `MediaStorage`, no la implementación). */
@Module({
  providers: [{ provide: MediaStorage, useClass: LocalMediaStorage }],
  exports: [MediaStorage],
})
export class StorageModule {}
