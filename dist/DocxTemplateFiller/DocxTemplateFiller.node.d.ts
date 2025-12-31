/**
 * ============================================================================
 * DOCX TEMPLATE FILLER - Nœud n8n pour remplir des documents DOCX
 * ============================================================================
 *
 * Ce nœud remplace les tags {{TAG}} dans un document DOCX par les valeurs
 * correspondantes fournies dans le JSON d'entrée.
 *
 * WORKFLOW TYPIQUE :
 * 1. TemplateMapper crée un document avec des tags {{TAG}}
 * 2. DocxTemplateFiller remplit ces tags avec les vraies valeurs
 *
 * FONCTIONNALITÉS :
 * - Remplacement simple des tags {{TAG}} par des valeurs
 * - Support des objets JSON imbriqués (entreprise.nom → ENTREPRISE_NOM)
 * - Support des tableaux avec boucles {#ARRAY}...{/ARRAY}
 * - Gestion des checkboxes (booléens → ☑/☐)
 * - Validation XML pour éviter les documents corrompus
 *
 * ENTRÉES :
 * - Document DOCX avec tags {{TAG}}
 * - Données JSON à injecter
 *
 * SORTIE :
 * - Document DOCX rempli
 * - Rapport de remplacement (tags traités, manquants)
 *
 * @author Rokodo
 * @version 2.0.0 (refactored)
 */
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class DocxTemplateFiller implements INodeType {
    /**
     * Description du nœud pour l'interface n8n.
     */
    description: INodeTypeDescription;
    /**
     * Point d'entrée principal du nœud.
     */
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
