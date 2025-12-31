/**
 * ============================================================================
 * TEMPLATE MAPPER - Nœud n8n pour taguer automatiquement des documents DOCX
 * ============================================================================
 *
 * Ce nœud utilise le "Transfer Learning" pour apprendre d'un template DOCX
 * déjà taggué et appliquer les mêmes tags à un document similaire non taggué.
 *
 * FLUX DE TRAVAIL :
 * 1. L'utilisateur fournit un template de référence (avec tags {{TAG}})
 * 2. L'utilisateur fournit un document cible (sans tags)
 * 3. Le nœud extrait les tags et leur contexte du template
 * 4. Un LLM analyse les deux documents et trouve les correspondances
 * 5. Les tags sont insérés dans le document cible
 *
 * ENTRÉES :
 * - Document cible (DOCX binaire) : le document à taguer
 * - Template de référence (DOCX binaire) : le modèle avec les tags
 * - Modèle LLM connecté (OBLIGATOIRE) : supporte TOUS les LLM de n8n
 *
 * SORTIES :
 * - Document taggué (DOCX binaire)
 * - Structure de données pour DocxTemplateFiller (JSON)
 * - Statistiques de mapping
 *
 * @author Rokodo
 * @version 2.0.0 (refactored)
 */
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class TemplateMapper implements INodeType {
    /**
     * Description du nœud pour l'interface n8n.
     * Configure les entrées, sorties, et paramètres disponibles.
     */
    description: INodeTypeDescription;
    /**
     * Point d'entrée principal du nœud.
     * Traite chaque item d'entrée et produit les résultats.
     */
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
