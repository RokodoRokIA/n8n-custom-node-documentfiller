/**
 * ============================================================================
 * SERVICE PDF EXTRACTOR - Extraction de texte avec positions
 * ============================================================================
 *
 * Ce service extrait le contenu textuel d'un PDF avec les positions absolues
 * de chaque élément. Il utilise pdfjs-dist (Mozilla pdf.js) pour le parsing.
 *
 * FONCTIONNALITÉS:
 * - Extraction de texte avec coordonnées (x, y, width, height)
 * - Reconstruction des lignes de texte
 * - Détection des zones vides (potentiels champs de saisie)
 * - Extraction des tags {{TAG}} avec leur contexte
 *
 * COORDONNÉES PDF:
 * - Origine (0, 0) = coin inférieur gauche
 * - Y augmente vers le haut
 * - Unité = points (72 points = 1 pouce)
 *
 * @author Rokodo
 * @version 1.0.0
 */
import type { PdfTextLine, PdfField, PdfDocumentContent } from '../types';
/**
 * Extrait le contenu complet d'un PDF avec positions.
 *
 * @param pdfBuffer - Buffer contenant le PDF
 * @param options - Options d'extraction
 * @returns Contenu du document avec structure complète
 */
export declare function extractPdfContent(pdfBuffer: Buffer, options?: {
    maxPages?: number;
    extractFields?: boolean;
    debug?: boolean;
}): Promise<PdfDocumentContent>;
/**
 * Trouve les lignes contenant un texte spécifique.
 */
export declare function findLinesContaining(content: PdfDocumentContent, searchText: string, options?: {
    caseSensitive?: boolean;
    page?: number;
}): PdfTextLine[];
/**
 * Trouve les champs proches d'une position donnée.
 */
export declare function findFieldsNearPosition(content: PdfDocumentContent, x: number, y: number, page: number, tolerance?: number): PdfField[];
/**
 * Calcule la similarité de position entre deux éléments.
 */
export declare function calculatePositionSimilarity(pos1: {
    x: number;
    y: number;
}, pos2: {
    x: number;
    y: number;
}, tolerance?: number): number;
