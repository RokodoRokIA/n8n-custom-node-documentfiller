/**
 * ============================================================================
 * SERVICE PDF REACT AGENT - Agent ReAct pour le remplissage de PDF
 * ============================================================================
 *
 * Ce service implémente un agent ReAct (Reasoning-Acting-Observing-Correcting)
 * pour placer intelligemment les valeurs dans un PDF.
 *
 * ARCHITECTURE:
 * 1. REASON: Analyser le PDF et identifier les sections/labels
 * 2. ACT: Demander au LLM de trouver les meilleures positions
 * 3. OBSERVE: Vérifier les placements dans le PDF généré
 * 4. CORRECT: Ajuster si nécessaire
 *
 * @author Rokodo
 * @version 1.0.0
 */
import { LLMModel } from '../../shared/types';
import { extractPdfContent } from './pdf-extractor.service';
export interface Position {
    x: number;
    y: number;
    page: number;
    type: 'inline' | 'multiline';
    labelY?: number;
    confidence?: number;
}
export interface FieldConfig {
    labels: string[];
    type: 'inline' | 'multiline' | 'checkbox';
    minGap?: number;
}
export interface PdfMappingContext {
    pdfContent: Awaited<ReturnType<typeof extractPdfContent>>;
    targetPageNumber: number;
    fillData: Record<string, string>;
    fieldConfig: Record<string, FieldConfig>;
    checkboxData?: Record<string, boolean>;
    sectionMarker?: string;
    debug: boolean;
}
export interface AgentResult {
    success: boolean;
    pdfBuffer: Buffer;
    positions: Record<string, Position | null>;
    iterations: number;
    satisfaction: number;
    llmCalls: number;
    corrections: number;
    verified: number;
    checkboxesPlaced: number;
    issues: string[];
}
/**
 * Lance l'agent ReAct pour mapper et remplir le PDF.
 */
export declare function runPdfReActAgent(model: LLMModel, context: PdfMappingContext, pdfBuffer: Buffer): Promise<AgentResult>;
