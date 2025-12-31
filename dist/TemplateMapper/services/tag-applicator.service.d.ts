/**
 * ============================================================================
 * SERVICE TAG APPLICATOR - Application des tags dans le document
 * ============================================================================
 *
 * Ce service gère l'insertion physique des tags {{TAG}} dans le document XML.
 * Il prend les résultats du matching IA et modifie le XML en conséquence.
 *
 * TYPES D'INSERTION SUPPORTÉS :
 * - after_colon   : Après un deux-points (Nom : → Nom : {{NOM}})
 * - replace_empty : Remplace une cellule vide
 * - inline        : Dans le texte existant
 * - checkbox      : Pour les cases à cocher
 * - table_cell    : Cellule de tableau (logique spéciale)
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Le XML Word a une structure complexe avec des "runs" (<w:r>)
 * - Chaque run contient du texte (<w:t>) avec un formatage uniforme
 * - On doit modifier le XML tout en préservant la structure
 *
 * @author Rokodo
 * @version 2.0.0
 */
import { MatchResult, TargetParagraph, TagApplicationResult } from '../../shared/types';
/**
 * Applique les tags dans le document XML cible.
 *
 * Cette fonction prend les résultats du matching IA et insère chaque tag
 * dans le paragraphe correspondant du document XML.
 *
 * LOGIQUE IMPORTANTE :
 * - Les matches sont triés par index décroissant pour éviter les problèmes de décalage
 * - Chaque tag ne peut être utilisé qu'une seule fois
 * - Chaque paragraphe ne peut être modifié qu'une seule fois
 *
 * @param xml - Le XML du document cible
 * @param matches - Les résultats du matching IA
 * @param targetParagraphs - Les paragraphes extraits du document
 * @returns Le XML modifié et les statistiques d'application
 *
 * @example
 * const { xml, applied, failed } = applyTagsToTarget(documentXml, matches, paragraphs);
 * console.log(`${applied.length} tags appliqués, ${failed.length} échecs`);
 */
export declare function applyTagsToTarget(xml: string, matches: MatchResult[], targetParagraphs: TargetParagraph[]): TagApplicationResult;
