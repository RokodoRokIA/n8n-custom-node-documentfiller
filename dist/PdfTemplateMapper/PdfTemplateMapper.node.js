"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfTemplateMapper = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const services_1 = require("./services");
// Configuration par défaut des labels à détecter (peut être surchargée via fieldConfig)
const DEFAULT_FIELD_CONFIG = {
    NOM_COMMERCIAL: { labels: ['Nom commercial et dénomination', 'Nom commercial'], type: 'multiline', minGap: 25 },
    ADRESSE: { labels: ['Adresses postale', 'Adressespostale', 'Adresse postale'], type: 'multiline', minGap: 25 },
    EMAIL: { labels: ['Adresse électronique'], type: 'inline' },
    TELEPHONE: { labels: ['Numéros de téléphone', 'Numéro de téléphone'], type: 'inline' },
    SIRET: { labels: ['Numéro SIRET'], type: 'multiline', minGap: 15 },
};
// Note: La configuration des sections est maintenant dans le service pdf-react-agent.service.ts
class PdfTemplateMapper {
    constructor() {
        this.description = {
            displayName: 'PDF Template Mapper',
            name: 'pdfTemplateMapper',
            icon: 'file:pdf.svg',
            group: ['transform'],
            version: 3,
            subtitle: 'Remplissage intelligent de PDF avec IA (ReAct Agent)',
            description: 'Analyse une page PDF et remplit automatiquement les champs détectés avec auto-correction.',
            defaults: {
                name: 'PDF Template Mapper',
            },
            // Entrées du noeud
            inputs: [
                // Entrée principale (données)
                { displayName: '', type: n8n_workflow_1.NodeConnectionTypes.Main },
                // Entrée OBLIGATOIRE pour un modèle LLM
                {
                    displayName: 'Model',
                    type: n8n_workflow_1.NodeConnectionTypes.AiLanguageModel,
                    required: true,
                    maxConnections: 1,
                },
            ],
            outputs: [{ displayName: '', type: n8n_workflow_1.NodeConnectionTypes.Main }],
            credentials: [],
            properties: [
                // PDF à remplir
                {
                    displayName: 'Document PDF',
                    name: 'pdfProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    description: 'Nom du champ binaire contenant le PDF. Correspond au nom dans le noeud "Read Binary File" ou "HTTP Request".',
                    placeholder: 'data',
                },
                // Page à analyser
                {
                    displayName: 'Page à analyser',
                    name: 'pageNumber',
                    type: 'number',
                    default: 2,
                    required: true,
                    typeOptions: {
                        minValue: 1,
                    },
                    description: 'Numéro de la page où placer les données. Pour DC1/DC2, la section candidat est généralement en page 2.',
                },
                // Données à remplir
                {
                    displayName: 'Données à remplir',
                    name: 'fillData',
                    type: 'json',
                    default: '{\n  "NOM_COMMERCIAL": "ACME Corporation",\n  "SIRET": "12345678900012",\n  "CANDIDAT_SEUL": true\n}',
                    required: true,
                    // eslint-disable-next-line n8n-nodes-base/node-param-description-unencoded-angle-brackets
                    description: 'JSON des valeurs à insérer. Champs texte = "string", Checkboxes = true/false. Exemple: {"NOM": "Ma Société", "MA_CHECKBOX": true}. Seuls les champs présents seront remplis.',
                },
                // Configuration des champs (optionnel)
                {
                    displayName: 'Configuration des champs (optionnel)',
                    name: 'fieldConfig',
                    type: 'json',
                    default: '{}',
                    required: false,
                    // eslint-disable-next-line n8n-nodes-base/node-param-description-unencoded-angle-brackets
                    description: 'Définit COMMENT détecter les champs dans le PDF. Laissez {} pour la config par défaut. Exemple: {"MON_CHAMP": {"labels": ["Texte à chercher"], "type": "checkbox|inline|multiline"}}',
                },
                // Marqueur de section (optionnel)
                {
                    displayName: 'Marqueur de section (optionnel)',
                    name: 'sectionMarker',
                    type: 'string',
                    default: '',
                    required: false,
                    description: 'Limite la recherche à une section spécifique du PDF. Utile pour les formulaires multi-sections.',
                    placeholder: 'D - Présentation du candidat',
                },
                // Options
                {
                    displayName: 'Options',
                    name: 'options',
                    type: 'collection',
                    placeholder: 'Ajouter option',
                    default: {},
                    options: [
                        {
                            displayName: 'Nom fichier sortie',
                            name: 'outputFilename',
                            type: 'string',
                            default: '',
                            description: 'Nom du fichier PDF généré. Par défaut: nom_original_filled.pdf',
                            placeholder: 'document_rempli.pdf',
                        },
                        {
                            displayName: 'Taille de police',
                            name: 'fontSize',
                            type: 'number',
                            default: 9,
                            description: 'Taille du texte inséré (en points). Recommandé: 8-11 pour les formulaires administratifs.',
                        },
                        {
                            displayName: 'Mode Debug',
                            name: 'debug',
                            type: 'boolean',
                            default: false,
                            description: 'Active les logs détaillés: positions détectées, appels LLM, corrections. Utile pour diagnostiquer les problèmes.',
                        },
                    ],
                },
            ],
        };
    }
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
exports.PdfTemplateMapper = PdfTemplateMapper;
// ============================================================================
// TRAITEMENT D'UN ITEM
// ============================================================================
async function processItem(ctx, itemIndex, item) {
    // Paramètres
    const pdfProperty = ctx.getNodeParameter('pdfProperty', itemIndex);
    const pageNumber = ctx.getNodeParameter('pageNumber', itemIndex);
    const fillDataRaw = ctx.getNodeParameter('fillData', itemIndex);
    const fieldConfigRaw = ctx.getNodeParameter('fieldConfig', itemIndex, '');
    const sectionMarker = ctx.getNodeParameter('sectionMarker', itemIndex, '');
    const options = ctx.getNodeParameter('options', itemIndex);
    const debug = options.debug || false;
    // Charger le PDF
    const binary = item.binary;
    if (!(binary === null || binary === void 0 ? void 0 : binary[pdfProperty])) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `PDF non trouvé dans le champ "${pdfProperty}"`, { itemIndex });
    }
    const pdfBuffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, pdfProperty);
    const originalFilename = binary[pdfProperty].fileName || 'document.pdf';
    // Parser les données (supporte string et boolean)
    let fillData = {};
    try {
        fillData = JSON.parse(fillDataRaw);
    }
    catch {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Le champ "Données à remplir" doit contenir un JSON valide', { itemIndex });
    }
    // Parser la configuration des champs (optionnel)
    // Le champ est de type 'json' donc n8n le parse automatiquement en objet
    let customFieldConfig = {};
    if (fieldConfigRaw && typeof fieldConfigRaw === 'object') {
        customFieldConfig = fieldConfigRaw;
    }
    else if (fieldConfigRaw && typeof fieldConfigRaw === 'string' && fieldConfigRaw.trim()) {
        try {
            customFieldConfig = JSON.parse(fieldConfigRaw);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Le champ "Configuration des champs" doit contenir un JSON valide. Exemple: {"MON_CHAMP": {"labels": ["Label"], "type": "checkbox"}}', { itemIndex });
        }
    }
    // Fusionner la config par défaut avec la config personnalisée
    const mergedFieldConfig = { ...DEFAULT_FIELD_CONFIG, ...customFieldConfig };
    // Validation: vérifier qu'au moins un champ a une valeur non-vide
    // Pour les booléens, on considère true comme "valeur présente"
    const fieldsWithValues = Object.entries(fillData).filter(([, value]) => {
        if (typeof value === 'boolean')
            return value === true;
        if (typeof value === 'string')
            return value.trim().length > 0;
        return false;
    });
    if (fieldsWithValues.length === 0) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Aucune donnée à remplir: tous les champs du JSON sont vides. ' +
            'Veuillez fournir au moins une valeur non-vide (string) ou true (checkbox). ' +
            `Champs détectés: ${Object.keys(fillData).join(', ') || 'aucun'}`, { itemIndex });
    }
    // Séparer les champs texte et checkbox
    const textFields = {};
    const checkboxFields = {};
    for (const [key, value] of Object.entries(fillData)) {
        if (typeof value === 'boolean') {
            checkboxFields[key] = value;
        }
        else if (typeof value === 'string' && value.trim()) {
            textFields[key] = value;
        }
    }
    if (debug) {
        console.log('\n📄 === PDF TEMPLATE MAPPER v3.1 (ReAct Agent + LLM + Checkboxes) ===');
        console.log(`   Document: ${originalFilename}`);
        console.log(`   Page: ${pageNumber}`);
        console.log(`   Champs texte: ${Object.keys(textFields).join(', ') || 'aucun'}`);
        console.log(`   Champs checkbox: ${Object.keys(checkboxFields).filter(k => checkboxFields[k]).join(', ') || 'aucun'}`);
        console.log(`   Config personnalisée: ${Object.keys(customFieldConfig).length > 0 ? 'oui' : 'non'}`);
    }
    // ═══════════════════════════════════════════════════════════════
    // RÉCUPÉRER LE MODÈLE LLM
    // ═══════════════════════════════════════════════════════════════
    const model = (await ctx.getInputConnectionData(n8n_workflow_1.NodeConnectionTypes.AiLanguageModel, itemIndex));
    if (!model) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Aucun modèle LLM connecté. Connectez un noeud LLM au port "Model" (ex: OpenAI, Claude, Gemini, etc.).', { itemIndex });
    }
    // Extraire le contenu du PDF
    const content = await (0, services_1.extractPdfContent)(pdfBuffer, {
        maxPages: pageNumber + 2,
        extractFields: true,
        debug,
    });
    // Vérifier que la page existe
    const targetPage = content.pages.find(p => p.pageNumber === pageNumber);
    if (!targetPage) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Page ${pageNumber} non trouvée. Le document a ${content.pageCount} pages.`, { itemIndex });
    }
    // ═══════════════════════════════════════════════════════════════
    // AGENT REACT AVEC LLM
    // ═══════════════════════════════════════════════════════════════
    const mappingContext = {
        pdfContent: content,
        targetPageNumber: pageNumber,
        fillData: textFields, // Seulement les champs texte pour l'agent ReAct
        fieldConfig: mergedFieldConfig,
        checkboxData: checkboxFields, // Nouveau: champs checkbox
        sectionMarker,
        debug,
    };
    // Lancer l'agent ReAct
    const agentResult = await (0, services_1.runPdfReActAgent)(model, mappingContext, pdfBuffer);
    const lastPdfBuffer = agentResult.pdfBuffer;
    const positions = agentResult.positions;
    const iteration = agentResult.iterations;
    // Préparer la sortie
    const outputFilename = options.outputFilename || originalFilename.replace('.pdf', '_filled.pdf');
    const binaryOutput = await ctx.helpers.prepareBinaryData(lastPdfBuffer, outputFilename, 'application/pdf');
    // Statistiques
    const textFieldsPlaced = Object.keys(positions).filter(k => positions[k] && textFields[k]).length;
    const checkboxesPlaced = agentResult.checkboxesPlaced || 0;
    const placedCount = textFieldsPlaced + checkboxesPlaced;
    if (debug) {
        console.log(`\n   ✓ Terminé après ${iteration} itération(s)`);
        console.log(`   ✓ ${textFieldsPlaced} champs texte remplis`);
        console.log(`   ✓ ${checkboxesPlaced} checkboxes cochées`);
        console.log(`   ✓ Satisfaction: ${agentResult.satisfaction}%`);
        console.log(`   ✓ Fichier: ${outputFilename}`);
    }
    return {
        json: {
            success: agentResult.success,
            mode: 'react_agent_llm',
            iterations: iteration,
            satisfaction: agentResult.satisfaction,
            placements: Object.entries(positions)
                .filter(([tag, pos]) => textFields[tag] && pos !== null)
                .map(([tag, pos]) => ({
                field: tag,
                value: String(textFields[tag] || '').substring(0, 30),
                type: 'text',
                page: pos.page,
                x: pos.x,
                y: pos.y,
            })),
            checkboxes: Object.entries(checkboxFields)
                .filter(([, value]) => value === true)
                .map(([tag]) => ({
                field: tag,
                checked: true,
                type: 'checkbox',
            })),
            agent: {
                llmCalls: agentResult.llmCalls,
                corrections: agentResult.corrections,
                issues: agentResult.issues,
            },
            stats: {
                fieldsRequested: fieldsWithValues.length,
                textFieldsPlaced: textFieldsPlaced,
                checkboxesPlaced: checkboxesPlaced,
                fieldsVerified: agentResult.verified,
                autoCorrections: agentResult.corrections,
            },
        },
        binary: { data: binaryOutput },
    };
}
