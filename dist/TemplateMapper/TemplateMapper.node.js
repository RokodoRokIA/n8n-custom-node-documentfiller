"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateMapper = void 0;
const n8n_workflow_1 = require("n8n-workflow");
// Import des types et utilitaires partagés
const shared_1 = require("../shared");
// Import des services
const services_1 = require("./services");
// ============================================================================
// DÉFINITION DU NŒUD
// ============================================================================
class TemplateMapper {
    constructor() {
        /**
         * Description du nœud pour l'interface n8n.
         * Configure les entrées, sorties, et paramètres disponibles.
         */
        this.description = {
            // Identification
            displayName: 'Template Mapper',
            name: 'templateMapper',
            icon: 'file:docx.svg',
            group: ['transform'],
            version: 16,
            subtitle: 'Transfer Learning - Tous LLM supportés',
            // Description
            description: "Apprend d'un template DOCX taggué pour taguer automatiquement un document similaire. " +
                'Les tags sont extraits automatiquement du template de référence.',
            // Configuration par défaut
            defaults: {
                name: 'Template Mapper',
            },
            // Entrées du nœud
            inputs: [
                // Entrée principale (données)
                { displayName: '', type: n8n_workflow_1.NodeConnectionTypes.Main },
                // Entrée OBLIGATOIRE pour un modèle LLM
                // Supporte TOUS les LLM de n8n : OpenAI, Claude, Gemini, Mistral, Ollama, Groq, Azure, etc.
                {
                    displayName: 'Model',
                    type: n8n_workflow_1.NodeConnectionTypes.AiLanguageModel,
                    required: true,
                    maxConnections: 1,
                },
            ],
            // Sortie du nœud
            outputs: [{ displayName: '', type: n8n_workflow_1.NodeConnectionTypes.Main }],
            // Pas de credentials spécifiques - le LLM est fourni via la connexion
            credentials: [],
            // Paramètres du nœud
            properties: [
                // ==================== DOCUMENT CIBLE ====================
                {
                    displayName: 'Document Cible',
                    name: 'targetDocumentProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    description: 'Nom du champ binaire contenant le document DOCX à taguer',
                },
                // ==================== TEMPLATE DE RÉFÉRENCE ====================
                {
                    displayName: 'Template de Référence',
                    name: 'referenceTemplateProperty',
                    type: 'string',
                    default: 'template',
                    required: true,
                    description: 'Nom du champ binaire contenant le template DOCX avec les tags {{TAG}} existants. ' +
                        'Les tags sont extraits automatiquement.',
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
                            description: 'Nom du fichier de sortie (par défaut: original_tagged.docx)',
                        },
                        {
                            displayName: 'Mode Debug',
                            name: 'debug',
                            type: 'boolean',
                            default: false,
                            description: 'Afficher les informations de débogage détaillées',
                        },
                        {
                            displayName: 'Segmentation du Document',
                            name: 'useSegmentation',
                            type: 'options',
                            options: [
                                {
                                    name: 'Automatique (recommandé)',
                                    value: 'auto',
                                    description: 'Active la segmentation pour les documents volumineux',
                                },
                                {
                                    name: 'Toujours activer',
                                    value: 'always',
                                    description: 'Force la segmentation. Améliore la précision (tableaux CA)',
                                },
                                {
                                    name: 'Désactiver',
                                    value: 'never',
                                    description: 'Désactive la segmentation.',
                                },
                            ],
                            default: 'auto',
                            description: 'Divise le document en sections pour un matching plus précis.',
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
     * Traite chaque item d'entrée et produit les résultats.
     */
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        // IMPORTANT: Vider les caches au début pour éviter les données périmées
        (0, services_1.clearAllCaches)();
        try {
            // Traiter chaque item d'entrée
            for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                // Réinitialiser le cache des paragraphes pour chaque item
                (0, services_1.resetParagraphCache)();
                try {
                    const result = await processItem(this, itemIndex, items[itemIndex]);
                    returnData.push(result);
                }
                catch (error) {
                    // Gestion des erreurs : continuer ou échouer selon la configuration
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
        finally {
            // IMPORTANT: Toujours vider les caches à la fin, même en cas d'erreur
            // Cela évite les fuites mémoire et les données corrompues
            (0, services_1.clearAllCaches)();
        }
    }
}
exports.TemplateMapper = TemplateMapper;
// ============================================================================
// FONCTIONS DE TRAITEMENT
// ============================================================================
/**
 * Traite un item individuel.
 *
 * Cette fonction orchestre tout le processus de mapping :
 * 1. Chargement des documents
 * 2. Extraction des tags
 * 3. Appel au LLM
 * 4. Application des tags
 * 5. Sauvegarde du résultat
 *
 * @param ctx - Le contexte d'exécution n8n
 * @param itemIndex - Index de l'item dans le lot
 * @param item - Les données de l'item
 * @returns Le résultat du traitement
 */
async function processItem(ctx, itemIndex, item) {
    // ============================================================
    // ÉTAPE 1: Récupérer les paramètres
    // ============================================================
    const params = getParameters(ctx, itemIndex);
    // ============================================================
    // ÉTAPE 2: Charger le document cible
    // ============================================================
    const targetDoc = await loadTargetDocument(ctx, itemIndex, item, params.targetProp);
    // ============================================================
    // ÉTAPE 3: Charger le template de référence
    // ============================================================
    const templateDoc = await loadTemplateDocument(ctx, itemIndex, item, params.refProp);
    // ============================================================
    // ÉTAPE 4: Extraire les tags du template
    // ============================================================
    const extractedTags = (0, shared_1.extractTagsFromTemplateXml)(templateDoc.xml);
    if (extractedTags.length === 0) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Aucun tag {{TAG}} trouvé dans le template de référence. ' +
            'Le template doit contenir des tags au format {{NOM_DU_TAG}}.', { itemIndex });
    }
    // Extraire les contextes des tags pour le transfer learning
    const tagContexts = (0, shared_1.extractTagContextsFromTemplate)(templateDoc.xml);
    // ============================================================
    // ÉTAPE 4b: Extraire les checkboxes du template
    // ============================================================
    const templateCheckboxes = (0, shared_1.extractCheckboxes)(templateDoc.xml);
    const templateCheckboxPairs = (0, shared_1.findCheckboxPairs)(templateCheckboxes);
    const checkboxTags = (0, shared_1.generateCheckboxTags)(templateCheckboxes, templateCheckboxPairs);
    if (params.debug && templateCheckboxes.length > 0) {
        console.log(`\n☑️ Checkboxes template: ${templateCheckboxes.length}`);
        console.log(`   Paires Oui/Non: ${templateCheckboxPairs.length}`);
        console.log(`   Tags checkbox générés: ${checkboxTags.size}`);
    }
    // ============================================================
    // ÉTAPE 5: Analyser le document cible
    // ============================================================
    const docType = (0, shared_1.detectDocumentType)(targetDoc.xml, targetDoc.filename);
    const targetParagraphs = (0, shared_1.extractTargetParagraphs)(targetDoc.xml);
    // Extraire les checkboxes de la cible
    const targetCheckboxes = (0, shared_1.extractCheckboxes)(targetDoc.xml);
    if (params.debug && targetCheckboxes.length > 0) {
        console.log(`☐ Checkboxes cible: ${targetCheckboxes.length}`);
    }
    // Logs de débogage si activé
    if (params.debug) {
        logDebugInfo(targetDoc.filename, docType.type, targetParagraphs, extractedTags);
    }
    // ============================================================
    // ÉTAPE 6: Décider du mode de matching (segmenté ou global)
    // ============================================================
    const useSegmentation = decideSegmentationMode(params.useSegmentation, templateDoc.xml, extractedTags);
    let matches;
    let segmentationUsed = false;
    let patternFallbackUsed = false;
    let llmRawResponse;
    if (useSegmentation) {
        // ============================================================
        // MODE SEGMENTÉ: Matching par segment (plus précis)
        // ============================================================
        if (params.debug) {
            console.log('\n📊 Mode SEGMENTÉ activé');
        }
        const segmentResult = await processWithSegmentation(ctx, itemIndex, params, templateDoc.xml, targetDoc.xml, extractedTags, docType.type);
        matches = segmentResult.matches;
        segmentationUsed = true;
        if (params.debug) {
            console.log(`\n✅ Matches par segmentation: ${matches.length}`);
        }
        // FALLBACK SEGMENTÉ: Si aucun match, utiliser le matching par patterns
        if (matches.length === 0) {
            if (params.debug) {
                console.log('\n⚠️ Segmentation n\'a retourné aucun match, fallback vers matching par patterns...');
            }
            matches = (0, services_1.patternBasedMatching)(tagContexts, targetParagraphs);
            patternFallbackUsed = true;
            if (params.debug) {
                console.log(`✅ Fallback patterns: ${matches.length} matches trouvés`);
            }
        }
    }
    else {
        // ============================================================
        // MODE GLOBAL: Matching classique (document entier)
        // ============================================================
        if (params.debug) {
            console.log('\n📄 Mode GLOBAL (document entier)');
        }
        // Générer le prompt principal
        let prompt = (0, services_1.generateTransferLearningPrompt)(tagContexts, targetParagraphs, extractedTags, docType.type);
        // Ajouter le prompt des checkboxes si présentes
        if (templateCheckboxes.length > 0) {
            const checkboxPrompt = (0, services_1.generateCheckboxFewShot)(templateCheckboxes, targetCheckboxes, templateCheckboxPairs);
            prompt = prompt + '\n\n' + checkboxPrompt;
            if (params.debug) {
                console.log(`\n☑️ Prompt checkbox ajouté (${templateCheckboxes.length} checkboxes)`);
            }
        }
        const llmResponse = await invokeLLM(ctx, itemIndex, params, prompt);
        llmRawResponse = llmResponse;
        if (params.debug) {
            console.log(`\n🤖 Réponse IA:\n${llmResponse.substring(0, 800)}...`);
        }
        matches = (0, services_1.parseMatchResponse)(llmResponse);
        // FALLBACK: Si le LLM ne retourne aucun match, utiliser le matching par patterns
        if (matches.length === 0) {
            if (params.debug) {
                console.log('\n⚠️ LLM n\'a retourné aucun match, fallback vers matching par patterns...');
            }
            matches = (0, services_1.patternBasedMatching)(tagContexts, targetParagraphs);
            patternFallbackUsed = true;
            if (params.debug) {
                console.log(`✅ Fallback patterns: ${matches.length} matches trouvés`);
            }
        }
    }
    // ============================================================
    // ÉTAPE 7: Appliquer les tags au document cible
    // ============================================================
    if (params.debug) {
        console.log(`\n✅ Matches trouvés: ${matches.length}`);
        matches.forEach((m) => console.log(`  - ${m.tag} → paragraphe ${m.targetParagraphIndex} (${m.confidence})`));
    }
    const { xml: taggedXml, applied, failed } = (0, services_1.applyTagsToTarget)(targetDoc.xml, matches, targetParagraphs);
    // ============================================================
    // ÉTAPE 7b: Appliquer l'état des checkboxes au document cible
    // ============================================================
    let modifiedXml = taggedXml;
    let checkboxApplied = [];
    let checkboxFailed = [];
    if (templateCheckboxes.length > 0 && targetCheckboxes.length > 0) {
        // Matcher les checkboxes template → cible
        const checkboxMatches = (0, shared_1.matchCheckboxes)(templateCheckboxes, targetCheckboxes);
        if (params.debug) {
            console.log(`\n☑️ Checkbox matches: ${checkboxMatches.length}`);
            checkboxMatches.forEach((m) => {
                const arrow = m.newState ? '☑' : '☐';
                console.log(`  - "${m.templateCheckbox.label.substring(0, 30)}" → ${arrow}`);
            });
        }
        // Appliquer les états des checkboxes
        if (checkboxMatches.length > 0) {
            const checkboxResult = (0, shared_1.applyCheckboxesToXml)(modifiedXml, checkboxMatches);
            modifiedXml = checkboxResult.xml;
            checkboxApplied = checkboxResult.applied;
            checkboxFailed = checkboxResult.failed;
            if (params.debug) {
                console.log(`   ✅ Checkboxes appliquées: ${checkboxApplied.length}`);
                if (checkboxFailed.length > 0) {
                    console.log(`   ⚠️ Checkboxes échouées: ${checkboxFailed.length}`);
                }
            }
        }
    }
    // ============================================================
    // ÉTAPE 8: Sauvegarder le document modifié
    // ============================================================
    const outputBuffer = (0, shared_1.saveDocxContent)(targetDoc.zip, modifiedXml);
    const outputName = params.outputFilename || targetDoc.filename.replace('.docx', '_tagged.docx');
    const binaryOutput = await ctx.helpers.prepareBinaryData(outputBuffer, outputName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    // ============================================================
    // ÉTAPE 9: Préparer la sortie
    // ============================================================
    const templateDataStructure = (0, shared_1.generateDataStructureFromTags)(extractedTags);
    // Ajouter les tags de checkboxes à la structure de données
    const checkboxDataStructure = {};
    for (const [tag, info] of checkboxTags) {
        checkboxDataStructure[tag] = info.checked;
    }
    // Déterminer le mode utilisé
    let mode = 'transfer_learning';
    let warning;
    if (segmentationUsed) {
        mode = 'transfer_learning_segmented';
    }
    else if (patternFallbackUsed) {
        mode = 'pattern_fallback';
        warning = 'Le LLM n\'a retourné aucun match valide. Fallback vers matching par patterns utilisé.';
    }
    return {
        json: {
            success: true,
            mode,
            warning,
            documentType: docType.type,
            sourceFilename: targetDoc.filename,
            outputFilename: outputName,
            templateTagsExtracted: extractedTags.length,
            targetParagraphsAnalyzed: targetParagraphs.length,
            tagsApplied: applied.length,
            tagsFailed: failed.length,
            applied,
            failed,
            availableTags: extractedTags.map((t) => `{{${t.tag}}}`),
            templateDataStructure,
            // Informations sur les checkboxes
            checkboxes: {
                templateCount: templateCheckboxes.length,
                targetCount: targetCheckboxes.length,
                pairsDetected: templateCheckboxPairs.length,
                tags: checkboxDataStructure,
                applied: checkboxApplied,
                failed: checkboxFailed,
            },
            segmentationUsed,
            patternFallbackUsed,
            debug: params.debug
                ? {
                    matches,
                    tagContexts: tagContexts.slice(0, 10),
                    checkboxes: templateCheckboxes.slice(0, 10),
                    llmRawResponse: llmRawResponse ? llmRawResponse.substring(0, 2000) : undefined,
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
 * Récupère et valide les paramètres du nœud.
 *
 * @param ctx - Le contexte d'exécution n8n
 * @param itemIndex - Index de l'item
 * @returns Les paramètres extraits
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
        useSegmentation: options.useSegmentation || 'auto',
    };
}
/**
 * Charge le document cible depuis les données binaires.
 *
 * @param ctx - Le contexte d'exécution n8n
 * @param itemIndex - Index de l'item
 * @param item - Les données de l'item
 * @param propertyName - Nom de la propriété binaire
 * @returns Le document chargé avec ses métadonnées
 */
async function loadTargetDocument(ctx, itemIndex, item, propertyName) {
    const binary = item.binary;
    if (!(binary === null || binary === void 0 ? void 0 : binary[propertyName])) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Document cible non trouvé dans le champ binaire "${propertyName}". ` +
            'Vérifiez que le document DOCX est bien connecté.', { itemIndex });
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
 * Charge le template de référence depuis les données binaires.
 *
 * @param ctx - Le contexte d'exécution n8n
 * @param itemIndex - Index de l'item
 * @param item - Les données de l'item
 * @param propertyName - Nom de la propriété binaire
 * @returns Le XML du template
 */
async function loadTemplateDocument(ctx, itemIndex, item, propertyName) {
    const binary = item.binary;
    if (!(binary === null || binary === void 0 ? void 0 : binary[propertyName])) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Template de référence non trouvé dans le champ binaire "${propertyName}". ` +
            'Assurez-vous qu\'un document DOCX taggué est connecté.', { itemIndex });
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
 * Appelle le LLM connecté.
 *
 * Supporte TOUS les LLM disponibles dans n8n :
 * - OpenAI (GPT-4, GPT-4o, etc.)
 * - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, etc.)
 * - Google (Gemini Pro, Gemini Ultra, etc.)
 * - Mistral (Mistral Large, Mixtral, etc.)
 * - Ollama (modèles locaux)
 * - Groq (LLaMA, Mixtral accéléré)
 * - Azure OpenAI
 * - AWS Bedrock
 * - Et tous les autres LLM supportés par n8n
 *
 * @param ctx - Le contexte d'exécution n8n
 * @param itemIndex - Index de l'item
 * @param _params - Les paramètres du nœud (non utilisé mais gardé pour compatibilité)
 * @param prompt - Le prompt à envoyer
 * @returns La réponse du LLM
 */
async function invokeLLM(ctx, itemIndex, _params, prompt) {
    // Récupérer le modèle LLM connecté
    const model = (await ctx.getInputConnectionData(n8n_workflow_1.NodeConnectionTypes.AiLanguageModel, itemIndex));
    if (!model) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Aucun modèle LLM connecté. ' +
            'Connectez un nœud LLM au port "Model" (ex: OpenAI Chat Model, Claude, Gemini, Mistral, Ollama, etc.). ' +
            'Ce nœud supporte TOUS les LLM disponibles dans n8n.', { itemIndex });
    }
    return (0, services_1.callConnectedLLM)(model, prompt);
}
/**
 * Affiche les informations de débogage dans la console.
 *
 * @param filename - Nom du fichier traité
 * @param docType - Type de document détecté
 * @param paragraphs - Liste des paragraphes
 * @param tags - Liste des tags extraits
 */
function logDebugInfo(filename, docType, paragraphs, tags) {
    console.log(`📄 Document cible: ${filename}`);
    console.log(`📋 Type détecté: ${docType}`);
    console.log(`📊 Paragraphes cible: ${paragraphs.length}`);
    console.log(`🏷️ Tags extraits du template: ${tags.length}`);
    tags.forEach((t) => console.log(`  - {{${t.tag}}} (${t.type})`));
}
// ============================================================================
// FONCTIONS DE SEGMENTATION
// ============================================================================
/**
 * Décide si la segmentation doit être utilisée.
 *
 * @param mode - Mode de segmentation configuré (auto, always, never)
 * @param templateXml - XML du template
 * @param extractedTags - Tags extraits
 * @returns true si la segmentation doit être utilisée
 */
function decideSegmentationMode(mode, templateXml, extractedTags) {
    if (mode === 'always')
        return true;
    if (mode === 'never')
        return false;
    // Mode auto: utiliser la fonction de décision du service
    return (0, services_1.shouldUseSegmentation)(templateXml, extractedTags);
}
/**
 * Traite le matching en utilisant la segmentation.
 *
 * Cette fonction divise les documents en segments, génère des prompts
 * ciblés pour chaque segment, et combine les résultats.
 *
 * @param ctx - Le contexte d'exécution n8n
 * @param itemIndex - Index de l'item
 * @param params - Les paramètres du nœud
 * @param templateXml - XML du template
 * @param targetXml - XML du document cible
 * @param extractedTags - Tags extraits
 * @param docType - Type de document
 * @returns Les matches combinés de tous les segments
 */
async function processWithSegmentation(ctx, itemIndex, params, templateXml, targetXml, extractedTags, docType) {
    // Étape 1: Préparer le plan de matching par segments
    const plan = (0, services_1.prepareSegmentMatchingPlan)(templateXml, targetXml, extractedTags);
    if (params.debug) {
        (0, services_1.logMatchingPlan)(plan);
    }
    // Si aucun segment matché, retourner vide
    if (plan.matchedPairs.length === 0) {
        console.log('⚠️ Aucun segment matché, fallback vers matching global');
        return { matches: [] };
    }
    // Étape 2: Pour chaque paire de segments, appeler le LLM
    const segmentResults = new Map();
    for (const pair of plan.matchedPairs) {
        if (params.debug) {
            console.log(`\n🔍 Traitement segment: ${pair.templateSegment.id}`);
            console.log(`   Tags: ${pair.tagsToTransfer.join(', ')}`);
        }
        // Générer le prompt pour ce segment
        const segmentPrompt = (0, services_1.generateSegmentPrompt)(pair, docType);
        // Appeler le LLM
        const llmResponse = await invokeLLM(ctx, itemIndex, params, segmentPrompt);
        if (params.debug) {
            console.log(`   Réponse: ${llmResponse.substring(0, 200)}...`);
        }
        // Parser la réponse
        const segmentMatches = (0, services_1.parseMatchResponse)(llmResponse);
        // Convertir les index relatifs en index globaux
        const adjustedMatches = adjustMatchIndexes(segmentMatches, pair);
        segmentResults.set(pair.templateSegment.id, adjustedMatches);
        if (params.debug) {
            console.log(`   ✓ ${adjustedMatches.length} matches trouvés`);
        }
    }
    // Étape 3: Combiner les résultats
    const allMatches = (0, services_1.combineSegmentResults)(segmentResults, plan.matchedPairs);
    return { matches: allMatches };
}
/**
 * Ajuste les index des matches pour correspondre au document global.
 *
 * HISTORIQUE:
 * - Avant: Les paragraphes étaient extraits du XML du segment, donc les index
 *   étaient relatifs (0, 1, 2...) et devaient être convertis en index globaux.
 *
 * - Maintenant: extractParagraphsFromSegment filtre les paragraphes du document
 *   global et conserve leurs index GLOBAUX. Donc aucune conversion n'est nécessaire.
 *
 * Cette fonction est conservée pour compatibilité et pour permettre d'ajouter
 * des validations ou transformations futures si nécessaire.
 *
 * @param matches - Matches avec index globaux (depuis la v2.1)
 * @param pair - Paire de segments (pour référence/validation)
 * @returns Matches avec index globaux (inchangés)
 */
function adjustMatchIndexes(matches, pair) {
    // Validation optionnelle: vérifier que les index sont dans la plage attendue
    const validIndexes = new Set(pair.targetParagraphs.map(p => p.index));
    return matches.map((match) => {
        // Log un warning si l'index retourné par le LLM n'est pas dans la liste
        if (!validIndexes.has(match.targetParagraphIndex) && validIndexes.size > 0) {
            console.warn(`⚠️ Index ${match.targetParagraphIndex} pour tag ${match.tag} ` +
                `n'est pas dans la plage du segment (${[...validIndexes].join(', ')})`);
        }
        return { ...match };
    });
}
