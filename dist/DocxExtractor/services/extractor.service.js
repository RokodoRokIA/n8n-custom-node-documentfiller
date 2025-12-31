"use strict";
/**
 * ============================================================================
 * EXTRACTOR SERVICE - Orchestrateur d'extraction DOCX vers JSON
 * ============================================================================
 *
 * Ce service coordonne l'extraction complète du contenu d'un document DOCX
 * vers une structure JSON structurée.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Ce service orchestre les autres services (structure-parser, table-extractor)
 * - Il charge le DOCX, extrait les métadonnées et le contenu
 * - Le résultat est un JSON structuré avec sections, tableaux et stats
 *
 * @author Rokodo
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDocxContent = extractDocxContent;
exports.validateExtractionOptions = validateExtractionOptions;
const docx_utils_1 = require("../../shared/utils/docx.utils");
const structure_parser_service_1 = require("./structure-parser.service");
const table_extractor_service_1 = require("./table-extractor.service");
// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================
/**
 * Extrait le contenu structuré d'un document DOCX.
 *
 * @param docxBuffer - Buffer contenant le fichier DOCX
 * @param options - Options d'extraction
 * @returns Résultat de l'extraction avec le document structuré
 *
 * @example
 * const result = await extractDocxContent(buffer, {
 *   preserveHierarchy: true,
 *   tableFormat: 'objects',
 *   includeMetadata: true
 * });
 * if (result.success) {
 *   console.log(result.document.content.sections);
 * }
 */
async function extractDocxContent(docxBuffer, options = {}) {
    var _a, _b, _c, _d, _e;
    const startTime = Date.now();
    const warnings = [];
    // Options par défaut
    const opts = {
        includeMetadata: (_a = options.includeMetadata) !== null && _a !== void 0 ? _a : true,
        includeSections: (_b = options.includeSections) !== null && _b !== void 0 ? _b : true,
        includeStyles: (_c = options.includeStyles) !== null && _c !== void 0 ? _c : false,
        tableFormat: (_d = options.tableFormat) !== null && _d !== void 0 ? _d : 'objects',
        preserveHierarchy: (_e = options.preserveHierarchy) !== null && _e !== void 0 ? _e : true,
    };
    try {
        // 1. Charger le DOCX
        const { zip, xml } = (0, docx_utils_1.loadDocxContent)(docxBuffer);
        // 2. Extraire les métadonnées
        let metadata;
        if (opts.includeMetadata) {
            metadata = extractMetadata(zip, xml);
        }
        else {
            metadata = {
                wordCount: 0,
                paragraphCount: 0,
            };
        }
        // 3. Parser la structure du document
        const content = (0, structure_parser_service_1.parseDocumentStructure)(xml, opts.preserveHierarchy, opts.includeStyles);
        // 4. Extraire les tableaux
        const tables = (0, table_extractor_service_1.extractTables)(xml, opts.tableFormat, opts.includeStyles);
        // 5. Ajouter les références aux tableaux dans le contenu
        if (opts.preserveHierarchy && content.sections) {
            addTableReferences(content.sections, tables.length);
        }
        // 6. Calculer les statistiques
        const stats = calculateStats(content, tables, startTime);
        // 7. Construire le document extrait
        const document = {
            metadata,
            content,
            tables,
            stats,
        };
        return {
            success: true,
            document,
            warnings,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error.message,
            warnings,
        };
    }
}
// ============================================================================
// EXTRACTION DES MÉTADONNÉES
// ============================================================================
/**
 * Extrait les métadonnées du document.
 */
function extractMetadata(zip, xml) {
    var _a, _b, _c;
    const metadata = {
        wordCount: 0,
        paragraphCount: 0,
    };
    // Extraire depuis docProps/core.xml
    try {
        const coreXml = (_a = zip.file('docProps/core.xml')) === null || _a === void 0 ? void 0 : _a.asText();
        if (coreXml) {
            // Titre
            const titleMatch = coreXml.match(/<dc:title>([^<]*)<\/dc:title>/);
            if (titleMatch && titleMatch[1]) {
                metadata.title = titleMatch[1];
            }
            // Auteur
            const creatorMatch = coreXml.match(/<dc:creator>([^<]*)<\/dc:creator>/);
            if (creatorMatch && creatorMatch[1]) {
                metadata.author = creatorMatch[1];
            }
            // Date de création
            const createdMatch = coreXml.match(/<dcterms:created[^>]*>([^<]*)<\/dcterms:created>/);
            if (createdMatch && createdMatch[1]) {
                metadata.created = createdMatch[1];
            }
            // Date de modification
            const modifiedMatch = coreXml.match(/<dcterms:modified[^>]*>([^<]*)<\/dcterms:modified>/);
            if (modifiedMatch && modifiedMatch[1]) {
                metadata.modified = modifiedMatch[1];
            }
        }
    }
    catch (e) {
        // Ignorer les erreurs de métadonnées core.xml
    }
    // Extraire depuis docProps/app.xml (statistiques Word)
    try {
        const appXml = (_b = zip.file('docProps/app.xml')) === null || _b === void 0 ? void 0 : _b.asText();
        if (appXml) {
            // Nombre de mots (si disponible)
            const wordsMatch = appXml.match(/<Words>(\d+)<\/Words>/);
            if (wordsMatch) {
                metadata.wordCount = parseInt(wordsMatch[1], 10);
            }
            // Nombre de paragraphes
            const paragraphsMatch = appXml.match(/<Paragraphs>(\d+)<\/Paragraphs>/);
            if (paragraphsMatch) {
                metadata.paragraphCount = parseInt(paragraphsMatch[1], 10);
            }
            // Nombre de caractères
            const charactersMatch = appXml.match(/<Characters>(\d+)<\/Characters>/);
            if (charactersMatch) {
                metadata.characterCount = parseInt(charactersMatch[1], 10);
            }
        }
    }
    catch (e) {
        // Ignorer les erreurs app.xml
    }
    // Si les stats Word ne sont pas disponibles, calculer manuellement
    if (metadata.wordCount === 0) {
        const allText = (0, structure_parser_service_1.extractAllText)(xml);
        metadata.wordCount = (0, structure_parser_service_1.countWords)(allText);
        metadata.characterCount = (0, structure_parser_service_1.countCharacters)(allText);
    }
    // Compter les paragraphes si non disponible
    if (metadata.paragraphCount === 0) {
        const paragraphMatches = xml.match(/<w:p\b/g);
        metadata.paragraphCount = (_c = paragraphMatches === null || paragraphMatches === void 0 ? void 0 : paragraphMatches.length) !== null && _c !== void 0 ? _c : 0;
    }
    return metadata;
}
// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================
/**
 * Ajoute les références aux tableaux dans les sections.
 * Note: Cette fonction est simplifiée - en réalité il faudrait
 * détecter la position exacte des tableaux dans le document.
 */
function addTableReferences(sections, tableCount) {
    // Pour l'instant, on n'ajoute pas de références automatiques
    // car la détection de position est complexe.
    // Les tableaux sont disponibles dans le champ `tables` du document.
}
/**
 * Calcule les statistiques d'extraction.
 */
function calculateStats(content, tables, startTime) {
    var _a, _b;
    let sectionsFound = 0;
    let headingsFound = 0;
    let listsFound = 0;
    let totalElements = 0;
    if (content.sections) {
        sectionsFound = content.sections.length;
        for (const section of content.sections) {
            totalElements++; // La section elle-même
            for (const item of section.content || []) {
                totalElements++;
                if (item.type === 'heading') {
                    headingsFound++;
                }
                else if (item.type === 'list') {
                    listsFound++;
                    totalElements += (_b = (_a = item.items) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
                }
            }
            // Compter les sous-sections récursivement
            if (section.subsections) {
                for (const sub of section.subsections) {
                    sectionsFound++;
                    totalElements++;
                }
            }
        }
    }
    else if (content.paragraphs) {
        totalElements = content.paragraphs.length;
        for (const para of content.paragraphs) {
            if (para.type === 'heading') {
                headingsFound++;
            }
            else if (para.type === 'listItem') {
                // Compter les listes distinctes est plus complexe
            }
        }
    }
    return {
        sectionsFound,
        headingsFound,
        listsFound,
        tablesFound: tables.length,
        totalElements,
        processingTimeMs: Date.now() - startTime,
    };
}
/**
 * Valide les options d'extraction.
 */
function validateExtractionOptions(options) {
    const errors = [];
    if (options.tableFormat && !['array', 'objects'].includes(options.tableFormat)) {
        errors.push('tableFormat doit être "array" ou "objects"');
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
