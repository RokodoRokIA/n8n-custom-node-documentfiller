/**
 * ============================================================================
 * SERVICE PDF FILLER - Remplissage de PDF avec données
 * ============================================================================
 *
 * Ce service remplit un PDF avec des données en superposant du texte
 * aux positions identifiées par le matching. Il utilise pdf-lib pour
 * la manipulation du PDF.
 *
 * FONCTIONNALITÉS:
 * - Insertion de texte à des positions précises
 * - Gestion des polices (Helvetica par défaut)
 * - Ajustement automatique de la taille de police
 * - Support du texte multiligne
 *
 * @author Rokodo
 * @version 1.0.0
 */
import { PDFDocument, PDFPage } from 'pdf-lib';
import type { PdfMatchResult, PdfPlacement } from '../types';
/**
 * Remplit un PDF avec les données fournies aux positions matchées.
 *
 * @param pdfBuffer - Buffer du PDF original
 * @param matches - Résultats du matching
 * @param data - Données à insérer (tag -> valeur)
 * @param options - Options de remplissage
 * @returns Résultat avec le PDF modifié
 */
export declare function fillPdf(pdfBuffer: Buffer, matches: PdfMatchResult[], data: Record<string, string>, options?: {
    fontSize?: number;
    fontColor?: {
        r: number;
        g: number;
        b: number;
    };
    debug?: boolean;
}): Promise<{
    pdfBuffer: Buffer;
    placements: PdfPlacement[];
    errors: string[];
    warnings: string[];
}>;
/**
 * Remplit un champ checkbox.
 */
export declare function fillCheckbox(page: PDFPage, x: number, y: number, checked: boolean, options?: {
    size?: number;
    color?: {
        r: number;
        g: number;
        b: number;
    };
}): Promise<void>;
/**
 * Remplit plusieurs checkboxes en détectant leurs positions.
 */
export declare function fillCheckboxes(pdfBuffer: Buffer, pdfContent: {
    pages: Array<{
        pageNumber: number;
        lines: Array<{
            text: string;
            x: number;
            y: number;
        }>;
    }>;
}, checkboxData: Record<string, boolean>, fieldConfig: Record<string, {
    labels: string[];
    type: string;
}>, targetPage: number, debug?: boolean): Promise<{
    pdfBuffer: Buffer;
    filled: number;
    issues: string[];
}>;
/**
 * Dessine un rectangle (pour debug ou mise en évidence).
 */
export declare function drawDebugRectangle(page: PDFPage, x: number, y: number, width: number, height: number, options?: {
    borderColor?: {
        r: number;
        g: number;
        b: number;
    };
    fillColor?: {
        r: number;
        g: number;
        b: number;
    };
    borderWidth?: number;
}): void;
/**
 * Charge un PDF depuis un buffer et retourne le document.
 */
export declare function loadPdfDocument(buffer: Buffer): Promise<PDFDocument>;
/**
 * Sauvegarde un document PDF en buffer.
 */
export declare function savePdfDocument(doc: PDFDocument): Promise<Buffer>;
/**
 * Obtient les informations de base d'un PDF.
 */
export declare function getPdfInfo(buffer: Buffer): Promise<{
    pageCount: number;
    pages: {
        width: number;
        height: number;
    }[];
}>;
/**
 * Crée un nouveau PDF vide.
 */
export declare function createEmptyPdf(): Promise<PDFDocument>;
/**
 * Copie une page d'un PDF vers un autre.
 */
export declare function copyPage(sourcePdf: PDFDocument, targetPdf: PDFDocument, pageIndex: number): Promise<PDFPage>;
/**
 * Extrait une page d'un PDF.
 */
export declare function extractPage(pdfBuffer: Buffer, pageNumber: number): Promise<Buffer>;
/**
 * Fusionne plusieurs PDFs en un seul.
 */
export declare function mergePdfs(pdfBuffers: Buffer[]): Promise<Buffer>;
