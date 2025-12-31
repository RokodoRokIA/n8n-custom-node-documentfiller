"use strict";
/**
 * ============================================================================
 * UTILITAIRES DOCX - Opérations de haut niveau sur les documents Word
 * ============================================================================
 *
 * Ce module contient les fonctions utilitaires de haut niveau pour travailler
 * avec les documents DOCX. Il s'appuie sur xml.utils et text.utils.
 *
 * @author Rokodo
 * @version 2.0.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDocxContent = loadDocxContent;
exports.saveDocxContent = saveDocxContent;
exports.validateDocxXml = validateDocxXml;
exports.repairDocxXml = repairDocxXml;
exports.detectDocumentType = detectDocumentType;
exports.extractTagContextsFromTemplate = extractTagContextsFromTemplate;
exports.extractTagsFromTemplateXml = extractTagsFromTemplateXml;
exports.generateDataStructureFromTags = generateDataStructureFromTags;
exports.extractTargetParagraphs = extractTargetParagraphs;
exports.extractTableCells = extractTableCells;
exports.enrichParagraphsWithTableInfo = enrichParagraphsWithTableInfo;
const pizzip_1 = __importDefault(require("pizzip"));
const xml_utils_1 = require("./xml.utils");
const text_utils_1 = require("./text.utils");
// ============================================================================
// CHARGEMENT DE DOCUMENTS
// ============================================================================
/**
 * Charge un document DOCX et extrait son contenu XML principal.
 *
 * @param buffer - Le buffer du fichier DOCX
 * @returns Un objet contenant le zip et le XML du document
 * @throws Error si le fichier n'est pas un DOCX valide
 *
 * @example
 * const { zip, xml } = loadDocxContent(buffer);
 * // xml contient le contenu de word/document.xml
 */
function loadDocxContent(buffer) {
    const zip = new pizzip_1.default(buffer);
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) {
        throw new Error('Le fichier DOCX ne contient pas de document.xml. ' +
            'Vérifiez que le fichier est un document Word valide.');
    }
    let xml = documentFile.asText();
    // Reconstruire le texte fragmenté pour faciliter la détection des tags
    xml = (0, xml_utils_1.reconstructFragmentedText)(xml);
    return { zip, xml };
}
/**
 * Sauvegarde le XML modifié dans le document DOCX.
 *
 * @param zip - L'archive ZIP du document
 * @param xml - Le nouveau contenu XML
 * @returns Le buffer du document modifié
 */
function saveDocxContent(zip, xml) {
    zip.file('word/document.xml', xml);
    return zip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
    });
}
/**
 * Valide que le XML DOCX est structurellement correct.
 *
 * VERSION v4.2 SIMPLIFIÉE:
 * - Ne vérifie que les erreurs VRAIMENT critiques
 * - Évite les faux positifs qui empêchaient le fonctionnement
 *
 * Erreurs critiques:
 * 1. Balises w:document ou w:body non fermées
 * 2. Caractères de contrôle invalides
 *
 * @param xml - Le XML à valider
 * @returns Résultat de la validation avec erreurs détaillées
 */
function validateDocxXml(xml) {
    const errors = [];
    const warnings = [];
    // 1. Vérifier les caractères invalides (CRITIQUE)
    const invalidCharPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
    const invalidChars = xml.match(invalidCharPattern);
    if (invalidChars) {
        errors.push({
            type: 'encoding_error',
            message: `${invalidChars.length} caractère(s) de contrôle invalide(s) trouvé(s)`,
            severity: 'critical',
        });
    }
    // 2. Vérifier UNIQUEMENT les balises XML vraiment critiques
    // (w:document et w:body doivent être présentes et fermées)
    const criticalTags = ['w:document', 'w:body'];
    for (const tag of criticalTags) {
        const hasOpen = xml.includes(`<${tag}`);
        const hasClose = xml.includes(`</${tag}>`);
        if (hasOpen && !hasClose) {
            errors.push({
                type: 'unclosed_tag',
                message: `Balise <${tag}> ouverte mais non fermée`,
                tag,
                severity: 'critical',
            });
        }
    }
    // 3. Les autres vérifications sont maintenant des WARNINGS seulement
    // (ne bloquent pas le document)
    // Vérifier les tags {{TAG}} mal formés (warning seulement)
    const malformedTags = xml.match(/\{\{[^}]*$/gm) || [];
    if (malformedTags.length > 0) {
        warnings.push(`${malformedTags.length} tag(s) {{TAG}} potentiellement mal formé(s)`);
    }
    return {
        isValid: errors.filter(e => e.severity === 'critical').length === 0,
        errors,
        warnings,
    };
}
/**
 * Valide la structure des tableaux (non utilisée actuellement - trop de faux positifs).
 */
function _validateTableStructure(xml) {
    const errors = [];
    const warnings = [];
    // Extraire chaque tableau
    const tableMatches = xml.matchAll(/<w:tbl[\s\S]*?<\/w:tbl>/g);
    let tableIndex = 0;
    for (const tableMatch of tableMatches) {
        const tableXml = tableMatch[0];
        // Vérifier que chaque ligne a des cellules
        const rows = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            const cells = row.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
            if (cells.length === 0) {
                warnings.push(`Tableau ${tableIndex}, ligne ${rowIndex}: aucune cellule trouvée`);
            }
            // Vérifier que chaque cellule contient une structure valide
            for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
                const cell = cells[cellIndex];
                // Une cellule doit contenir au moins un paragraphe ou être vide avec tcPr
                const hasParagraph = /<w:p[\s>]/.test(cell);
                const hasTcPr = /<w:tcPr>/.test(cell);
                if (!hasParagraph && !hasTcPr) {
                    errors.push({
                        type: 'invalid_structure',
                        message: `Tableau ${tableIndex}, ligne ${rowIndex}, cellule ${cellIndex}: structure invalide (pas de paragraphe)`,
                        severity: 'warning',
                    });
                }
            }
        }
        tableIndex++;
    }
    return { errors, warnings };
}
/**
 * Tente de réparer un XML DOCX corrompu.
 *
 * Cette fonction essaie de corriger les problèmes courants:
 * 1. Fermer les balises non fermées
 * 2. Supprimer les caractères invalides
 * 3. Corriger les tags {{TAG}} mal formés
 *
 * @param xml - Le XML à réparer
 * @param originalXml - Le XML original (pour rollback si nécessaire)
 * @returns Le XML réparé ou l'original si la réparation échoue
 */
function repairDocxXml(xml, originalXml) {
    const repairs = [];
    let repairedXml = xml;
    // 1. Supprimer les caractères de contrôle invalides
    const cleanedXml = repairedXml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    if (cleanedXml !== repairedXml) {
        repairs.push('Suppression des caractères de contrôle invalides');
        repairedXml = cleanedXml;
    }
    // 2. Corriger les tags {{TAG}} mal formés
    // Exemple: {{TAG devient {{TAG}}
    repairedXml = repairedXml.replace(/\{\{([A-Z_0-9]+)(?!\}\})/g, '{{$1}}');
    if (repairedXml !== cleanedXml) {
        repairs.push('Correction des tags {{TAG}} mal formés');
    }
    // 3. Vérifier si les réparations ont fonctionné
    const validation = validateDocxXml(repairedXml);
    if (!validation.isValid) {
        // Si toujours invalide, essayer une réparation plus agressive
        const criticalErrors = validation.errors.filter(e => e.severity === 'critical');
        // Si on a des balises non fermées, essayer de les fermer
        for (const error of criticalErrors) {
            if (error.type === 'unclosed_tag' && error.tag) {
                // Ajouter la balise fermante à la fin appropriée
                const fixedXml = tryToFixUnclosedTag(repairedXml, error.tag);
                if (fixedXml !== repairedXml) {
                    repairs.push(`Tentative de fermeture de <${error.tag}>`);
                    repairedXml = fixedXml;
                }
            }
        }
    }
    // 4. Validation finale
    const finalValidation = validateDocxXml(repairedXml);
    if (!finalValidation.isValid) {
        // Si toujours invalide après réparations, revenir à l'original
        console.warn('⚠️ Impossible de réparer le XML, retour à l\'original');
        return {
            xml: originalXml,
            repaired: false,
            repairs: ['ÉCHEC - Retour au document original'],
        };
    }
    return {
        xml: repairedXml,
        repaired: repairs.length > 0,
        repairs,
    };
}
/**
 * Tente de fermer une balise non fermée.
 */
function tryToFixUnclosedTag(xml, tag) {
    const openPattern = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g');
    const closePattern = new RegExp(`</${tag}>`, 'g');
    const openCount = (xml.match(openPattern) || []).length;
    const closeCount = (xml.match(closePattern) || []).length;
    if (openCount > closeCount) {
        // Il manque des balises fermantes
        // Trouver la dernière occurrence de la balise ouvrante
        let lastOpenIndex = -1;
        let match;
        const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g');
        while ((match = regex.exec(xml)) !== null) {
            lastOpenIndex = match.index;
        }
        if (lastOpenIndex !== -1) {
            // Chercher la fin du contenu de cette balise
            // Pour les balises Word, on cherche généralement avant </w:p> ou </w:tc>
            const afterOpen = xml.substring(lastOpenIndex);
            // Déterminer où insérer la balise fermante
            let insertPosition = xml.length;
            if (tag === 'w:r') {
                // Pour les runs, fermer avant </w:p> ou la prochaine ouverture de <w:r>
                const pClose = afterOpen.indexOf('</w:p>');
                const nextR = afterOpen.indexOf('<w:r', 10); // Après la balise actuelle
                insertPosition = lastOpenIndex + Math.min(pClose !== -1 ? pClose : Infinity, nextR !== -1 ? nextR : Infinity);
            }
            else if (tag === 'w:t') {
                // Pour les textes, fermer avant </w:r>
                const rClose = afterOpen.indexOf('</w:r>');
                if (rClose !== -1) {
                    insertPosition = lastOpenIndex + rClose;
                }
            }
            // Insérer la balise fermante
            return xml.substring(0, insertPosition) + `</${tag}>` + xml.substring(insertPosition);
        }
    }
    return xml;
}
// ============================================================================
// DÉTECTION DU TYPE DE DOCUMENT
// ============================================================================
/**
 * Détecte automatiquement le type de document administratif.
 *
 * Cette fonction analyse le contenu et le nom du fichier pour déterminer
 * s'il s'agit d'un DC1, DC2, AE ou autre type de document.
 *
 * CRITÈRES DE DÉTECTION :
 * - Nom du fichier (DC1, DC2, AE)
 * - Présence de phrases clés ("Lettre de candidature" pour DC1, etc.)
 * - Mots-clés spécifiques à chaque type
 *
 * @param xml - Le contenu XML du document
 * @param filename - Le nom du fichier (optionnel)
 * @returns Le type détecté et le nom de l'acheteur si trouvé
 *
 * @example
 * const result = detectDocumentType(xml, 'DC1_entreprise.docx');
 * // { type: 'DC1', acheteur: 'Ville de Paris' }
 */
function detectDocumentType(xml, filename) {
    const textLower = xml.toLowerCase();
    const filenameLower = (filename || '').toLowerCase();
    let acheteur = '';
    // Essayer d'extraire le nom de l'acheteur
    const acheteurPatterns = [
        /désignation\s+(?:de\s+l[''])?acheteur\s*[:\s]+([A-Za-zÀ-ÿ\s]{5,50})/i,
        /pouvoir\s+adjudicateur\s*[:\s]+([A-Za-zÀ-ÿ\s]{5,50})/i,
        /acheteur\s*[:\s]+([A-Za-zÀ-ÿ\s]{5,50})/i,
    ];
    for (const pattern of acheteurPatterns) {
        const match = xml.match(pattern);
        if (match) {
            acheteur = match[1].trim();
            break;
        }
    }
    // Système de scoring pour déterminer le type
    const scores = { DC1: 0, DC2: 0, AE: 0, UNKNOWN: 0 };
    // Score basé sur le nom du fichier (priorité haute)
    if (filenameLower.includes('dc1') && !filenameLower.includes('dc2')) {
        scores.DC1 += 50;
    }
    if (filenameLower.includes('dc2') && !filenameLower.includes('dc1')) {
        scores.DC2 += 50;
    }
    if (filenameLower.includes('_ae') || filenameLower.includes('ae_') || filenameLower === 'ae.docx') {
        scores.AE += 50;
    }
    // Score basé sur le contenu pour DC1
    if (/lettre\s+de\s+candidature/i.test(textLower))
        scores.DC1 += 15;
    if (/dc\s*1\s*[-–]/i.test(textLower))
        scores.DC1 += 15;
    if (textLower.includes('habilitation du mandataire'))
        scores.DC1 += 10;
    // Score basé sur le contenu pour DC2
    if (/déclaration\s+du\s+candidat\s+individuel/i.test(textLower))
        scores.DC2 += 15;
    if (/dc\s*2\s*[-–]/i.test(textLower))
        scores.DC2 += 15;
    if (textLower.includes('capacité économique et financière'))
        scores.DC2 += 8;
    // Score basé sur le contenu pour AE
    if (/acte\s+d['']?\s*engagement/i.test(textLower))
        scores.AE += 15;
    if (textLower.includes('compte à créditer') || textLower.includes('compte bancaire')) {
        scores.AE += 10;
    }
    // Déterminer le type avec le meilleur score
    let detectedType = 'UNKNOWN';
    let maxScore = 0;
    for (const [docType, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            detectedType = docType;
        }
    }
    // Score minimum requis pour valider la détection
    if (maxScore < 5) {
        detectedType = 'UNKNOWN';
    }
    return { type: detectedType, acheteur };
}
// ============================================================================
// EXTRACTION DES TAGS DU TEMPLATE
// ============================================================================
/**
 * Extrait tous les tags d'un template avec leur contexte complet.
 *
 * Cette fonction analyse un document DOCX déjà taggué et extrait :
 * - Chaque tag avec son nom
 * - Le texte qui le précède (label)
 * - Le texte qui le suit
 * - La section du document
 * - Le type de tag (texte, checkbox, etc.)
 *
 * Utilisé pour le "Transfer Learning" : apprendre d'un template
 * pour taguer un document similaire.
 *
 * @param xml - Le XML du template
 * @returns Liste des tags avec leur contexte
 */
function extractTagContextsFromTemplate(xml) {
    const contexts = [];
    const paragraphs = (0, xml_utils_1.extractParagraphsFromXml)(xml);
    // Extraire les informations de cellules de tableau
    const tableCells = extractTableCellsForTemplate(xml);
    // Normaliser le texte de chaque paragraphe
    const normalizedParagraphs = paragraphs.map(p => ({
        ...p,
        text: (0, text_utils_1.normalizeText)(p.text),
    }));
    let currentSection = '';
    for (let i = 0; i < normalizedParagraphs.length; i++) {
        const paragraph = normalizedParagraphs[i];
        currentSection = (0, text_utils_1.detectSection)(paragraph.text, currentSection);
        // Trouver tous les tags dans ce paragraphe
        const tagMatches = paragraph.text.match(/\{\{[A-Z_0-9]+\}\}/g);
        if (!tagMatches)
            continue;
        for (const fullTag of tagMatches) {
            const tagName = fullTag.replace(/[{}]/g, '');
            const tagType = inferTagType(tagName);
            const labelBefore = extractLabelBefore(paragraph.text, fullTag, normalizedParagraphs, i);
            const labelAfter = extractLabelAfter(paragraph.text, fullTag);
            // Détecter si c'est une cellule de tableau
            const inTableCell = (0, xml_utils_1.isInsideTableCell)(xml, paragraph.xmlStart, paragraph.xml);
            const finalType = inTableCell && tagType === 'text' ? 'table_cell' : tagType;
            // Ajouter des indices sémantiques basés sur le nom du tag
            const semanticHints = getSemanticHintsForTag(tagName);
            // Chercher les infos de position dans le tableau pour ce tag
            const cellInfo = tableCells.find(c => c.tags.includes(tagName));
            // Enrichir le label avec la position de colonne si applicable
            let enrichedLabel = cleanLabel(labelBefore + ' ' + semanticHints);
            if (cellInfo && cellInfo.columnIndex > 0) {
                // Ajouter l'info de colonne (crucial pour tableaux multi-colonnes)
                enrichedLabel += ` [colonne ${cellInfo.columnIndex}]`;
                if (cellInfo.columnHeader) {
                    enrichedLabel += ` (${cellInfo.columnHeader})`;
                }
            }
            contexts.push({
                tag: tagName,
                fullTag,
                labelBefore: enrichedLabel,
                labelAfter: cleanLabel(labelAfter),
                section: currentSection,
                type: finalType,
                xmlContext: paragraph.xml.substring(0, 500),
                paragraphIndex: i,
                // Ajouter les infos de position tableau
                tableIndex: cellInfo === null || cellInfo === void 0 ? void 0 : cellInfo.tableIndex,
                rowIndex: cellInfo === null || cellInfo === void 0 ? void 0 : cellInfo.rowIndex,
                columnIndex: cellInfo === null || cellInfo === void 0 ? void 0 : cellInfo.columnIndex,
                rowHeader: cellInfo === null || cellInfo === void 0 ? void 0 : cellInfo.rowHeader,
                columnHeader: cellInfo === null || cellInfo === void 0 ? void 0 : cellInfo.columnHeader,
            });
        }
    }
    return contexts;
}
/**
 * Extrait les cellules de tableau avec leurs tags (version simplifiée pour le template).
 */
function extractTableCellsForTemplate(xml) {
    const result = [];
    const tableMatches = xml.matchAll(/<w:tbl[\s\S]*?<\/w:tbl>/g);
    let tableIndex = 0;
    for (const tableMatch of tableMatches) {
        const tableXml = tableMatch[0];
        // Extraire les lignes
        const rows = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
        // Extraire les en-têtes de colonnes (ligne 0)
        const columnHeaders = [];
        const firstRow = rows[0];
        if (firstRow) {
            const firstRowCells = firstRow.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
            for (const cell of firstRowCells) {
                const text = cell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                columnHeaders.push(text.substring(0, 50));
            }
        }
        // Parcourir chaque ligne
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const rowXml = rows[rowIndex];
            if (!rowXml)
                continue;
            const cells = rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
            // En-tête de ligne (colonne 0)
            const firstCell = cells[0];
            const rowHeader = firstCell
                ? firstCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50)
                : '';
            for (let columnIndex = 0; columnIndex < cells.length; columnIndex++) {
                const cellXml = cells[columnIndex];
                if (!cellXml)
                    continue;
                const tagMatches = cellXml.match(/\{\{([A-Z_0-9]+)\}\}/g) || [];
                const tags = tagMatches.map(t => t.replace(/[{}]/g, ''));
                if (tags.length > 0) {
                    result.push({
                        tableIndex,
                        rowIndex,
                        columnIndex,
                        rowHeader,
                        columnHeader: columnHeaders[columnIndex] || '',
                        tags,
                    });
                }
            }
        }
        tableIndex++;
    }
    return result;
}
/**
 * Extrait automatiquement tous les tags d'un template XML.
 *
 * Version simplifiée qui retourne uniquement les tags et leurs types
 * déduits, sans le contexte complet.
 *
 * @param xml - Le XML du template
 * @returns Liste des tags extraits avec leur type
 */
function extractTagsFromTemplateXml(xml) {
    const tags = [];
    const seenTags = new Set();
    // Trouver tous les tags {{TAG}}
    const tagMatches = xml.match(/\{\{[A-Z_0-9]+\}\}/g) || [];
    for (const fullTag of tagMatches) {
        const tagName = fullTag.replace(/[{}]/g, '');
        // Éviter les doublons
        if (seenTags.has(tagName))
            continue;
        seenTags.add(tagName);
        // Déduire le type
        const type = inferTagDataType(tagName);
        // Trouver le contexte autour du tag
        const tagIndex = xml.indexOf(fullTag);
        const contextStart = Math.max(0, tagIndex - 200);
        const contextEnd = Math.min(xml.length, tagIndex + fullTag.length + 100);
        const contextXml = xml.substring(contextStart, contextEnd);
        const context = (0, xml_utils_1.extractTextFromXml)(contextXml)
            .replace(fullTag, '')
            .trim()
            .substring(0, 100);
        tags.push({ tag: tagName, type, context });
    }
    return tags;
}
/**
 * Génère une structure de données vide basée sur les tags extraits.
 *
 * Cette structure peut être utilisée comme template pour remplir le document.
 *
 * @param extractedTags - Les tags extraits du template
 * @returns Un objet avec chaque tag comme clé et une valeur par défaut
 */
function generateDataStructureFromTags(extractedTags) {
    const structure = {};
    for (const { tag, type } of extractedTags) {
        switch (type) {
            case 'boolean':
                structure[tag] = false;
                break;
            case 'number':
                structure[tag] = 0;
                break;
            case 'date':
            case 'string':
            default:
                structure[tag] = '';
                break;
        }
    }
    return structure;
}
// ============================================================================
// EXTRACTION DES PARAGRAPHES DU DOCUMENT CIBLE
// ============================================================================
/**
 * Extrait tous les paragraphes du document cible avec métadonnées.
 *
 * Cette fonction prépare le document cible pour le matching avec les tags.
 *
 * @param xml - Le XML du document cible
 * @returns Liste des paragraphes avec leurs métadonnées
 */
function extractTargetParagraphs(xml) {
    const paragraphs = [];
    const rawParagraphs = (0, xml_utils_1.extractParagraphsFromXml)(xml);
    let currentSection = '';
    for (let i = 0; i < rawParagraphs.length; i++) {
        const p = rawParagraphs[i];
        const text = (0, text_utils_1.normalizeText)(p.text);
        currentSection = (0, text_utils_1.detectSection)(text, currentSection);
        const inTableCell = (0, xml_utils_1.isInsideTableCell)(xml, p.xmlStart, p.xml);
        paragraphs.push({
            index: i,
            text,
            xmlStart: p.xmlStart,
            xmlEnd: p.xmlEnd,
            section: currentSection,
            isTableCell: inTableCell,
            hasExistingTag: (0, text_utils_1.hasExistingTag)(text),
        });
    }
    return paragraphs;
}
// ============================================================================
// FONCTIONS UTILITAIRES PRIVÉES
// ============================================================================
/**
 * Déduit le type de tag basé sur son nom.
 */
function inferTagType(tagName) {
    if (tagName.startsWith('CHECK_') ||
        tagName.includes('_OUI') ||
        tagName.includes('_NON') ||
        tagName.startsWith('EST_')) {
        return 'checkbox';
    }
    if (tagName.includes('DATE') || tagName.includes('_DEBUT') || tagName.includes('_FIN')) {
        return 'date';
    }
    return 'text';
}
/**
 * Déduit le type de données d'un tag basé sur son nom.
 */
function inferTagDataType(tagName) {
    if (tagName.startsWith('CHECK_') ||
        tagName.startsWith('EST_') ||
        tagName.includes('_OUI') ||
        tagName.includes('_NON')) {
        return 'boolean';
    }
    if (tagName.includes('DATE') || tagName.includes('_DEBUT') || tagName.includes('_FIN')) {
        return 'date';
    }
    if (tagName.includes('MONTANT') || tagName.includes('PRIX') || tagName.includes('CA_')) {
        return 'number';
    }
    return 'string';
}
/**
 * Extrait le label qui précède un tag dans un paragraphe.
 */
function extractLabelBefore(paragraphText, fullTag, allParagraphs, currentIndex) {
    const tagIndex = paragraphText.indexOf(fullTag);
    // D'abord, chercher dans le même paragraphe avant le tag
    if (tagIndex > 0) {
        const textBefore = paragraphText.substring(0, tagIndex).trim();
        if (textBefore.length > 2 && (0, text_utils_1.containsLetters)(textBefore)) {
            return textBefore;
        }
    }
    // Sinon, chercher dans les paragraphes précédents
    for (let j = currentIndex - 1; j >= Math.max(0, currentIndex - 5); j--) {
        const prevText = allParagraphs[j].text.trim();
        if (prevText.length > 3 && !(0, text_utils_1.hasExistingTag)(prevText) && (0, text_utils_1.containsLetters)(prevText)) {
            return prevText.substring(0, 150);
        }
    }
    return '';
}
/**
 * Extrait le label qui suit un tag dans un paragraphe.
 */
function extractLabelAfter(paragraphText, fullTag) {
    const tagIndex = paragraphText.indexOf(fullTag);
    const afterTagIndex = tagIndex + fullTag.length;
    if (afterTagIndex < paragraphText.length) {
        const textAfter = paragraphText.substring(afterTagIndex).trim();
        if (textAfter.length > 0 && !(0, text_utils_1.hasExistingTag)(textAfter)) {
            return textAfter.substring(0, 50);
        }
    }
    return '';
}
/**
 * Nettoie un label en retirant les tags résiduels.
 */
function cleanLabel(label) {
    return label.replace(/\{\{[A-Z_0-9]+\}\}/g, '').trim();
}
/**
 * Retourne des indices sémantiques basés sur le nom du tag.
 * Ces indices aident l'IA à mieux comprendre le contexte.
 */
function getSemanticHintsForTag(tagName) {
    const hints = {
        'NOM_COMMERCIAL': 'nom commercial dénomination sociale raison sociale',
        'DENOMINATION': 'dénomination sociale',
        'ADRESSE': 'adresse postale siège',
        'ADRESSE_SIEGE': 'siège social adresse siège',
        'SIRET': 'numéro SIRET SIREN identification',
        'EMAIL': 'adresse électronique courriel email',
        'TELEPHONE': 'téléphone numéro tel',
        'FORME_JURIDIQUE': 'forme juridique statut entreprise',
        'CHECK_PME': 'PME petite moyenne entreprise artisan',
        'CA_': 'chiffre affaires exercice',
        'PART_CA': 'part pourcentage chiffre affaires',
    };
    for (const [key, hint] of Object.entries(hints)) {
        if (tagName.includes(key)) {
            return hint;
        }
    }
    return '';
}
/**
 * Extrait toutes les cellules de tableaux avec leurs positions.
 * Inclut les cellules vides (crucial pour le matching des tableaux multi-colonnes).
 *
 * @param xml - Le XML du document
 * @returns Liste des cellules avec leur position dans le tableau
 */
function extractTableCells(xml) {
    var _a;
    const cells = [];
    const tableMatches = xml.matchAll(/<w:tbl[\s\S]*?<\/w:tbl>/g);
    let tableIndex = 0;
    for (const tableMatch of tableMatches) {
        const tableXml = tableMatch[0];
        const tableStart = tableMatch.index || 0;
        // Extraire les lignes
        const rowMatches = tableXml.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g);
        // D'abord, extraire les en-têtes de colonnes (ligne 0)
        const columnHeaders = [];
        const allRows = [];
        for (const rowMatch of rowMatches) {
            allRows.push({
                rowXml: rowMatch[0],
                rowStart: tableStart + (rowMatch.index || 0),
            });
        }
        // Extraire les en-têtes de colonnes (ligne 0)
        if (allRows.length > 0) {
            const firstRowCells = allRows[0].rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
            for (const cell of firstRowCells) {
                const text = extractTextFromCellXml(cell);
                columnHeaders.push(text);
            }
        }
        // Parcourir chaque ligne
        for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
            const { rowXml, rowStart } = allRows[rowIndex];
            const cellMatches = rowXml.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g);
            // En-tête de ligne (première cellule, colonne 0)
            const firstCellMatch = rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/);
            const rowHeader = firstCellMatch ? extractTextFromCellXml(firstCellMatch[0]) : '';
            let columnIndex = 0;
            for (const cellMatch of cellMatches) {
                const cellXml = cellMatch[0];
                const cellStart = rowStart + (cellMatch.index || 0);
                const cellEnd = cellStart + cellXml.length;
                const text = extractTextFromCellXml(cellXml);
                const isEmpty = text.trim().length === 0;
                // Chercher les tags dans la cellule
                const tagMatches = cellXml.match(/\{\{([A-Z_0-9]+)\}\}/g) || [];
                const tags = tagMatches.map((t) => t.replace(/[{}]/g, ''));
                cells.push({
                    tableIndex,
                    rowIndex,
                    columnIndex,
                    text: text.substring(0, 100),
                    isEmpty,
                    rowHeader: rowHeader.substring(0, 80),
                    columnHeader: ((_a = columnHeaders[columnIndex]) === null || _a === void 0 ? void 0 : _a.substring(0, 80)) || '',
                    xmlStart: cellStart,
                    xmlEnd: cellEnd,
                    hasTags: tags.length > 0,
                    tags,
                });
                columnIndex++;
            }
        }
        tableIndex++;
    }
    return cells;
}
/**
 * Extrait le texte d'une cellule de tableau XML.
 */
function extractTextFromCellXml(cellXml) {
    return cellXml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Enrichit les paragraphes cibles avec les informations de position dans les tableaux.
 * Ajoute également les cellules vides comme paragraphes potentiels.
 *
 * AMÉLIORATION v4.0:
 * - Enrichit TOUS les paragraphes dont la position XML est dans une cellule
 * - Ajoute les cellules vides même en colonne 0
 * - Meilleure détection des positions avec tolérance
 *
 * @param xml - Le XML du document
 * @param paragraphs - Les paragraphes déjà extraits
 * @returns Paragraphes enrichis avec position de tableau + cellules vides ajoutées
 */
function enrichParagraphsWithTableInfo(xml, paragraphs) {
    const tableCells = extractTableCells(xml);
    const enrichedParagraphs = [...paragraphs];
    // Phase 1: Enrichir les paragraphes existants avec les infos de tableau
    for (const p of enrichedParagraphs) {
        // Chercher la cellule qui contient ce paragraphe
        const containingCell = tableCells.find(cell => p.xmlStart >= cell.xmlStart && p.xmlEnd <= cell.xmlEnd);
        if (containingCell) {
            // Marquer comme cellule de tableau et ajouter les infos de position
            p.isTableCell = true;
            p.tableIndex = containingCell.tableIndex;
            p.rowIndex = containingCell.rowIndex;
            p.columnIndex = containingCell.columnIndex;
            p.rowHeader = containingCell.rowHeader;
            p.columnHeader = containingCell.columnHeader;
        }
    }
    // Phase 2: Ajouter les cellules qui n'ont pas de paragraphe (cellules vides)
    for (const cell of tableCells) {
        // Vérifier si on a déjà un paragraphe pour cette cellule
        const existingParagraph = enrichedParagraphs.find((p) => p.isTableCell &&
            p.tableIndex === cell.tableIndex &&
            p.rowIndex === cell.rowIndex &&
            p.columnIndex === cell.columnIndex);
        if (!existingParagraph) {
            // Ajouter la cellule comme paragraphe potentiel
            const newIndex = enrichedParagraphs.length;
            enrichedParagraphs.push({
                index: newIndex,
                text: cell.text || '', // Peut être vide
                xmlStart: cell.xmlStart,
                xmlEnd: cell.xmlEnd,
                section: '',
                isTableCell: true,
                hasExistingTag: cell.hasTags,
                tableIndex: cell.tableIndex,
                rowIndex: cell.rowIndex,
                columnIndex: cell.columnIndex,
                rowHeader: cell.rowHeader,
                columnHeader: cell.columnHeader,
            });
        }
    }
    return enrichedParagraphs;
}
