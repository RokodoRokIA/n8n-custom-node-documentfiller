/**
 * TemplateMapper - Création intelligente de templates via IA
 *
 * Ce nœud analyse un document vierge et une structure de données JSON,
 * puis utilise l'IA pour déduire où placer chaque tag {{TAG}} dans le document.
 *
 * Workflow complémentaire avec DocxTemplateFiller :
 * 1. TemplateMapper : Crée le template + génère la structure de données exacte
 * 2. DocxTemplateFiller : Remplit le template avec les valeurs réelles
 *
 * Sorties :
 * - Document DOCX avec les tags {{TAG}} insérés aux bons emplacements
 * - dataStructure : Structure JSON exacte à remplir pour DocxTemplateFiller
 */

import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import PizZip from 'pizzip';

// ============================================================================
// Types
// ============================================================================

interface FieldMapping {
	field: string;
	tag: string;
	paragraphIndex: number;
	insertAfter?: string;
	replaceText?: string;
	confidence: number;
}

interface MappingResult {
	tag: string;
	paragraphIndex: number;
	inserted: boolean;
	reason: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extrait les paragraphes d'un document XML OOXML
 * Gère correctement les structures imbriquées (tableaux, etc.)
 */
function extractParagraphs(xml: string): Array<{
	index: number;
	text: string;
	xml: string;
	start: number;
	end: number;
}> {
	const paragraphs: Array<{
		index: number;
		text: string;
		xml: string;
		start: number;
		end: number;
	}> = [];
	let searchPos = 0;
	let paragraphIndex = 0;

	while (searchPos < xml.length) {
		let pStart = xml.indexOf('<w:p ', searchPos);
		let pStartNoAttr = xml.indexOf('<w:p>', searchPos);

		if (pStart === -1) pStart = Infinity;
		if (pStartNoAttr === -1) pStartNoAttr = Infinity;

		const actualStart = Math.min(pStart, pStartNoAttr);
		if (actualStart === Infinity) break;

		const tagEnd = xml.indexOf('>', actualStart);
		if (tagEnd === -1) break;

		if (xml[tagEnd - 1] === '/') {
			searchPos = tagEnd + 1;
			paragraphIndex++;
			continue;
		}

		let depth = 1;
		let pos = tagEnd + 1;

		while (pos < xml.length && depth > 0) {
			const nextOpen = xml.indexOf('<w:p ', pos);
			const nextOpenNoAttr = xml.indexOf('<w:p>', pos);
			const nextClose = xml.indexOf('</w:p>', pos);

			let nextOpenPos = Math.min(
				nextOpen === -1 ? Infinity : nextOpen,
				nextOpenNoAttr === -1 ? Infinity : nextOpenNoAttr,
			);

			if (nextClose === -1) break;

			if (nextOpenPos < nextClose) {
				const openTagEnd = xml.indexOf('>', nextOpenPos);
				if (openTagEnd !== -1 && xml[openTagEnd - 1] === '/') {
					pos = openTagEnd + 1;
				} else {
					depth++;
					pos = openTagEnd !== -1 ? openTagEnd + 1 : nextOpenPos + 5;
				}
			} else {
				depth--;
				if (depth === 0) {
					const pEnd = nextClose + 6;
					const pXml = xml.substring(actualStart, pEnd);

					const textParts: string[] = [];
					const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
					let tMatch;
					while ((tMatch = tRegex.exec(pXml)) !== null) {
						textParts.push(tMatch[1]);
					}
					const text = textParts.join('');

					paragraphs.push({
						index: paragraphIndex,
						text,
						xml: pXml,
						start: actualStart,
						end: pEnd,
					});

					searchPos = pEnd;
				} else {
					pos = nextClose + 6;
				}
			}
		}

		if (depth > 0) {
			searchPos = actualStart + 5;
		}

		paragraphIndex++;
		if (paragraphIndex > 5000) break;
	}

	return paragraphs;
}

/**
 * Aplatit un objet JSON pour extraire toutes les clés (champs) avec leurs chemins complets
 * Retourne un tableau d'objets { key, path, tag }
 */
function flattenJsonStructure(
	obj: Record<string, unknown>,
	prefix = '',
): Array<{ key: string; path: string; tag: string }> {
	const fields: Array<{ key: string; path: string; tag: string }> = [];

	for (const [key, value] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${key}` : key;
		const tag = path.replace(/\./g, '_').toUpperCase();

		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			fields.push(...flattenJsonStructure(value as Record<string, unknown>, path));
		} else {
			fields.push({ key, path, tag });
		}
	}

	return fields;
}

/**
 * Génère la structure de données exacte pour DocxTemplateFiller
 * Crée un objet avec les tags comme clés et des valeurs vides
 */
function generateDataStructure(
	insertedTags: string[],
): Record<string, string> {
	const structure: Record<string, string> = {};
	for (const tag of insertedTags) {
		structure[tag] = '';
	}
	return structure;
}

/**
 * Construit le prompt pour l'IA
 * L'IA déduit où placer les tags basé sur la sémantique des clés JSON
 */
function buildDeductionPrompt(
	fields: Array<{ key: string; path: string; tag: string }>,
	paragraphs: Array<{ index: number; text: string }>,
): string {
	const fieldsInfo = fields
		.map((f) => `- {{${f.tag}}} (champ: ${f.key}, chemin: ${f.path})`)
		.join('\n');

	const paragraphsInfo = paragraphs
		.filter((p) => p.text.length > 3)
		.slice(0, 200)
		.map((p) => `[${p.index}] "${p.text.substring(0, 250)}"`)
		.join('\n');

	return `Tu es un expert en analyse de documents administratifs et formulaires.

MISSION: Analyser un document vierge et identifier où placer des tags pour le pré-remplissage automatique.

CHAMPS À PLACER (basés sur la structure de données fournie):
${fieldsInfo}

PARAGRAPHES DU DOCUMENT (index + texte):
${paragraphsInfo}

INSTRUCTIONS:
1. Pour chaque champ, trouve le paragraphe où la VALEUR correspondante doit être insérée
2. Utilise la sémantique des noms de champs pour déduire les correspondances:
   - "nom_commercial", "nom", "raison_sociale" → paragraphe contenant "Dénomination", "Nom", "Raison sociale"
   - "siret", "siren" → paragraphe contenant "SIRET", "N° SIRET", "Numéro SIRET"
   - "adresse", "adresse_siege" → paragraphe contenant "Adresse", "Siège", "Établissement"
   - "email", "mail" → paragraphe contenant "Mail", "Courriel", "Électronique", "@"
   - "telephone", "tel" → paragraphe contenant "Téléphone", "Tél", "N°"
   - "date" → paragraphe contenant "Date", "Le", "Fait à"
   - etc.
3. Si le paragraphe contient "...", "[...]", "____", ou un espace à remplir, utilise "replaceText"
4. Sinon, utilise "insertAfter" avec le label qui précède la zone à remplir

RÉPONDS UNIQUEMENT avec un JSON valide:
{
  "mappings": [
    {
      "field": "nom_commercial",
      "tag": "NOM_COMMERCIAL",
      "paragraphIndex": 46,
      "insertAfter": "Dénomination sociale :",
      "confidence": 95
    },
    {
      "field": "siret",
      "tag": "SIRET",
      "paragraphIndex": 48,
      "replaceText": "...............",
      "confidence": 90
    }
  ]
}

IMPORTANT:
- Chaque champ doit avoir un seul mapping vers le paragraphe le plus approprié
- Le "tag" doit correspondre exactement à ceux listés ci-dessus
- La "confidence" est un score de 0 à 100
- Ne force pas un mapping si tu n'es pas sûr (confidence < 50)`;
}

/**
 * Parse la réponse LLM
 */
function parseLLMResponse(response: unknown): FieldMapping[] {
	let responseText: string;

	if (typeof response === 'string') {
		responseText = response;
	} else if (response && typeof response === 'object') {
		const resp = response as Record<string, unknown>;
		if (resp.content) {
			if (typeof resp.content === 'string') {
				responseText = resp.content;
			} else if (Array.isArray(resp.content)) {
				responseText = resp.content
					.map((c: { text?: string }) => c.text || '')
					.join('');
			} else {
				responseText = JSON.stringify(resp.content);
			}
		} else if (resp.text) {
			responseText = String(resp.text);
		} else {
			responseText = JSON.stringify(response);
		}
	} else {
		throw new Error('Réponse LLM invalide');
	}

	const jsonMatch = responseText.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Pas de JSON trouvé dans la réponse LLM');
	}

	const parsed = JSON.parse(jsonMatch[0]);
	return parsed.mappings || [];
}

/**
 * Insère les tags dans le XML du document
 */
function insertTagsInXml(
	xml: string,
	mappings: FieldMapping[],
): { xml: string; results: MappingResult[] } {
	let result = xml;
	const results: MappingResult[] = [];

	const paragraphs = extractParagraphs(xml);

	// Trier par index décroissant pour éviter les décalages
	const sortedMappings = [...mappings].sort(
		(a, b) => b.paragraphIndex - a.paragraphIndex,
	);

	for (const mapping of sortedMappings) {
		const paragraph = paragraphs.find((p) => p.index === mapping.paragraphIndex);
		if (!paragraph) {
			results.push({
				tag: mapping.tag,
				paragraphIndex: mapping.paragraphIndex,
				inserted: false,
				reason: 'Paragraphe non trouvé',
			});
			continue;
		}

		let newParagraph = paragraph.xml;
		let inserted = false;

		// Stratégie 1: Remplacer un texte spécifique
		if (mapping.replaceText && newParagraph.includes(mapping.replaceText)) {
			newParagraph = newParagraph.replace(
				mapping.replaceText,
				`{{${mapping.tag}}}`,
			);
			inserted = true;
		}

		// Stratégie 2: Insérer après un label
		if (!inserted && mapping.insertAfter) {
			const labelIndex = newParagraph
				.toLowerCase()
				.indexOf(mapping.insertAfter.toLowerCase());
			if (labelIndex !== -1) {
				const labelEnd = newParagraph.indexOf('</w:t>', labelIndex);
				if (labelEnd !== -1) {
					newParagraph =
						newParagraph.substring(0, labelEnd) +
						` {{${mapping.tag}}}` +
						newParagraph.substring(labelEnd);
					inserted = true;
				}
			}
		}

		// Stratégie 3: Ajouter à la fin du paragraphe si confiance suffisante
		if (!inserted && mapping.confidence >= 70) {
			const lastTEnd = newParagraph.lastIndexOf('</w:t>');
			if (lastTEnd !== -1) {
				newParagraph =
					newParagraph.substring(0, lastTEnd) +
					` {{${mapping.tag}}}` +
					newParagraph.substring(lastTEnd);
				inserted = true;
			}
		}

		if (inserted) {
			result =
				result.substring(0, paragraph.start) +
				newParagraph +
				result.substring(paragraph.end);

			const diff = newParagraph.length - paragraph.xml.length;
			for (const p of paragraphs) {
				if (p.start > paragraph.start) {
					p.start += diff;
					p.end += diff;
				}
			}
			paragraph.xml = newParagraph;
			paragraph.end = paragraph.start + newParagraph.length;
		}

		results.push({
			tag: mapping.tag,
			paragraphIndex: mapping.paragraphIndex,
			inserted,
			reason: inserted ? 'OK' : 'Position non trouvée dans le paragraphe',
		});
	}

	return { xml: result, results };
}

// ============================================================================
// Main Node Class
// ============================================================================

export class TemplateMapper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Template Mapper',
		name: 'templateMapper',
		icon: 'file:docx.svg',
		group: ['transform'],
		version: 3,
		subtitle: 'IA déduit les emplacements des {{TAGS}}',
		description:
			'Analyse un document vierge et une structure JSON, puis utilise l\'IA pour placer automatiquement les tags {{TAG}}. Génère également la structure de données exacte pour DocxTemplateFiller.',
		defaults: {
			name: 'Template Mapper',
		},
		inputs: [
			{ displayName: '', type: 'main' as const },
			{
				displayName: 'Model',
				maxConnections: 1,
				type: 'ai_languageModel' as const,
				required: true,
			},
		],
		outputs: [{ displayName: '', type: 'main' as const }],
		properties: [
			// ==================== Document à analyser ====================
			{
				displayName: 'Document Vierge',
				name: 'documentProperty',
				type: 'string',
				default: 'data',
				required: true,
				description:
					'Nom de la propriété binaire contenant le document DOCX vierge à analyser. Ce document sera transformé en template avec des tags {{TAG}} aux emplacements appropriés.',
			},

			// ==================== Structure JSON ====================
			{
				displayName: 'Structure de Données',
				name: 'dataStructure',
				type: 'json',
				default: `{
  "client": {
    "nom": "",
    "prenom": "",
    "email": "",
    "telephone": "",
    "adresse": ""
  },
  "commande": {
    "numero": "",
    "date": "",
    "montant": ""
  },
  "signature": {
    "lieu": "",
    "date": ""
  }
}`,
				required: true,
				description:
					'Structure JSON décrivant les champs à insérer dans le document. Les clés sont converties en tags (ex: client.nom → {{CLIENT_NOM}}). L\'IA utilise la sémantique des noms pour trouver les bons emplacements.',
			},

			// ==================== Options ====================
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Ajouter une option',
				default: {},
				options: [
					{
						displayName: 'Seuil de Confiance',
						name: 'confidenceThreshold',
						type: 'number',
						default: 70,
						typeOptions: {
							minValue: 0,
							maxValue: 100,
						},
						description:
							'Score minimum de confiance (0-100) pour qu\'un tag soit inséré. Plus le seuil est élevé, moins de tags seront placés mais avec plus de précision.',
					},
					{
						displayName: 'Nom du Fichier de Sortie',
						name: 'outputFilename',
						type: 'string',
						default: '',
						placeholder: 'ex: template_entreprise.docx',
						description:
							'Nom du fichier template généré. Si vide, utilise le nom du fichier source avec suffixe "_TEMPLATE".',
					},
					{
						displayName: 'Inclure les Détails du Mapping',
						name: 'includeDetails',
						type: 'boolean',
						default: false,
						description:
							'Inclut dans la sortie JSON les détails complets du mapping (positions, scores de confiance, etc.) pour le débogage.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Récupérer le LLM
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let llm: any = null;
		try {
			llm = await this.getInputConnectionData('ai_languageModel', 0);
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				'Un modèle LLM est requis. Connectez un modèle (OpenAI, Claude, Ollama, Gemini...) à l\'entrée "Model".',
			);
		}

		if (!llm) {
			throw new NodeOperationError(
				this.getNode(),
				'Un modèle LLM est requis. Connectez un modèle (OpenAI, Claude, Ollama, Gemini...) à l\'entrée "Model".',
			);
		}

		for (let i = 0; i < items.length; i++) {
			try {
				// ============================================================
				// Récupérer les paramètres
				// ============================================================

				const documentProperty = this.getNodeParameter(
					'documentProperty',
					i,
				) as string;
				const dataStructureRaw = this.getNodeParameter(
					'dataStructure',
					i,
				) as string | object;
				const options = this.getNodeParameter('options', i) as {
					confidenceThreshold?: number;
					outputFilename?: string;
					includeDetails?: boolean;
				};

				const confidenceThreshold = options.confidenceThreshold ?? 70;
				const includeDetails = options.includeDetails ?? false;

				// Parser la structure JSON
				let dataStructure: Record<string, unknown>;
				if (typeof dataStructureRaw === 'string') {
					try {
						dataStructure = JSON.parse(dataStructureRaw);
					} catch {
						throw new NodeOperationError(
							this.getNode(),
							'Structure de données JSON invalide. Vérifiez la syntaxe JSON.',
							{ itemIndex: i },
						);
					}
				} else {
					dataStructure = dataStructureRaw as Record<string, unknown>;
				}

				// ============================================================
				// Charger le document
				// ============================================================

				const binaryData = items[i].binary;
				if (!binaryData || !binaryData[documentProperty]) {
					throw new NodeOperationError(
						this.getNode(),
						`Aucun document trouvé dans la propriété binaire "${documentProperty}". Assurez-vous qu'un document DOCX est connecté en entrée.`,
						{ itemIndex: i },
					);
				}

				const documentBuffer = await this.helpers.getBinaryDataBuffer(
					i,
					documentProperty,
				);
				const documentFilename =
					binaryData[documentProperty].fileName || 'document.docx';

				let documentZip: PizZip;
				try {
					documentZip = new PizZip(documentBuffer);
				} catch {
					throw new NodeOperationError(
						this.getNode(),
						'Le fichier fourni n\'est pas un document DOCX valide.',
						{ itemIndex: i },
					);
				}

				const documentXml =
					documentZip.file('word/document.xml')?.asText() || '';

				if (!documentXml || documentXml.length < 100) {
					throw new NodeOperationError(
						this.getNode(),
						'Document DOCX invalide ou vide.',
						{ itemIndex: i },
					);
				}

				// ============================================================
				// Extraire les champs de la structure JSON
				// ============================================================

				const fields = flattenJsonStructure(dataStructure);

				if (fields.length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						'Aucun champ trouvé dans la structure de données. Ajoutez au moins un champ à mapper.',
						{ itemIndex: i },
					);
				}

				// ============================================================
				// Extraire les paragraphes du document
				// ============================================================

				const paragraphs = extractParagraphs(documentXml);

				// ============================================================
				// Appeler l'IA pour déduire les emplacements
				// ============================================================

				const prompt = buildDeductionPrompt(fields, paragraphs);
				const response = await llm.invoke(prompt);
				const aiMappings = parseLLMResponse(response);

				// Filtrer par seuil de confiance
				const filteredMappings = aiMappings.filter(
					(m) => m.confidence >= confidenceThreshold,
				);

				// ============================================================
				// Insérer les tags dans le document
				// ============================================================

				const { xml: mappedXml, results } = insertTagsInXml(
					documentXml,
					filteredMappings,
				);

				// Mettre à jour le document
				documentZip.file('word/document.xml', mappedXml);

				const outputBuffer = documentZip.generate({
					type: 'nodebuffer',
					compression: 'DEFLATE',
				});

				// ============================================================
				// Préparer la sortie
				// ============================================================

				const insertedTags = results.filter((r) => r.inserted).map((r) => r.tag);
				const failedTags = results.filter((r) => !r.inserted).map((r) => r.tag);

				// Générer la structure de données exacte pour DocxTemplateFiller
				const templateDataStructure = generateDataStructure(insertedTags);

				const finalFilename =
					options.outputFilename ||
					documentFilename.replace('.docx', '_TEMPLATE.docx');

				const binaryOutput = await this.helpers.prepareBinaryData(
					outputBuffer,
					finalFilename,
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				);

				// JSON de sortie avec la structure de données pour DocxTemplateFiller
				const jsonOutput: {
					success: boolean;
					sourceFilename: string;
					outputFilename: string;
					fieldsProvided: number;
					tagsInserted: number;
					tagsFailed: number;
					insertedTags: string[];
					failedTags: string[];
					dataStructure: Record<string, string>;
					mappingDetails?: MappingResult[];
					aiMappings?: FieldMapping[];
				} = {
					success: true,
					sourceFilename: documentFilename,
					outputFilename: finalFilename,
					fieldsProvided: fields.length,
					tagsInserted: insertedTags.length,
					tagsFailed: failedTags.length,
					insertedTags,
					failedTags,
					// Structure exacte pour DocxTemplateFiller
					dataStructure: templateDataStructure,
				};

				if (includeDetails) {
					jsonOutput.mappingDetails = results;
					jsonOutput.aiMappings = aiMappings;
				}

				returnData.push({
					json: jsonOutput,
					binary: { data: binaryOutput },
				});
			} catch (error) {
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
	}
}
