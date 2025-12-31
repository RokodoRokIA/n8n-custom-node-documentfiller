"use strict";
/**
 * ============================================================================
 * UTILITAIRES CHECKBOX - Extraction et manipulation des cases à cocher
 * ============================================================================
 *
 * Ce module gère l'extraction des checkboxes depuis les documents DOCX.
 * Supporte plusieurs formats:
 * - Unicode: ☑ (coché) et ☐ (non coché)
 * - Word Form Controls: FORMCHECKBOX
 * - Content Controls: w:sdt avec checkbox
 *
 * @author Rokodo
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCheckboxes = extractCheckboxes;
exports.findCheckboxPairs = findCheckboxPairs;
exports.generateCheckboxTags = generateCheckboxTags;
exports.booleanToCheckbox = booleanToCheckbox;
exports.matchCheckboxes = matchCheckboxes;
exports.applyCheckboxesToXml = applyCheckboxesToXml;
// ============================================================================
// CONSTANTES
// ============================================================================
/** Caractères Unicode pour checkbox cochée */
const UNICODE_CHECKED = ['☑', '✓', '✔', '☒', '■'];
/** Caractères Unicode pour checkbox non cochée */
const UNICODE_UNCHECKED = ['☐', '□', '○', '◯', '◻'];
// ============================================================================
// EXTRACTION DES CHECKBOXES
// ============================================================================
/**
 * Extrait toutes les checkboxes d'un document XML.
 *
 * @param xml - Le contenu XML du document DOCX
 * @returns Liste des checkboxes extraites avec leur contexte
 */
function extractCheckboxes(xml) {
    const checkboxes = [];
    // Extraire les paragraphes
    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let match;
    let index = 0;
    while ((match = paragraphRegex.exec(xml)) !== null) {
        const paragraphXml = match[0];
        const paragraphStart = match.index;
        const paragraphEnd = match.index + match[0].length;
        // Extraire le texte du paragraphe
        const text = extractTextFromXml(paragraphXml);
        // Détecter la section
        const section = detectSection(text);
        // Chercher les checkboxes Unicode
        const unicodeCheckboxes = findUnicodeCheckboxes(text, index, section, paragraphStart, paragraphEnd);
        checkboxes.push(...unicodeCheckboxes);
        // Chercher les Word Form Controls
        const formCheckboxes = findFormCheckboxes(paragraphXml, text, index, section, paragraphStart, paragraphEnd);
        checkboxes.push(...formCheckboxes);
        index++;
    }
    return checkboxes;
}
/**
 * Trouve les checkboxes Unicode dans un texte.
 */
function findUnicodeCheckboxes(text, paragraphIndex, section, xmlStart, xmlEnd) {
    const results = [];
    // Chercher les caractères cochés
    for (const char of UNICODE_CHECKED) {
        if (text.includes(char)) {
            const label = text.replace(new RegExp(`[${UNICODE_CHECKED.join('')}${UNICODE_UNCHECKED.join('')}]`, 'g'), '').trim();
            results.push({
                index: paragraphIndex,
                checked: true,
                type: 'unicode',
                label: label.substring(0, 100),
                section,
                xmlStart,
                xmlEnd
            });
        }
    }
    // Chercher les caractères non cochés
    for (const char of UNICODE_UNCHECKED) {
        if (text.includes(char)) {
            const label = text.replace(new RegExp(`[${UNICODE_CHECKED.join('')}${UNICODE_UNCHECKED.join('')}]`, 'g'), '').trim();
            results.push({
                index: paragraphIndex,
                checked: false,
                type: 'unicode',
                label: label.substring(0, 100),
                section,
                xmlStart,
                xmlEnd
            });
        }
    }
    return results;
}
/**
 * Trouve les Word Form Controls (FORMCHECKBOX) dans un paragraphe.
 */
function findFormCheckboxes(paragraphXml, text, paragraphIndex, section, xmlStart, xmlEnd) {
    const results = [];
    if (paragraphXml.includes('FORMCHECKBOX')) {
        // Déterminer si coché (chercher l'état)
        // Formats possibles:
        // - <w:default w:val="1"/> (Word moderne)
        // - w:default="1" (ancien format)
        // - w14:checked w14:val="1" (Word 2010+)
        const defaultMatch = paragraphXml.match(/<w:default\s+w:val="(\d)"/);
        const isChecked = (defaultMatch && defaultMatch[1] === '1') ||
            paragraphXml.includes('w:default="1"') ||
            paragraphXml.includes('w14:checked w14:val="1"') ||
            paragraphXml.includes('w:checked="1"');
        // Nettoyer le label
        const label = text
            .replace(/FORMCHECKBOX/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        results.push({
            index: paragraphIndex,
            checked: isChecked,
            type: 'formcontrol',
            label: label.substring(0, 100),
            section,
            xmlStart,
            xmlEnd
        });
    }
    return results;
}
/**
 * Extrait le texte brut d'un fragment XML.
 */
function extractTextFromXml(xml) {
    return xml
        .replace(/<w:instrText[^>]*>[^<]*<\/w:instrText>/g, ' FORMCHECKBOX ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Détecte la section à partir du texte.
 */
function detectSection(text) {
    const sectionMatch = text.match(/^([A-Z])\s*[-–—:\.]/);
    if (sectionMatch) {
        return sectionMatch[1];
    }
    return undefined;
}
// ============================================================================
// DÉTECTION DES PAIRES OUI/NON
// ============================================================================
/**
 * Identifie les paires de checkboxes Oui/Non.
 *
 * @param checkboxes - Liste des checkboxes extraites
 * @returns Liste des paires identifiées
 */
function findCheckboxPairs(checkboxes) {
    const pairs = [];
    const used = new Set();
    for (let i = 0; i < checkboxes.length; i++) {
        if (used.has(i))
            continue;
        const current = checkboxes[i];
        const currentLabel = normalizeLabel(current.label);
        // Chercher une checkbox proche qui forme une paire
        for (let j = i + 1; j < checkboxes.length; j++) {
            if (used.has(j))
                continue;
            const next = checkboxes[j];
            const nextLabel = normalizeLabel(next.label);
            // Vérifier si c'est une paire Oui/Non (avec tolérance pour les variations)
            const currentIsOui = isOuiCheckbox(currentLabel);
            const currentIsNon = isNonCheckbox(currentLabel);
            const nextIsOui = isOuiCheckbox(nextLabel);
            const nextIsNon = isNonCheckbox(nextLabel);
            const isOuiNonPair = (currentIsOui && nextIsNon) || (currentIsNon && nextIsOui);
            // Vérifier si les checkboxes sont proches (dans les 5 paragraphes)
            const isClose = Math.abs(current.index - next.index) <= 5;
            if (isOuiNonPair && isClose) {
                const oui = currentIsOui ? current : next;
                const non = currentIsNon ? current : next;
                // Déterminer la valeur
                let value = null;
                if (oui.checked && !non.checked)
                    value = true;
                else if (!oui.checked && non.checked)
                    value = false;
                // Extraire le contexte de la question
                const question = extractQuestionContext(current, checkboxes, i);
                pairs.push({
                    question,
                    paragraphIndex: Math.min(current.index, next.index),
                    oui,
                    non,
                    value
                });
                used.add(i);
                used.add(j);
                break;
            }
        }
    }
    return pairs;
}
/**
 * Normalise un label pour la comparaison.
 */
function normalizeLabel(label) {
    return label
        .toLowerCase()
        .replace(/[^\w\sàâäéèêëïîôùûç]/gi, '') // Supprimer symboles
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Vérifie si un label représente "Oui".
 */
function isOuiCheckbox(label) {
    const normalized = label.toLowerCase().trim();
    return (normalized === 'oui' ||
        normalized.startsWith('oui ') ||
        normalized.startsWith('oui.') ||
        normalized.startsWith('oui,') ||
        /^\s*oui\s*$/i.test(normalized));
}
/**
 * Vérifie si un label représente "Non".
 */
function isNonCheckbox(label) {
    const normalized = label.toLowerCase().trim();
    return (normalized === 'non' ||
        normalized.startsWith('non ') ||
        normalized.startsWith('non.') ||
        normalized.startsWith('non,') ||
        /^\s*non\s*$/i.test(normalized));
}
/**
 * Extrait le contexte de la question pour une checkbox.
 */
function extractQuestionContext(checkbox, allCheckboxes, currentIndex) {
    // Le contexte est généralement dans le label ou dans les paragraphes précédents
    let context = checkbox.label;
    // Nettoyer le contexte
    context = context
        .replace(/oui|non/gi, '')
        .replace(/☐|☑|□|■/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    // Si le contexte est trop court, utiliser l'index
    if (context.length < 10) {
        context = `Question_${currentIndex + 1}`;
    }
    return context.substring(0, 60);
}
// ============================================================================
// GÉNÉRATION DE TAGS POUR CHECKBOXES
// ============================================================================
/**
 * Génère les tags appropriés pour les checkboxes.
 *
 * @param checkboxes - Liste des checkboxes
 * @param pairs - Paires Oui/Non identifiées
 * @returns Map de tag → état (true/false)
 */
function generateCheckboxTags(checkboxes, pairs) {
    const tags = new Map();
    // Tags pour les paires Oui/Non
    for (const pair of pairs) {
        const tagBase = sanitizeTagName(pair.question);
        tags.set(tagBase, {
            checked: pair.value === true,
            label: pair.question,
            type: 'boolean_pair'
        });
    }
    // Tags pour les checkboxes isolées (pas dans une paire)
    const usedIndexes = new Set();
    for (const pair of pairs) {
        usedIndexes.add(pair.oui.index);
        usedIndexes.add(pair.non.index);
    }
    for (const cb of checkboxes) {
        if (!usedIndexes.has(cb.index)) {
            const tag = sanitizeTagName(cb.label || `CHECKBOX_${cb.index}`);
            tags.set(tag, {
                checked: cb.checked,
                label: cb.label,
                type: 'boolean_single'
            });
        }
    }
    return tags;
}
/**
 * Convertit un label en nom de tag valide.
 */
function sanitizeTagName(label) {
    return label
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 40) || 'CHECKBOX';
}
// ============================================================================
// CONVERSION ENTRE FORMATS
// ============================================================================
/**
 * Convertit une valeur booléenne en symbole Unicode.
 *
 * @param checked - État de la checkbox
 * @param style - Style de checkbox ('unicode' | 'text' | 'boolean')
 * @returns Le symbole correspondant
 */
function booleanToCheckbox(checked, style = 'unicode') {
    switch (style) {
        case 'unicode':
            return checked ? '☑' : '☐';
        case 'text':
            return checked ? 'X' : ' ';
        case 'boolean':
            return checked ? 'true' : 'false';
        default:
            return checked ? '☑' : '☐';
    }
}
/**
 * Trouve les correspondances entre les checkboxes du template et de la cible.
 *
 * @param templateCheckboxes - Checkboxes du template
 * @param targetCheckboxes - Checkboxes de la cible
 * @returns Liste des correspondances avec le nouvel état
 */
function matchCheckboxes(templateCheckboxes, targetCheckboxes) {
    const matches = [];
    const usedTargets = new Set();
    for (const templateCb of templateCheckboxes) {
        const templateLabel = normalizeForMatching(templateCb.label);
        // Chercher la meilleure correspondance dans la cible
        let bestMatch = null;
        let bestScore = 0;
        for (let i = 0; i < targetCheckboxes.length; i++) {
            if (usedTargets.has(i))
                continue;
            const targetCb = targetCheckboxes[i];
            const targetLabel = normalizeForMatching(targetCb.label);
            // Cas spécial: Oui/Non
            if (isOuiText(templateLabel) && isOuiText(targetLabel)) {
                bestMatch = targetCb;
                bestScore = 100;
                usedTargets.add(i);
                break;
            }
            if (isNonText(templateLabel) && isNonText(targetLabel)) {
                bestMatch = targetCb;
                bestScore = 100;
                usedTargets.add(i);
                break;
            }
            // Matching par mots-clés
            const score = calculateMatchScore(templateLabel, targetLabel);
            if (score > bestScore && score >= 10) {
                bestScore = score;
                bestMatch = targetCb;
            }
        }
        if (bestMatch) {
            matches.push({
                templateCheckbox: templateCb,
                targetCheckbox: bestMatch,
                newState: templateCb.checked
            });
        }
    }
    return matches;
}
/**
 * Applique l'état des checkboxes au XML du document cible.
 *
 * @param targetXml - XML du document cible
 * @param matches - Correspondances de checkboxes
 * @returns XML modifié avec les checkboxes mises à jour
 */
function applyCheckboxesToXml(targetXml, matches) {
    let modifiedXml = targetXml;
    const applied = [];
    const failed = [];
    // Pour chaque match, on doit trouver et modifier le paragraphe correspondant
    // On utilise une approche par index pour éviter les problèmes de remplacement en cascade
    for (const match of matches) {
        const targetIdx = match.targetCheckbox.index;
        const newState = match.newState;
        // Extraire les paragraphes du XML ACTUEL (pas de l'original)
        const currentParagraphs = modifiedXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g) || [];
        if (targetIdx >= currentParagraphs.length) {
            failed.push(`Checkbox "${match.templateCheckbox.label.substring(0, 50)}" - index invalide`);
            continue;
        }
        const paragraph = currentParagraphs[targetIdx];
        // Déterminer le type de checkbox et appliquer la modification
        let modifiedParagraph;
        if (match.targetCheckbox.type === 'formcontrol') {
            // FORMCHECKBOX: modifier l'état via XML
            modifiedParagraph = setFormCheckboxState(paragraph, newState);
        }
        else if (match.targetCheckbox.type === 'unicode') {
            // Unicode: remplacer le symbole
            modifiedParagraph = setUnicodeCheckboxState(paragraph, newState);
        }
        else {
            failed.push(`Checkbox "${match.templateCheckbox.label.substring(0, 50)}" - type non supporté`);
            continue;
        }
        if (modifiedParagraph !== paragraph) {
            // Utiliser une regex pour un remplacement plus précis
            // On échappe les caractères spéciaux du paragraphe original
            const escapedParagraph = escapeRegExp(paragraph);
            const regex = new RegExp(escapedParagraph);
            const newXml = modifiedXml.replace(regex, modifiedParagraph);
            if (newXml !== modifiedXml) {
                modifiedXml = newXml;
                applied.push(`${match.templateCheckbox.label.substring(0, 50)} → ${newState ? '☑' : '☐'}`);
            }
            else {
                failed.push(`Checkbox "${match.templateCheckbox.label.substring(0, 50)}" - remplacement échoué`);
            }
        }
        else {
            failed.push(`Checkbox "${match.templateCheckbox.label.substring(0, 50)}" - impossible de modifier`);
        }
    }
    return { xml: modifiedXml, applied, failed };
}
/**
 * Échappe les caractères spéciaux pour une regex.
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Modifie l'état d'un FORMCHECKBOX dans un paragraphe.
 *
 * Structure typique:
 * <w:ffData>
 *   <w:checkBox>
 *     <w:size w:val="20"/>
 *     <w:default w:val="0"/>  ← à modifier
 *   </w:checkBox>
 * </w:ffData>
 */
function setFormCheckboxState(paragraphXml, checked) {
    let modified = paragraphXml;
    const newVal = checked ? '1' : '0';
    // Méthode principale: Modifier w:default w:val="X"
    // Pattern pour capturer <w:default w:val="0"/> ou <w:default w:val="1"/>
    if (modified.includes('w:default')) {
        modified = modified.replace(/<w:default\s+w:val="[01]"\s*\/>/g, `<w:default w:val="${newVal}"/>`);
    }
    else if (modified.includes('<w:checkBox>')) {
        // Si pas de w:default, l'ajouter après w:size ou au début de w:checkBox
        modified = modified.replace(/<w:checkBox>([\s\S]*?)<\/w:checkBox>/g, (match, content) => {
            // Si contient déjà w:size, ajouter après
            if (content.includes('<w:size')) {
                return `<w:checkBox>${content.replace(/<w:size[^>]*\/>/, `$&<w:default w:val="${newVal}"/>`)}</w:checkBox>`;
            }
            // Sinon, ajouter au début
            return `<w:checkBox><w:default w:val="${newVal}"/>${content}</w:checkBox>`;
        });
    }
    // Méthode 2: Modifier w14:checked (Word 2010+)
    if (modified.includes('w14:checked')) {
        modified = modified.replace(/w14:checked\s+w14:val="[01]"/g, `w14:checked w14:val="${newVal}"`);
    }
    return modified;
}
/**
 * Modifie l'état d'une checkbox Unicode dans un paragraphe.
 */
function setUnicodeCheckboxState(paragraphXml, checked) {
    const checkedSymbols = ['☑', '✓', '✔', '☒', '■'];
    const uncheckedSymbols = ['☐', '□', '○', '◯', '◻'];
    let modified = paragraphXml;
    if (checked) {
        // Remplacer les symboles non cochés par cochés
        for (const symbol of uncheckedSymbols) {
            modified = modified.replace(new RegExp(symbol, 'g'), '☑');
        }
    }
    else {
        // Remplacer les symboles cochés par non cochés
        for (const symbol of checkedSymbols) {
            modified = modified.replace(new RegExp(symbol, 'g'), '☐');
        }
    }
    return modified;
}
/**
 * Normalise un label pour le matching.
 */
function normalizeForMatching(label) {
    return label
        .toLowerCase()
        .replace(/[☑☐✓✔□■○◯◻︎]/g, '')
        .replace(/[^\w\sàâäéèêëïîôùûç]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Vérifie si le texte représente "Oui".
 */
function isOuiText(text) {
    const normalized = text.trim().toLowerCase();
    return normalized === 'oui' || normalized.startsWith('oui ') || normalized.startsWith('oui.');
}
/**
 * Vérifie si le texte représente "Non".
 */
function isNonText(text) {
    const normalized = text.trim().toLowerCase();
    return normalized === 'non' || normalized.startsWith('non ') || normalized.startsWith('non.');
}
/**
 * Calcule le score de correspondance entre deux labels.
 */
function calculateMatchScore(label1, label2) {
    const words1 = label1.split(/\s+/).filter(w => w.length >= 3);
    let score = 0;
    for (const word of words1) {
        if (label2.includes(word)) {
            score += word.length;
        }
    }
    return score;
}
