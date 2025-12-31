/**
 * ============================================================================
 * UTILITAIRES XML - Manipulation de contenu XML Word
 * ============================================================================
 *
 * Ce module contient toutes les fonctions utilitaires pour manipuler le XML
 * des documents Word (DOCX). Les fichiers DOCX sont des archives ZIP contenant
 * des fichiers XML, principalement word/document.xml.
 *
 * STRUCTURE XML WORD (pour les développeurs juniors) :
 * ----------------------------------------------------
 * - <w:p>     : Paragraphe (paragraph)
 * - <w:r>     : Run - une portion de texte avec un formatage uniforme
 * - <w:t>     : Texte brut (text)
 * - <w:tc>    : Cellule de tableau (table cell)
 * - <w:tr>    : Ligne de tableau (table row)
 * - <w:tbl>   : Tableau (table)
 * - <w:rPr>   : Propriétés de run (formatage du texte)
 * - <w:pPr>   : Propriétés de paragraphe
 *
 * EXEMPLE DE STRUCTURE XML :
 * ```xml
 * <w:p>                           <!-- Paragraphe -->
 *   <w:pPr>...</w:pPr>           <!-- Propriétés du paragraphe -->
 *   <w:r>                         <!-- Run 1 -->
 *     <w:rPr>...</w:rPr>         <!-- Formatage (gras, italique, etc.) -->
 *     <w:t>Nom : </w:t>          <!-- Texte -->
 *   </w:r>
 *   <w:r>                         <!-- Run 2 -->
 *     <w:t>{{NOM}}</w:t>         <!-- Tag à remplacer -->
 *   </w:r>
 * </w:p>
 * ```
 *
 * @author Rokodo
 * @version 2.0.0
 */
import { XmlValidationResult } from '../types';
/**
 * Extrait le texte brut d'un contenu XML Word.
 *
 * Cette fonction trouve tous les éléments <w:t> (texte) et concatène
 * leur contenu pour obtenir le texte visible du document.
 *
 * @param xmlContent - Contenu XML à analyser
 * @returns Le texte extrait, concaténé
 *
 * @example
 * const xml = '<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>World</w:t></w:r></w:p>';
 * const text = extractTextFromXml(xml); // "Hello World"
 */
export declare function extractTextFromXml(xmlContent: string): string;
/**
 * Reconstruit le texte fragmenté dans les runs XML.
 *
 * PROBLÈME RÉSOLU :
 * Word fragmente parfois le texte en plusieurs éléments <w:t> pour des raisons
 * de formatage ou de vérification orthographique. Par exemple, "{{NOM}}" peut
 * devenir "<w:t>{{</w:t><w:t>NOM</w:t><w:t>}}</w:t>", ce qui casse la détection des tags.
 *
 * Cette fonction fusionne les éléments <w:t> consécutifs dans un même <w:r>
 * pour reconstituer le texte original.
 *
 * @param xml - Le XML à reconstruire
 * @returns Le XML avec le texte reconstruit
 *
 * @example
 * // Avant: <w:r><w:t>{{</w:t><w:t>NOM</w:t><w:t>}}</w:t></w:r>
 * // Après: <w:r><w:t>{{NOM}}</w:t></w:r>
 */
export declare function reconstructFragmentedText(xml: string): string;
/**
 * Valide que le XML est bien formé et ne contient pas d'erreurs structurelles.
 *
 * Cette validation est importante car un XML mal formé peut corrompre
 * le document Word et le rendre illisible.
 *
 * VÉRIFICATIONS EFFECTUÉES :
 * 1. Pas de caractères invalides dans les attributs XML
 * 2. Les tags {{...}} ne sont pas dans des attributs (ce qui est invalide)
 * 3. Les balises principales sont équilibrées
 *
 * @param xml - Le XML à valider
 * @returns Un objet indiquant si le XML est valide et l'erreur éventuelle
 *
 * @example
 * const result = validateXml(xmlContent);
 * if (!result.valid) {
 *   console.error('XML invalide:', result.error);
 * }
 */
export declare function validateXml(xml: string): XmlValidationResult;
/**
 * Échappe les caractères spéciaux pour les inclure dans du XML.
 *
 * Les caractères <, >, &, " et ' ont une signification spéciale en XML
 * et doivent être échappés pour apparaître en tant que texte.
 *
 * @param value - La chaîne à échapper
 * @returns La chaîne avec les caractères spéciaux échappés
 *
 * @example
 * escapeXml('A & B');   // "A &amp; B"
 * escapeXml('<tag>');   // "&lt;tag&gt;"
 * escapeXml('"test"');  // "&quot;test&quot;"
 */
export declare function escapeXml(value: string): string;
/**
 * Vérifie si un paragraphe est à l'intérieur d'une cellule de tableau.
 *
 * Cette fonction est utile pour adapter le comportement d'insertion des tags
 * selon qu'on est dans un paragraphe normal ou une cellule de tableau.
 *
 * LOGIQUE :
 * On compte les balises <w:tc> (ouverture de cellule) et </w:tc> (fermeture)
 * avant le paragraphe. Si on a plus d'ouvertures que de fermetures,
 * on est à l'intérieur d'une cellule.
 *
 * @param xml - Le XML complet du document
 * @param paragraphStart - Position de début du paragraphe dans le XML
 * @param paragraphXml - Le XML du paragraphe lui-même
 * @returns true si le paragraphe est dans une cellule de tableau
 */
export declare function isInsideTableCell(xml: string, paragraphStart: number, paragraphXml: string): boolean;
/**
 * Interface pour un paragraphe XML extrait.
 */
export interface ExtractedParagraph {
    /** Texte brut du paragraphe */
    text: string;
    /** Position de début dans le XML */
    xmlStart: number;
    /** Position de fin dans le XML */
    xmlEnd: number;
    /** Le XML complet du paragraphe */
    xml: string;
}
/**
 * Extrait tous les paragraphes d'un document XML Word.
 *
 * @param xml - Le XML du document
 * @returns Liste des paragraphes avec leur position et contenu
 */
export declare function extractParagraphsFromXml(xml: string): ExtractedParagraph[];
