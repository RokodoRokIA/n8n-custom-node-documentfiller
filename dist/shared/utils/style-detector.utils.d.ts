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
import type { HeadingLevel, SectionInfo } from '../types/extraction.types';
import type { ParagraphStyle } from '../types/pdf.types';
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
export declare function detectHeadingFromStyle(styleId: string): HeadingLevel | null;
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
export declare function extractStyleId(paragraphXml: string): string | null;
/**
 * Détecte si un paragraphe est un titre et retourne son niveau.
 *
 * @param paragraphXml - XML du paragraphe
 * @returns Niveau de titre (1-6) ou null
 */
export declare function detectHeadingLevel(paragraphXml: string): HeadingLevel | null;
/**
 * Convertit un HeadingLevel en ParagraphStyle.
 *
 * @param level - Niveau de titre (1-6)
 * @returns Style de paragraphe correspondant
 */
export declare function headingLevelToStyle(level: HeadingLevel): ParagraphStyle;
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
export declare function detectListItem(paragraphXml: string): {
    level: number;
    numId: string;
} | null;
/**
 * Détecte si une liste est ordonnée (numérotée) ou non ordonnée (puces).
 *
 * Cette fonction analyse le texte pour détecter les patterns de numérotation.
 * Pour une détection précise, il faudrait analyser numbering.xml.
 *
 * @param text - Texte du premier élément de liste
 * @returns true si la liste semble ordonnée
 */
export declare function isOrderedList(text: string): boolean;
/**
 * Extrait le numéro d'un élément de liste ordonnée.
 *
 * @param text - Texte de l'élément
 * @returns Numéro ou null si pas de numéro détecté
 */
export declare function extractListNumber(text: string): number | null;
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
export declare function detectSectionInfo(text: string): SectionInfo | null;
/**
 * Détecte le changement de section dans un document.
 * Compare deux textes pour voir s'ils appartiennent à des sections différentes.
 *
 * @param currentSection - Section actuelle (peut être null)
 * @param text - Nouveau texte à analyser
 * @returns Nouvelle section si changement, null sinon
 */
export declare function detectSectionChange(currentSection: SectionInfo | null, text: string): SectionInfo | null;
/**
 * Détecte si un run de texte est en gras.
 *
 * @param runXml - XML du run (<w:r>...</w:r>)
 * @returns true si le texte est en gras
 */
export declare function isBold(runXml: string): boolean;
/**
 * Détecte si un run de texte est en italique.
 *
 * @param runXml - XML du run
 * @returns true si le texte est en italique
 */
export declare function isItalic(runXml: string): boolean;
/**
 * Détecte si un run de texte est souligné.
 *
 * @param runXml - XML du run
 * @returns true si le texte est souligné
 */
export declare function isUnderline(runXml: string): boolean;
/**
 * Extrait la taille de police d'un run.
 *
 * @param runXml - XML du run
 * @returns Taille en points ou null
 */
export declare function extractFontSize(runXml: string): number | null;
/**
 * Extrait la couleur du texte d'un run.
 *
 * @param runXml - XML du run
 * @returns Couleur hex (sans #) ou null
 */
export declare function extractTextColor(runXml: string): string | null;
/**
 * Extrait le nom de la police d'un run.
 *
 * @param runXml - XML du run
 * @returns Nom de la police ou null
 */
export declare function extractFontFamily(runXml: string): string | null;
/**
 * Extrait l'alignement d'un paragraphe.
 *
 * @param paragraphXml - XML du paragraphe
 * @returns Alignement ou 'left' par défaut
 */
export declare function extractAlignment(paragraphXml: string): 'left' | 'center' | 'right' | 'justify';
/**
 * Extrait l'espacement d'un paragraphe.
 *
 * @param paragraphXml - XML du paragraphe
 * @returns Espacement { before, after, lineHeight } en points
 */
export declare function extractSpacing(paragraphXml: string): {
    before?: number;
    after?: number;
    lineHeight?: number;
};
