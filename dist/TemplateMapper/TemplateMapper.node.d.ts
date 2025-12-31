/**
 * ============================================================================
 * TEMPLATE MAPPER - Noeud n8n pour taguer automatiquement des documents DOCX
 * ============================================================================
 *
 * Ce noeud utilise le "Transfer Learning" pour apprendre d'un template DOCX
 * deja taggue et appliquer les memes tags a un document similaire non taggue.
 *
 * ARCHITECTURE v3.0 - UNIFIED MAPPING:
 * - 1 seul appel LLM pour Tags + Checkboxes
 * - Pattern Few-Shot Learning coherent
 * - Fallback semantique integre
 *
 * FLUX DE TRAVAIL :
 * 1. L'utilisateur fournit un template de reference (avec tags {{TAG}})
 * 2. L'utilisateur fournit un document cible (sans tags)
 * 3. Le noeud extrait les tags, checkboxes et leur contexte du template
 * 4. Un LLM analyse les deux documents et trouve les correspondances
 * 5. Les tags et etats de checkboxes sont appliques au document cible
 *
 * @author Rokodo
 * @version 3.0.0 (unified architecture)
 */
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class TemplateMapper implements INodeType {
    /**
     * Description du noeud pour l'interface n8n.
     * Configure les entrees, sorties, et parametres disponibles.
     */
    description: INodeTypeDescription;
    /**
     * Point d'entree principal du noeud.
     * Traite chaque item d'entree et produit les resultats.
     */
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
