/**
 * ============================================================================
 * UTILITAIRES DOCX - Opérations de haut niveau sur les documents Word
 * ============================================================================
 *
 * Ce module contient les fonctions utilitaires de haut niveau pour travailler
 * avec les documents DOCX. Il s'appuie sur xml.utils et text.utils.
 *
 * @author Rokodo
 * @version 2.0.0
 */
import PizZip from 'pizzip';
import { DocumentDetectionResult, TagContext, ExtractedTag, TargetParagraph } from '../types';
/**
 * Charge un document DOCX et extrait son contenu XML principal.
 *
 * @param buffer - Le buffer du fichier DOCX
 * @returns Un objet contenant le zip et le XML du document
 * @throws Error si le fichier n'est pas un DOCX valide
 *
 * @example
 * const { zip, xml } = loadDocxContent(buffer);
 * // xml contient le contenu de word/document.xml
 */
export declare function loadDocxContent(buffer: Buffer): {
    zip: PizZip;
    xml: string;
};
/**
 * Sauvegarde le XML modifié dans le document DOCX.
 *
 * @param zip - L'archive ZIP du document
 * @param xml - Le nouveau contenu XML
 * @returns Le buffer du document modifié
 */
export declare function saveDocxContent(zip: PizZip, xml: string): Buffer;
/**
 * Résultat de la validation XML DOCX (version détaillée).
 */
export interface DocxXmlValidationResult {
    isValid: boolean;
    errors: XmlValidationError[];
    warnings: string[];
}
/**
 * Erreur de validation XML.
 */
export interface XmlValidationError {
    type: 'unclosed_tag' | 'mismatched_tag' | 'invalid_structure' | 'corrupted_content' | 'encoding_error';
    message: string;
    position?: number;
    tag?: string;
    severity: 'critical' | 'warning';
}
/**
 * Valide que le XML DOCX est structurellement correct.
 *
 * VERSION v4.2 SIMPLIFIÉE:
 * - Ne vérifie que les erreurs VRAIMENT critiques
 * - Évite les faux positifs qui empêchaient le fonctionnement
 *
 * Erreurs critiques:
 * 1. Balises w:document ou w:body non fermées
 * 2. Caractères de contrôle invalides
 *
 * @param xml - Le XML à valider
 * @returns Résultat de la validation avec erreurs détaillées
 */
export declare function validateDocxXml(xml: string): DocxXmlValidationResult;
/**
 * Tente de réparer un XML DOCX corrompu.
 *
 * Cette fonction essaie de corriger les problèmes courants:
 * 1. Fermer les balises non fermées
 * 2. Supprimer les caractères invalides
 * 3. Corriger les tags {{TAG}} mal formés
 *
 * @param xml - Le XML à réparer
 * @param originalXml - Le XML original (pour rollback si nécessaire)
 * @returns Le XML réparé ou l'original si la réparation échoue
 */
export declare function repairDocxXml(xml: string, originalXml: string): {
    xml: string;
    repaired: boolean;
    repairs: string[];
};
/**
 * Détecte automatiquement le type de document administratif.
 *
 * Cette fonction analyse le contenu et le nom du fichier pour déterminer
 * s'il s'agit d'un DC1, DC2, AE ou autre type de document.
 *
 * CRITÈRES DE DÉTECTION :
 * - Nom du fichier (DC1, DC2, AE)
 * - Présence de phrases clés ("Lettre de candidature" pour DC1, etc.)
 * - Mots-clés spécifiques à chaque type
 *
 * @param xml - Le contenu XML du document
 * @param filename - Le nom du fichier (optionnel)
 * @returns Le type détecté et le nom de l'acheteur si trouvé
 *
 * @example
 * const result = detectDocumentType(xml, 'DC1_entreprise.docx');
 * // { type: 'DC1', acheteur: 'Ville de Paris' }
 */
export declare function detectDocumentType(xml: string, filename?: string): DocumentDetectionResult;
/**
 * Extrait tous les tags d'un template avec leur contexte complet.
 *
 * Cette fonction analyse un document DOCX déjà taggué et extrait :
 * - Chaque tag avec son nom
 * - Le texte qui le précède (label)
 * - Le texte qui le suit
 * - La section du document
 * - Le type de tag (texte, checkbox, etc.)
 *
 * Utilisé pour le "Transfer Learning" : apprendre d'un template
 * pour taguer un document similaire.
 *
 * @param xml - Le XML du template
 * @returns Liste des tags avec leur contexte
 */
export declare function extractTagContextsFromTemplate(xml: string): TagContext[];
/**
 * Extrait automatiquement tous les tags d'un template XML.
 *
 * Version simplifiée qui retourne uniquement les tags et leurs types
 * déduits, sans le contexte complet.
 *
 * @param xml - Le XML du template
 * @returns Liste des tags extraits avec leur type
 */
export declare function extractTagsFromTemplateXml(xml: string): ExtractedTag[];
/**
 * Génère une structure de données vide basée sur les tags extraits.
 *
 * Cette structure peut être utilisée comme template pour remplir le document.
 *
 * @param extractedTags - Les tags extraits du template
 * @returns Un objet avec chaque tag comme clé et une valeur par défaut
 */
export declare function generateDataStructureFromTags(extractedTags: ExtractedTag[]): Record<string, unknown>;
/**
 * Extrait tous les paragraphes du document cible avec métadonnées.
 *
 * Cette fonction prépare le document cible pour le matching avec les tags.
 *
 * @param xml - Le XML du document cible
 * @returns Liste des paragraphes avec leurs métadonnées
 */
export declare function extractTargetParagraphs(xml: string): TargetParagraph[];
/**
 * Représente une cellule de tableau extraite.
 */
export interface TableCellInfo {
    /** Index du tableau dans le document */
    tableIndex: number;
    /** Index de la ligne (0 = en-tête) */
    rowIndex: number;
    /** Index de la colonne */
    columnIndex: number;
    /** Texte de la cellule */
    text: string;
    /** Est-ce une cellule vide ? */
    isEmpty: boolean;
    /** Texte de l'en-tête de ligne (colonne 0) */
    rowHeader: string;
    /** Texte de l'en-tête de colonne (ligne 0) */
    columnHeader: string;
    /** Position dans le XML */
    xmlStart: number;
    xmlEnd: number;
    /** Contient des tags ? */
    hasTags: boolean;
    /** Tags trouvés */
    tags: string[];
}
/**
 * Extrait toutes les cellules de tableaux avec leurs positions.
 * Inclut les cellules vides (crucial pour le matching des tableaux multi-colonnes).
 *
 * @param xml - Le XML du document
 * @returns Liste des cellules avec leur position dans le tableau
 */
export declare function extractTableCells(xml: string): TableCellInfo[];
/**
 * Enrichit les paragraphes cibles avec les informations de position dans les tableaux.
 * Ajoute également les cellules vides comme paragraphes potentiels.
 *
 * AMÉLIORATION v4.0:
 * - Enrichit TOUS les paragraphes dont la position XML est dans une cellule
 * - Ajoute les cellules vides même en colonne 0
 * - Meilleure détection des positions avec tolérance
 *
 * @param xml - Le XML du document
 * @param paragraphs - Les paragraphes déjà extraits
 * @returns Paragraphes enrichis avec position de tableau + cellules vides ajoutées
 */
export declare function enrichParagraphsWithTableInfo(xml: string, paragraphs: TargetParagraph[]): TargetParagraph[];
