import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ggzfljxummcyljrwfyeb.supabase.co';
const DEFAULT_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnemZsanh1bW1jeWxqcndmeWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODY1MzEyNiwiZXhwIjoyMTA0MjI5MTI2fQ.c6vug0jGct62Hl8J4TlZnXf8F3CxK3bSdEjsZ2BQ-HA';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private supabase: SupabaseClient | null = null;
  private isConfigured = false;
  private initErrorReason: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initSupabase();
  }

  private resolveEnv(keys: string[]): string | undefined {
    // 1. Direct match
    for (const key of keys) {
      const val = process.env[key] || this.configService?.get<string>(key);
      if (val && val.trim() !== '') return val.trim();
    }
    // 2. Case-insensitive match across process.env
    const lowerKeys = keys.map((k) => k.toLowerCase());
    for (const [envKey, envVal] of Object.entries(process.env)) {
      if (envVal && lowerKeys.includes(envKey.toLowerCase())) {
        return envVal.trim();
      }
    }
    return undefined;
  }

  private initSupabase(): boolean {
    if (this.isConfigured && this.supabase) {
      return true;
    }

    let supabaseUrl = this.resolveEnv([
      'SUPABASE_URL',
      'Project_URL',
      'PROJECT_URL',
      'project_url',
      'SUPABASE_PROJECT_URL',
    ]);

    let supabaseKey = this.resolveEnv([
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_KEY',
      'SUPABASE_SERVICE_KEY',
      'Project_API_keys',
      'PROJECT_API_KEYS',
      'PROJECT_API_KEY',
      'project_api_keys',
      'SUPABASE_API_KEY',
    ]);

    // Fallbacks si Render no tiene las variables en su entorno
    if (!supabaseUrl) {
      this.logger.warn('⚠️ SUPABASE_URL no detectada en variables de entorno. Aplicando fallback de proyecto.');
      supabaseUrl = DEFAULT_SUPABASE_URL;
    }

    if (!supabaseKey) {
      this.logger.warn('⚠️ SUPABASE_KEY no detectada en variables de entorno. Aplicando fallback de proyecto.');
      supabaseKey = DEFAULT_SUPABASE_KEY;
    }

    // Normalizar URL: quitar /rest/v1/ o barras finales si existen
    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

    // Polyfill WebSocket si el runtime de Node no lo tiene nativo (Node < 22)
    if (typeof (global as any).WebSocket === 'undefined') {
      (global as any).WebSocket = class WebSocketDummy {
        static readonly CONNECTING = 0;
        static readonly OPEN = 1;
        static readonly CLOSING = 2;
        static readonly CLOSED = 3;
        addEventListener() {}
        removeEventListener() {}
        send() {}
        close() {}
      };
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          transport: (global as any).WebSocket,
        },
      });
      this.isConfigured = true;
      this.initErrorReason = null;
      this.logger.log(`✅ Supabase Storage inicializado correctamente para URL: ${supabaseUrl}`);
      return true;
    } catch (err: any) {
      this.initErrorReason = err.message;
      this.logger.error(`Error inicializando cliente Supabase: ${err.message}`);
      return false;
    }
  }

  /**
   * Sube un buffer de archivo al bucket indicado y retorna su URL pública
   */
  async uploadFile(
    bucket: string,
    filePath: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<{ publicUrl: string; storagePath: string }> {
    if (!this.isConfigured || !this.supabase) {
      this.initSupabase();
    }

    if (!this.isConfigured || !this.supabase) {
      throw new InternalServerErrorException(
        `El servicio de almacenamiento en la nube (Supabase Storage) no pudo iniciarse: ${this.initErrorReason || 'Faltan credenciales'}`,
      );
    }

    const { data, error } = await this.supabase.storage.from(bucket).upload(filePath, fileBuffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      this.logger.error(`Error subiendo archivo a Supabase Storage: ${error.message}`);
      throw new BadRequestException(`No se pudo subir la imagen: ${error.message}`);
    }

    const { data: publicUrlData } = this.supabase.storage.from(bucket).getPublicUrl(filePath);

    return {
      publicUrl: publicUrlData.publicUrl,
      storagePath: filePath,
    };
  }

  /**
   * Elimina un archivo del bucket
   */
  async deleteFile(bucket: string, filePath: string): Promise<void> {
    if (!this.isConfigured || !this.supabase) {
      return;
    }

    try {
      const { error } = await this.supabase.storage.from(bucket).remove([filePath]);
      if (error) {
        this.logger.warn(`No se pudo eliminar archivo ${filePath} de Supabase: ${error.message}`);
      }
    } catch (err: any) {
      this.logger.warn(`Excepción al eliminar archivo de Supabase: ${err.message}`);
    }
  }
}
