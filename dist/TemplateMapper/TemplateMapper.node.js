"use strict";
/**
 * TemplateMapper - Création intelligente de templates via IA
 *
 * NOUVELLE APPROCHE:
 * 1. L'utilisateur fournit un document vierge (formulaire à remplir)
 * 2. L'utilisateur fournit une structure JSON décrivant les champs de données
 * 3. L'IA analyse le document et déduit où placer chaque tag {{TAG}}
 * 4. Le document avec tags est prêt pour DocxTemplateFiller
 *
 * Workflow:
 * TemplateMapper (crée le template) → DocxTemplateFiller (remplit avec données)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateMapper = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const pizzip_1 = __importDefault(require("pizzip"));
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Extrait les paragraphes d'un document XML OOXML
 * Gère correctement les structures imbriquées (tableaux, etc.)
 */
function extractParagraphs(xml) {
    const paragraphs = [];
    let searchPos = 0;
    let paragraphIndex = 0;
    while (searchPos < xml.length) {
        let pStart = xml.indexOf('<w:p ', searchPos);
        let pStartNoAttr = xml.indexOf('<w:p>', searchPos);
        if (pStart === -1)
            pStart = Infinity;
        if (pStartNoAttr === -1)
            pStartNoAttr = Infinity;
        const actualStart = Math.min(pStart, pStartNoAttr);
        if (actualStart === Infinity)
            break;
        const tagEnd = xml.indexOf('>', actualStart);
        if (tagEnd === -1)
            break;
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
            let nextOpenPos = Math.min(nextOpen === -1 ? Infinity : nextOpen, nextOpenNoAttr === -1 ? Infinity : nextOpenNoAttr);
            if (nextClose === -1)
                break;
            if (nextOpenPos < nextClose) {
                const openTagEnd = xml.indexOf('>', nextOpenPos);
                if (openTagEnd !== -1 && xml[openTagEnd - 1] === '/') {
                    pos = openTagEnd + 1;
                }
                else {
                    depth++;
                    pos = openTagEnd !== -1 ? openTagEnd + 1 : nextOpenPos + 5;
                }
            }
            else {
                depth--;
                if (depth === 0) {
                    const pEnd = nextClose + 6;
                    const pXml = xml.substring(actualStart, pEnd);
                    const textParts = [];
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
                }
                else {
                    pos = nextClose + 6;
                }
            }
        }
        if (depth > 0) {
            searchPos = actualStart + 5;
        }
        paragraphIndex++;
        if (paragraphIndex > 5000)
            break;
    }
    return paragraphs;
}
/**
 * Aplatit un objet JSON pour extraire toutes les clés (champs)
 */
function flattenJsonKeys(obj, prefix = '') {
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            keys.push(...flattenJsonKeys(value, path));
        }
        else {
            keys.push(key); // On garde juste le nom du champ, pas le chemin complet
        }
    }
    return [...new Set(keys)]; // Dédupliquer
}
/**
 * Construit le prompt pour l'IA - NOUVELLE APPROCHE
 * L'IA déduit où placer les tags basé sur la sémantique des clés JSON
 */
function buildDeductionPrompt(fields, paragraphs, documentType) {
    const fieldsInfo = fields.map((f) => `- {{${f.toUpperCase()}}}`).join('\n');
    const paragraphsInfo = paragraphs
        .filter((p) => p.text.length > 5)
        .slice(0, 150)
        .map((p) => `[${p.index}] "${p.text.substring(0, 200)}"`)
        .join('\n');
    return `Tu es un expert en analyse de documents administratifs français (DC1, DC2, AE, ATTRI1, formulaires CERFA).

MISSION: Analyser un document vierge et identifier où placer des tags pour le pré-remplissage automatique.

TYPE DE DOCUMENT: ${documentType}

CHAMPS À PLACER (basés sur la structure de données fournie):
${fieldsInfo}

PARAGRAPHES DU DOCUMENT (index + texte):
${paragraphsInfo}

INSTRUCTIONS:
1. Pour chaque champ, trouve le paragraphe où la VALEUR correspondante doit être insérée
2. Utilise la sémantique des noms de champs pour déduire les correspondances:
   - "nom_commercial" → paragraphe contenant "Dénomination", "Nom commercial", "Raison sociale"
   - "siret" → paragraphe contenant "SIRET", "N° SIRET", "Numéro SIRET"
   - "adresse" → paragraphe contenant "Adresse", "Siège", "Établissement"
   - "email" → paragraphe contenant "Mail", "Courriel", "Électronique"
   - "telephone" → paragraphe contenant "Téléphone", "Tél", "N°"
   - etc.
3. Si le paragraphe contient "...", "[...]", ou un espace à remplir, utilise "replaceText"
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
- Le "tag" doit être le nom du champ en MAJUSCULES avec underscores
- La "confidence" est un score de 0 à 100`;
}
/**
 * Parse la réponse LLM
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
                responseText = resp.content
                    .map((c) => c.text || '')
                    .join('');
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
function insertTagsInXml(xml, mappings) {
    let result = xml;
    const results = [];
    const paragraphs = extractParagraphs(xml);
    // Trier par index décroissant pour éviter les décalages
    const sortedMappings = [...mappings].sort((a, b) => b.paragraphIndex - a.paragraphIndex);
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
            newParagraph = newParagraph.replace(mapping.replaceText, `{{${mapping.tag}}}`);
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
        // Stratégie 3: Ajouter à la fin du paragraphe
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
            reason: inserted ? 'OK' : 'Position non trouvée',
        });
    }
    return { xml: result, results };
}
// ============================================================================
// Main Node Class
// ============================================================================
class TemplateMapper {
    constructor() {
        this.description = {
            displayName: 'Template Mapper',
            name: 'templateMapper',
            icon: 'file:docx.svg',
            group: ['transform'],
            version: 2,
            subtitle: '🤖 IA déduit les emplacements des tags',
            description: 'Analyse un document vierge et une structure JSON, puis utilise l\'IA pour déduire où placer les tags {{TAG}} basé sur la sémantique des champs.',
            defaults: {
                name: 'Template Mapper',
            },
            inputs: [
                { displayName: '', type: 'main' },
                {
                    displayName: 'Model',
                    maxConnections: 1,
                    type: 'ai_languageModel',
                    required: true,
                },
            ],
            outputs: [{ displayName: '', type: 'main' }],
            properties: [
                // ==================== Document à analyser ====================
                {
                    displayName: 'Document à Analyser',
                    name: 'documentProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    description: 'Propriété binaire contenant le document vierge (formulaire à pré-remplir)',
                },
                // ==================== Structure JSON ====================
                {
                    displayName: 'Structure de Données',
                    name: 'dataStructure',
                    type: 'json',
                    default: `{
  "entreprise": {
    "nom_commercial": "",
    "siret": "",
    "adresse": "",
    "email": "",
    "telephone": ""
  },
  "signataire": {
    "nom": "",
    "prenom": "",
    "qualite": ""
  }
}`,
                    required: true,
                    description: 'Structure JSON décrivant les champs de données. L\'IA utilisera les noms des clés pour déduire où placer les tags.',
                },
                // ==================== Type de document ====================
                {
                    displayName: 'Type de Document',
                    name: 'documentType',
                    type: 'options',
                    options: [
                        { name: 'DC1 - Lettre de Candidature', value: 'DC1' },
                        { name: 'DC2 - Déclaration du Candidat', value: 'DC2' },
                        { name: 'AE - Acte d\'Engagement', value: 'AE' },
                        { name: 'ATTRI1 - Attribution', value: 'ATTRI1' },
                        { name: 'CERFA', value: 'CERFA' },
                        { name: 'Autre Document', value: 'autre' },
                    ],
                    default: 'DC1',
                    description: 'Type de document pour aider l\'IA',
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
                            description: 'Seuil minimum de confiance pour insérer un tag (0-100)',
                        },
                        {
                            displayName: 'Nom Fichier Sortie',
                            name: 'outputFilename',
                            type: 'string',
                            default: '',
                            description: 'Nom du fichier de sortie. Vide = basé sur le document source.',
                        },
                        {
                            displayName: 'Inclure Détails',
                            name: 'includeDetails',
                            type: 'boolean',
                            default: false,
                            description: 'Inclure les détails du mapping dans la sortie JSON',
                        },
                    ],
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c;
        const items = this.getInputData();
        const returnData = [];
        // Récupérer le LLM
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let llm = null;
        try {
            llm = await this.getInputConnectionData('ai_languageModel', 0);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Un modèle LLM est requis. Connectez un modèle (OpenAI, Claude, Ollama...) à l\'entrée "Model".');
        }
        if (!llm) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Un modèle LLM est requis. Connectez un modèle (OpenAI, Claude, Ollama...) à l\'entrée "Model".');
        }
        for (let i = 0; i < items.length; i++) {
            try {
                // ============================================================
                // Récupérer les paramètres
                // ============================================================
                const documentProperty = this.getNodeParameter('documentProperty', i);
                const dataStructureRaw = this.getNodeParameter('dataStructure', i);
                const documentType = this.getNodeParameter('documentType', i);
                const options = this.getNodeParameter('options', i);
                const confidenceThreshold = (_a = options.confidenceThreshold) !== null && _a !== void 0 ? _a : 70;
                const includeDetails = (_b = options.includeDetails) !== null && _b !== void 0 ? _b : false;
                // Parser la structure JSON
                let dataStructure;
                if (typeof dataStructureRaw === 'string') {
                    try {
                        dataStructure = JSON.parse(dataStructureRaw);
                    }
                    catch {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Structure de données JSON invalide', { itemIndex: i });
                    }
                }
                else {
                    dataStructure = dataStructureRaw;
                }
                // ============================================================
                // Charger le document
                // ============================================================
                const binaryData = items[i].binary;
                if (!binaryData || !binaryData[documentProperty]) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Aucun document trouvé dans "${documentProperty}"`, { itemIndex: i });
                }
                const documentBuffer = await this.helpers.getBinaryDataBuffer(i, documentProperty);
                const documentFilename = binaryData[documentProperty].fileName || 'document.docx';
                const documentZip = new pizzip_1.default(documentBuffer);
                const documentXml = ((_c = documentZip.file('word/document.xml')) === null || _c === void 0 ? void 0 : _c.asText()) || '';
                if (!documentXml || documentXml.length < 100) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Document invalide ou vide', { itemIndex: i });
                }
                // ============================================================
                // Extraire les champs de la structure JSON
                // ============================================================
                const fields = flattenJsonKeys(dataStructure);
                if (fields.length === 0) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Aucun champ trouvé dans la structure de données', { itemIndex: i });
                }
                // ============================================================
                // Extraire les paragraphes du document
                // ============================================================
                const paragraphs = extractParagraphs(documentXml);
                // ============================================================
                // Appeler l'IA pour déduire les emplacements
                // ============================================================
                const prompt = buildDeductionPrompt(fields, paragraphs, documentType);
                const response = await llm.invoke(prompt);
                const aiMappings = parseLLMResponse(response);
                // Filtrer par seuil de confiance
                const filteredMappings = aiMappings.filter((m) => m.confidence >= confidenceThreshold);
                // ============================================================
                // Insérer les tags dans le document
                // ============================================================
                const { xml: mappedXml, results } = insertTagsInXml(documentXml, filteredMappings);
                // Mettre à jour le document
                documentZip.file('word/document.xml', mappedXml);
                const outputBuffer = documentZip.generate({
                    type: 'nodebuffer',
                    compression: 'DEFLATE',
                });
                // ============================================================
                // Préparer la sortie
                // ============================================================
                const insertedCount = results.filter((r) => r.inserted).length;
                const finalFilename = options.outputFilename ||
                    documentFilename.replace('.docx', '_TEMPLATE.docx');
                const binaryOutput = await this.helpers.prepareBinaryData(outputBuffer, finalFilename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                const jsonOutput = {
                    success: true,
                    documentType,
                    sourceFilename: documentFilename,
                    outputFilename: finalFilename,
                    fieldsInSchema: fields.length,
                    tagsInserted: insertedCount,
                    tagsFailed: fields.length - insertedCount,
                    insertedTags: results.filter((r) => r.inserted).map((r) => r.tag),
                    failedTags: results.filter((r) => !r.inserted).map((r) => r.tag),
                    mappingDetails: includeDetails ? results : undefined,
                    aiMappings: includeDetails ? aiMappings : undefined,
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
exports.TemplateMapper = TemplateMapper;
