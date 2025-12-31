/**
 * ============================================================================
 * SERVICE TAG REPLACER - Remplacement des tags dans le document
 * ============================================================================
 *
 * Ce service gère le remplacement des tags {{TAG}} par leurs valeurs
 * dans le XML du document DOCX.
 *
 * FONCTIONNALITÉS :
 * - Remplacement simple des tags par leurs valeurs
 * - Gestion des tags sans valeur (suppression ou conservation)
 * - Échappement des caractères spéciaux XML
 * - Suivi des tags remplacés et non remplacés
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Un tag est au format {{NOM_DU_TAG}} dans le document
 * - On cherche la valeur correspondante dans les données
 * - Si trouvée, on remplace le tag par la valeur
 * - Les caractères spéciaux (<, >, &, etc.) sont échappés
 *
 * @author Rokodo
 * @version 2.0.0
 */
import { TagReplacementResult } from '../../shared/types';
/**
 * Remplace tous les tags {{TAG}} dans le XML par leurs valeurs.
 *
 * @param xml - Le XML du document
 * @param data - Les données de remplacement (clé = nom du tag, valeur = contenu)
 * @param keepEmpty - Si true, conserve les tags sans valeur ; sinon les supprime
 * @returns Le XML modifié et les statistiques de remplacement
 *
 * @example
 * const xml = '<w:t>Nom: {{NOM}}, SIRET: {{SIRET}}</w:t>';
 * const data = { NOM: 'Ma Société' };
 * const result = replaceTagsInXml(xml, data, false);
 * // xml: '<w:t>Nom: Ma Société, SIRET: </w:t>'
 * // replaced: ['NOM']
 * // remaining: ['SIRET']
 */
export declare function replaceTagsInXml(xml: string, data: Record<string, string>, keepEmpty?: boolean): TagReplacementResult;
/**
 * Extrait tous les noms de tags uniques d'un document XML.
 *
 * Utile pour générer un rapport des tags présents dans le document.
 *
 * @param xml - Le XML du document
 * @returns Liste des noms de tags (sans les accolades), sans doublons
 *
 * @example
 * const xml = '<w:t>{{NOM}} et {{NOM}} et {{SIRET}}</w:t>';
 * const tags = extractTagsFromXml(xml);
 *
 */
export declare function extractTagsFromXml(xml: string): string[];
