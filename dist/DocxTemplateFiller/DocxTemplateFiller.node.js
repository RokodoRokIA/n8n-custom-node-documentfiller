"use strict";
/**
 * DocxTemplateFiller - Remplissage intelligent de documents DOCX
 *
 * Trois modes de fonctionnement:
 * 1. Mode Standard: Mapping fixe basé sur le schéma TagsSchema (rapide, gratuit)
 * 2. Mode IA (LLM): Mapping dynamique avec n'importe quel modèle LLM connecté
 * 3. Mode Hybride: Standard d'abord, puis IA pour les tags non reconnus
 *
 * Le mode IA utilise l'input ai_languageModel de n8n, permettant de connecter:
 * - OpenAI (GPT-4, GPT-4o, GPT-3.5)
 * - Anthropic (Claude)
 * - Ollama (modèles locaux)
 * - Azure OpenAI
 * - Google (Gemini)
 * - Mistral
 * - Et tout autre LLM compatible LangChain
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocxTemplateFiller = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const pizzip_1 = __importDefault(require("pizzip"));
const TagsSchema_1 = require("../shared/TagsSchema");
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Extrait tous les tags {{TAG}} d'un document XML
 */
function extractTagsFromXml(xml) {
    const allTags = xml.match(/\{\{[A-Z_0-9]+\}\}/gi) || [];
    return [...new Set(allTags.map(t => t.replace(/[{}]/g, '')))];
}
/**
 * Aplatit un objet JSON en chemins dotted
 * { a: { b: 1 } } → { "a.b": 1 }
 */
function flattenJson(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value === null || value === undefined) {
            continue;
        }
        else if (typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenJson(value, path));
        }
        else if (Array.isArray(value)) {
            value.forEach((item, idx) => {
                if (typeof item === 'object') {
                    Object.assign(result, flattenJson(item, `${path}[${idx}]`));
                }
                else {
                    result[`${path}[${idx}]`] = String(item);
                }
            });
        }
        else {
            result[path] = String(value);
        }
    }
    return result;
}
/**
 * Prépare les données avec le schéma standard
 */
function prepareStandardData(rawData, documentType) {
    const result = (0, TagsSchema_1.mapDataToTags)(rawData);
    // Tags spécifiques DC2
    if (documentType === 'dc2') {
        const registre = rawData.registre_professionnel;
        const certifications = (registre === null || registre === void 0 ? void 0 : registre.certifications) || [];
        const ca = rawData.chiffres_affaires;
        result.CERTIFICATION_1 = certifications[0] || '';
        result.CERTIFICATION_2 = certifications[1] || '';
        result.CERTIFICATION_3 = certifications[2] || '';
        result.CERTIFICATION_4 = certifications[3] || '';
        result.PART_CA_PERCENT = (ca === null || ca === void 0 ? void 0 : ca.part_ca_percent) || '';
    }
    return result;
}
/**
 * Construit le prompt pour le mapping IA
 */
function buildMappingPrompt(tags, jsonData, context) {
    return `Tu es un assistant spécialisé dans le remplissage de documents administratifs français (marchés publics).

CONTEXTE: ${context || 'Document administratif à remplir'}

TAGS À REMPLIR (ce sont des placeholders dans le document):
${tags.map(t => `- {{${t}}}`).join('\n')}

DONNÉES DISPONIBLES (format: chemin.vers.donnée = valeur):
${Object.entries(jsonData).slice(0, 100).map(([k, v]) => `- ${k} = "${v}"`).join('\n')}

INSTRUCTIONS:
1. Pour chaque tag, trouve la donnée la plus appropriée sémantiquement
2. Utilise ton intelligence pour comprendre les correspondances:
   - NOM_COMMERCIAL ↔ entreprise.nom_commercial
   - SIRET ↔ entreprise.siret
   - RAISON_SOCIALE ↔ entreprise.denomination_sociale
   - ADRESSE ↔ entreprise.adresse
   - etc.
3. Pour les checkboxes (CHECK_*), retourne "☑" si la valeur est true/oui, "☐" si false/non
4. Si aucune donnée ne correspond, retourne une chaîne vide ""
5. Formate les valeurs correctement (dates en français, montants avec €, etc.)

RÉPONDS UNIQUEMENT avec un JSON valide au format:
{
  "mappings": {
    "TAG_NAME": { "value": "valeur à insérer", "confidence": 0.95, "source": "chemin.donnée" },
    "AUTRE_TAG": { "value": "", "confidence": 0, "source": "" }
  }
}`;
}
/**
 * Parse la réponse LLM pour extraire le mapping
 */
function parseLLMResponse(response) {
    let responseText;
    if (typeof response === 'string') {
        responseText = response;
    }
    else if (response && typeof response === 'object') {
        const resp = response;
        if (resp.content) {
            if (typeof resp.content === 'string') {
                responseText = resp.content;
            }
            else if (Array.isArray(resp.content)) {
                responseText = resp.content.map((c) => c.text || '').join('');
            }
            else {
                responseText = JSON.stringify(resp.content);
            }
        }
        else if (resp.text) {
            responseText = String(resp.text);
        }
        else {
            responseText = JSON.stringify(response);
        }
    }
    else {
        throw new Error('Réponse LLM invalide');
    }
    // Extraire le JSON de la réponse
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Pas de JSON trouvé dans la réponse LLM');
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.mappings || {};
}
/**
 * Convertit le mapping IA en données pour le template
 */
function aiMappingToTemplateData(mapping) {
    const result = {};
    for (const [tag, info] of Object.entries(mapping)) {
        if (info.value !== undefined && info.value !== null) {
            result[tag] = String(info.value);
        }
    }
    return result;
}
/**
 * Remplace les tags dans le XML
 */
function replaceTagsInXml(xml, data, keepEmpty = false) {
    let result = xml;
    const replaced = [];
    const remaining = [];
    const allTags = xml.match(/\{\{[A-Z_0-9]+\}\}/gi) || [];
    const uniqueTags = [...new Set(allTags)];
    for (const fullTag of uniqueTags) {
        const tagName = fullTag.replace(/[{}]/g, '');
        const value = data[tagName];
        if (value !== undefined && value !== null && value !== '') {
            const escapedTag = fullTag.replace(/[{}]/g, '\\$&');
            const regex = new RegExp(escapedTag, 'g');
            const safeValue = String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            result = result.replace(regex, safeValue);
            replaced.push(tagName);
        }
        else {
            remaining.push(tagName);
        }
    }
    // Nettoyer les tags restants sauf si on veut les garder
    if (!keepEmpty) {
        result = result.replace(/\{\{[A-Z_0-9]+\}\}/gi, '');
    }
    return { xml: result, replaced, remaining };
}
/**
 * Ajuste le style des checkboxes
 */
function adjustCheckboxStyle(data, style) {
    if (style === 'unicode')
        return data;
    const result = { ...data };
    for (const key of Object.keys(result)) {
        if (key.startsWith('CHECK_')) {
            const val = result[key];
            if (style === 'text') {
                result[key] = val === '☑' ? 'X' : ' ';
            }
            else if (style === 'boolean') {
                result[key] = val === '☑' ? 'true' : 'false';
            }
        }
    }
    return result;
}
// ============================================================================
// Main Node Class
// ============================================================================
class DocxTemplateFiller {
    constructor() {
        this.description = {
            displayName: 'DOCX Template Filler',
            name: 'docxTemplateFiller',
            icon: 'file:docx.svg',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["mappingMode"] === "ai" ? "🤖 IA" : $parameter["mappingMode"] === "hybrid" ? "🔄 Hybride" : "📋 Standard"}} - {{$parameter["documentType"].toUpperCase()}}',
            description: 'Remplit un document DOCX avec des données JSON. Mode Standard (schéma fixe) ou Mode IA (mapping dynamique avec n\'importe quel LLM).',
            defaults: {
                name: 'DOCX Template Filler',
            },
            inputs: [
                { displayName: '', type: 'main' },
                {
                    displayName: 'Model',
                    maxConnections: 1,
                    type: 'ai_languageModel',
                    required: false,
                },
            ],
            outputs: [{ displayName: '', type: 'main' }],
            properties: [
                // ==================== Mode de Mapping ====================
                {
                    displayName: 'Mode de Mapping',
                    name: 'mappingMode',
                    type: 'options',
                    options: [
                        {
                            name: '📋 Standard (Schéma Fixe)',
                            value: 'standard',
                            description: 'Utilise le schéma de tags prédéfini. Rapide et gratuit.',
                        },
                        {
                            name: '🤖 IA (Mapping Dynamique)',
                            value: 'ai',
                            description: 'Le LLM connecté analyse et mappe les données intelligemment. Flexible mais nécessite un LLM.',
                        },
                        {
                            name: '🔄 Hybride (Standard + IA)',
                            value: 'hybrid',
                            description: 'Schéma standard en priorité, IA pour les tags non reconnus.',
                        },
                    ],
                    default: 'standard',
                    description: 'Comment mapper les données JSON aux tags du template',
                },
                // ==================== Notice LLM ====================
                {
                    displayName: 'Connectez un modèle LLM (OpenAI, Claude, Ollama, etc.) à l\'entrée "Model" pour activer le mode IA.',
                    name: 'aiNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: {
                        show: { mappingMode: ['ai', 'hybrid'] },
                    },
                },
                // ==================== Document Type ====================
                {
                    displayName: 'Type de Document',
                    name: 'documentType',
                    type: 'options',
                    options: [
                        { name: 'DC1 - Lettre de Candidature', value: 'dc1' },
                        { name: 'DC2 - Déclaration du Candidat', value: 'dc2' },
                        { name: 'AE - Acte d\'Engagement', value: 'ae' },
                        { name: 'ATTRI1 - Acte d\'Engagement', value: 'attri1' },
                        { name: 'Autre Document', value: 'autre' },
                    ],
                    default: 'dc1',
                    description: 'Type de document (utilisé pour le schéma standard et le contexte IA)',
                },
                // ==================== Context for AI ====================
                {
                    displayName: 'Contexte Document',
                    name: 'documentContext',
                    type: 'string',
                    typeOptions: {
                        rows: 2,
                    },
                    default: '',
                    displayOptions: {
                        show: { mappingMode: ['ai', 'hybrid'] },
                    },
                    placeholder: 'ex: Formulaire DC2 pour marché de services informatiques',
                    description: 'Description du document pour aider le LLM à comprendre le contexte',
                },
                // ==================== Binary Input ====================
                {
                    displayName: 'Document à Remplir',
                    name: 'binaryProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    description: 'Propriété binaire contenant le document DOCX avec tags {{TAG}}',
                },
                // ==================== Data Input ====================
                {
                    displayName: 'Données',
                    name: 'dataField',
                    type: 'string',
                    default: '',
                    description: 'Champ JSON contenant les données. Vide = utiliser tout le JSON.',
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
                            displayName: 'Style Checkboxes',
                            name: 'checkboxStyle',
                            type: 'options',
                            options: [
                                { name: 'Unicode (☑/☐)', value: 'unicode' },
                                { name: 'Texte (X / )', value: 'text' },
                                { name: 'Boolean (true/false)', value: 'boolean' },
                            ],
                            default: 'unicode',
                        },
                        {
                            displayName: 'Nom Fichier Sortie',
                            name: 'outputFilename',
                            type: 'string',
                            default: '',
                            placeholder: 'ex: {{$json.entreprise.nom}}_DC1.docx',
                            description: 'Nom du fichier de sortie. Supporte les expressions n8n.',
                        },
                        {
                            displayName: 'Conserver Tags Vides',
                            name: 'keepEmptyTags',
                            type: 'boolean',
                            default: false,
                            description: 'Ne pas supprimer les tags sans données correspondantes',
                        },
                        {
                            displayName: 'Inclure Détails Mapping',
                            name: 'includeMapping',
                            type: 'boolean',
                            default: false,
                            description: 'Inclure les détails du mapping IA dans la sortie JSON (debug)',
                        },
                    ],
                },
            ],
        };
    }
    async execute() {
        var _a;
        const items = this.getInputData();
        const returnData = [];
        // Récupérer le LLM si connecté
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let llm = null;
        try {
            llm = await this.getInputConnectionData('ai_languageModel', 0);
        }
        catch {
            // Pas de LLM connecté, ce n'est pas forcément une erreur
        }
        for (let i = 0; i < items.length; i++) {
            try {
                // ============================================================
                // Récupérer les paramètres
                // ============================================================
                const mappingMode = this.getNodeParameter('mappingMode', i);
                const documentType = this.getNodeParameter('documentType', i);
                const binaryProperty = this.getNodeParameter('binaryProperty', i);
                const dataField = this.getNodeParameter('dataField', i);
                const options = this.getNodeParameter('options', i);
                const checkboxStyle = options.checkboxStyle || 'unicode';
                const keepEmptyTags = options.keepEmptyTags || false;
                const includeMapping = options.includeMapping || false;
                // Vérifier que le LLM est connecté si mode IA
                if ((mappingMode === 'ai' || mappingMode === 'hybrid') && !llm) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Mode IA sélectionné mais aucun modèle LLM connecté. Connectez un modèle (OpenAI, Claude, Ollama...) à l\'entrée "Model".', { itemIndex: i });
                }
                // ============================================================
                // Charger le document binaire
                // ============================================================
                const binaryData = items[i].binary;
                if (!binaryData || !binaryData[binaryProperty]) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Aucun document trouvé dans "${binaryProperty}"`, { itemIndex: i });
                }
                const documentBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
                const originalFilename = binaryData[binaryProperty].fileName || 'document.docx';
                // ============================================================
                // Charger les données JSON
                // ============================================================
                let rawData;
                if (dataField && dataField.trim() !== '') {
                    rawData = items[i].json[dataField];
                    if (!rawData) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Aucune donnée trouvée dans "${dataField}"`, { itemIndex: i });
                    }
                }
                else {
                    rawData = items[i].json;
                }
                // ============================================================
                // Ouvrir le document et extraire les tags
                // ============================================================
                const zip = new pizzip_1.default(documentBuffer);
                let xml = ((_a = zip.file('word/document.xml')) === null || _a === void 0 ? void 0 : _a.asText()) || '';
                if (!xml || xml.length < 100) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Document DOCX invalide ou vide', { itemIndex: i });
                }
                const documentTags = extractTagsFromXml(xml);
                // ============================================================
                // Préparer les données selon le mode
                // ============================================================
                let templateData = {};
                let aiMappingResult = null;
                let llmUsed = false;
                if (mappingMode === 'standard') {
                    // Mode standard: schéma fixe uniquement
                    templateData = prepareStandardData(rawData, documentType);
                }
                else if (mappingMode === 'ai') {
                    // Mode IA: tout via le LLM
                    const flatData = flattenJson(rawData);
                    const documentContext = this.getNodeParameter('documentContext', i);
                    const prompt = buildMappingPrompt(documentTags, flatData, documentContext || `Document ${documentType.toUpperCase()} - Marché public français`);
                    const response = await llm.invoke(prompt);
                    aiMappingResult = parseLLMResponse(response);
                    templateData = aiMappingToTemplateData(aiMappingResult);
                    llmUsed = true;
                }
                else if (mappingMode === 'hybrid') {
                    // Mode hybride: standard d'abord, puis IA pour le reste
                    templateData = prepareStandardData(rawData, documentType);
                    // Trouver les tags non mappés par le schéma standard
                    const unmappedTags = documentTags.filter(t => !templateData[t] || templateData[t] === '');
                    if (unmappedTags.length > 0 && llm) {
                        const flatData = flattenJson(rawData);
                        const documentContext = this.getNodeParameter('documentContext', i);
                        const prompt = buildMappingPrompt(unmappedTags, flatData, documentContext || `Document ${documentType.toUpperCase()} - Tags supplémentaires`);
                        const response = await llm.invoke(prompt);
                        aiMappingResult = parseLLMResponse(response);
                        const aiData = aiMappingToTemplateData(aiMappingResult);
                        // Fusionner: standard a priorité
                        templateData = { ...aiData, ...templateData };
                        llmUsed = true;
                    }
                }
                // Ajuster le style des checkboxes
                templateData = adjustCheckboxStyle(templateData, checkboxStyle);
                // ============================================================
                // Remplir le document
                // ============================================================
                const { xml: filledXml, replaced, remaining } = replaceTagsInXml(xml, templateData, keepEmptyTags);
                zip.file('word/document.xml', filledXml);
                const outputBuffer = zip.generate({
                    type: 'nodebuffer',
                    compression: 'DEFLATE',
                });
                // ============================================================
                // Préparer la sortie
                // ============================================================
                const entreprise = rawData.entreprise;
                const companyName = (entreprise === null || entreprise === void 0 ? void 0 : entreprise.nom_commercial)
                    ? String(entreprise.nom_commercial).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
                    : 'document';
                const date = new Date().toISOString().split('T')[0];
                const finalFilename = options.outputFilename || `${companyName}_${documentType.toUpperCase()}_${date}.docx`;
                const binaryOutput = await this.helpers.prepareBinaryData(outputBuffer, finalFilename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                // Construire le JSON de sortie
                const jsonOutput = {
                    success: true,
                    mappingMode,
                    llmUsed,
                    documentType,
                    filename: finalFilename,
                    originalFilename,
                    tagsInDocument: documentTags.length,
                    tagsReplaced: replaced.length,
                    tagsRemaining: remaining.length,
                    replacedTags: replaced,
                    remainingTags: remaining,
                    companyName: (entreprise === null || entreprise === void 0 ? void 0 : entreprise.nom_commercial) || '',
                    aiMapping: includeMapping && aiMappingResult ? aiMappingResult : undefined,
                };
                returnData.push({
                    json: jsonOutput,
                    binary: { data: binaryOutput },
                });
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
