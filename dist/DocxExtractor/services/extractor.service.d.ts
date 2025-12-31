/**
 * ============================================================================
 * EXTRACTOR SERVICE - Orchestrateur d'extraction DOCX vers JSON
 * ============================================================================
 *
 * Ce service coordonne l'extraction complète du contenu d'un document DOCX
 * vers une structure JSON structurée.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Ce service orchestre les autres services (structure-parser, table-extractor)
 * - Il charge le DOCX, extrait les métadonnées et le contenu
 * - Le résultat est un JSON structuré avec sections, tableaux et stats
 *
 * @author Rokodo
 * @version 1.0.0
 */
import type { ExtractionOptions, ExtractionResult } from '../../shared/types/extraction.types';
/**
 * Extrait le contenu structuré d'un document DOCX.
 *
 * @param docxBuffer - Buffer contenant le fichier DOCX
 * @param options - Options d'extraction
 * @returns Résultat de l'extraction avec le document structuré
 *
 * @example
 * const result = await extractDocxContent(buffer, {
 *   preserveHierarchy: true,
 *   tableFormat: 'objects',
 *   includeMetadata: true
 * });
 * if (result.success) {
 *   console.log(result.document.content.sections);
 * }
 */
export declare function extractDocxContent(docxBuffer: Buffer, options?: ExtractionOptions): Promise<ExtractionResult>;
/**
 * Valide les options d'extraction.
 */
export declare function validateExtractionOptions(options: ExtractionOptions): {
    isValid: boolean;
    errors: string[];
};
