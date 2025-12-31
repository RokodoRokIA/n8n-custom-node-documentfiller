/**
 * ============================================================================
 * DÉTECTEUR DE STYLES - Analyse sémantique des documents DOCX
 * ============================================================================
 *
 * Ce fichier contient les utilitaires pour détecter les styles et la structure
 * sémantique d'un document DOCX (titres, listes, sections).
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Word utilise des styles prédéfinis (Heading1, Heading2, etc.)
 * - Ces styles sont stockés dans <w:pStyle w:val="...">
 * - Les listes utilisent <w:numPr> pour le niveau et le type
 *
 * @author Rokodo
 * @version 1.0.0
 */

import type { HeadingLevel, ListItemInfo, SectionInfo } from '../types/extraction.types';
import type { ParagraphStyle } from '../types/pdf.types';

// ============================================================================
// DÉTECTION DES TITRES
// ============================================================================

/**
 * Mapping des styles Word vers les niveaux de titre.
 * Couvre les styles anglais et français courants.
 */
const HEADING_STYLE_MAP: Record<string, HeadingLevel> = {
	// Styles anglais
	'Heading1': 1,
	'Heading2': 2,
	'Heading3': 3,
	'Heading4': 4,
	'Heading5': 5,
	'Heading6': 6,
	// Styles français
	'Titre1': 1,
	'Titre2': 2,
	'Titre3': 3,
	'Titre4': 4,
	'Titre5': 5,
	'Titre6': 6,
	// Variantes
	'Title': 1,
	'Titre': 1,
	'Subtitle': 2,
	'Sous-titre': 2,
};

/**
 * Détecte le niveau de titre depuis le style Word.
 *
 * @param styleId - ID du style Word (ex: "Heading1", "Titre2")
 * @returns Niveau de titre (1-6) ou null si pas un titre
 *
 * @example
 * const level = detectHeadingFromStyle('Heading2'); // 2
 * const notHeading = detectHeadingFromStyle('Normal'); // null
 */
export function detectHeadingFromStyle(styleId: string): HeadingLevel | null {
	// Recherche directe dans le mapping
	if (HEADING_STYLE_MAP[styleId]) {
		return HEADING_STYLE_MAP[styleId];
	}

	// Recherche par pattern (Heading1, titre1, etc.)
	const headingMatch = styleId.match(/(?:heading|titre|head|title)[\s-_]?(\d)/i);
	if (headingMatch) {
		const level = parseInt(headingMatch[1], 10);
		if (level >= 1 && level <= 6) {
			return level as HeadingLevel;
		}
	}

	return null;
}

/**
 * Extrait le style ID d'un paragraphe XML.
 *
 * @param paragraphXml - XML du paragraphe (<w:p>...</w:p>)
 * @returns ID du style ou null
 *
 * @example
 * const styleId = extractStyleId('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>...</w:p>');
 * // 'Heading1'
 */
export function extractStyleId(paragraphXml: string): string | null {
	const match = paragraphXml.match(/<w:pStyle\s+w:val="([^"]+)"/);
	return match ? match[1] : null;
}

/**
 * Détecte si un paragraphe est un titre et retourne son niveau.
 *
 * @param paragraphXml - XML du paragraphe
 * @returns Niveau de titre (1-6) ou null
 */
export function detectHeadingLevel(paragraphXml: string): HeadingLevel | null {
	const styleId = extractStyleId(paragraphXml);
	if (styleId) {
		return detectHeadingFromStyle(styleId);
	}
	return null;
}

/**
 * Convertit un HeadingLevel en ParagraphStyle.
 *
 * @param level - Niveau de titre (1-6)
 * @returns Style de paragraphe correspondant
 */
export function headingLevelToStyle(level: HeadingLevel): ParagraphStyle {
	const styleMap: Record<HeadingLevel, ParagraphStyle> = {
		1: 'heading1',
		2: 'heading2',
		3: 'heading3',
		4: 'heading4',
		5: 'heading5',
		6: 'heading6',
	};
	return styleMap[level];
}

// ============================================================================
// DÉTECTION DES LISTES
// ============================================================================

/**
 * Détecte si un paragraphe est un élément de liste.
 *
 * Les listes Word utilisent <w:numPr> avec:
 * - <w:ilvl> : niveau d'indentation (0 = premier niveau)
 * - <w:numId> : ID de la définition de liste
 *
 * @param paragraphXml - XML du paragraphe
 * @returns Information sur l'élément de liste ou null
 */
export function detectListItem(paragraphXml: string): { level: number; numId: string } | null {
	// Chercher <w:numPr>
	const numPrMatch = paragraphXml.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
	if (!numPrMatch) {
		return null;
	}

	const numPrContent = numPrMatch[1];

	// Extraire le niveau d'indentation
	const ilvlMatch = numPrContent.match(/<w:ilvl\s+w:val="(\d+)"/);
	const level = ilvlMatch ? parseInt(ilvlMatch[1], 10) : 0;

	// Extraire l'ID de numérotation
	const numIdMatch = numPrContent.match(/<w:numId\s+w:val="(\d+)"/);
	const numId = numIdMatch ? numIdMatch[1] : '0';

	return { level, numId };
}

/**
 * Détecte si une liste est ordonnée (numérotée) ou non ordonnée (puces).
 *
 * Cette fonction analyse le texte pour détecter les patterns de numérotation.
 * Pour une détection précise, il faudrait analyser numbering.xml.
 *
 * @param text - Texte du premier élément de liste
 * @returns true si la liste semble ordonnée
 */
export function isOrderedList(text: string): boolean {
	// Patterns de listes numérotées
	const orderedPatterns = [
		/^\d+[\.\)]\s/, // 1. ou 1)
		/^[a-z][\.\)]\s/i, // a. ou a)
		/^[ivxlcdm]+[\.\)]\s/i, // i. ou i) (chiffres romains)
	];

	return orderedPatterns.some((pattern) => pattern.test(text.trim()));
}

/**
 * Extrait le numéro d'un élément de liste ordonnée.
 *
 * @param text - Texte de l'élément
 * @returns Numéro ou null si pas de numéro détecté
 */
export function extractListNumber(text: string): number | null {
	const match = text.trim().match(/^(\d+)[\.\)]\s/);
	return match ? parseInt(match[1], 10) : null;
}

// ============================================================================
// DÉTECTION DES SECTIONS
// ============================================================================

/**
 * Patterns pour détecter les identifiants de section.
 * Couvre les formats courants: A., B., 1., I., etc.
 */
const SECTION_PATTERNS = [
	// Lettres majuscules: A, B, C ou A., B., C.
	/^([A-Z])[\.\s\-:]/,
	// Lettres minuscules: a., b., c.
	/^([a-z])[\.\s\-:]/,
	// Chiffres arabes: 1., 2., 3.
	/^(\d+)[\.\s\-:]/,
	// Chiffres romains: I., II., III.
	/^([IVXLCDM]+)[\.\s\-:]/i,
	// "Section X" ou "Article X"
	/^(?:section|article|chapitre|partie)\s+(\w+)/i,
];

/**
 * Détecte si un texte représente un titre de section et retourne ses informations.
 *
 * @param text - Texte à analyser
 * @returns Information sur la section ou null
 *
 * @example
 * detectSectionInfo('A. Introduction'); // { id: 'A', title: 'Introduction', level: 1 }
 * detectSectionInfo('1.2 Contexte'); // { id: '1.2', title: 'Contexte', level: 2 }
 */
export function detectSectionInfo(text: string): SectionInfo | null {
	const trimmedText = text.trim();

	for (const pattern of SECTION_PATTERNS) {
		const match = trimmedText.match(pattern);
		if (match) {
			const id = match[1];
			const restOfText = trimmedText.substring(match[0].length).trim();

			// Calculer le niveau basé sur le format
			let level = 1;
			if (/^\d+\.\d+/.test(trimmedText)) {
				level = 2; // Format 1.1, 2.3, etc.
			} else if (/^\d+\.\d+\.\d+/.test(trimmedText)) {
				level = 3; // Format 1.1.1
			}

			return {
				id: id.toUpperCase(),
				title: restOfText || trimmedText,
				level,
			};
		}
	}

	return null;
}

/**
 * Détecte le changement de section dans un document.
 * Compare deux textes pour voir s'ils appartiennent à des sections différentes.
 *
 * @param currentSection - Section actuelle (peut être null)
 * @param text - Nouveau texte à analyser
 * @returns Nouvelle section si changement, null sinon
 */
export function detectSectionChange(
	currentSection: SectionInfo | null,
	text: string
): SectionInfo | null {
	const newSection = detectSectionInfo(text);

	if (!newSection) {
		return null;
	}

	if (!currentSection || newSection.id !== currentSection.id) {
		return newSection;
	}

	return null;
}

// ============================================================================
// DÉTECTION DES STYLES DE TEXTE
// ============================================================================

/**
 * Détecte si un run de texte est en gras.
 *
 * @param runXml - XML du run (<w:r>...</w:r>)
 * @returns true si le texte est en gras
 */
export function isBold(runXml: string): boolean {
	// <w:b/> ou <w:b w:val="true"/> ou <w:b w:val="1"/>
	return /<w:b(?:\s+w:val="(?:true|1|on)")?(?:\s*\/)?>/.test(runXml);
}

/**
 * Détecte si un run de texte est en italique.
 *
 * @param runXml - XML du run
 * @returns true si le texte est en italique
 */
export function isItalic(runXml: string): boolean {
	return /<w:i(?:\s+w:val="(?:true|1|on)")?(?:\s*\/)?>/.test(runXml);
}

/**
 * Détecte si un run de texte est souligné.
 *
 * @param runXml - XML du run
 * @returns true si le texte est souligné
 */
export function isUnderline(runXml: string): boolean {
	// <w:u w:val="single"/> ou autres valeurs de soulignement
	return /<w:u\s+w:val="(?!none)[^"]+"\s*\/?>/.test(runXml);
}

/**
 * Extrait la taille de police d'un run.
 *
 * @param runXml - XML du run
 * @returns Taille en points ou null
 */
export function extractFontSize(runXml: string): number | null {
	// <w:sz w:val="24"/> - valeur en demi-points
	const match = runXml.match(/<w:sz\s+w:val="(\d+)"/);
	if (match) {
		return parseInt(match[1], 10) / 2; // Convertir demi-points en points
	}
	return null;
}

/**
 * Extrait la couleur du texte d'un run.
 *
 * @param runXml - XML du run
 * @returns Couleur hex (sans #) ou null
 */
export function extractTextColor(runXml: string): string | null {
	// <w:color w:val="FF0000"/>
	const match = runXml.match(/<w:color\s+w:val="([0-9A-Fa-f]{6})"/);
	return match ? match[1] : null;
}

/**
 * Extrait le nom de la police d'un run.
 *
 * @param runXml - XML du run
 * @returns Nom de la police ou null
 */
export function extractFontFamily(runXml: string): string | null {
	// <w:rFonts w:ascii="Arial"/>
	const match = runXml.match(/<w:rFonts[^>]+w:ascii="([^"]+)"/);
	return match ? match[1] : null;
}

// ============================================================================
// ANALYSE D'ALIGNEMENT
// ============================================================================

/**
 * Extrait l'alignement d'un paragraphe.
 *
 * @param paragraphXml - XML du paragraphe
 * @returns Alignement ou 'left' par défaut
 */
export function extractAlignment(
	paragraphXml: string
): 'left' | 'center' | 'right' | 'justify' {
	// <w:jc w:val="center"/>
	const match = paragraphXml.match(/<w:jc\s+w:val="([^"]+)"/);

	if (match) {
		const val = match[1].toLowerCase();
		switch (val) {
			case 'center':
				return 'center';
			case 'right':
			case 'end':
				return 'right';
			case 'both':
			case 'justify':
				return 'justify';
			default:
				return 'left';
		}
	}

	return 'left';
}

// ============================================================================
// ESPACEMENT
// ============================================================================

/**
 * Extrait l'espacement d'un paragraphe.
 *
 * @param paragraphXml - XML du paragraphe
 * @returns Espacement { before, after, lineHeight } en points
 */
export function extractSpacing(paragraphXml: string): {
	before?: number;
	after?: number;
	lineHeight?: number;
} {
	const result: { before?: number; after?: number; lineHeight?: number } = {};

	// <w:spacing w:before="240" w:after="120" w:line="360"/>
	const spacingMatch = paragraphXml.match(/<w:spacing([^>]+)>/);
	if (spacingMatch) {
		const attrs = spacingMatch[1];

		const beforeMatch = attrs.match(/w:before="(\d+)"/);
		if (beforeMatch) {
			result.before = parseInt(beforeMatch[1], 10) / 20; // twips to points
		}

		const afterMatch = attrs.match(/w:after="(\d+)"/);
		if (afterMatch) {
			result.after = parseInt(afterMatch[1], 10) / 20;
		}

		const lineMatch = attrs.match(/w:line="(\d+)"/);
		if (lineMatch) {
			// Valeur en 240e de ligne (240 = simple, 360 = 1.5, 480 = double)
			result.lineHeight = parseInt(lineMatch[1], 10) / 240;
		}
	}

	return result;
}
