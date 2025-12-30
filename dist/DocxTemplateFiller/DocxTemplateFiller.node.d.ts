/**
 * DocxTemplateFiller - Remplissage factuel de documents DOCX
 *
 * Ce nœud remplace les tags {{TAG}} dans un document DOCX par les valeurs
 * correspondantes fournies dans le JSON d'entrée.
 *
 * Logique simple et agnostique :
 * - Le document contient des placeholders au format {{NOM_DU_TAG}}
 * - Le JSON d'entrée contient les mêmes clés avec leurs valeurs
 * - Chaque {{TAG}} est remplacé par sa valeur correspondante
 *
 * Ce nœud est conçu pour fonctionner avec TemplateMapper qui génère :
 * 1. Le document DOCX avec les tags insérés
 * 2. La structure de données exacte à remplir (dataStructure)
 *
 * Workflow typique :
 * TemplateMapper (crée template + structure) → DocxTemplateFiller (remplit les valeurs)
 */
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class DocxTemplateFiller implements INodeType {
    description: INodeTypeDescription;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
