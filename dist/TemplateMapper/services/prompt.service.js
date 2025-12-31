"use strict";
/**
 * ============================================================================
 * SERVICE PROMPT - Génération des prompts pour le matching IA
 * ============================================================================
 *
 * Ce service génère les prompts envoyés au LLM pour le matching sémantique.
 *
 * ARCHITECTURE v3.0 - FEW-SHOT LEARNING:
 * - L'IA apprend par EXEMPLES concrets, pas par règles abstraites
 * - Chaque tag du template montre: "Dans le template, ce tag était ICI"
 * - L'IA doit trouver l'équivalent dans le document cible
 * - Format JSON strict avec validation
 *
 * POURQUOI CETTE APPROCHE:
 * - Les LLM suivent mieux les exemples que les instructions textuelles
 * - Moins de tokens = réponses plus précises
 * - Le contexte du template EST la logique métier
 *
 * @author Rokodo
 * @version 3.0.0 - Few-Shot Learning
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTransferLearningPrompt = generateTransferLearningPrompt;
exports.generateCheckboxFewShot = generateCheckboxFewShot;
exports.generateDirectMappingPrompt = generateDirectMappingPrompt;
exports.validatePromptSize = validatePromptSize;
// ============================================================================
// CONSTANTES
// ============================================================================
const MAX_PROMPT_SIZE = 60000;
const MAX_PARAGRAPHS = 80;
const MAX_TAG_CONTEXTS = 40;
// ============================================================================
// GÉNÉRATION DU PROMPT - FEW-SHOT LEARNING
// ============================================================================
/**
 * Génère le prompt avec approche Few-Shot Learning.
 *
 * PRINCIPE: Montrer des exemples concrets plutôt que des règles abstraites.
 * L'IA voit: "Dans le template, {{NOM}} était après 'Nom commercial :'"
 * Elle doit trouver: "Dans la cible, 'Nom commercial :' est au paragraphe X"
 */
function generateTransferLearningPrompt(tagContexts, targetParagraphs, extractedTags, docType) {
    // Limiter les données
    const limitedContexts = tagContexts.slice(0, MAX_TAG_CONTEXTS);
    // Préparer les paragraphes cibles
    const targetList = prepareTargetParagraphs(targetParagraphs);
    // Construire les exemples d'apprentissage (Few-Shot)
    const fewShotExamples = buildFewShotExamples(limitedContexts, targetList);
    // Liste des tags à mapper
    const tagsToMap = extractedTags.map(t => t.tag);
    return `# TÂCHE: Mapping de tags par Transfer Learning

## CONTEXTE
Tu analyses un document administratif français (${docType}).
Tu as un TEMPLATE DE RÉFÉRENCE avec des tags {{TAG}} déjà placés.
Tu dois placer ces mêmes tags dans un DOCUMENT CIBLE similaire.

## MÉTHODE (OBLIGATOIRE)
Pour chaque tag, tu as appris son CONTEXTE dans le template.
Tu dois trouver le MÊME CONTEXTE dans le document cible.

## APPRENTISSAGE DU TEMPLATE (Few-Shot)
${fewShotExamples}

## DOCUMENT CIBLE - Paragraphes disponibles
\`\`\`json
${JSON.stringify(targetList, null, 2)}
\`\`\`

## TAGS À PLACER
${tagsToMap.join(', ')}

## RÈGLES D'INSERTION
| Situation | insertionPoint |
|-----------|----------------|
| Paragraphe finit par ":" | "after_colon" |
| Cellule de tableau (isCell=true) | "table_cell" |
| Paragraphe vide hors tableau | "replace_empty" |
| Autre | "inline" |

## FORMAT DE RÉPONSE (JSON STRICT)
\`\`\`json
{
  "matches": [
    {"tag": "NOM_TAG", "targetIdx": 0, "confidence": 0.9, "insertionPoint": "after_colon", "reason": "court"}
  ]
}
\`\`\`

## CONTRAINTES
- targetIdx = un des "idx" listés ci-dessus
- confidence >= 0.7
- Réponds UNIQUEMENT avec le JSON, rien d'autre`;
}
/**
 * Construit les exemples Few-Shot à partir des contextes de tags.
 * Chaque exemple montre: "Ce tag était dans CE contexte"
 */
function buildFewShotExamples(contexts, targetList) {
    const examples = [];
    for (const ctx of contexts) {
        // Trouver le meilleur candidat dans la cible
        const candidate = findBestCandidate(ctx, targetList);
        const example = `
### Tag: {{${ctx.tag}}}
- **Contexte template**: "${ctx.labelBefore.substring(0, 60)}"
- **Type**: ${ctx.type}
- **Section**: ${ctx.section || 'N/A'}
${candidate ? `- **Candidat cible probable**: idx=${candidate.idx} ("${candidate.text.substring(0, 40)}...")` : '- **Candidat**: À trouver dans les paragraphes'}`;
        examples.push(example);
    }
    return examples.join('\n');
}
/**
 * Trouve le meilleur candidat dans la liste cible pour un contexte donné.
 * Utilise une correspondance sémantique simple.
 */
function findBestCandidate(ctx, targetList) {
    const labelLower = ctx.labelBefore.toLowerCase();
    // Mots-clés à chercher dans le label
    const keywords = extractKeywords(labelLower);
    if (keywords.length === 0)
        return null;
    // Chercher le paragraphe qui contient le plus de mots-clés
    let bestMatch = null;
    let bestScore = 0;
    for (const p of targetList) {
        const textLower = p.text.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
            if (textLower.includes(kw)) {
                score += kw.length; // Pondérer par longueur du mot
            }
        }
        // Bonus si finit par ":" (label)
        if (p.endsWithColon)
            score += 5;
        // Bonus si même section
        if (ctx.section && p.section === ctx.section)
            score += 3;
        if (score > bestScore) {
            bestScore = score;
            bestMatch = p;
        }
    }
    // Retourner seulement si score significatif
    return bestScore >= 5 ? bestMatch : null;
}
/**
 * Extrait les mots-clés significatifs d'un label.
 */
function extractKeywords(label) {
    // Mots à ignorer
    const stopWords = new Set([
        'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'à', 'au', 'aux',
        'en', 'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'ce', 'cette', 'ces',
        'est', 'sont', 'être', 'avoir', 'qui', 'que', 'dont', 'où'
    ]);
    return label
        .replace(/[^a-zàâäéèêëïîôùûç\s]/gi, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w));
}
function prepareTargetParagraphs(paragraphs) {
    return paragraphs
        .filter(p => !p.hasExistingTag)
        .slice(0, MAX_PARAGRAPHS)
        .map(p => ({
        idx: p.index,
        text: p.text.substring(0, 80),
        section: p.section || '',
        isCell: p.isTableCell,
        isEmpty: p.text.trim().length === 0,
        endsWithColon: p.text.trim().endsWith(':'),
        hasCheckbox: p.text.includes('FORMCHECKBOX') || /[☐☑□✓✔]/.test(p.text),
    }))
        .sort((a, b) => a.idx - b.idx);
}
// ============================================================================
// SUPPORT DES CHECKBOXES
// ============================================================================
/**
 * Génère la section Few-Shot pour les checkboxes.
 *
 * @param templateCheckboxes - Checkboxes extraites du template
 * @param targetCheckboxes - Checkboxes extraites de la cible
 * @param pairs - Paires Oui/Non identifiées
 * @returns Section du prompt pour les checkboxes
 */
function generateCheckboxFewShot(templateCheckboxes, targetCheckboxes, pairs) {
    if (templateCheckboxes.length === 0) {
        return '';
    }
    const examples = [];
    // Exemples pour chaque checkbox du template
    for (const cb of templateCheckboxes) {
        const status = cb.checked ? '☑ COCHÉ' : '☐ NON COCHÉ';
        // Trouver le candidat correspondant dans la cible
        const candidate = findMatchingCheckbox(cb, targetCheckboxes);
        const example = `
### Checkbox: ${status}
- **Label template**: "${cb.label.substring(0, 50)}"
- **Type**: ${cb.type}
- **Index template**: ${cb.index}
${candidate ? `- **Candidat cible**: idx=${candidate.index} ("${candidate.label.substring(0, 40)}...")` : '- **Candidat**: À trouver'}`;
        examples.push(example);
    }
    // Ajouter les paires Oui/Non
    let pairsSection = '';
    if (pairs.length > 0) {
        pairsSection = `

### Paires Oui/Non détectées (${pairs.length})
${pairs.map(p => `- "${p.question}": ${p.value === true ? 'OUI coché' : p.value === false ? 'NON coché' : 'aucun coché'}`).join('\n')}
`;
    }
    return `
## CHECKBOXES (Few-Shot)
${examples.join('\n')}
${pairsSection}
## RÈGLES CHECKBOXES
- Pour les checkboxes, utilise insertionPoint: "checkbox"
- Indique l'état avec "checked": true ou false
- Les paires Oui/Non génèrent UN tag avec valeur booléenne
`;
}
/**
 * Trouve une checkbox correspondante dans la cible.
 * Gère spécialement les checkboxes Oui/Non.
 */
function findMatchingCheckbox(templateCb, targetCheckboxes) {
    const templateLabel = normalizeCheckboxLabel(templateCb.label);
    // Cas spécial: checkbox "Oui" ou "Non"
    if (isOuiLabel(templateLabel)) {
        // Trouver une checkbox "Oui" dans la cible
        const ouiMatch = targetCheckboxes.find(cb => isOuiLabel(normalizeCheckboxLabel(cb.label)));
        if (ouiMatch)
            return ouiMatch;
    }
    if (isNonLabel(templateLabel)) {
        // Trouver une checkbox "Non" dans la cible
        const nonMatch = targetCheckboxes.find(cb => isNonLabel(normalizeCheckboxLabel(cb.label)));
        if (nonMatch)
            return nonMatch;
    }
    // Matching par mots-clés pour les autres checkboxes
    const templateWords = templateLabel.split(/\s+/).filter(w => w.length >= 3);
    let bestMatch = null;
    let bestScore = 0;
    for (const targetCb of targetCheckboxes) {
        const targetLabel = normalizeCheckboxLabel(targetCb.label);
        let score = 0;
        for (const word of templateWords) {
            if (targetLabel.includes(word)) {
                score += word.length;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = targetCb;
        }
    }
    return bestScore >= 4 ? bestMatch : null;
}
/**
 * Normalise un label de checkbox.
 */
function normalizeCheckboxLabel(label) {
    return label
        .toLowerCase()
        .replace(/[☑☐✓✔□■○◯◻]/g, '')
        .replace(/[^\w\sàâäéèêëïîôùûç]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Vérifie si un label normalisé est "Oui".
 */
function isOuiLabel(label) {
    return label === 'oui' || label.startsWith('oui ') || label.startsWith('oui.') || /^\s*oui\s*$/.test(label);
}
/**
 * Vérifie si un label normalisé est "Non".
 */
function isNonLabel(label) {
    return label === 'non' || label.startsWith('non ') || label.startsWith('non.') || /^\s*non\s*$/.test(label);
}
// ============================================================================
// GÉNÉRATION DU PROMPT MAPPING DIRECT
// ============================================================================
/**
 * Génère le prompt pour le mapping direct sans template de référence.
 *
 * Cette stratégie est utilisée en fallback quand aucun template
 * de référence n'est disponible. L'IA se base uniquement sur
 * la sémantique des noms de tags et du contenu du document.
 *
 * @param targetParagraphs - Paragraphes du document cible
 * @param extractedTags - Tags à placer
 * @param docType - Type de document détecté
 * @returns Le prompt formaté pour le LLM
 */
function generateDirectMappingPrompt(targetParagraphs, extractedTags, docType) {
    // Préparer la liste des paragraphes avec métadonnées supplémentaires
    const targetList = targetParagraphs
        .filter(p => p.text.length > 3 && !p.hasExistingTag)
        .slice(0, 100)
        .map(p => ({
        idx: p.index,
        text: p.text.substring(0, 120),
        section: p.section,
        endsWithColon: p.text.trim().endsWith(':'),
        isCell: p.isTableCell,
    }));
    // Préparer les tags avec leurs types
    const availableTags = extractedTags.map(t => ({
        tag: t.tag,
        type: t.type,
    }));
    return `Tu es un expert en documents administratifs français (${docType}).

OBJECTIF: Mapper les tags JSON aux positions appropriées dans le document.

=== TAGS DISPONIBLES ===
${JSON.stringify(availableTags, null, 2)}

=== PARAGRAPHES DU DOCUMENT ===
${JSON.stringify(targetList, null, 2)}

=== RÈGLES DE MAPPING ===
1. Associe chaque tag au paragraphe dont le texte correspond sémantiquement:
   - "nom commercial" → NOM_COMMERCIAL
   - "adresse" / "siège social" → ADRESSE
   - "siret" / "siren" → SIRET
   - "email" / "courriel" → EMAIL
   - "téléphone" → TELEPHONE
   - "chiffre d'affaires" → CA_...
2. Priorité aux paragraphes qui se terminent par ":"
3. Pour les cellules de tableau (isCell: true), utilise "table_cell" comme insertionPoint
4. Confidence >= 0.7 minimum
5. insertionPoint:
   - "after_colon" si finit par ":" (hors tableau)
   - "table_cell" si isCell: true (SPÉCIFIQUE pour les cellules de tableau)
   - "replace_empty" si cellule vide (hors tableau)
   - "inline" sinon

=== RÉPONSE JSON ===
{
  "matches": [
    {"tag": "NOM_COMMERCIAL", "targetIdx": 15, "confidence": 0.9, "insertionPoint": "after_colon"}
  ]
}

IMPORTANT: Pour les paragraphes avec isCell: true, utilise toujours "table_cell" comme insertionPoint.

Réponds UNIQUEMENT en JSON valide.`;
}
// ============================================================================
// UTILITAIRES
// ============================================================================
/**
 * Vérifie et log un avertissement si le prompt est trop grand.
 * Retourne le prompt (potentiellement tronqué en mode strict).
 *
 * @param prompt - Le prompt généré
 * @param strict - Si true, tronque le prompt (non recommandé)
 * @returns Le prompt (peut être le même ou tronqué)
 */
function validatePromptSize(prompt, strict = false) {
    const size = prompt.length;
    if (size > MAX_PROMPT_SIZE) {
        console.warn(`⚠️ ATTENTION: Le prompt fait ${Math.round(size / 1000)}KB, ` +
            `ce qui dépasse la limite recommandée de ${MAX_PROMPT_SIZE / 1000}KB. ` +
            `Risque d'erreur 413 Request Entity Too Large.`);
        if (strict) {
            // Tronquer le prompt (non recommandé mais évite l'erreur 413)
            return prompt.substring(0, MAX_PROMPT_SIZE) + '\n\n[PROMPT TRONQUÉ]';
        }
    }
    return prompt;
}
