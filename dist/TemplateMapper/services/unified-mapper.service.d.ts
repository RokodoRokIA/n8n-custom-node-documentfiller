/**
 * ============================================================================
 * SERVICE UNIFIED MAPPER - Mapping unifié Tags + Checkboxes + Tables
 * ============================================================================
 *
 * Ce service centralise TOUT le mapping IA en un seul appel LLM.
 * Il utilise le pattern Few-Shot Learning pour apprendre du template
 * et appliquer les mêmes patterns au document cible.
 *
 * ARCHITECTURE CLEAN CODE:
 * - 1 seul appel LLM au lieu de 2-N
 * - Pattern Few-Shot cohérent pour tags, checkboxes et tableaux
 * - Fallback intelligent si l'IA échoue
 *
 * @author Rokodo
 * @version 1.0.0 - Refactorisation architecture
 */
import { DocumentType, TagContext, ExtractedTag, TargetParagraph, MatchResult, LLMModel } from '../../shared/types';
import { ExtractedCheckbox, CheckboxPair } from '../../shared/utils/checkbox.utils';
/**
 * Décision de l'IA pour une checkbox.
 */
export interface CheckboxDecision {
    targetIndex: number;
    label: string;
    shouldBeChecked: boolean;
    confidence: number;
    reason?: string;
}
/**
 * Résultat complet du mapping unifié.
 */
export interface UnifiedMappingResult {
    tagMatches: MatchResult[];
    checkboxDecisions: CheckboxDecision[];
    llmRawResponse?: string;
    mode: 'unified_ai' | 'fallback_semantic';
}
/**
 * Contexte complet pour le mapping.
 */
export interface MappingContext {
    tagContexts: TagContext[];
    extractedTags: ExtractedTag[];
    templateCheckboxes: ExtractedCheckbox[];
    templateCheckboxPairs: CheckboxPair[];
    targetParagraphs: TargetParagraph[];
    targetCheckboxes: ExtractedCheckbox[];
    targetXml: string;
    docType: DocumentType;
    debug: boolean;
}
/**
 * Effectue le mapping unifié Tags + Checkboxes en un seul appel LLM.
 *
 * Cette fonction:
 * 1. Génère un prompt Few-Shot unifié
 * 2. Appelle le LLM une seule fois
 * 3. Parse les résultats pour tags ET checkboxes
 * 4. Retourne un résultat consolidé
 *
 * @param model - Modèle LLM connecté
 * @param context - Contexte complet du mapping
 * @returns Résultat du mapping unifié
 */
export declare function performUnifiedMapping(model: LLMModel, context: MappingContext): Promise<UnifiedMappingResult>;
/**
 * Applique les décisions de checkboxes au XML.
 */
export declare function applyCheckboxDecisions(xml: string, decisions: CheckboxDecision[], targetCheckboxes: ExtractedCheckbox[]): {
    xml: string;
    applied: string[];
    failed: string[];
};
