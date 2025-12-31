"use strict";
/**
 * ============================================================================
 * SERVICE PATTERN MATCHER - Matching basé sur des patterns textuels
 * ============================================================================
 *
 * Ce service fournit un fallback pour le matching quand le LLM ne retourne
 * pas de résultats. Il utilise des patterns de texte prédéfinis pour
 * trouver les correspondances entre les tags et les paragraphes cibles.
 *
 * AMÉLIORATIONS v2.1:
 * - Détection des cellules vides APRÈS les labels (au lieu de placer sur le label)
 * - Gestion correcte des colonnes du tableau CA
 * - Mapping précis des tags PART_CA vers les cellules avec "%"
 *
 * UTILISÉ QUAND :
 * - Le LLM ne retourne aucun match
 * - Le LLM retourne une réponse invalide
 * - Mode hors-ligne
 *
 * @author Rokodo
 * @version 2.1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.patternBasedMatching = patternBasedMatching;
// ============================================================================
// PATTERNS DE MATCHING
// ============================================================================
/**
 * Patterns de texte pour chaque type de tag courant.
 * Ces patterns sont utilisés pour trouver des correspondances sémantiques.
 */
const TAG_PATTERNS = {
    'NOM_COMMERCIAL': ['nom commercial', 'dénomination', 'raison sociale', 'société'],
    'DENOMINATION': ['dénomination', 'raison sociale'],
    'ADRESSE': ['adresse postale', 'siège social', 'adresses postale'],
    'ADRESSE_SIEGE': ['siège social', 'adresse du siège'],
    'CODE_POSTAL': ['code postal', 'cp'],
    'VILLE': ['ville', 'commune', 'localité'],
    'EMAIL': ['adresse électronique', 'email', 'courriel', 'mail', 'e-mail'],
    'TELEPHONE': ['téléphone', 'télécopie', 'tél', 'tel', 'numéro de téléphone'],
    'SIRET': ['siret', 'siren', 'numéro siret', 'n° siret'],
    'FORME_JURIDIQUE': ['forme juridique', 'statut juridique', 'type de société'],
    'CA_N': ['chiffre d\'affaires global'],
    'CA_N1': ['chiffre d\'affaires global'],
    'CA_N2': ['chiffre d\'affaires global'],
    'PART_CA_N': ['part du chiffre d\'affaires'],
    'PART_CA_N1': ['part du chiffre d\'affaires'],
    'PART_CA_N2': ['part du chiffre d\'affaires'],
    'EFFECTIF': ['effectif', 'nombre de salariés', 'employés'],
    'DATE': ['date', 'le ', 'fait à', 'fait le'],
    'MONTANT': ['montant', 'prix', 'somme', '€', 'euros'],
    'CHECK_': ['☐', '☑', 'oui', 'non', 'case'],
};
/**
 * Labels spécifiques des formulaires DC2 pour les tags d'identification.
 * Ces labels précèdent les champs à remplir.
 */
const DC2_LABELS = {
    'NOM_COMMERCIAL': ['nom commercial et dénomination sociale'],
    'ADRESSE': ['adresses postale et du siège', 'adresse postale'],
    'EMAIL': ['adresse électronique'],
    'TELEPHONE': ['numéros de téléphone'],
    'SIRET': ['numéro siret'],
};
// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================
/**
 * Effectue le matching basé sur des patterns textuels.
 *
 * Cette fonction est un fallback robuste quand le LLM ne fonctionne pas.
 * Elle analyse les labels des tags du template et cherche des correspondances
 * dans les paragraphes du document cible.
 *
 * AMÉLIORATIONS v2.1:
 * - Les tags d'identification sont placés dans les cellules APRÈS les labels
 * - Les tags CA sont placés dans les bonnes colonnes du tableau
 * - Les tags PART_CA sont placés dans les cellules avec "%"
 *
 * @param tagContexts - Contextes des tags extraits du template
 * @param targetParagraphs - Paragraphes du document cible
 * @returns Liste des matches trouvés
 */
function patternBasedMatching(tagContexts, targetParagraphs) {
    const matches = [];
    const usedParagraphs = new Set();
    const usedTags = new Set();
    // === ÉTAPE 1: TRAITEMENT DES DATES D'EXERCICE CA ===
    processExerciseDates(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags);
    // === ÉTAPE 2: TRAITEMENT DES TAGS CA (Chiffre d'Affaires) ===
    processCAValues(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags);
    // === ÉTAPE 3: TRAITEMENT DES TAGS PART_CA ===
    processPartCAValues(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags);
    // === ÉTAPE 4: TRAITEMENT DES TAGS D'IDENTIFICATION ===
    processIdentificationTags(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags);
    // === ÉTAPE 5: TRAITEMENT DES AUTRES TAGS ===
    processRemainingTags(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags);
    return matches;
}
// ============================================================================
// FONCTIONS DE TRAITEMENT SPÉCIALISÉES
// ============================================================================
/**
 * Traite les dates d'exercice (CA_N_DEBUT/FIN, etc.)
 */
function processExerciseDates(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags) {
    // Trouver les lignes "Exercice du ... au ..." dans le tableau
    const exerciseLines = targetParagraphs.filter(p => p.text.toLowerCase().includes('exercice') &&
        p.text.includes('du') &&
        p.text.includes('au') &&
        p.isTableCell).sort((a, b) => a.index - b.index);
    // Mapper les dates aux lignes d'exercice (ordre chronologique)
    const dateTagMappings = [
        { debut: 'CA_N_DEBUT', fin: 'CA_N_FIN' },
        { debut: 'CA_N1_DEBUT', fin: 'CA_N1_FIN' },
        { debut: 'CA_N2_DEBUT', fin: 'CA_N2_FIN' },
    ];
    for (let i = 0; i < Math.min(exerciseLines.length, dateTagMappings.length); i++) {
        const line = exerciseLines[i];
        const mapping = dateTagMappings[i];
        const hasDebutTag = tagContexts.some(tc => tc.tag === mapping.debut);
        const hasFinTag = tagContexts.some(tc => tc.tag === mapping.fin);
        if (hasDebutTag && hasFinTag) {
            usedParagraphs.add(line.index);
            matches.push({
                tag: mapping.debut,
                targetParagraphIndex: line.index,
                confidence: 0.95,
                insertionPoint: 'table_cell',
            });
            matches.push({
                tag: mapping.fin,
                targetParagraphIndex: line.index,
                confidence: 0.95,
                insertionPoint: 'table_cell',
            });
            usedTags.add(mapping.debut);
            usedTags.add(mapping.fin);
        }
    }
}
/**
 * Normalise les apostrophes dans un texte (remplace ' par ')
 */
function normalizeApostrophes(text) {
    return text.replace(/[\u2019\u2018\u0060\u00B4]/g, "'");
}
/**
 * Traite les valeurs de Chiffre d'Affaires (CA_N, CA_N1, CA_N2)
 * Ces tags vont dans les cellules vides après le label "Chiffre d'affaires global"
 *
 * STRUCTURE DU TABLEAU CA:
 * - Ligne 0: [vide] [Exercice N] [Exercice N-1] [Exercice N-2]
 * - Ligne 1: [CA Label 126] [CA_N 127-128] [CA_N1 129] [CA_N2 130]
 * - Ligne 2: [PART_CA Label 131] [% 132-133] [% 134-135] [% 136-137]
 *
 * IMPORTANT:
 * - La recherche doit s'arrêter AVANT le label PART_CA
 * - Une cellule peut contenir 1 ou 2 paragraphes vides
 */
function processCAValues(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags) {
    // Trouver le label "Chiffre d'affaires global"
    const caLabelIndex = targetParagraphs.findIndex(p => normalizeApostrophes(p.text.toLowerCase()).includes('chiffre d\'affaires global') &&
        p.isTableCell);
    if (caLabelIndex === -1)
        return;
    // Trouver le label "Part du chiffre d'affaires" (limite de recherche)
    const partCaLabelIndex = targetParagraphs.findIndex(p => normalizeApostrophes(p.text.toLowerCase()).includes('part du chiffre d\'affaires') &&
        p.isTableCell &&
        p.index > caLabelIndex);
    // Les tags CA à placer
    const caTags = ['CA_N', 'CA_N1', 'CA_N2'];
    const existingCATags = caTags.filter(tag => tagContexts.some(tc => tc.tag === tag));
    // Trouver les cellules vides ENTRE les deux labels
    const maxIndex = partCaLabelIndex !== -1 ? partCaLabelIndex : caLabelIndex + 10;
    const emptyCellsInRow = targetParagraphs.filter(p => p.index > caLabelIndex &&
        p.index < maxIndex &&
        p.isTableCell &&
        p.text.trim().length === 0 &&
        !usedParagraphs.has(p.index)).sort((a, b) => a.index - b.index);
    // Regrouper les paragraphes par cellule/colonne
    // Structure observée du tableau CA:
    // - Première cellule de données: souvent 2 paragraphes consécutifs
    // - Cellules suivantes: 1 seul paragraphe chacune
    // On groupe les 2 premiers consécutifs, puis 1 par colonne ensuite
    const columns = [];
    if (emptyCellsInRow.length === 0) {
        // Pas de cellules vides
    }
    else if (emptyCellsInRow.length <= 3) {
        // 3 cellules ou moins: une par colonne
        emptyCellsInRow.forEach(cell => columns.push([cell.index]));
    }
    else {
        // Plus de 3 cellules: la première cellule peut avoir 2 paragraphes
        // Vérifier si les 2 premiers sont consécutifs
        const first = emptyCellsInRow[0];
        const second = emptyCellsInRow[1];
        if (second.index === first.index + 1) {
            // Les 2 premiers sont consécutifs → même cellule
            columns.push([first.index, second.index]);
            // Le reste: 1 par colonne
            for (let i = 2; i < emptyCellsInRow.length; i++) {
                columns.push([emptyCellsInRow[i].index]);
            }
        }
        else {
            // Non consécutifs: tous séparés
            emptyCellsInRow.forEach(cell => columns.push([cell.index]));
        }
    }
    // Mapper chaque tag CA à une colonne (prendre le premier paragraphe de chaque colonne)
    for (let i = 0; i < Math.min(existingCATags.length, columns.length); i++) {
        const tag = existingCATags[i];
        const cellIndex = columns[i][0]; // Premier paragraphe de la colonne
        matches.push({
            tag: tag,
            targetParagraphIndex: cellIndex,
            confidence: 0.90,
            insertionPoint: 'table_cell',
        });
        usedParagraphs.add(cellIndex);
        usedTags.add(tag);
    }
}
/**
 * Traite les valeurs Part du CA (PART_CA_N, PART_CA_N1, PART_CA_N2)
 * Ces tags vont dans les cellules avec "%" après le label "Part du chiffre d'affaires"
 */
function processPartCAValues(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags) {
    // Trouver le label "Part du chiffre d'affaires" (avec normalisation des apostrophes)
    const partCaLabelIndex = targetParagraphs.findIndex(p => normalizeApostrophes(p.text.toLowerCase()).includes('part du chiffre d\'affaires') &&
        p.isTableCell);
    if (partCaLabelIndex === -1)
        return;
    // Les tags PART_CA à placer
    const partCaTags = ['PART_CA_N', 'PART_CA_N1', 'PART_CA_N2'];
    const existingPartCATags = partCaTags.filter(tag => tagContexts.some(tc => tc.tag === tag));
    // Trouver les cellules avec "%" APRÈS le label
    const percentCells = targetParagraphs.filter(p => p.index > partCaLabelIndex &&
        p.isTableCell &&
        p.text.trim() === '%' &&
        !usedParagraphs.has(p.index)).sort((a, b) => a.index - b.index);
    // Mapper chaque tag PART_CA à une cellule "%"
    for (let i = 0; i < Math.min(existingPartCATags.length, percentCells.length); i++) {
        const tag = existingPartCATags[i];
        const cell = percentCells[i];
        // Vérifier que cette cellule est proche du label
        if (cell.index - partCaLabelIndex > 15)
            continue;
        matches.push({
            tag: tag,
            targetParagraphIndex: cell.index,
            confidence: 0.90,
            insertionPoint: 'table_cell',
        });
        usedParagraphs.add(cell.index);
        usedTags.add(tag);
    }
}
/**
 * Traite les tags d'identification (NOM_COMMERCIAL, ADRESSE, EMAIL, etc.)
 * Ces tags vont dans les paragraphes/cellules APRÈS les labels correspondants.
 *
 * IMPORTANT pour DC2:
 * - NOM_COMMERCIAL: Le document a 2 paragraphes "Nom commercial..."
 *   Le 1er [33] est une description générale, le 2ème [35] est le champ à remplir
 *   On doit cibler le DEUXIÈME paragraphe
 */
function processIdentificationTags(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags) {
    // Tags d'identification à traiter
    const identificationTags = ['NOM_COMMERCIAL', 'ADRESSE', 'EMAIL', 'TELEPHONE', 'SIRET'];
    for (const tagName of identificationTags) {
        if (usedTags.has(tagName))
            continue;
        // Vérifier que ce tag existe dans les contextes
        const tagContext = tagContexts.find(tc => tc.tag === tagName);
        if (!tagContext)
            continue;
        // Trouver le label spécifique pour ce tag
        const labels = DC2_LABELS[tagName] || TAG_PATTERNS[tagName] || [];
        let labelParagraphIndex = -1;
        // SPÉCIAL pour NOM_COMMERCIAL: prendre le DEUXIÈME paragraphe "Nom commercial..."
        // car le premier est une description, le second est le champ à remplir
        if (tagName === 'NOM_COMMERCIAL') {
            const nomCommParagraphs = targetParagraphs.filter(p => normalizeApostrophes(p.text.toLowerCase()).includes('nom commercial') &&
                p.text.trim().endsWith(':') &&
                p.section === 'C' &&
                !usedParagraphs.has(p.index));
            // Prendre le DEUXIÈME si disponible
            if (nomCommParagraphs.length >= 2) {
                labelParagraphIndex = nomCommParagraphs[1].index;
            }
            else if (nomCommParagraphs.length === 1) {
                labelParagraphIndex = nomCommParagraphs[0].index;
            }
        }
        else {
            // Pour les autres tags, chercher le paragraphe qui COMMENCE par le label
            // (évite le paragraphe description [33] qui contient tous les labels)
            for (const label of labels) {
                // D'abord chercher un paragraphe qui COMMENCE par le label (meilleur match)
                let found = targetParagraphs.findIndex(p => normalizeApostrophes(p.text.toLowerCase()).startsWith(label.toLowerCase()) &&
                    p.text.trim().endsWith(':') &&
                    !usedParagraphs.has(p.index));
                // Si non trouvé, chercher un paragraphe court qui contient le label
                // (exclure les paragraphes > 150 chars qui sont des descriptions)
                if (found === -1) {
                    found = targetParagraphs.findIndex(p => normalizeApostrophes(p.text.toLowerCase()).includes(label.toLowerCase()) &&
                        p.text.trim().endsWith(':') &&
                        p.text.length < 150 &&
                        !usedParagraphs.has(p.index));
                }
                if (found !== -1) {
                    labelParagraphIndex = found;
                    break;
                }
            }
        }
        if (labelParagraphIndex === -1)
            continue;
        const labelParagraph = targetParagraphs[labelParagraphIndex];
        // CAS 1: Le label se termine par ":" - placer le tag après le deux-points
        if (labelParagraph.text.trim().endsWith(':')) {
            matches.push({
                tag: tagName,
                targetParagraphIndex: labelParagraphIndex,
                confidence: 0.85,
                insertionPoint: 'after_colon',
            });
            usedParagraphs.add(labelParagraphIndex);
            usedTags.add(tagName);
            continue;
        }
        // CAS 2: Chercher une cellule vide ou courte APRÈS le label
        const nextEmptyCell = targetParagraphs.find(p => p.index > labelParagraphIndex &&
            p.index <= labelParagraphIndex + 5 &&
            !usedParagraphs.has(p.index) &&
            p.text.trim().length < 5);
        if (nextEmptyCell) {
            matches.push({
                tag: tagName,
                targetParagraphIndex: nextEmptyCell.index,
                confidence: 0.80,
                insertionPoint: nextEmptyCell.isTableCell ? 'table_cell' : 'replace_empty',
            });
            usedParagraphs.add(nextEmptyCell.index);
            usedTags.add(tagName);
            continue;
        }
        // CAS 3: Chercher le paragraphe suivant avec un label spécifique
        const specificLabelPara = targetParagraphs.find(p => p.index > labelParagraphIndex &&
            p.index <= labelParagraphIndex + 3 &&
            !usedParagraphs.has(p.index) &&
            p.text.trim().endsWith(':'));
        if (specificLabelPara) {
            matches.push({
                tag: tagName,
                targetParagraphIndex: specificLabelPara.index,
                confidence: 0.80,
                insertionPoint: 'after_colon',
            });
            usedParagraphs.add(specificLabelPara.index);
            usedTags.add(tagName);
        }
    }
}
/**
 * Traite les tags restants avec la logique standard.
 */
function processRemainingTags(tagContexts, targetParagraphs, matches, usedParagraphs, usedTags) {
    for (const tagContext of tagContexts) {
        const tag = tagContext.tag;
        // Sauter les tags déjà traités
        if (usedTags.has(tag))
            continue;
        // Sauter les tags de dates CA
        if (tag.match(/^CA_N\d?_(DEBUT|FIN)$/))
            continue;
        const labelBefore = (tagContext.labelBefore || '').toLowerCase();
        // Trouver les patterns applicables pour ce tag
        let applicablePatterns = [];
        for (const [key, patterns] of Object.entries(TAG_PATTERNS)) {
            if (tag.includes(key) || tag.startsWith(key)) {
                applicablePatterns = applicablePatterns.concat(patterns);
            }
        }
        // Si pas de pattern spécifique, utiliser le label du template
        if (applicablePatterns.length === 0 && labelBefore) {
            applicablePatterns = labelBefore.split(/\s+/).filter(w => w.length > 3);
        }
        // Chercher dans les paragraphes cibles
        let bestMatch = null;
        let bestScore = 0;
        for (const para of targetParagraphs) {
            if (usedParagraphs.has(para.index))
                continue;
            if (para.hasExistingTag)
                continue;
            if (para.text.length < 3)
                continue;
            const paraTextLower = para.text.toLowerCase();
            let score = 0;
            // Calculer le score basé sur les patterns trouvés
            for (const pattern of applicablePatterns) {
                if (paraTextLower.includes(pattern)) {
                    score += 10;
                }
            }
            // Bonus si même section
            if (tagContext.section && para.section === tagContext.section) {
                score += 5;
            }
            // Bonus si le paragraphe se termine par ":"
            if (para.text.trim().endsWith(':')) {
                score += 3;
            }
            // Bonus pour les cellules de tableau si le tag est de type table_cell
            if (tagContext.type === 'table_cell' && para.isTableCell) {
                score += 5;
            }
            if (score > bestScore) {
                bestScore = score;
                bestMatch = para;
            }
        }
        // Ajouter le match si score suffisant
        if (bestMatch && bestScore >= 10) {
            usedParagraphs.add(bestMatch.index);
            usedTags.add(tag);
            // Déterminer le type d'insertion
            let insertionPoint = 'inline';
            if (bestMatch.text.trim().endsWith(':')) {
                insertionPoint = 'after_colon';
            }
            else if (bestMatch.isTableCell) {
                insertionPoint = 'table_cell';
            }
            else if (bestMatch.text.trim().length < 5) {
                insertionPoint = 'replace_empty';
            }
            matches.push({
                tag: tag,
                targetParagraphIndex: bestMatch.index,
                confidence: Math.min(bestScore / 20, 1),
                insertionPoint: insertionPoint,
            });
        }
    }
}
