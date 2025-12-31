/**
 * ============================================================================
 * SERVICE PATTERN MATCHER - Matching basé sur des patterns textuels
 * ============================================================================
 *
 * Ce service fournit un fallback pour le matching quand le LLM ne retourne
 * pas de résultats. Il utilise des patterns de texte prédéfinis pour
 * trouver les correspondances entre les tags et les paragraphes cibles.
 *
 * AMÉLIORATIONS v2.1:
 * - Détection des cellules vides APRÈS les labels (au lieu de placer sur le label)
 * - Gestion correcte des colonnes du tableau CA
 * - Mapping précis des tags PART_CA vers les cellules avec "%"
 *
 * UTILISÉ QUAND :
 * - Le LLM ne retourne aucun match
 * - Le LLM retourne une réponse invalide
 * - Mode hors-ligne
 *
 * @author Rokodo
 * @version 2.1.0
 */
import { TagContext, TargetParagraph, MatchResult } from '../../shared/types';
/**
 * Effectue le matching basé sur des patterns textuels.
 *
 * Cette fonction est un fallback robuste quand le LLM ne fonctionne pas.
 * Elle analyse les labels des tags du template et cherche des correspondances
 * dans les paragraphes du document cible.
 *
 * AMÉLIORATIONS v2.1:
 * - Les tags d'identification sont placés dans les cellules APRÈS les labels
 * - Les tags CA sont placés dans les bonnes colonnes du tableau
 * - Les tags PART_CA sont placés dans les cellules avec "%"
 *
 * @param tagContexts - Contextes des tags extraits du template
 * @param targetParagraphs - Paragraphes du document cible
 * @returns Liste des matches trouvés
 */
export declare function patternBasedMatching(tagContexts: TagContext[], targetParagraphs: TargetParagraph[]): MatchResult[];
