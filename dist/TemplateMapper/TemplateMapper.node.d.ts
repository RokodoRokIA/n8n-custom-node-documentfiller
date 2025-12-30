/**
 * TemplateMapper - Création intelligente de templates via IA
 *
 * Ce nœud analyse un document vierge et une structure de données JSON,
 * puis utilise l'IA pour déduire où placer chaque tag {{TAG}} dans le document.
 *
 * Workflow complémentaire avec DocxTemplateFiller :
 * 1. TemplateMapper : Crée le template + génère la structure de données exacte
 * 2. DocxTemplateFiller : Remplit le template avec les valeurs réelles
 *
 * Sorties :
 * - Document DOCX avec les tags {{TAG}} insérés aux bons emplacements
 * - dataStructure : Structure JSON exacte à remplir pour DocxTemplateFiller
 */
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class TemplateMapper implements INodeType {
    description: INodeTypeDescription;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
