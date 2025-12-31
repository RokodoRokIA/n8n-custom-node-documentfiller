"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateMapper = void 0;
const n8n_workflow_1 = require("n8n-workflow");
// Import des types et utilitaires partages
const shared_1 = require("../shared");
// Import des services
const services_1 = require("./services");
// ============================================================================
// DEFINITION DU NOEUD
// ============================================================================
class TemplateMapper {
    constructor() {
        /**
         * Description du noeud pour l'interface n8n.
         * Configure les entrees, sorties, et parametres disponibles.
         */
        this.description = {
            // Identification
            displayName: 'Template Mapper',
            name: 'templateMapper',
            icon: 'file:docx.svg',
            group: ['transform'],
            version: 18,
            subtitle: 'Transfer Learning Unifie (Tags + Checkboxes)',
            // Description
            description: "Apprend d'un template DOCX taggue pour taguer automatiquement un document similaire. " +
                'Tags et checkboxes sont analyses en un seul appel IA.',
            // Configuration par defaut
            defaults: {
                name: 'Template Mapper',
            },
            // Entrees du noeud
            inputs: [
                // Entree principale (donnees)
                { displayName: '', type: n8n_workflow_1.NodeConnectionTypes.Main },
                // Entree OBLIGATOIRE pour un modele LLM
                {
                    displayName: 'Model',
                    type: n8n_workflow_1.NodeConnectionTypes.AiLanguageModel,
                    required: true,
                    maxConnections: 1,
                },
            ],
            // Sortie du noeud
            outputs: [{ displayName: '', type: n8n_workflow_1.NodeConnectionTypes.Main }],
            // Pas de credentials specifiques - le LLM est fourni via la connexion
            credentials: [],
            // Parametres du noeud (simplifie - sans option segmentation)
            properties: [
                // ==================== DOCUMENT CIBLE ====================
                {
                    displayName: 'Document Cible',
                    name: 'targetDocumentProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    description: 'Nom du champ binaire contenant le document DOCX a taguer',
                },
                // ==================== TEMPLATE DE REFERENCE ====================
                {
                    displayName: 'Template de Reference',
                    name: 'referenceTemplateProperty',
                    type: 'string',
                    default: 'template',
                    required: true,
                    description: 'Nom du champ binaire contenant le template DOCX avec les tags {{TAG}} existants.',
                },
                // ==================== OPTIONS ====================
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
                            description: 'Nom du fichier de sortie (par defaut: original_tagged.docx)',
                        },
                        {
                            displayName: 'Mode Debug',
                            name: 'debug',
                            type: 'boolean',
                            default: false,
                            description: 'Afficher les informations de debogage detaillees',
                        },
                    ],
                },
            ],
        };
    }
    // ============================================================================
    // EXECUTION DU NOEUD
    // ============================================================================
    /**
     * Point d'entree principal du noeud.
     * Traite chaque item d'entree et produit les resultats.
     */
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        // Traiter chaque item d'entree
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const result = await processItem(this, itemIndex, items[itemIndex]);
                returnData.push(result);
            }
            catch (error) {
                // Gestion des erreurs : continuer ou echouer selon la configuration
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
exports.TemplateMapper = TemplateMapper;
// ============================================================================
// FONCTIONS DE TRAITEMENT
// ============================================================================
/**
 * Traite un item individuel.
 *
 * Architecture unifiee:
 * 1. Chargement des documents
 * 2. Extraction des tags et checkboxes
 * 3. Appel LLM unifie (tags + checkboxes en 1 appel)
 * 4. Application des resultats
 * 5. Sauvegarde du document
 */
async function processItem(ctx, itemIndex, item) {
    // ============================================================
    // ETAPE 1: Recuperer les parametres
    // ============================================================
    const params = getParameters(ctx, itemIndex);
    // ============================================================
    // ETAPE 2: Charger les documents
    // ============================================================
    const targetDoc = await loadTargetDocument(ctx, itemIndex, item, params.targetProp);
    const templateDoc = await loadTemplateDocument(ctx, itemIndex, item, params.refProp);
    // ============================================================
    // ETAPE 3: Extraire les tags du template
    // ============================================================
    const extractedTags = (0, shared_1.extractTagsFromTemplateXml)(templateDoc.xml);
    if (extractedTags.length === 0) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Aucun tag {{TAG}} trouve dans le template de reference. ' +
            'Le template doit contenir des tags au format {{NOM_DU_TAG}}.', { itemIndex });
    }
    const tagContexts = (0, shared_1.extractTagContextsFromTemplate)(templateDoc.xml);
    // ============================================================
    // ETAPE 4: Extraire les checkboxes
    // ============================================================
    const templateCheckboxes = (0, shared_1.extractCheckboxes)(templateDoc.xml);
    const templateCheckboxPairs = (0, shared_1.findCheckboxPairs)(templateCheckboxes);
    const checkboxTags = (0, shared_1.generateCheckboxTags)(templateCheckboxes, templateCheckboxPairs);
    // ============================================================
    // ETAPE 5: Analyser le document cible
    // ============================================================
    const docType = (0, shared_1.detectDocumentType)(targetDoc.xml, targetDoc.filename);
    const baseParagraphs = (0, shared_1.extractTargetParagraphs)(targetDoc.xml);
    // Enrichir avec les infos de position de tableau (inclut les cellules vides)
    const targetParagraphs = (0, shared_1.enrichParagraphsWithTableInfo)(targetDoc.xml, baseParagraphs);
    const targetCheckboxes = (0, shared_1.extractCheckboxes)(targetDoc.xml);
    // Logs de debogage si active
    if (params.debug) {
        logDebugInfo(targetDoc.filename, docType.type, targetParagraphs, extractedTags, templateCheckboxes, targetCheckboxes);
    }
    // ============================================================
    // ETAPE 6: Recuperer le modele LLM
    // ============================================================
    const model = (await ctx.getInputConnectionData(n8n_workflow_1.NodeConnectionTypes.AiLanguageModel, itemIndex));
    if (!model) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Aucun modele LLM connecte. ' +
            'Connectez un noeud LLM au port "Model" (ex: OpenAI, Claude, Gemini, etc.).', { itemIndex });
    }
    // ============================================================
    // ETAPE 7: AGENT REACT AUTONOME
    // ============================================================
    // L'agent ReAct effectue:
    // - Mapping des tags avec verification
    // - Application des tags au document
    // - Re-lecture et verification post-application
    // - Correction automatique si necessaire
    // - Traitement des checkboxes
    const mappingContext = {
        tagContexts,
        extractedTags,
        templateCheckboxes,
        templateCheckboxPairs,
        targetParagraphs,
        targetCheckboxes,
        targetXml: targetDoc.xml,
        docType: docType.type,
        debug: params.debug,
    };
    // Lancer l'agent ReAct autonome
    const agentResult = await (0, services_1.runReActAgent)(model, mappingContext);
    // L'agent a deja applique les tags et les checkboxes
    const modifiedXml = agentResult.xml;
    // ============================================================
    // ETAPE 8: Appliquer les checkboxes (si l'agent en a decide)
    // ============================================================
    let finalXml = modifiedXml;
    let checkboxApplied = [];
    let checkboxFailed = [];
    if (agentResult.checkboxDecisions.length > 0) {
        const checkboxResult = (0, services_1.applyCheckboxDecisions)(modifiedXml, agentResult.checkboxDecisions, targetCheckboxes);
        finalXml = checkboxResult.xml;
        checkboxApplied = checkboxResult.applied;
        checkboxFailed = checkboxResult.failed;
        if (params.debug) {
            console.log(`\n☑️ Checkboxes appliquees: ${checkboxApplied.length}`);
            checkboxApplied.forEach((a) => console.log(`   ✓ ${a}`));
            if (checkboxFailed.length > 0) {
                console.log(`   ⚠️ Echecs: ${checkboxFailed.length}`);
            }
        }
    }
    // ============================================================
    // ETAPE 9: Sauvegarder le document modifie
    // ============================================================
    const outputBuffer = (0, shared_1.saveDocxContent)(targetDoc.zip, finalXml);
    const outputName = params.outputFilename || targetDoc.filename.replace('.docx', '_tagged.docx');
    const binaryOutput = await ctx.helpers.prepareBinaryData(outputBuffer, outputName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    // ============================================================
    // ETAPE 10: Preparer la sortie
    // ============================================================
    const templateDataStructure = (0, shared_1.generateDataStructureFromTags)(extractedTags);
    // Structure de donnees pour les checkboxes
    const checkboxDataStructure = {};
    for (const [tag, info] of checkboxTags) {
        checkboxDataStructure[tag] = info.checked;
    }
    // Extraire les tags appliques depuis l'etat de l'agent
    const applied = agentResult.state.expectedTags
        .filter(t => t.status === 'verified' || t.status === 'placed')
        .map(t => t.tag);
    const failed = agentResult.state.expectedTags
        .filter(t => t.status === 'failed' || t.status === 'pending')
        .map(t => t.tag);
    return {
        json: {
            success: agentResult.success,
            mode: agentResult.mode,
            documentType: docType.type,
            sourceFilename: targetDoc.filename,
            outputFilename: outputName,
            // Statistiques agent
            agent: {
                iterations: agentResult.iterations,
                satisfaction: agentResult.satisfaction,
                tagsExpected: agentResult.tagsExpected,
                tagsVerified: agentResult.tagsVerified,
                tagsFailed: agentResult.tagsFailed,
                issues: agentResult.state.issues.map(i => ({
                    type: i.type,
                    severity: i.severity,
                    tag: i.tag,
                    description: i.description,
                })),
            },
            // Statistiques tags
            templateTagsExtracted: extractedTags.length,
            targetParagraphsAnalyzed: targetParagraphs.length,
            tagsApplied: applied.length,
            tagsFailed: failed.length,
            applied,
            failed,
            availableTags: extractedTags.map((t) => `{{${t.tag}}}`),
            templateDataStructure,
            // Statistiques checkboxes
            checkboxes: {
                templateCount: templateCheckboxes.length,
                targetCount: targetCheckboxes.length,
                pairsDetected: templateCheckboxPairs.length,
                tags: checkboxDataStructure,
                applied: checkboxApplied,
                failed: checkboxFailed,
                decisions: agentResult.checkboxDecisions.map((d) => ({
                    index: d.targetIndex,
                    label: d.label,
                    checked: d.shouldBeChecked,
                    confidence: d.confidence,
                    reason: d.reason,
                })),
            },
            // Debug
            debug: params.debug
                ? {
                    agentActions: agentResult.state.actions,
                    expectedTags: agentResult.state.expectedTags.slice(0, 20),
                    foundTags: agentResult.state.foundTags.slice(0, 20),
                    tagContexts: tagContexts.slice(0, 10),
                }
                : undefined,
        },
        binary: { data: binaryOutput },
    };
}
// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================
/**
 * Recupere et valide les parametres du noeud.
 */
function getParameters(ctx, itemIndex) {
    const targetProp = ctx.getNodeParameter('targetDocumentProperty', itemIndex);
    const refProp = ctx.getNodeParameter('referenceTemplateProperty', itemIndex);
    const options = ctx.getNodeParameter('options', itemIndex);
    return {
        targetProp,
        refProp,
        debug: options.debug || false,
        outputFilename: options.outputFilename || '',
    };
}
/**
 * Charge le document cible depuis les donnees binaires.
 */
async function loadTargetDocument(ctx, itemIndex, item, propertyName) {
    const binary = item.binary;
    if (!(binary === null || binary === void 0 ? void 0 : binary[propertyName])) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Document cible non trouve dans le champ binaire "${propertyName}". ` +
            'Verifiez que le document DOCX est bien connecte.', { itemIndex });
    }
    const buffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, propertyName);
    const filename = binary[propertyName].fileName || 'document.docx';
    try {
        const { zip, xml } = (0, shared_1.loadDocxContent)(buffer);
        return { zip, xml, filename };
    }
    catch (error) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Erreur lors du chargement du document cible: ${error.message}`, { itemIndex });
    }
}
/**
 * Charge le template de reference depuis les donnees binaires.
 */
async function loadTemplateDocument(ctx, itemIndex, item, propertyName) {
    const binary = item.binary;
    if (!(binary === null || binary === void 0 ? void 0 : binary[propertyName])) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Template de reference non trouve dans le champ binaire "${propertyName}". ` +
            'Assurez-vous qu\'un document DOCX taggue est connecte.', { itemIndex });
    }
    const buffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, propertyName);
    try {
        const { xml } = (0, shared_1.loadDocxContent)(buffer);
        return { xml };
    }
    catch (error) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Erreur lors du chargement du template: ${error.message}`, { itemIndex });
    }
}
/**
 * Affiche les informations de debogage dans la console.
 */
function logDebugInfo(filename, docType, paragraphs, tags, templateCheckboxes, targetCheckboxes) {
    console.log('\n📄 === TEMPLATE MAPPER v3.0 ===');
    console.log(`   Document cible: ${filename}`);
    console.log(`   Type detecte: ${docType}`);
    console.log(`   Paragraphes cible: ${paragraphs.length}`);
    console.log(`   Tags template: ${tags.length}`);
    console.log(`   Checkboxes template: ${templateCheckboxes.length}`);
    console.log(`   Checkboxes cible: ${targetCheckboxes.length}`);
    console.log('\n🏷️ Tags a placer:');
    tags.forEach((t) => console.log(`   - {{${t.tag}}} (${t.type})`));
}
