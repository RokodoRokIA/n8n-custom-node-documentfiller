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
