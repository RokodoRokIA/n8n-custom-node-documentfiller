/**
 * ============================================================================
 * TABLE EXTRACTOR SERVICE - Extraction des tableaux DOCX
 * ============================================================================
 *
 * Ce service extrait les tableaux d'un document DOCX et les convertit
 * en structures JSON exploitables.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Les tableaux DOCX utilisent <w:tbl>, <w:tr> (ligne), <w:tc> (cellule)
 * - La première ligne est souvent l'en-tête
 * - On peut convertir en array d'objets si les headers sont détectés
 *
 * @author Rokodo
 * @version 1.0.0
 */
import type { ExtractedTable } from '../../shared/types/extraction.types';
/**
 * Extrait tous les tableaux d'un document DOCX.
 *
 * @param xml - Contenu XML de word/document.xml
 * @param tableFormat - Format de sortie: 'array' ou 'objects'
 * @param includeStyles - Si true, inclut les styles des cellules
 * @returns Array de tableaux extraits
 */
export declare function extractTables(xml: string, tableFormat?: 'array' | 'objects', includeStyles?: boolean): ExtractedTable[];
/**
 * Compte le nombre total de cellules dans tous les tableaux.
 */
export declare function countTotalCells(tables: ExtractedTable[]): number;
/**
 * Vérifie si un tableau contient une cellule fusionnée.
 */
export declare function hasMergedCells(table: ExtractedTable): boolean;
/**
 * Extrait tous les textes des cellules d'un tableau.
 */
export declare function extractTableTexts(table: ExtractedTable): string[];
