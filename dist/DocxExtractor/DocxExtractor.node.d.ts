/**
 * ============================================================================
 * DOCX EXTRACTOR - Nœud n8n pour extraire le contenu DOCX vers JSON
 * ============================================================================
 *
 * Ce nœud extrait le contenu structuré d'un document Word (DOCX) et le
 * convertit en JSON. Détecte automatiquement les titres, listes, tableaux
 * et sections.
 *
 * FONCTIONNALITÉS :
 * - Extraction du texte et de la structure
 * - Détection des titres (H1-H6)
 * - Extraction des listes (ordonnées et non ordonnées)
 * - Extraction des tableaux avec conversion en objets
 * - Métadonnées du document (titre, auteur, dates)
 *
 * SORTIES :
 * - Format hiérarchique: sections → contenu → sous-sections
 * - Format plat: liste de tous les paragraphes
 *
 * @author Rokodo
 * @version 1.0.0
 */
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class DocxExtractor implements INodeType {
    /**
     * Description du nœud pour l'interface n8n.
     */
    description: INodeTypeDescription;
    /**
     * Méthode d'exécution principale du nœud.
     */
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
