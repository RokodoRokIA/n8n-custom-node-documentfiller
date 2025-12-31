/**
 * ============================================================================
 * STRUCTURE PARSER SERVICE - Analyse sémantique des documents DOCX
 * ============================================================================
 *
 * Ce service parse la structure d'un document DOCX et détecte les éléments
 * sémantiques: titres, listes, sections, paragraphes.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Les titres sont détectés via les styles Word (Heading1, Heading2, etc.)
 * - Les listes utilisent <w:numPr> pour le niveau et le type
 * - Les sections sont détectées par pattern (A., B., 1., etc.)
 *
 * @author Rokodo
 * @version 1.0.0
 */
import type { ExtractedContent, ExtractedTextStyle, HeadingLevel } from '../../shared/types/extraction.types';
interface ParsedElement {
    type: 'paragraph' | 'heading' | 'listItem';
    text: string;
    headingLevel?: HeadingLevel;
    listLevel?: number;
    listOrdered?: boolean;
    style?: ExtractedTextStyle;
    sectionId?: string;
}
/**
 * Parse la structure d'un document DOCX et retourne le contenu organisé.
 *
 * @param xml - Contenu XML de word/document.xml
 * @param preserveHierarchy - Si true, organise par sections/sous-sections
 * @param includeStyles - Si true, inclut les infos de style
 * @returns Contenu structuré
 */
export declare function parseDocumentStructure(xml: string, preserveHierarchy?: boolean, includeStyles?: boolean): ExtractedContent;
/**
 * Compte les mots dans un texte.
 */
export declare function countWords(text: string): number;
/**
 * Compte les caractères dans un texte (sans espaces).
 */
export declare function countCharacters(text: string): number;
/**
 * Détecte le nombre de titres par niveau.
 */
export declare function countHeadingsByLevel(elements: ParsedElement[]): Record<number, number>;
/**
 * Extrait tous les textes des paragraphes pour le comptage de mots.
 */
export declare function extractAllText(xml: string): string;
export {};
