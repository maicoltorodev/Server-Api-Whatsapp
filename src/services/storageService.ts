import supabase from '../config/database';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import leadModel from '../models/leadModel';

export class StorageService {
    private bucketName = 'chat-media';
    private MAX_MEDIA_COUNT = 5;

    /**
     * Optimiza una imagen a formato WebP
     */
    public async optimizeImage(buffer: Buffer): Promise<Buffer> {
        try {
            return await sharp(buffer)
                .webp({ quality: 80 })
                .toBuffer();
        } catch (error) {
            logger.error(`❌ [STORAGE] Error optimizando imagen`, { error });
            return buffer; // Fallback al original si falla
        }
    }

    /**
     * Sube un buffer a Supabase Storage y retorna la URL pública
     */
    public async uploadBuffer(buffer: Buffer, mimeType: string, phone?: string): Promise<string | null> {
        try {
            let finalBuffer = buffer;
            let finalMimeType = mimeType;
            let extension = mimeType.split('/')[1] || 'bin';

            // Optimizar si es imagen
            if (mimeType.startsWith('image')) {
                logger.info(`🖼️ [STORAGE] Optimizando imagen para ${phone || 'unknown'}...`);
                finalBuffer = await this.optimizeImage(buffer);
                finalMimeType = 'image/webp';
                extension = 'webp';
            }

            const fileName = `${uuidv4()}.${extension}`;
            const filePath = `uploads/${fileName}`;

            const { data, error } = await supabase.storage
                .from(this.bucketName)
                .upload(filePath, finalBuffer, {
                    contentType: finalMimeType,
                    upsert: false
                });

            if (error) throw error;

            const { data: publicUrlData } = supabase.storage
                .from(this.bucketName)
                .getPublicUrl(filePath);

            const url = publicUrlData.publicUrl;

            // Gestionar límites por cliente si se provee el teléfono
            if (phone) {
                const type = mimeType.startsWith('image') ? 'images' : 'audios';
                await this.manageMediaLimit(phone, type, url);
            }

            return url;
        } catch (error: any) {
            logger.error(`❌ [STORAGE] Error en proceso de subida`, { error: error.message });
            return null;
        }
    }

    /**
     * Obtiene la ruta del archivo a partir de su URL pública de Supabase
     */
    private getPathFromUrl(url: string): string {
        // Ejemplo URL: https://.../storage/v1/object/public/chat-media/uploads/filename.webp
        // Queremos: uploads/filename.webp
        const parts = url.split(`${this.bucketName}/`);
        return parts.length > 1 ? parts[1] : '';
    }

    /**
     * Elimina un archivo de Storage
     */
    public async deleteFileByUrl(url: string): Promise<void> {
        try {
            const path = this.getPathFromUrl(url);
            if (!path) return;

            const { error } = await supabase.storage
                .from(this.bucketName)
                .remove([path]);

            if (error) throw error;
            logger.info(`🗑️ [STORAGE] Archivo eliminado: ${path}`);
        } catch (error: any) {
            logger.error(`❌ [STORAGE] Error eliminando archivo`, { url, error: error.message });
        }
    }

    /**
     * Gestiona el límite de 5 archivos por tipo (FIFO)
     */
    private async manageMediaLimit(phone: string, type: 'images' | 'audios', newUrl: string): Promise<void> {
        try {
            const lead = await leadModel.getByPhone(phone);
            if (!lead) return;

            const recentMedia = lead.recent_media || { images: [], audios: [] };
            const currentList: string[] = (recentMedia as any)[type] || [];

            currentList.push(newUrl);

            // Si excede el límite (5), borrar el más antiguo
            if (currentList.length > this.MAX_MEDIA_COUNT) {
                const oldestUrl = currentList.shift();
                if (oldestUrl) {
                    await this.deleteFileByUrl(oldestUrl);
                }
            }

            (recentMedia as any)[type] = currentList;

            await leadModel.updateStatus(phone, { recent_media: recentMedia });
        } catch (error: any) {
            logger.error(`❌ [STORAGE] Error gestionando límites de media`, { phone, error: error.message });
        }
    }
}

export default new StorageService();
