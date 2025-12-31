"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocxTemplateFiller = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const pizzip_1 = __importDefault(require("pizzip"));
// Import des types et utilitaires partagés
const shared_1 = require("../shared");
// Import des services
const services_1 = require("./services");
// ============================================================================
// DÉFINITION DU NŒUD
// ============================================================================
class DocxTemplateFiller {
    constructor() {
        /**
         * Description du nœud pour l'interface n8n.
         */
        this.description = {
            // Identification
            displayName: 'DOCX Template Filler',
            name: 'docxTemplateFiller',
            icon: 'file:docx.svg',
            group: ['transform'],
            version: 3,
            subtitle: 'Remplit {{TAGS}} avec données JSON',
            // Description
            description: "Remplace les tags {{TAG}} d'un document DOCX par les valeurs du JSON d'entrée. " +
                'Fonctionne avec tout document DOCX contenant des placeholders {{TAG}}.',
            // Configuration par défaut
            defaults: {
                name: 'DOCX Template Filler',
            },
            // Entrées/Sorties
            inputs: [{ displayName: '', type: 'main' }],
            outputs: [{ displayName: '', type: 'main' }],
            // Paramètres
            properties: [
                // ==================== DOCUMENT SOURCE ====================
                {
                    displayName: 'Document Template',
                    name: 'binaryProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    description: 'Nom de la propriété binaire contenant le document DOCX avec les tags {{TAG}} à remplacer. ' +
                        'Ce document est généralement produit par le nœud TemplateMapper.',
                },
                // ==================== SOURCE DES DONNÉES ====================
                {
                    displayName: 'Source des Données',
                    name: 'dataSource',
                    type: 'options',
                    options: [
                        {
                            name: 'JSON Complet (Item Courant)',
                            value: 'fullJson',
                            description: "Utilise tout le JSON de l'item courant. " +
                                'Les clés sont converties en tags (ex: entreprise.nom → ENTREPRISE_NOM).',
                        },
                        {
                            name: 'Champ Spécifique',
                            value: 'specificField',
                            description: 'Utilise un champ spécifique du JSON qui contient directement les tags et valeurs.',
                        },
                    ],
                    default: 'fullJson',
                    description: "D'où proviennent les données à injecter dans le document.",
                },
                {
                    displayName: 'Champ de Données',
                    name: 'dataField',
                    type: 'string',
                    default: 'templateData',
                    displayOptions: {
                        show: { dataSource: ['specificField'] },
                    },
                    description: 'Nom du champ JSON contenant les données de mapping. ' +
                        'Ce champ doit contenir un objet avec les tags comme clés ' +
                        '(ex: { "NOM_COMMERCIAL": "Ma Société", "SIRET": "12345678901234" }).',
                    placeholder: 'ex: templateData, mappingData',
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
                            displayName: 'Style des Cases à Cocher',
                            name: 'checkboxStyle',
                            type: 'options',
                            options: [
                                {
                                    name: 'Unicode (☑/☐)',
                                    value: 'unicode',
                                    description: 'Symboles Unicode pour les checkboxes',
                                },
                                {
                                    name: 'Texte (X / espace)',
                                    value: 'text',
                                    description: 'X pour coché, espace pour non coché',
                                },
                                {
                                    name: 'Booléen (true/false)',
                                    value: 'boolean',
                                    description: 'Valeurs textuelles true ou false',
                                },
                            ],
                            default: 'unicode',
                            description: 'Comment afficher les valeurs booléennes (cases à cocher).',
                        },
                        {
                            displayName: 'Nom du Fichier de Sortie',
                            name: 'outputFilename',
                            type: 'string',
                            default: '',
                            placeholder: 'ex: document_rempli.docx',
                            description: 'Nom du fichier DOCX généré. Si vide, utilise le nom du fichier source avec suffixe "_FILLED".',
                        },
                        {
                            displayName: 'Conserver les Tags Non Remplis',
                            name: 'keepEmptyTags',
                            type: 'boolean',
                            default: false,
                            description: 'Si activé, les tags {{TAG}} sans valeur correspondante restent visibles dans le document. ' +
                                'Sinon, ils sont supprimés.',
                        },
                        {
                            displayName: 'Inclure le Rapport de Mapping',
                            name: 'includeReport',
                            type: 'boolean',
                            default: true,
                            description: 'Inclut dans la sortie JSON la liste des tags remplacés et non remplacés pour faciliter le débogage.',
                        },
                    ],
                },
            ],
        };
    }
    // ============================================================================
    // EXÉCUTION DU NŒUD
    // ============================================================================
    /**
     * Point d'entrée principal du nœud.
     */
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const result = await processItem(this, itemIndex, items[itemIndex]);
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
exports.DocxTemplateFiller = DocxTemplateFiller;
// ============================================================================
// FONCTIONS DE TRAITEMENT
// ============================================================================
/**
 * Traite un item individuel.
 *
 * @param ctx - Le contexte d'exécution n8n
 * @param itemIndex - Index de l'item
 * @param item - Les données de l'item
 * @returns Le résultat du traitement
 */
async function processItem(ctx, itemIndex, item) {
    // ============================================================
    // ÉTAPE 1: Récupérer les paramètres
    // ============================================================
    const binaryProperty = ctx.getNodeParameter('binaryProperty', itemIndex);
    const dataSource = ctx.getNodeParameter('dataSource', itemIndex);
    const options = extractOptions(ctx, itemIndex);
    // ============================================================
    // ÉTAPE 2: Charger le document DOCX
    // ============================================================
    const { zip, xml: originalXml, filename } = await loadDocument(ctx, itemIndex, item, binaryProperty);
    // Extraire les tags du document pour le rapport
    const documentTags = (0, services_1.extractTagsFromXml)(originalXml);
    // ============================================================
    // ÉTAPE 3: Valider le XML d'entrée
    // ============================================================
    const inputValidation = (0, shared_1.validateXml)(originalXml);
    if (!inputValidation.valid) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Le document DOCX d'entrée contient du XML invalide: ${inputValidation.error}. ` +
            'Le document peut être corrompu.', { itemIndex });
    }
    // ============================================================
    // ÉTAPE 4: Charger les données de mapping
    // ============================================================
    const rawData = loadMappingData(ctx, itemIndex, item, dataSource);
    // ============================================================
    // ÉTAPE 5: Transformer les données
    // ============================================================
    // Aplatir le JSON en tags (ENTREPRISE_NOM, etc.)
    let templateData = (0, services_1.flattenJsonToTags)(rawData);
    // Ajuster le style des checkboxes
    templateData = (0, services_1.adjustCheckboxStyle)(templateData, options.checkboxStyle);
    // ============================================================
    // ÉTAPE 6: Traiter les boucles
    // ============================================================
    const xmlWithLoopsProcessed = (0, services_1.processLoopsInXml)(originalXml, rawData);
    // Valider après traitement des boucles
    const loopValidation = (0, shared_1.validateXml)(xmlWithLoopsProcessed);
    if (!loopValidation.valid) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Le traitement des boucles a corrompu le document: ${loopValidation.error}. ` +
            'Opération annulée.', { itemIndex });
    }
    // ============================================================
    // ÉTAPE 7: Remplacer les tags
    // ============================================================
    const { xml: filledXml, replaced, remaining } = (0, services_1.replaceTagsInXml)(xmlWithLoopsProcessed, templateData, options.keepEmptyTags);
    // Validation finale
    const finalValidation = (0, shared_1.validateXml)(filledXml);
    if (!finalValidation.valid) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Le remplacement des tags a corrompu le document: ${finalValidation.error}. ` +
            'Opération annulée.', { itemIndex });
    }
    // ============================================================
    // ÉTAPE 8: Sauvegarder le document
    // ============================================================
    zip.file('word/document.xml', filledXml);
    const outputBuffer = zip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
    });
    const finalFilename = options.outputFilename || filename.replace('.docx', '_FILLED.docx');
    const binaryOutput = await ctx.helpers.prepareBinaryData(outputBuffer, finalFilename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    // ============================================================
    // ÉTAPE 9: Préparer la sortie
    // ============================================================
    const jsonOutput = {
        success: true,
        filename: finalFilename,
        originalFilename: filename,
        report: options.includeReport
            ? {
                tagsInDocument: documentTags.length,
                tagsReplaced: replaced.length,
                tagsRemaining: remaining.length,
                replacedTags: replaced,
                remainingTags: remaining,
            }
            : undefined,
    };
    return {
        json: jsonOutput,
        binary: { data: binaryOutput },
    };
}
// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================
/**
 * Extrait les options du nœud.
 */
function extractOptions(ctx, itemIndex) {
    const options = ctx.getNodeParameter('options', itemIndex);
    return {
        checkboxStyle: options.checkboxStyle || 'unicode',
        outputFilename: options.outputFilename || '',
        keepEmptyTags: options.keepEmptyTags || false,
        includeReport: options.includeReport !== false,
    };
}
/**
 * Charge le document DOCX depuis les données binaires.
 */
async function loadDocument(ctx, itemIndex, item, binaryProperty) {
    const binaryData = item.binary;
    if (!binaryData || !binaryData[binaryProperty]) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Aucun document trouvé dans la propriété binaire "${binaryProperty}". ` +
            "Assurez-vous qu'un document DOCX est connecté en entrée.", { itemIndex });
    }
    const documentBuffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
    const filename = binaryData[binaryProperty].fileName || 'document.docx';
    let zip;
    try {
        zip = new pizzip_1.default(documentBuffer);
    }
    catch {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), "Le fichier fourni n'est pas un document DOCX valide " +
            '(archive ZIP corrompue ou format incorrect).', { itemIndex });
    }
    const documentXmlFile = zip.file('word/document.xml');
    if (!documentXmlFile) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Le fichier DOCX ne contient pas de document.xml. ' +
            'Vérifiez que le fichier est un document Word valide.', { itemIndex });
    }
    const xml = documentXmlFile.asText();
    return { zip, xml, filename };
}
/**
 * Charge les données de mapping depuis l'item.
 */
function loadMappingData(ctx, itemIndex, item, dataSource) {
    if (dataSource === 'specificField') {
        const dataField = ctx.getNodeParameter('dataField', itemIndex);
        const data = item.json[dataField];
        if (!data || typeof data !== 'object') {
            throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Le champ "${dataField}" n'existe pas ou n'est pas un objet valide. ` +
                'Vérifiez que ce champ contient les données de mapping ' +
                '(ex: { "NOM_COMMERCIAL": "...", "SIRET": "..." }).', { itemIndex });
        }
        return data;
    }
    // fullJson - utiliser tout le JSON de l'item
    return item.json;
}
