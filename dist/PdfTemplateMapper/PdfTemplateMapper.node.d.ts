/**
 * ============================================================================
 * PDF TEMPLATE MAPPER - Remplissage intelligent de PDF
 * ============================================================================
 *
 * Ce node analyse une page PDF et remplit automatiquement les champs détectés.
 * Utilise la technique ReAct (Reason → Act → Observe → Correct).
 *
 * FONCTIONNEMENT:
 * 1. L'utilisateur fournit un PDF + numéro de page
 * 2. Le node détecte les labels et zones de saisie (gaps)
 * 3. Les données sont placées aux positions détectées
 * 4. Si collision détectée, auto-correction et réitération
 *
 * @author Rokodo
 * @version 2.0.0
 */
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class PdfTemplateMapper implements INodeType {
    description: INodeTypeDescription;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
