/**
 * DocxTemplateFiller - Remplissage factuel de documents DOCX
 *
 * Ce nœud remplace les tags {{TAG}} dans un document DOCX par les valeurs
 * correspondantes fournies dans le JSON d'entrée.
 *
 * Logique simple et agnostique :
 * - Le document contient des placeholders au format {{NOM_DU_TAG}}
 * - Le JSON d'entrée contient les mêmes clés avec leurs valeurs
 * - Chaque {{TAG}} est remplacé par sa valeur correspondante
 *
 * Ce nœud est conçu pour fonctionner avec TemplateMapper qui génère :
 * 1. Le document DOCX avec les tags insérés
 * 2. La structure de données exacte à remplir (dataStructure)
 *
 * Workflow typique :
 * TemplateMapper (crée template + structure) → DocxTemplateFiller (remplit les valeurs)
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

type CheckboxStyle = 'unicode' | 'text' | 'boolean';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extrait tous les tags {{TAG}} d'un document XML
 * Format supporté : {{TAG_NAME}} où TAG_NAME contient lettres majuscules, chiffres et underscores
 */
function extractTagsFromXml(xml: string): string[] {
	const allTags = xml.match(/\{\{[A-Z_0-9]+\}\}/gi) || [];
	return [...new Set(allTags.map((t) => t.replace(/[{}]/g, '')))];
}

/**
 * Aplatit un objet JSON imbriqué en un objet plat avec les clés en majuscules
 * { entreprise: { nom: "Test" } } → { "ENTREPRISE_NOM": "Test" }
 *
 * Supporte également les clés déjà au bon format (ex: NOM_COMMERCIAL)
 */
function flattenJsonToTags(
	obj: Record<string, unknown>,
	prefix = '',
): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(obj)) {
		// Construire la clé : soit avec préfixe, soit juste la clé
		const tagKey = prefix
			? `${prefix}_${key}`.toUpperCase()
			: key.toUpperCase();

		if (value === null || value === undefined) {
			continue;
		} else if (typeof value === 'object' && !Array.isArray(value)) {
			// Récursion pour les objets imbriqués
			Object.assign(
				result,
				flattenJsonToTags(value as Record<string, unknown>, tagKey),
			);
		} else if (Array.isArray(value)) {
			// Pour les tableaux, joindre les éléments
			result[tagKey] = value
				.map((item) =>
					typeof item === 'object' ? JSON.stringify(item) : String(item),
				)
				.join(', ');
		} else if (typeof value === 'boolean') {
			// Les booléens sont convertis pour les checkboxes
			result[tagKey] = value ? '☑' : '☐';
		} else {
			result[tagKey] = String(value);
		}
	}

	return result;
}

/**
 * Ajuste le style des checkboxes selon la préférence utilisateur
 */
function adjustCheckboxStyle(
	data: Record<string, string>,
	style: CheckboxStyle,
): Record<string, string> {
	if (style === 'unicode') return data;

	const result = { ...data };
	for (const key of Object.keys(result)) {
		const val = result[key];
		// Détecter les valeurs de checkbox (☑ ou ☐)
		if (val === '☑' || val === '☐') {
			if (style === 'text') {
				result[key] = val === '☑' ? 'X' : ' ';
			} else if (style === 'boolean') {
				result[key] = val === '☑' ? 'true' : 'false';
			}
		}
	}
	return result;
}

/**
 * Échappe les caractères spéciaux XML
 */
function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Remplace les tags {{TAG}} dans le XML par leurs valeurs
 */
function replaceTagsInXml(
	xml: string,
	data: Record<string, string>,
	keepEmpty: boolean = false,
): { xml: string; replaced: string[]; remaining: string[] } {
	let result = xml;
	const replaced: string[] = [];
	const remaining: string[] = [];

	// Trouver tous les tags uniques
	const allTags = xml.match(/\{\{[A-Z_0-9]+\}\}/gi) || [];
	const uniqueTags = [...new Set(allTags)];

	for (const fullTag of uniqueTags) {
		const tagName = fullTag.replace(/[{}]/g, '');
		const value = data[tagName];

		if (value !== undefined && value !== null && value !== '') {
			// Remplacer le tag par sa valeur (échappée pour XML)
			const escapedTag = fullTag.replace(/[{}]/g, '\\$&');
			const regex = new RegExp(escapedTag, 'g');
			const safeValue = escapeXml(String(value));
			result = result.replace(regex, safeValue);
			replaced.push(tagName);
		} else {
			remaining.push(tagName);
		}
	}

	// Nettoyer les tags sans valeur (sauf si keepEmpty = true)
	if (!keepEmpty) {
		result = result.replace(/\{\{[A-Z_0-9]+\}\}/gi, '');
	}

	return { xml: result, replaced, remaining };
}

// ============================================================================
// Main Node Class
// ============================================================================

export class DocxTemplateFiller implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DOCX Template Filler',
		name: 'docxTemplateFiller',
		icon: 'file:docx.svg',
		group: ['transform'],
		version: 2,
		subtitle: 'Remplit {{TAGS}} avec données JSON',
		description:
			'Remplace les tags {{TAG}} d\'un document DOCX par les valeurs du JSON d\'entrée. Fonctionne avec tout document DOCX contenant des placeholders {{TAG}}.',
		defaults: {
			name: 'DOCX Template Filler',
		},
		inputs: [{ displayName: '', type: 'main' as const }],
		outputs: [{ displayName: '', type: 'main' as const }],
		properties: [
			// ==================== Document Source ====================
			{
				displayName: 'Document Template',
				name: 'binaryProperty',
				type: 'string',
				default: 'data',
				required: true,
				description:
					'Nom de la propriété binaire contenant le document DOCX avec les tags {{TAG}} à remplacer. Ce document est généralement produit par le nœud TemplateMapper.',
			},

			// ==================== Données à injecter ====================
			{
				displayName: 'Source des Données',
				name: 'dataSource',
				type: 'options',
				options: [
					{
						name: 'JSON Complet (Item Courant)',
						value: 'fullJson',
						description:
							'Utilise tout le JSON de l\'item courant. Les clés sont converties en tags (ex: entreprise.nom → ENTREPRISE_NOM).',
					},
					{
						name: 'Champ Spécifique',
						value: 'specificField',
						description:
							'Utilise un champ spécifique du JSON qui contient directement les tags et valeurs.',
					},
				],
				default: 'fullJson',
				description: 'D\'où proviennent les données à injecter dans le document.',
			},
			{
				displayName: 'Champ de Données',
				name: 'dataField',
				type: 'string',
				default: 'templateData',
				displayOptions: {
					show: { dataSource: ['specificField'] },
				},
				description:
					'Nom du champ JSON contenant les données de mapping. Ce champ doit contenir un objet avec les tags comme clés (ex: { "NOM_COMMERCIAL": "Ma Société", "SIRET": "12345678901234" }).',
				placeholder: 'ex: templateData, mappingData',
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
						description:
							'Comment afficher les valeurs booléennes (cases à cocher).',
					},
					{
						displayName: 'Nom du Fichier de Sortie',
						name: 'outputFilename',
						type: 'string',
						default: '',
						placeholder: 'ex: document_rempli.docx',
						description:
							'Nom du fichier DOCX généré. Si vide, utilise le nom du fichier source avec suffixe "_FILLED".',
					},
					{
						displayName: 'Conserver les Tags Non Remplis',
						name: 'keepEmptyTags',
						type: 'boolean',
						default: false,
						description:
							'Si activé, les tags {{TAG}} sans valeur correspondante restent visibles dans le document. Sinon, ils sont supprimés.',
					},
					{
						displayName: 'Inclure le Rapport de Mapping',
						name: 'includeReport',
						type: 'boolean',
						default: true,
						description:
							'Inclut dans la sortie JSON la liste des tags remplacés et non remplacés pour faciliter le débogage.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				// ============================================================
				// Récupérer les paramètres
				// ============================================================

				const binaryProperty = this.getNodeParameter(
					'binaryProperty',
					i,
				) as string;
				const dataSource = this.getNodeParameter('dataSource', i) as string;
				const options = this.getNodeParameter('options', i) as {
					checkboxStyle?: CheckboxStyle;
					outputFilename?: string;
					keepEmptyTags?: boolean;
					includeReport?: boolean;
				};

				const checkboxStyle = options.checkboxStyle || 'unicode';
				const keepEmptyTags = options.keepEmptyTags || false;
				const includeReport = options.includeReport !== false;

				// ============================================================
				// Charger le document DOCX
				// ============================================================

				const binaryData = items[i].binary;
				if (!binaryData || !binaryData[binaryProperty]) {
					throw new NodeOperationError(
						this.getNode(),
						`Aucun document trouvé dans la propriété binaire "${binaryProperty}". Assurez-vous qu'un document DOCX est connecté en entrée.`,
						{ itemIndex: i },
					);
				}

				const documentBuffer = await this.helpers.getBinaryDataBuffer(
					i,
					binaryProperty,
				);
				const originalFilename =
					binaryData[binaryProperty].fileName || 'document.docx';

				// ============================================================
				// Charger les données de mapping
				// ============================================================

				let rawData: Record<string, unknown>;

				if (dataSource === 'specificField') {
					const dataField = this.getNodeParameter('dataField', i) as string;
					rawData = items[i].json[dataField] as Record<string, unknown>;
					if (!rawData || typeof rawData !== 'object') {
						throw new NodeOperationError(
							this.getNode(),
							`Le champ "${dataField}" n'existe pas ou n'est pas un objet valide. Vérifiez que ce champ contient les données de mapping (ex: { "NOM_COMMERCIAL": "...", "SIRET": "..." }).`,
							{ itemIndex: i },
						);
					}
				} else {
					// fullJson - utiliser tout le JSON de l'item
					rawData = items[i].json as Record<string, unknown>;
				}

				// ============================================================
				// Ouvrir le document et extraire les tags
				// ============================================================

				let zip: PizZip;
				try {
					zip = new PizZip(documentBuffer);
				} catch {
					throw new NodeOperationError(
						this.getNode(),
						'Le fichier fourni n\'est pas un document DOCX valide (archive ZIP corrompue ou format incorrect).',
						{ itemIndex: i },
					);
				}

				const documentXmlFile = zip.file('word/document.xml');
				if (!documentXmlFile) {
					throw new NodeOperationError(
						this.getNode(),
						'Le fichier DOCX ne contient pas de document.xml. Vérifiez que le fichier est un document Word valide.',
						{ itemIndex: i },
					);
				}

				let xml = documentXmlFile.asText();
				const documentTags = extractTagsFromXml(xml);

				// ============================================================
				// Préparer les données de mapping
				// ============================================================

				// Aplatir le JSON en tags (ENTREPRISE_NOM, etc.)
				let templateData = flattenJsonToTags(rawData);

				// Ajuster le style des checkboxes
				templateData = adjustCheckboxStyle(templateData, checkboxStyle);

				// ============================================================
				// Remplacer les tags dans le document
				// ============================================================

				const { xml: filledXml, replaced, remaining } = replaceTagsInXml(
					xml,
					templateData,
					keepEmptyTags,
				);

				zip.file('word/document.xml', filledXml);

				const outputBuffer = zip.generate({
					type: 'nodebuffer',
					compression: 'DEFLATE',
				});

				// ============================================================
				// Préparer la sortie
				// ============================================================

				const finalFilename =
					options.outputFilename ||
					originalFilename.replace('.docx', '_FILLED.docx');

				const binaryOutput = await this.helpers.prepareBinaryData(
					outputBuffer,
					finalFilename,
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				);

				// Construire le JSON de sortie
				const jsonOutput: {
					success: boolean;
					filename: string;
					originalFilename: string;
					report?: {
						tagsInDocument: number;
						tagsReplaced: number;
						tagsRemaining: number;
						replacedTags: string[];
						remainingTags: string[];
					};
				} = {
					success: true,
					filename: finalFilename,
					originalFilename,
				};

				if (includeReport) {
					jsonOutput.report = {
						tagsInDocument: documentTags.length,
						tagsReplaced: replaced.length,
						tagsRemaining: remaining.length,
						replacedTags: replaced,
						remainingTags: remaining,
					};
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
