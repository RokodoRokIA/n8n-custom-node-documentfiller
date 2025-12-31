/**
 * ============================================================================
 * SERVICE REACT AGENT - Agent Autonome pour le Mapping de Documents
 * ============================================================================
 *
 * Ce service implémente un vrai agent ReAct (Reasoning-Acting-Observing-Correcting)
 * qui place les tags dans un document de manière autonome et vérifie son travail.
 *
 * ARCHITECTURE:
 * 1. ANALYSE PROFONDE du document cible
 * 2. BOUCLE REACT avec vérification post-application
 * 3. AUTO-CORRECTION jusqu'à satisfaction
 *
 * DIFFÉRENCES AVEC L'ANCIENNE APPROCHE:
 * - L'agent RELIT le document après chaque modification
 * - L'agent VÉRIFIE que les tags sont aux bons endroits
 * - L'agent CORRIGE les erreurs automatiquement
 * - L'agent continue jusqu'à satisfaction (pas juste 3 itérations)
 *
 * @author Rokodo
 * @version 2.0.0 - Agent ReAct Autonome
 */
import { DocumentType, TagContext, ExtractedTag, TargetParagraph, MatchResult, LLMModel } from '../../shared/types';
import { ExtractedCheckbox, CheckboxPair } from '../../shared/utils/checkbox.utils';
/**
 * Tag attendu dans le document (checklist)
 */
export interface ExpectedTag {
    tag: string;
    fullTag: string;
    expectedLocation: {
        type: 'text' | 'table_cell' | 'checkbox';
        tableIndex?: number;
        rowIndex?: number;
        columnIndex?: number;
        nearText?: string;
        section?: string;
    };
    templateContext: {
        labelBefore: string;
        labelAfter: string;
        rowHeader?: string;
        columnHeader?: string;
    };
    status: 'pending' | 'placed' | 'verified' | 'failed';
}
/**
 * Problème détecté par l'agent
 */
export interface AgentIssue {
    type: 'missing_tag' | 'wrong_position' | 'empty_cell' | 'duplicate' | 'semantic_mismatch';
    severity: 'critical' | 'warning' | 'info';
    tag?: string;
    description: string;
    suggestedFix?: string;
    location?: {
        tableIndex?: number;
        rowIndex?: number;
        columnIndex?: number;
        paragraphIndex?: number;
    };
}
/**
 * Action effectuée par l'agent
 */
export interface AgentAction {
    type: 'analyze' | 'think' | 'call_llm' | 'apply_tags' | 'observe' | 'verify' | 'correct';
    iteration: number;
    timestamp: number;
    details: Record<string, unknown>;
    result: 'success' | 'partial' | 'failed';
}
/**
 * État complet de l'agent
 */
export interface AgentState {
    iteration: number;
    maxIterations: number;
    currentXml: string;
    expectedTags: ExpectedTag[];
    foundTags: FoundTag[];
    issues: AgentIssue[];
    actions: AgentAction[];
    satisfaction: number;
    tagsPlaced: number;
    tagsVerified: number;
}
/**
 * Tag trouvé dans le document
 */
export interface FoundTag {
    tag: string;
    fullTag: string;
    xmlPosition: number;
    context: string;
    inTableCell: boolean;
    tableIndex?: number;
    rowIndex?: number;
    columnIndex?: number;
}
/**
 * Résultat de l'agent
 */
export interface AgentResult {
    success: boolean;
    xml: string;
    state: AgentState;
    iterations: number;
    satisfaction: number;
    tagsExpected: number;
    tagsVerified: number;
    tagsFailed: number;
    tagMatches: MatchResult[];
    checkboxDecisions: CheckboxDecision[];
    mode: 'react_agent';
}
/**
 * Décision checkbox (compatibilité)
 */
export interface CheckboxDecision {
    targetIndex: number;
    label: string;
    shouldBeChecked: boolean;
    confidence: number;
    reason?: string;
}
/**
 * Contexte de mapping (entrée de l'agent)
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
 * Lance l'agent ReAct autonome pour mapper les tags.
 *
 * AMÉLIORATION v4.3: Traitement SECTION PAR SECTION
 * - Filtre les paragraphes par section
 * - Utilise des indices de tableaux RELATIFS à la section
 * - Réduit la complexité pour l'IA
 *
 * @param model - Modèle LLM connecté
 * @param context - Contexte de mapping complet
 * @returns Résultat du mapping avec le document modifié
 */
export declare function runReActAgent(model: LLMModel, context: MappingContext): Promise<AgentResult>;
