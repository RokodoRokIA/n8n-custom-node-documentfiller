"use strict";
/**
 * ============================================================================
 * STRUCTURE PARSER SERVICE - Analyse sémantique des documents DOCX
 * ============================================================================
 *
 * Ce service parse la structure d'un document DOCX et détecte les éléments
 * sémantiques: titres, listes, sections, paragraphes.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Les titres sont détectés via les styles Word (Heading1, Heading2, etc.)
 * - Les listes utilisent <w:numPr> pour le niveau et le type
 * - Les sections sont détectées par pattern (A., B., 1., etc.)
 *
 * @author Rokodo
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDocumentStructure = parseDocumentStructure;
exports.countWords = countWords;
exports.countCharacters = countCharacters;
exports.countHeadingsByLevel = countHeadingsByLevel;
exports.extractAllText = extractAllText;
const style_detector_utils_1 = require("../../shared/utils/style-detector.utils");
// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================
/**
 * Parse la structure d'un document DOCX et retourne le contenu organisé.
 *
 * @param xml - Contenu XML de word/document.xml
 * @param preserveHierarchy - Si true, organise par sections/sous-sections
 * @param includeStyles - Si true, inclut les infos de style
 * @returns Contenu structuré
 */
function parseDocumentStructure(xml, preserveHierarchy = true, includeStyles = false) {
    // Extraire le body
    const bodyMatch = xml.match(/<w:body>([\s\S]*?)<\/w:body>/);
    if (!bodyMatch) {
        return { sections: [], paragraphs: [] };
    }
    const bodyXml = bodyMatch[1];
    // Parser tous les éléments
    const elements = parseAllElements(bodyXml, includeStyles);
    if (preserveHierarchy) {
        // Organiser en sections hiérarchiques
        const sections = buildHierarchy(elements);
        return { sections };
    }
    else {
        // Liste plate de paragraphes
        const paragraphs = elements.map((el) => elementToParagraph(el));
        return { paragraphs };
    }
}
/**
 * Parse tous les éléments du document (paragraphes).
 */
function parseAllElements(bodyXml, includeStyles) {
    const elements = [];
    // Matcher les paragraphes (en excluant ceux dans les tableaux pour l'instant)
    // On traite les tableaux séparément
    const paragraphRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let match;
    while ((match = paragraphRegex.exec(bodyXml)) !== null) {
        const paragraphXml = match[0];
        // Ignorer les paragraphes dans les tableaux (traités séparément)
        // On vérifie si on est dans un <w:tc>
        const beforeMatch = bodyXml.substring(0, match.index);
        const lastTcOpen = beforeMatch.lastIndexOf('<w:tc');
        const lastTcClose = beforeMatch.lastIndexOf('</w:tc>');
        if (lastTcOpen > lastTcClose) {
            // On est dans une cellule de tableau, ignorer
            continue;
        }
        const element = parseParagraphElement(paragraphXml, includeStyles);
        if (element) {
            elements.push(element);
        }
    }
    return elements;
}
/**
 * Parse un paragraphe et détermine son type.
 */
function parseParagraphElement(paragraphXml, includeStyles) {
    // Extraire le texte
    const text = extractParagraphText(paragraphXml);
    if (!text.trim()) {
        return null;
    }
    // Détecter le type
    const headingLevel = (0, style_detector_utils_1.detectHeadingLevel)(paragraphXml);
    const listInfo = (0, style_detector_utils_1.detectListItem)(paragraphXml);
    // Extraire le style si demandé
    let style;
    if (includeStyles) {
        style = extractParagraphStyle(paragraphXml);
    }
    // Détecter si c'est une section
    const sectionInfo = (0, style_detector_utils_1.detectSectionInfo)(text);
    if (headingLevel) {
        return {
            type: 'heading',
            text: text.trim(),
            headingLevel,
            style,
            sectionId: sectionInfo === null || sectionInfo === void 0 ? void 0 : sectionInfo.id,
        };
    }
    if (listInfo) {
        return {
            type: 'listItem',
            text: text.trim(),
            listLevel: listInfo.level,
            listOrdered: false, // On ne peut pas facilement le détecter sans numbering.xml
            style,
        };
    }
    return {
        type: 'paragraph',
        text: text.trim(),
        style,
        sectionId: sectionInfo === null || sectionInfo === void 0 ? void 0 : sectionInfo.id,
    };
}
/**
 * Extrait le texte d'un paragraphe.
 */
function extractParagraphText(paragraphXml) {
    const textParts = [];
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = textRegex.exec(paragraphXml)) !== null) {
        textParts.push(match[1]);
    }
    return textParts.join('');
}
/**
 * Extrait le style dominant d'un paragraphe.
 */
function extractParagraphStyle(paragraphXml) {
    // On prend le style du premier run non vide
    const runRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    let match;
    while ((match = runRegex.exec(paragraphXml)) !== null) {
        const runXml = match[0];
        // Vérifier que le run contient du texte
        if (/<w:t[^>]*>[^<]+<\/w:t>/.test(runXml)) {
            return {
                bold: (0, style_detector_utils_1.isBold)(runXml),
                italic: (0, style_detector_utils_1.isItalic)(runXml),
                underline: (0, style_detector_utils_1.isUnderline)(runXml),
            };
        }
    }
    return {};
}
/**
 * Construit la hiérarchie de sections à partir des éléments.
 */
function buildHierarchy(elements) {
    var _a, _b, _c;
    const sections = [];
    let currentSection = null;
    let currentList = null;
    let sectionCounter = 0;
    for (const element of elements) {
        if (element.type === 'heading') {
            // Fermer la liste en cours
            if (currentList && currentSection) {
                currentSection.content.push(currentList);
                currentList = null;
            }
            // Créer une nouvelle section ou sous-section
            const level = (_a = element.headingLevel) !== null && _a !== void 0 ? _a : 1;
            if (level === 1 || !currentSection) {
                // Nouvelle section principale
                if (currentSection) {
                    sections.push(currentSection);
                }
                sectionCounter++;
                currentSection = {
                    id: `section_${sectionCounter}`,
                    title: element.text,
                    level: 1,
                    content: [],
                    subsections: [],
                };
            }
            else {
                // Ajouter comme contenu (heading dans la section)
                currentSection.content.push({
                    type: 'heading',
                    text: element.text,
                    level: level,
                });
            }
        }
        else if (element.type === 'listItem') {
            // Ajouter à la liste en cours ou créer une nouvelle
            if (!currentList) {
                currentList = {
                    type: 'list',
                    items: [],
                    ordered: (_b = element.listOrdered) !== null && _b !== void 0 ? _b : false,
                };
            }
            currentList.items.push({
                text: element.text,
                level: (_c = element.listLevel) !== null && _c !== void 0 ? _c : 0,
                style: element.style,
            });
        }
        else {
            // Paragraphe normal
            // Fermer la liste en cours
            if (currentList && currentSection) {
                currentSection.content.push(currentList);
                currentList = null;
            }
            if (!currentSection) {
                // Créer une section par défaut si on n'en a pas
                sectionCounter++;
                currentSection = {
                    id: `section_${sectionCounter}`,
                    title: 'Introduction',
                    level: 1,
                    content: [],
                };
            }
            currentSection.content.push({
                type: 'paragraph',
                text: element.text,
                style: element.style,
            });
        }
    }
    // Fermer la dernière liste et section
    if (currentList && currentSection) {
        currentSection.content.push(currentList);
    }
    if (currentSection) {
        sections.push(currentSection);
    }
    return sections;
}
/**
 * Convertit un élément parsé en ExtractedParagraph.
 */
function elementToParagraph(element) {
    return {
        text: element.text,
        type: element.type,
        headingLevel: element.headingLevel,
        listIndex: undefined, // Nécessiterait un compteur global
        listOrdered: element.listOrdered,
        style: element.style,
        sectionId: element.sectionId,
    };
}
// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================
/**
 * Compte les mots dans un texte.
 */
function countWords(text) {
    return text
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
}
/**
 * Compte les caractères dans un texte (sans espaces).
 */
function countCharacters(text) {
    return text.replace(/\s/g, '').length;
}
/**
 * Détecte le nombre de titres par niveau.
 */
function countHeadingsByLevel(elements) {
    const counts = {};
    for (const el of elements) {
        if (el.type === 'heading' && el.headingLevel) {
            counts[el.headingLevel] = (counts[el.headingLevel] || 0) + 1;
        }
    }
    return counts;
}
/**
 * Extrait tous les textes des paragraphes pour le comptage de mots.
 */
function extractAllText(xml) {
    const textParts = [];
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = textRegex.exec(xml)) !== null) {
        textParts.push(match[1]);
    }
    return textParts.join(' ');
}
