/**
 * ============================================================================
 * SERVICE CHECKBOX - Analyse et injection des checkboxes par IA
 * ============================================================================
 *
 * Ce service permet à l'IA d'analyser le contenu du document et de DÉCIDER
 * quelles checkboxes doivent être cochées ou non.
 *
 * FONCTIONNALITÉS :
 * - Génération de prompts pour l'analyse des checkboxes
 * - Parsing des décisions du LLM
 * - Application intelligente des états de checkboxes
 *
 * POURQUOI CE SERVICE :
 * L'approche précédente copiait simplement l'état du template vers la cible.
 * Maintenant, l'IA analyse le CONTENU du document cible et DÉCIDE
 * intelligemment quel devrait être l'état de chaque checkbox.
 *
 * @author Rokodo
 * @version 1.0.0
 */
import { ExtractedCheckbox, CheckboxPair } from '../../shared/utils/checkbox.utils';
import { LLMModel } from '../../shared/types';
/**
 * Décision de l'IA pour une checkbox.
 */
export interface CheckboxDecision {
    /** Index de la checkbox dans le document cible */
    targetIndex: number;
    /** Label de la checkbox (pour vérification) */
    label: string;
    /** Décision: true = coché, false = non coché */
    shouldBeChecked: boolean;
    /** Confiance de l'IA (0-1) */
    confidence: number;
    /** Raison de la décision */
    reason?: string;
}
/**
 * Résultat de l'analyse des checkboxes par l'IA.
 */
export interface CheckboxAnalysisResult {
    /** Décisions pour chaque checkbox */
    decisions: CheckboxDecision[];
    /** Checkboxes appliquées avec succès */
    applied: string[];
    /** Checkboxes en échec */
    failed: string[];
    /** XML modifié */
    xml: string;
    /** Mode utilisé */
    mode: 'ai_analysis' | 'fallback_template_copy';
}
/**
 * Génère un prompt pour que l'IA analyse et décide l'état des checkboxes.
 *
 * L'IA doit:
 * 1. Comprendre le contexte de chaque checkbox
 * 2. Analyser le contenu du document
 * 3. Décider si chaque checkbox devrait être cochée ou non
 *
 * @param templateCheckboxes - Checkboxes du template (pour contexte)
 * @param targetCheckboxes - Checkboxes du document cible
 * @param templatePairs - Paires Oui/Non détectées dans le template
 * @param documentContext - Contexte textuel du document cible
 * @returns Le prompt formaté pour l'IA
 */
export declare function generateCheckboxAnalysisPrompt(templateCheckboxes: ExtractedCheckbox[], targetCheckboxes: ExtractedCheckbox[], templatePairs: CheckboxPair[], documentContext: string): string;
/**
 * Parse la réponse du LLM pour extraire les décisions sur les checkboxes.
 *
 * @param response - Réponse brute du LLM
 * @returns Liste des décisions validées
 */
export declare function parseCheckboxDecisions(response: string): CheckboxDecision[];
/**
 * Analyse les checkboxes avec l'IA et applique les décisions.
 *
 * C'est la fonction principale qui:
 * 1. Génère le prompt d'analyse
 * 2. Appelle le LLM
 * 3. Parse les décisions
 * 4. Applique les modifications au XML
 *
 * @param model - Modèle LLM connecté
 * @param targetXml - XML du document cible
 * @param templateCheckboxes - Checkboxes du template
 * @param targetCheckboxes - Checkboxes du document cible
 * @param templatePairs - Paires Oui/Non du template
 * @param documentContext - Contexte textuel du document
 * @param debug - Mode debug
 * @returns Résultat de l'analyse avec le XML modifié
 */
export declare function analyzeCheckboxesWithAI(model: LLMModel, targetXml: string, templateCheckboxes: ExtractedCheckbox[], targetCheckboxes: ExtractedCheckbox[], templatePairs: CheckboxPair[], documentContext: string, debug?: boolean): Promise<CheckboxAnalysisResult>;
/**
 * Extrait le contexte textuel du document pour l'analyse des checkboxes.
 *
 * @param xml - XML du document
 * @returns Texte brut du document (pour l'analyse IA)
 */
export declare function extractDocumentContext(xml: string): string;
