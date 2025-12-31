/**
 * ============================================================================
 * SERVICE SEGMENT MATCHER - Matching par segment pour meilleure précision
 * ============================================================================
 *
 * Ce service améliore le matching en divisant les documents en segments
 * logiques (tableaux, sections) et en matchant segment par segment.
 *
 * AVANTAGES DE LA SEGMENTATION :
 * 1. Précision accrue : Les tags CA vont uniquement dans le segment financier
 * 2. Performance LLM : Moins de tokens par appel (segment vs document entier)
 * 3. Moins d'erreurs : Évite les confusions entre sections similaires
 * 4. Débogage facile : On sait exactement quel segment pose problème
 *
 * FLUX DE TRAVAIL :
 * 1. Segmenter le template et le document cible
 * 2. Matcher les segments entre eux (template segment ↔ target segment)
 * 3. Pour chaque paire de segments matchés, générer un prompt ciblé
 * 4. Combiner les résultats de tous les segments
 *
 * @author Rokodo
 * @version 2.0.0
 */
import { DocumentSegment } from '../../shared/utils/document-segmenter.utils';
import { TagContext, ExtractedTag, TargetParagraph, DocumentType, MatchResult } from '../../shared/types';
/**
 * Représente une paire de segments matchés (template + cible).
 */
export interface MatchedSegmentPair {
    /** Segment du template contenant les tags */
    templateSegment: DocumentSegment;
    /** Segment correspondant dans le document cible */
    targetSegment: DocumentSegment;
    /** Score de similarité (0-100) */
    matchScore: number;
    /** Tags à transférer dans ce segment */
    tagsToTransfer: string[];
    /** Contextes des tags extraits du segment template */
    tagContexts: TagContext[];
    /** Paragraphes cibles extraits du segment cible */
    targetParagraphs: TargetParagraph[];
}
/**
 * Résultat de la préparation du matching par segments.
 */
export interface SegmentMatchingPlan {
    /** Paires de segments à traiter */
    matchedPairs: MatchedSegmentPair[];
    /** Tags sans correspondance de segment */
    unmatchedTags: string[];
    /** Statistiques */
    stats: {
        totalTemplateSegments: number;
        totalTargetSegments: number;
        matchedSegments: number;
        totalTagsToTransfer: number;
    };
}
/**
 * Prépare le plan de matching par segments.
 *
 * Cette fonction analyse les deux documents, les segmente, et prépare
 * les paires de segments à traiter par le LLM.
 *
 * @param templateXml - XML du document template (avec tags)
 * @param targetXml - XML du document cible (sans tags)
 * @param extractedTags - Liste des tags extraits du template
 * @returns Plan de matching avec les paires de segments
 *
 * @example
 * const plan = prepareSegmentMatchingPlan(templateXml, targetXml, extractedTags);
 * console.log(`${plan.matchedPairs.length} paires de segments à traiter`);
 *
 * for (const pair of plan.matchedPairs) {
 *   const prompt = generateSegmentPrompt(pair, docType);
 *   const response = await callLLM(prompt);
 *   // ... traiter la réponse
 * }
 */
export declare function prepareSegmentMatchingPlan(templateXml: string, targetXml: string, extractedTags: ExtractedTag[]): SegmentMatchingPlan;
export declare function generateSegmentPrompt(pair: MatchedSegmentPair, docType: DocumentType): string;
/**
 * Réinitialise le cache des paragraphes globaux.
 * À appeler au début d'un nouveau traitement de document.
 */
export declare function resetParagraphCache(): void;
/**
 * Vide TOUS les caches du module.
 * À appeler APRÈS chaque traitement pour libérer la mémoire.
 *
 * IMPORTANT: Cette fonction DOIT être appelée à la fin de chaque
 * exécution du nœud pour éviter les fuites mémoire et les données
 * corrompues entre différentes exécutions.
 */
export declare function clearAllCaches(): void;
/**
 * Interface pour un match de tag.
 * Réexporte MatchResult pour compatibilité.
 */
export type TagMatch = MatchResult;
/**
 * Combine les résultats de matching de plusieurs segments.
 *
 * @param segmentResults - Résultats par segment
 * @param matchedPairs - Paires de segments utilisées
 * @returns Liste combinée des matches
 */
export declare function combineSegmentResults(segmentResults: Map<string, TagMatch[]>, matchedPairs: MatchedSegmentPair[]): TagMatch[];
/**
 * Affiche un résumé du plan de matching pour le débogage.
 *
 * @param plan - Le plan de matching
 */
export declare function logMatchingPlan(plan: SegmentMatchingPlan): void;
/**
 * Détermine si la segmentation doit être utilisée pour ce document.
 *
 * La segmentation est recommandée pour les documents volumineux
 * avec beaucoup de tags répartis sur plusieurs sections.
 *
 * @param templateXml - XML du template
 * @param extractedTags - Tags extraits
 * @returns true si la segmentation est recommandée
 */
export declare function shouldUseSegmentation(templateXml: string, extractedTags: ExtractedTag[]): boolean;
