/**
 * ============================================================================
 * UTILITAIRES PDF - Fonctions pour la génération PDF
 * ============================================================================
 *
 * Ce fichier contient les utilitaires pour la conversion DOCX vers PDF.
 * Utilisé par le node DocxToPdf.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Les dimensions PDF sont en points (72 points = 1 pouce)
 * - A4 = 210mm x 297mm = 595.28pt x 841.89pt
 * - pdf-lib utilise un système de coordonnées où Y=0 est en bas de page
 *
 * @author Rokodo
 * @version 1.0.0
 */
import type { PageMargins } from '../types/pdf.types';
/** Largeur A4 en points */
export declare const A4_WIDTH_PT = 595.28;
/** Hauteur A4 en points */
export declare const A4_HEIGHT_PT = 841.89;
/** Conversion: points par millimètre */
export declare const POINTS_PER_MM = 2.83465;
/** Conversion: points par pouce */
export declare const POINTS_PER_INCH = 72;
/** Marges par défaut (1 pouce = 72 points) */
export declare const DEFAULT_PDF_MARGINS: PageMargins;
/** Taille de police par défaut en points */
export declare const DEFAULT_FONT_SIZE = 12;
/** Interligne par défaut (multiplicateur) */
export declare const DEFAULT_LINE_HEIGHT = 1.2;
/**
 * Convertit des millimètres en points.
 *
 * @param mm - Valeur en millimètres
 * @returns Valeur en points
 *
 * @example
 * const points = mmToPoints(210); // A4 largeur -> ~595.28pt
 */
export declare function mmToPoints(mm: number): number;
/**
 * Convertit des points en millimètres.
 *
 * @param points - Valeur en points
 * @returns Valeur en millimètres
 */
export declare function pointsToMm(points: number): number;
/**
 * Convertit des pouces en points.
 *
 * @param inches - Valeur en pouces
 * @returns Valeur en points
 */
export declare function inchesToPoints(inches: number): number;
/**
 * Convertit des points en pouces.
 *
 * @param points - Valeur en points
 * @returns Valeur en pouces
 */
export declare function pointsToInches(points: number): number;
/**
 * Convertit des twips (unité Word) en points.
 * 1 point = 20 twips.
 *
 * @param twips - Valeur en twips
 * @returns Valeur en points
 */
export declare function twipsToPoints(twips: number): number;
/**
 * Convertit des EMUs (English Metric Units, utilisé dans DOCX) en points.
 * 1 point = 12700 EMUs.
 *
 * @param emus - Valeur en EMUs
 * @returns Valeur en points
 */
export declare function emusToPoints(emus: number): number;
/**
 * Convertit une couleur hexadécimale en composantes RGB normalisées (0-1).
 *
 * @param hex - Couleur hexadécimale (ex: "FF0000", "#FF0000")
 * @returns Objet avec composantes r, g, b (0-1)
 *
 * @example
 * const { r, g, b } = hexToRgb('#FF0000'); // Rouge: { r: 1, g: 0, b: 0 }
 */
export declare function hexToRgb(hex: string): {
    r: number;
    g: number;
    b: number;
};
/**
 * Vérifie si une chaîne est une couleur hexadécimale valide.
 *
 * @param value - Valeur à tester
 * @returns true si couleur hex valide
 */
export declare function isValidHexColor(value: string): boolean;
/**
 * Estime la largeur d'un texte en points (approximation).
 *
 * Cette estimation est basée sur une largeur moyenne de caractère.
 * Pour un calcul précis, utilisez font.widthOfTextAtSize() de pdf-lib.
 *
 * @param text - Texte à mesurer
 * @param fontSize - Taille de police en points
 * @returns Largeur estimée en points
 */
export declare function estimateTextWidth(text: string, fontSize: number): number;
/**
 * Découpe un texte en lignes pour tenir dans une largeur maximale.
 *
 * @param text - Texte à découper
 * @param maxWidth - Largeur maximale en points
 * @param fontSize - Taille de police en points
 * @returns Array de lignes
 *
 * @example
 * const lines = wrapText('Un très long texte...', 200, 12);
 */
export declare function wrapText(text: string, maxWidth: number, fontSize: number): string[];
/**
 * Calcule la hauteur d'un bloc de texte avec interligne.
 *
 * @param lineCount - Nombre de lignes
 * @param fontSize - Taille de police en points
 * @param lineHeight - Multiplicateur d'interligne (défaut: 1.2)
 * @returns Hauteur totale en points
 */
export declare function calculateTextBlockHeight(lineCount: number, fontSize: number, lineHeight?: number): number;
/**
 * Détecte le type MIME d'une image à partir de ses magic bytes.
 *
 * @param buffer - Buffer contenant les données de l'image
 * @returns Type MIME ou null si non reconnu
 */
export declare function detectImageMimeType(buffer: Buffer): string | null;
/**
 * Calcule les dimensions pour adapter une image dans une zone tout en
 * préservant le ratio d'aspect.
 *
 * @param imgWidth - Largeur originale de l'image
 * @param imgHeight - Hauteur originale de l'image
 * @param maxWidth - Largeur maximale de la zone
 * @param maxHeight - Hauteur maximale de la zone
 * @returns Nouvelles dimensions { width, height }
 *
 * @example
 * const { width, height } = scaleImageToFit(800, 600, 200, 150);
 */
export declare function scaleImageToFit(imgWidth: number, imgHeight: number, maxWidth: number, maxHeight: number): {
    width: number;
    height: number;
};
/**
 * Calcule la zone de contenu disponible sur une page.
 *
 * @param pageWidth - Largeur de la page en points
 * @param pageHeight - Hauteur de la page en points
 * @param margins - Marges de la page
 * @returns Dimensions de la zone de contenu
 */
export declare function calculateContentArea(pageWidth: number, pageHeight: number, margins: PageMargins): {
    width: number;
    height: number;
    x: number;
    y: number;
};
/**
 * Vérifie si un élément tient sur la page actuelle.
 *
 * @param currentY - Position Y actuelle (depuis le haut)
 * @param elementHeight - Hauteur de l'élément à placer
 * @param pageHeight - Hauteur de la page
 * @param bottomMargin - Marge du bas
 * @returns true si l'élément tient sur la page
 */
export declare function fitsOnCurrentPage(currentY: number, elementHeight: number, pageHeight: number, bottomMargin: number): boolean;
/**
 * Valide les options de conversion PDF.
 *
 * @param options - Options à valider
 * @returns Objet avec isValid et erreurs éventuelles
 */
export declare function validatePdfOptions(options: {
    fontSize?: number;
    margins?: Partial<PageMargins>;
}): {
    isValid: boolean;
    errors: string[];
};
