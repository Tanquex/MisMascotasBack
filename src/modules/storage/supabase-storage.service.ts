import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private supabase: SupabaseClient | null = null;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    this.initSupabase();
  }

  private initSupabase() {
    let supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.Project_URL ||
      this.configService.get<string>('SUPABASE_URL') ||
      this.configService.get<string>('Project_URL');

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.Project_API_keys ||
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('Project_API_keys');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('⚠️ Supabase Storage no está configurado (Faltan SUPABASE_URL o API Key)');
      return;
    }

    // Normalizar URL: quitar /rest/v1/ o barras finales si existen
    supabaseUrl = supabaseUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.isConfigured = true;
      this.logger.log(`✅ Supabase Storage inicializado correctamente para URL: ${supabaseUrl}`);
    } catch (err: any) {
      this.logger.error(`Error inicializando cliente Supabase: ${err.message}`);
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
      throw new InternalServerErrorException(
        'El servicio de almacenamiento en la nube (Supabase Storage) no está configurado correctamente.',
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
