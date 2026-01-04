/**
 * ============================================================================
 * SERVICE PDF MATCHER - Matching LLM avec positions PDF
 * ============================================================================
 *
 * Ce service utilise un LLM pour matcher les champs d'un template PDF
 * avec les champs d'un document cible. Il exploite les positions absolues
 * pour un matching plus précis.
 *
 * STRATÉGIES DE MATCHING:
 * 1. Position directe: Si les positions sont très proches (±10px)
 * 2. Position relative: Si les positions relatives sont similaires (% de page)
 * 3. Sémantique: Si les labels sont sémantiquement équivalents
 * 4. LLM hybride: Combine position + sémantique pour les cas ambigus
 *
 * @author Rokodo
 * @version 1.0.0
 */
import type { LLMModel } from '../../shared/types';
import type { PdfDocumentContent, PdfMatchResult, PdfMappingOptions, PdfAgentState } from '../types';
/**
 * Lance l'agent ReAct pour matcher les champs PDF.
 *
 * @param model - Modèle LLM connecté
 * @param templateContent - Contenu du template extrait
 * @param targetContent - Contenu du document cible extrait
 * @param options - Options de mapping
 * @returns Résultats du matching
 */
export declare function runPdfMatchingAgent(model: LLMModel, templateContent: PdfDocumentContent, targetContent: PdfDocumentContent, options: PdfMappingOptions): Promise<{
    matches: PdfMatchResult[];
    state: PdfAgentState;
}>;
/**
 * Trouve le meilleur match pour un tag donné.
 */
export declare function findBestMatch(tag: string, matches: PdfMatchResult[]): PdfMatchResult | undefined;
/**
 * Valide les matches pour éviter les conflits.
 */
export declare function validateMatches(matches: PdfMatchResult[]): {
    valid: PdfMatchResult[];
    conflicts: {
        tag1: string;
        tag2: string;
        fieldId: string;
    }[];
};
