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

// ============================================================================
// CONSTANTES DE DIMENSION
// ============================================================================

/** Largeur A4 en points */
export const A4_WIDTH_PT = 595.28;

/** Hauteur A4 en points */
export const A4_HEIGHT_PT = 841.89;

/** Conversion: points par millimètre */
export const POINTS_PER_MM = 2.83465;

/** Conversion: points par pouce */
export const POINTS_PER_INCH = 72;

/** Marges par défaut (1 pouce = 72 points) */
export const DEFAULT_PDF_MARGINS: PageMargins = {
	top: 72,
	bottom: 72,
	left: 72,
	right: 72,
};

/** Taille de police par défaut en points */
export const DEFAULT_FONT_SIZE = 12;

/** Interligne par défaut (multiplicateur) */
export const DEFAULT_LINE_HEIGHT = 1.2;

// ============================================================================
// CONVERSIONS D'UNITÉS
// ============================================================================

/**
 * Convertit des millimètres en points.
 *
 * @param mm - Valeur en millimètres
 * @returns Valeur en points
 *
 * @example
 * const points = mmToPoints(210); // A4 largeur -> ~595.28pt
 */
export function mmToPoints(mm: number): number {
	return mm * POINTS_PER_MM;
}

/**
 * Convertit des points en millimètres.
 *
 * @param points - Valeur en points
 * @returns Valeur en millimètres
 */
export function pointsToMm(points: number): number {
	return points / POINTS_PER_MM;
}

/**
 * Convertit des pouces en points.
 *
 * @param inches - Valeur en pouces
 * @returns Valeur en points
 */
export function inchesToPoints(inches: number): number {
	return inches * POINTS_PER_INCH;
}

/**
 * Convertit des points en pouces.
 *
 * @param points - Valeur en points
 * @returns Valeur en pouces
 */
export function pointsToInches(points: number): number {
	return points / POINTS_PER_INCH;
}

/**
 * Convertit des twips (unité Word) en points.
 * 1 point = 20 twips.
 *
 * @param twips - Valeur en twips
 * @returns Valeur en points
 */
export function twipsToPoints(twips: number): number {
	return twips / 20;
}

/**
 * Convertit des EMUs (English Metric Units, utilisé dans DOCX) en points.
 * 1 point = 12700 EMUs.
 *
 * @param emus - Valeur en EMUs
 * @returns Valeur en points
 */
export function emusToPoints(emus: number): number {
	return emus / 12700;
}

// ============================================================================
// COULEURS
// ============================================================================

/**
 * Convertit une couleur hexadécimale en composantes RGB normalisées (0-1).
 *
 * @param hex - Couleur hexadécimale (ex: "FF0000", "#FF0000")
 * @returns Objet avec composantes r, g, b (0-1)
 *
 * @example
 * const { r, g, b } = hexToRgb('#FF0000'); // Rouge: { r: 1, g: 0, b: 0 }
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
	// Retirer le # si présent
	const cleanHex = hex.replace('#', '');

	// Parser les composantes
	const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
	const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
	const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

	return { r, g, b };
}

/**
 * Vérifie si une chaîne est une couleur hexadécimale valide.
 *
 * @param value - Valeur à tester
 * @returns true si couleur hex valide
 */
export function isValidHexColor(value: string): boolean {
	return /^#?[0-9A-Fa-f]{6}$/.test(value);
}

// ============================================================================
// TEXTE
// ============================================================================

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
export function estimateTextWidth(text: string, fontSize: number): number {
	// Largeur moyenne d'un caractère ≈ 0.5 * taille de police (pour Helvetica)
	const avgCharWidth = fontSize * 0.5;
	return text.length * avgCharWidth;
}

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
export function wrapText(
	text: string,
	maxWidth: number,
	fontSize: number
): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		const testWidth = estimateTextWidth(testLine, fontSize);

		if (testWidth > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}

	if (currentLine) {
		lines.push(currentLine);
	}

	return lines;
}

/**
 * Calcule la hauteur d'un bloc de texte avec interligne.
 *
 * @param lineCount - Nombre de lignes
 * @param fontSize - Taille de police en points
 * @param lineHeight - Multiplicateur d'interligne (défaut: 1.2)
 * @returns Hauteur totale en points
 */
export function calculateTextBlockHeight(
	lineCount: number,
	fontSize: number,
	lineHeight: number = DEFAULT_LINE_HEIGHT
): number {
	return lineCount * fontSize * lineHeight;
}

// ============================================================================
// IMAGES
// ============================================================================

/**
 * Détecte le type MIME d'une image à partir de ses magic bytes.
 *
 * @param buffer - Buffer contenant les données de l'image
 * @returns Type MIME ou null si non reconnu
 */
export function detectImageMimeType(buffer: Buffer): string | null {
	if (buffer.length < 4) return null;

	// PNG: 89 50 4E 47
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47
	) {
		return 'image/png';
	}

	// JPEG: FF D8 FF
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return 'image/jpeg';
	}

	// GIF: 47 49 46 38
	if (
		buffer[0] === 0x47 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x38
	) {
		return 'image/gif';
	}

	// BMP: 42 4D
	if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
		return 'image/bmp';
	}

	return null;
}

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
export function scaleImageToFit(
	imgWidth: number,
	imgHeight: number,
	maxWidth: number,
	maxHeight: number
): { width: number; height: number } {
	const widthRatio = maxWidth / imgWidth;
	const heightRatio = maxHeight / imgHeight;
	const ratio = Math.min(widthRatio, heightRatio, 1); // Ne pas agrandir

	return {
		width: imgWidth * ratio,
		height: imgHeight * ratio,
	};
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Calcule la zone de contenu disponible sur une page.
 *
 * @param pageWidth - Largeur de la page en points
 * @param pageHeight - Hauteur de la page en points
 * @param margins - Marges de la page
 * @returns Dimensions de la zone de contenu
 */
export function calculateContentArea(
	pageWidth: number,
	pageHeight: number,
	margins: PageMargins
): { width: number; height: number; x: number; y: number } {
	return {
		width: pageWidth - margins.left - margins.right,
		height: pageHeight - margins.top - margins.bottom,
		x: margins.left,
		y: margins.bottom, // Y=0 est en bas dans pdf-lib
	};
}

/**
 * Vérifie si un élément tient sur la page actuelle.
 *
 * @param currentY - Position Y actuelle (depuis le haut)
 * @param elementHeight - Hauteur de l'élément à placer
 * @param pageHeight - Hauteur de la page
 * @param bottomMargin - Marge du bas
 * @returns true si l'élément tient sur la page
 */
export function fitsOnCurrentPage(
	currentY: number,
	elementHeight: number,
	pageHeight: number,
	bottomMargin: number
): boolean {
	// currentY décroît depuis le haut de la page
	const remainingSpace = currentY - bottomMargin;
	return remainingSpace >= elementHeight;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Valide les options de conversion PDF.
 *
 * @param options - Options à valider
 * @returns Objet avec isValid et erreurs éventuelles
 */
export function validatePdfOptions(options: {
	fontSize?: number;
	margins?: Partial<PageMargins>;
}): { isValid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (options.fontSize !== undefined) {
		if (options.fontSize < 6 || options.fontSize > 72) {
			errors.push('La taille de police doit être entre 6 et 72 points');
		}
	}

	if (options.margins) {
		const marginNames = ['top', 'bottom', 'left', 'right'] as const;
		for (const name of marginNames) {
			const value = options.margins[name];
			if (value !== undefined && (value < 0 || value > 200)) {
				errors.push(`La marge ${name} doit être entre 0 et 200 points`);
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}
