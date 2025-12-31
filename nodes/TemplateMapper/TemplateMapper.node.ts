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

import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';

import PizZip from 'pizzip';

// Import des types et utilitaires partagés
import {
	DocumentType,
	ExtractedTag,
	TargetParagraph,
	LLMModel,
	loadDocxContent,
	saveDocxContent,
	detectDocumentType,
	extractTagContextsFromTemplate,
	extractTagsFromTemplateXml,
	extractTargetParagraphs,
	generateDataStructureFromTags,
	// Support des checkboxes
	extractCheckboxes,
	findCheckboxPairs,
	generateCheckboxTags,
} from '../shared';

// Import des services
import {
	callConnectedLLM,
	parseMatchResponse,
	generateTransferLearningPrompt,
	generateCheckboxFewShot,
	applyTagsToTarget,
	// Services de segmentation
	prepareSegmentMatchingPlan,
	generateSegmentPrompt,
	combineSegmentResults,
	shouldUseSegmentation,
	logMatchingPlan,
	MatchedSegmentPair,
	TagMatch,
	// Fallback par patterns
	patternBasedMatching,
	// Gestion du cache
	clearAllCaches,
	resetParagraphCache,
	// Service d'analyse des checkboxes par IA
	analyzeCheckboxesWithAI,
	extractDocumentContext,
	CheckboxAnalysisResult,
} from './services';

// ============================================================================
// INTERFACES LOCALES
// ============================================================================

/**
 * Paramètres extraits du nœud pour faciliter le passage entre fonctions.
 */
interface NodeParameters {
	targetProp: string;
	refProp: string;
	debug: boolean;
	outputFilename: string;
	useSegmentation: 'auto' | 'always' | 'never';
}

/**
 * Document chargé avec ses métadonnées.
 */
interface LoadedDocument {
	zip: PizZip;
	xml: string;
	filename: string;
}

// ============================================================================
// DÉFINITION DU NŒUD
// ============================================================================

export class TemplateMapper implements INodeType {
	/**
	 * Description du nœud pour l'interface n8n.
	 * Configure les entrées, sorties, et paramètres disponibles.
	 */
	description: INodeTypeDescription = {
		// Identification
		displayName: 'Template Mapper',
		name: 'templateMapper',
		icon: 'file:docx.svg',
		group: ['transform'],
		version: 17,
		subtitle: 'Transfer Learning + Analyse IA des Checkboxes',

		// Description
		description:
			"Apprend d'un template DOCX taggué pour taguer automatiquement un document similaire. " +
			'Les tags sont extraits automatiquement du template de référence.',

		// Configuration par défaut
		defaults: {
			name: 'Template Mapper',
		},

		// Entrées du nœud
		inputs: [
			// Entrée principale (données)
			{ displayName: '', type: NodeConnectionTypes.Main },
			// Entrée OBLIGATOIRE pour un modèle LLM
			// Supporte TOUS les LLM de n8n : OpenAI, Claude, Gemini, Mistral, Ollama, Groq, Azure, etc.
			{
				displayName: 'Model',
				type: NodeConnectionTypes.AiLanguageModel,
				required: true,
				maxConnections: 1,
			},
		],

		// Sortie du nœud
		outputs: [{ displayName: '', type: NodeConnectionTypes.Main }],

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
				description:
					'Nom du champ binaire contenant le template DOCX avec les tags {{TAG}} existants. ' +
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
						description:
							'Nom du fichier de sortie (par défaut: original_tagged.docx)',
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
								description:
									'Active la segmentation pour les documents volumineux',
							},
							{
								name: 'Toujours activer',
								value: 'always',
								description:
									'Force la segmentation. Améliore la précision (tableaux CA)',
							},
							{
								name: 'Désactiver',
								value: 'never',
								description: 'Désactive la segmentation.',
							},
						],
						default: 'auto',
						description:
							'Divise le document en sections pour un matching plus précis.',
					},
				],
			},
		],
	};

	// ============================================================================
	// EXÉCUTION DU NŒUD
	// ============================================================================

	/**
	 * Point d'entrée principal du nœud.
	 * Traite chaque item d'entrée et produit les résultats.
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// IMPORTANT: Vider les caches au début pour éviter les données périmées
		clearAllCaches();

		try {
			// Traiter chaque item d'entrée
			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
				// Réinitialiser le cache des paragraphes pour chaque item
				resetParagraphCache();

				try {
					const result = await processItem(this, itemIndex, items[itemIndex]);
					returnData.push(result);
				} catch (error) {
					// Gestion des erreurs : continuer ou échouer selon la configuration
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								success: false,
								error: (error as Error).message,
							},
						});
					} else {
						throw error;
					}
				}
			}

			return [returnData];
		} finally {
			// IMPORTANT: Toujours vider les caches à la fin, même en cas d'erreur
			// Cela évite les fuites mémoire et les données corrompues
			clearAllCaches();
		}
	}
}

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
async function processItem(
	ctx: IExecuteFunctions,
	itemIndex: number,
	item: INodeExecutionData
): Promise<INodeExecutionData> {
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

	const extractedTags = extractTagsFromTemplateXml(templateDoc.xml);

	if (extractedTags.length === 0) {
		throw new NodeOperationError(
			ctx.getNode(),
			'Aucun tag {{TAG}} trouvé dans le template de référence. ' +
				'Le template doit contenir des tags au format {{NOM_DU_TAG}}.',
			{ itemIndex }
		);
	}

	// Extraire les contextes des tags pour le transfer learning
	const tagContexts = extractTagContextsFromTemplate(templateDoc.xml);

	// ============================================================
	// ÉTAPE 4b: Extraire les checkboxes du template
	// ============================================================

	const templateCheckboxes = extractCheckboxes(templateDoc.xml);
	const templateCheckboxPairs = findCheckboxPairs(templateCheckboxes);
	const checkboxTags = generateCheckboxTags(templateCheckboxes, templateCheckboxPairs);

	if (params.debug && templateCheckboxes.length > 0) {
		console.log(`\n☑️ Checkboxes template: ${templateCheckboxes.length}`);
		console.log(`   Paires Oui/Non: ${templateCheckboxPairs.length}`);
		console.log(`   Tags checkbox générés: ${checkboxTags.size}`);
	}

	// ============================================================
	// ÉTAPE 5: Analyser le document cible
	// ============================================================

	const docType = detectDocumentType(targetDoc.xml, targetDoc.filename);
	const targetParagraphs = extractTargetParagraphs(targetDoc.xml);

	// Extraire les checkboxes de la cible
	const targetCheckboxes = extractCheckboxes(targetDoc.xml);

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

	const useSegmentation = decideSegmentationMode(
		params.useSegmentation,
		templateDoc.xml,
		extractedTags
	);

	let matches: TagMatch[];
	let segmentationUsed = false;
	let patternFallbackUsed = false;
	let llmRawResponse: string | undefined;

	if (useSegmentation) {
		// ============================================================
		// MODE SEGMENTÉ: Matching par segment (plus précis)
		// ============================================================
		if (params.debug) {
			console.log('\n📊 Mode SEGMENTÉ activé');
		}

		const segmentResult = await processWithSegmentation(
			ctx,
			itemIndex,
			params,
			templateDoc.xml,
			targetDoc.xml,
			extractedTags,
			docType.type
		);

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
			matches = patternBasedMatching(tagContexts, targetParagraphs);
			patternFallbackUsed = true;

			if (params.debug) {
				console.log(`✅ Fallback patterns: ${matches.length} matches trouvés`);
			}
		}
	} else {
		// ============================================================
		// MODE GLOBAL: Matching classique (document entier)
		// ============================================================
		if (params.debug) {
			console.log('\n📄 Mode GLOBAL (document entier)');
		}

		// Générer le prompt principal
		let prompt = generateTransferLearningPrompt(
			tagContexts,
			targetParagraphs,
			extractedTags,
			docType.type
		);

		// Ajouter le prompt des checkboxes si présentes
		if (templateCheckboxes.length > 0) {
			const checkboxPrompt = generateCheckboxFewShot(
				templateCheckboxes,
				targetCheckboxes,
				templateCheckboxPairs
			);
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

		matches = parseMatchResponse(llmResponse);

		// FALLBACK: Si le LLM ne retourne aucun match, utiliser le matching par patterns
		if (matches.length === 0) {
			if (params.debug) {
				console.log('\n⚠️ LLM n\'a retourné aucun match, fallback vers matching par patterns...');
			}
			matches = patternBasedMatching(tagContexts, targetParagraphs);
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
		matches.forEach((m) =>
			console.log(`  - ${m.tag} → paragraphe ${m.targetParagraphIndex} (${m.confidence})`)
		);
	}

	const { xml: taggedXml, applied, failed } = applyTagsToTarget(
		targetDoc.xml,
		matches,
		targetParagraphs
	);

	// ============================================================
	// ÉTAPE 7b: Analyser et appliquer les checkboxes avec l'IA
	// ============================================================

	let modifiedXml = taggedXml;
	let checkboxApplied: string[] = [];
	let checkboxFailed: string[] = [];
	let checkboxAnalysisResult: CheckboxAnalysisResult | undefined;

	if (targetCheckboxes.length > 0) {
		// Récupérer le modèle LLM pour l'analyse des checkboxes
		const model = (await ctx.getInputConnectionData(
			NodeConnectionTypes.AiLanguageModel,
			itemIndex
		)) as LLMModel | undefined;

		if (model) {
			// Extraire le contexte textuel du document pour l'analyse IA
			const documentContext = extractDocumentContext(targetDoc.xml);

			if (params.debug) {
				console.log(`\n☑️ === ANALYSE IA DES CHECKBOXES ===`);
				console.log(`   Checkboxes cibles: ${targetCheckboxes.length}`);
				console.log(`   Checkboxes template: ${templateCheckboxes.length}`);
				console.log(`   Contexte document: ${Math.round(documentContext.length / 1000)}KB`);
			}

			// Analyser les checkboxes avec l'IA
			checkboxAnalysisResult = await analyzeCheckboxesWithAI(
				model,
				modifiedXml,
				templateCheckboxes,
				targetCheckboxes,
				templateCheckboxPairs,
				documentContext,
				params.debug
			);

			modifiedXml = checkboxAnalysisResult.xml;
			checkboxApplied = checkboxAnalysisResult.applied;
			checkboxFailed = checkboxAnalysisResult.failed;

			if (params.debug) {
				console.log(`\n☑️ Résultat analyse IA:`);
				console.log(`   Mode: ${checkboxAnalysisResult.mode}`);
				console.log(`   Décisions: ${checkboxAnalysisResult.decisions.length}`);
				console.log(`   ✅ Appliquées: ${checkboxApplied.length}`);
				if (checkboxFailed.length > 0) {
					console.log(`   ⚠️ Échouées: ${checkboxFailed.length}`);
				}
				checkboxAnalysisResult.decisions.forEach((d) => {
					const arrow = d.shouldBeChecked ? '☑' : '☐';
					console.log(`     - idx=${d.targetIndex} "${d.label.substring(0, 30)}" → ${arrow} (${d.reason || 'N/A'})`);
				});
			}
		} else {
			console.warn('⚠️ Pas de modèle LLM pour l\'analyse des checkboxes');
		}
	}

	// ============================================================
	// ÉTAPE 8: Sauvegarder le document modifié
	// ============================================================

	const outputBuffer = saveDocxContent(targetDoc.zip, modifiedXml);
	const outputName =
		params.outputFilename || targetDoc.filename.replace('.docx', '_tagged.docx');

	const binaryOutput = await ctx.helpers.prepareBinaryData(
		outputBuffer,
		outputName,
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	);

	// ============================================================
	// ÉTAPE 9: Préparer la sortie
	// ============================================================

	const templateDataStructure = generateDataStructureFromTags(extractedTags);

	// Ajouter les tags de checkboxes à la structure de données
	const checkboxDataStructure: Record<string, boolean> = {};
	for (const [tag, info] of checkboxTags) {
		checkboxDataStructure[tag] = info.checked;
	}

	// Déterminer le mode utilisé
	let mode = 'transfer_learning';
	let warning: string | undefined;
	if (segmentationUsed) {
		mode = 'transfer_learning_segmented';
	} else if (patternFallbackUsed) {
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
			// Informations sur les checkboxes (avec analyse IA)
			checkboxes: {
				templateCount: templateCheckboxes.length,
				targetCount: targetCheckboxes.length,
				pairsDetected: templateCheckboxPairs.length,
				tags: checkboxDataStructure,
				applied: checkboxApplied,
				failed: checkboxFailed,
				// Nouvelles informations sur l'analyse IA
				aiAnalysisMode: checkboxAnalysisResult?.mode || 'none',
				aiDecisions: checkboxAnalysisResult?.decisions.map(d => ({
					index: d.targetIndex,
					label: d.label,
					checked: d.shouldBeChecked,
					confidence: d.confidence,
					reason: d.reason,
				})) || [],
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
function getParameters(ctx: IExecuteFunctions, itemIndex: number): NodeParameters {
	const targetProp = ctx.getNodeParameter('targetDocumentProperty', itemIndex) as string;
	const refProp = ctx.getNodeParameter('referenceTemplateProperty', itemIndex) as string;
	const options = ctx.getNodeParameter('options', itemIndex) as {
		outputFilename?: string;
		debug?: boolean;
		useSegmentation?: 'auto' | 'always' | 'never';
	};

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
async function loadTargetDocument(
	ctx: IExecuteFunctions,
	itemIndex: number,
	item: INodeExecutionData,
	propertyName: string
): Promise<LoadedDocument> {
	const binary = item.binary;

	if (!binary?.[propertyName]) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Document cible non trouvé dans le champ binaire "${propertyName}". ` +
				'Vérifiez que le document DOCX est bien connecté.',
			{ itemIndex }
		);
	}

	const buffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, propertyName);
	const filename = binary[propertyName].fileName || 'document.docx';

	try {
		const { zip, xml } = loadDocxContent(buffer);
		return { zip, xml, filename };
	} catch (error) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Erreur lors du chargement du document cible: ${(error as Error).message}`,
			{ itemIndex }
		);
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
async function loadTemplateDocument(
	ctx: IExecuteFunctions,
	itemIndex: number,
	item: INodeExecutionData,
	propertyName: string
): Promise<{ xml: string }> {
	const binary = item.binary;

	if (!binary?.[propertyName]) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Template de référence non trouvé dans le champ binaire "${propertyName}". ` +
				'Assurez-vous qu\'un document DOCX taggué est connecté.',
			{ itemIndex }
		);
	}

	const buffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, propertyName);

	try {
		const { xml } = loadDocxContent(buffer);
		return { xml };
	} catch (error) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Erreur lors du chargement du template: ${(error as Error).message}`,
			{ itemIndex }
		);
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
async function invokeLLM(
	ctx: IExecuteFunctions,
	itemIndex: number,
	_params: NodeParameters,
	prompt: string
): Promise<string> {
	// Récupérer le modèle LLM connecté
	const model = (await ctx.getInputConnectionData(
		NodeConnectionTypes.AiLanguageModel,
		itemIndex
	)) as LLMModel | undefined;

	if (!model) {
		throw new NodeOperationError(
			ctx.getNode(),
			'Aucun modèle LLM connecté. ' +
				'Connectez un nœud LLM au port "Model" (ex: OpenAI Chat Model, Claude, Gemini, Mistral, Ollama, etc.). ' +
				'Ce nœud supporte TOUS les LLM disponibles dans n8n.',
			{ itemIndex }
		);
	}

	return callConnectedLLM(model, prompt);
}

/**
 * Affiche les informations de débogage dans la console.
 *
 * @param filename - Nom du fichier traité
 * @param docType - Type de document détecté
 * @param paragraphs - Liste des paragraphes
 * @param tags - Liste des tags extraits
 */
function logDebugInfo(
	filename: string,
	docType: DocumentType,
	paragraphs: TargetParagraph[],
	tags: ExtractedTag[]
): void {
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
function decideSegmentationMode(
	mode: 'auto' | 'always' | 'never',
	templateXml: string,
	extractedTags: ExtractedTag[]
): boolean {
	if (mode === 'always') return true;
	if (mode === 'never') return false;

	// Mode auto: utiliser la fonction de décision du service
	return shouldUseSegmentation(templateXml, extractedTags);
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
async function processWithSegmentation(
	ctx: IExecuteFunctions,
	itemIndex: number,
	params: NodeParameters,
	templateXml: string,
	targetXml: string,
	extractedTags: ExtractedTag[],
	docType: DocumentType
): Promise<{ matches: TagMatch[] }> {
	// Étape 1: Préparer le plan de matching par segments
	const plan = prepareSegmentMatchingPlan(templateXml, targetXml, extractedTags);

	if (params.debug) {
		logMatchingPlan(plan);
	}

	// Si aucun segment matché, retourner vide
	if (plan.matchedPairs.length === 0) {
		console.log('⚠️ Aucun segment matché, fallback vers matching global');
		return { matches: [] };
	}

	// Étape 2: Pour chaque paire de segments, appeler le LLM
	const segmentResults = new Map<string, TagMatch[]>();

	for (const pair of plan.matchedPairs) {
		if (params.debug) {
			console.log(`\n🔍 Traitement segment: ${pair.templateSegment.id}`);
			console.log(`   Tags: ${pair.tagsToTransfer.join(', ')}`);
		}

		// Générer le prompt pour ce segment
		const segmentPrompt = generateSegmentPrompt(pair, docType);

		// Appeler le LLM
		const llmResponse = await invokeLLM(ctx, itemIndex, params, segmentPrompt);

		if (params.debug) {
			console.log(`   Réponse: ${llmResponse.substring(0, 200)}...`);
		}

		// Parser la réponse
		const segmentMatches = parseMatchResponse(llmResponse);

		// Convertir les index relatifs en index globaux
		const adjustedMatches = adjustMatchIndexes(segmentMatches, pair);

		segmentResults.set(pair.templateSegment.id, adjustedMatches);

		if (params.debug) {
			console.log(`   ✓ ${adjustedMatches.length} matches trouvés`);
		}
	}

	// Étape 3: Combiner les résultats
	const allMatches = combineSegmentResults(segmentResults, plan.matchedPairs);

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
function adjustMatchIndexes(
	matches: TagMatch[],
	pair: MatchedSegmentPair
): TagMatch[] {
	// Validation optionnelle: vérifier que les index sont dans la plage attendue
	const validIndexes = new Set(pair.targetParagraphs.map(p => p.index));

	return matches.map((match) => {
		// Log un warning si l'index retourné par le LLM n'est pas dans la liste
		if (!validIndexes.has(match.targetParagraphIndex) && validIndexes.size > 0) {
			console.warn(
				`⚠️ Index ${match.targetParagraphIndex} pour tag ${match.tag} ` +
				`n'est pas dans la plage du segment (${[...validIndexes].join(', ')})`
			);
		}
		return { ...match };
	});
}
