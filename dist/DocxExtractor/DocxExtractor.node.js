"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocxExtractor = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const services_1 = require("./services");
// ============================================================================
// DÉFINITION DU NŒUD
// ============================================================================
class DocxExtractor {
    constructor() {
        /**
         * Description du nœud pour l'interface n8n.
         */
        this.description = {
            // Identification
            displayName: 'DOCX Extractor',
            name: 'docxExtractor',
            icon: 'file:docx.svg',
            group: ['transform'],
            version: 1,
            subtitle: 'Extrait DOCX vers JSON structuré',
            // Description
            description: 'Extrait le contenu structuré d\'un document Word (DOCX) vers JSON. ' +
                'Détecte les titres, listes, tableaux et sections automatiquement.',
            // Configuration par défaut
            defaults: {
                name: 'DOCX Extractor',
            },
            // Entrées/Sorties
            inputs: [{ displayName: '', type: 'main' }],
            outputs: [{ displayName: '', type: 'main' }],
            // Paramètres
            properties: [
                // ==================== DOCUMENT SOURCE ====================
                {
                    displayName: 'Document Source',
                    name: 'binaryProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    description: 'Nom de la propriété binaire contenant le fichier DOCX à extraire.',
                },
                // ==================== FORMAT DE SORTIE ====================
                {
                    displayName: 'Format de Sortie',
                    name: 'outputFormat',
                    type: 'options',
                    options: [
                        {
                            name: 'Structuré (Hiérarchique)',
                            value: 'hierarchical',
                            description: 'Organise le contenu en sections et sous-sections. ' +
                                'Idéal pour les documents avec une structure claire.',
                        },
                        {
                            name: 'Plat (Liste)',
                            value: 'flat',
                            description: 'Liste simple de tous les éléments (paragraphes, titres, listes). ' +
                                'Plus facile à parcourir en boucle.',
                        },
                    ],
                    default: 'hierarchical',
                    description: 'Comment organiser le contenu extrait.',
                },
                // ==================== OPTIONS ====================
                {
                    displayName: 'Options',
                    name: 'options',
                    type: 'collection',
                    placeholder: 'Ajouter une option',
                    default: {},
                    options: [
                        {
                            displayName: 'Inclure Métadonnées',
                            name: 'includeMetadata',
                            type: 'boolean',
                            default: true,
                            description: 'Inclure les métadonnées du document (titre, auteur, dates, compteurs).',
                        },
                        {
                            displayName: 'Inclure Styles',
                            name: 'includeStyles',
                            type: 'boolean',
                            default: false,
                            description: 'Inclure les informations de style (gras, italique, souligné) pour chaque élément.',
                        },
                        {
                            displayName: 'Format des Tableaux',
                            name: 'tableFormat',
                            type: 'options',
                            options: [
                                {
                                    name: 'Array de Lignes',
                                    value: 'array',
                                    description: 'Retourne les tableaux comme des arrays de lignes avec des cellules.',
                                },
                                {
                                    name: 'Array d\'Objets (si headers)',
                                    value: 'objects',
                                    description: 'Si la première ligne est détectée comme header, ' +
                                        'convertit les lignes en objets clé-valeur.',
                                },
                            ],
                            default: 'objects',
                            description: 'Comment formater les données des tableaux.',
                        },
                    ],
                },
            ],
        };
    }
    /**
     * Méthode d'exécution principale du nœud.
     */
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const result = await processDocxExtractorItem.call(this, itemIndex, items[itemIndex]);
                returnData.push(result);
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            success: false,
                            error: error.message,
                        },
                    });
                }
                else {
                    throw error;
                }
            }
        }
        return [returnData];
    }
}
exports.DocxExtractor = DocxExtractor;
/**
 * Traite un item individuel.
 */
async function processDocxExtractorItem(itemIndex, item) {
    var _a, _b, _c;
    // 1. Récupérer les paramètres
    const binaryProperty = this.getNodeParameter('binaryProperty', itemIndex);
    const outputFormat = this.getNodeParameter('outputFormat', itemIndex);
    const options = this.getNodeParameter('options', itemIndex);
    // 2. Vérifier que le binaire existe
    const binaryData = item.binary;
    if (!binaryData || !binaryData[binaryProperty]) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Aucun document trouvé dans la propriété binaire "${binaryProperty}". ` +
            'Vérifiez que le nœud précédent fournit bien un fichier DOCX.', { itemIndex });
    }
    // 3. Vérifier l'extension du fichier
    const originalFilename = binaryData[binaryProperty].fileName || 'document.docx';
    if (!originalFilename.toLowerCase().endsWith('.docx') &&
        !originalFilename.toLowerCase().endsWith('.doc')) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Le fichier "${originalFilename}" n'est pas un document Word (.docx). ` +
            'Ce nœud ne supporte que les fichiers DOCX.', { itemIndex });
    }
    // 4. Charger le document
    const docxBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
    // 5. Préparer les options d'extraction
    const extractionOptions = {
        includeMetadata: (_a = options.includeMetadata) !== null && _a !== void 0 ? _a : true,
        includeStyles: (_b = options.includeStyles) !== null && _b !== void 0 ? _b : false,
        tableFormat: (_c = options.tableFormat) !== null && _c !== void 0 ? _c : 'objects',
        preserveHierarchy: outputFormat === 'hierarchical',
    };
    // 6. Extraire le contenu
    const result = await (0, services_1.extractDocxContent)(docxBuffer, extractionOptions);
    // 7. Vérifier le résultat
    if (!result.success) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `L'extraction du document a échoué: ${result.error}`, { itemIndex });
    }
    // 8. Retourner le résultat
    return {
        json: {
            success: true,
            filename: originalFilename,
            ...result.document,
            warnings: result.warnings,
        },
    };
}
