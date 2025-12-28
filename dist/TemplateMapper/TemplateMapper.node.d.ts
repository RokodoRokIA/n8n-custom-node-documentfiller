/**
 * TemplateMapper - Création intelligente de templates via IA
 *
 * NOUVELLE APPROCHE:
 * 1. L'utilisateur fournit un document vierge (formulaire à remplir)
 * 2. L'utilisateur fournit une structure JSON décrivant les champs de données
 * 3. L'IA analyse le document et déduit où placer chaque tag {{TAG}}
 * 4. Le document avec tags est prêt pour DocxTemplateFiller
 *
 * Workflow:
 * TemplateMapper (crée le template) → DocxTemplateFiller (remplit avec données)
 */
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class TemplateMapper implements INodeType {
    description: INodeTypeDescription;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
