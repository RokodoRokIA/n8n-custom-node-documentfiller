"use strict";
/**
 * ============================================================================
 * SERVICE UNIFIED MAPPER - Mapping unifié Tags + Checkboxes + Tables
 * ============================================================================
 *
 * Ce service centralise TOUT le mapping IA en un seul appel LLM.
 * Il utilise le pattern Few-Shot Learning pour apprendre du template
 * et appliquer les mêmes patterns au document cible.
 *
 * ARCHITECTURE CLEAN CODE:
 * - 1 seul appel LLM au lieu de 2-N
 * - Pattern Few-Shot cohérent pour tags, checkboxes et tableaux
 * - Fallback intelligent si l'IA échoue
 *
 * @author Rokodo
 * @version 1.0.0 - Refactorisation architecture
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.performUnifiedMapping = performUnifiedMapping;
exports.applyCheckboxDecisions = applyCheckboxDecisions;
const checkbox_utils_1 = require("../../shared/utils/checkbox.utils");
const llm_service_1 = require("./llm.service");
// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================
/**
 * Effectue le mapping unifié Tags + Checkboxes en un seul appel LLM.
 *
 * Cette fonction:
 * 1. Génère un prompt Few-Shot unifié
 * 2. Appelle le LLM une seule fois
 * 3. Parse les résultats pour tags ET checkboxes
 * 4. Retourne un résultat consolidé
 *
 * @param model - Modèle LLM connecté
 * @param context - Contexte complet du mapping
 * @returns Résultat du mapping unifié
 */
async function performUnifiedMapping(model, context) {
    const { tagContexts, extractedTags, templateCheckboxes, templateCheckboxPairs, targetParagraphs, targetCheckboxes, docType, debug, } = context;
    const MAX_ITERATIONS = 3;
    let iteration = 0;
    let lastParsed = null;
    let correctionFeedback = '';
    if (debug) {
        console.log('\n🤖 === AGENT IA ReAct (Action-Observe-Verify-Correct) ===');
        console.log(`   Tags à placer: ${extractedTags.length}`);
        console.log(`   Max itérations: ${MAX_ITERATIONS}`);
    }
    while (iteration < MAX_ITERATIONS) {
        iteration++;
        if (debug) {
            console.log(`\n🔄 === ITÉRATION ${iteration}/${MAX_ITERATIONS} ===`);
        }
        // ============================================================
        // ACTION: Générer le prompt et appeler le LLM
        // ============================================================
        const prompt = buildUnifiedPrompt(tagContexts, extractedTags, targetParagraphs, templateCheckboxes, targetCheckboxes, templateCheckboxPairs, docType, correctionFeedback // Ajouter le feedback de correction si disponible
        );
        if (debug && iteration === 1) {
            console.log(`   Taille prompt: ${Math.round(prompt.length / 1000)}KB`);
        }
        try {
            const llmResponse = await (0, llm_service_1.callConnectedLLM)(model, prompt);
            if (debug) {
                console.log(`   Réponse LLM: ${llmResponse.length} chars`);
            }
            // ============================================================
            // OBSERVE: Parser la réponse
            // ============================================================
            const parsed = parseUnifiedResponse(llmResponse);
            lastParsed = parsed;
            if (debug) {
                console.log(`   Tags parsés: ${parsed.tagMatches.length}`);
                console.log(`   Checkboxes parsées: ${parsed.checkboxDecisions.length}`);
            }
            // Si pas de résultat, continuer avec fallback
            if (parsed.tagMatches.length === 0 && parsed.checkboxDecisions.length === 0) {
                if (debug) {
                    console.log('   ⚠️ Aucun résultat parsé');
                }
                break;
            }
            // ============================================================
            // VERIFY: Valider la cohérence des résultats (Tags + Checkboxes)
            // ============================================================
            const issues = validateMappingResults(parsed.tagMatches, tagContexts, targetParagraphs, parsed.checkboxDecisions, templateCheckboxPairs);
            if (issues.length === 0) {
                // ✅ Résultats validés - sortir de la boucle
                if (debug) {
                    console.log('   ✅ Validation OK - Résultats cohérents');
                }
                return {
                    ...parsed,
                    llmRawResponse: llmResponse,
                    mode: 'unified_ai',
                };
            }
            // ============================================================
            // CORRECT: Construire le feedback de correction
            // ============================================================
            if (debug) {
                console.log(`   ⚠️ ${issues.length} problème(s) détecté(s):`);
                issues.forEach(issue => console.log(`      - ${issue}`));
            }
            correctionFeedback = buildCorrectionFeedback(issues, parsed.tagMatches, parsed.checkboxDecisions);
            // Continuer à la prochaine itération
        }
        catch (error) {
            console.error(`   ❌ Erreur itération ${iteration}:`, error.message);
            break;
        }
    }
    // Si on arrive ici, utiliser le fallback sémantique (ou les derniers résultats partiels)
    if (debug) {
        console.log('\n⚠️ Max itérations atteint ou erreur, fallback sémantique...');
    }
    // Combiner les résultats LLM partiels avec le fallback sémantique
    const fallbackResult = performSemanticFallback(context);
    if (lastParsed && lastParsed.tagMatches.length > 0) {
        // Garder les matches LLM de haute confiance, compléter avec fallback
        const llmTags = new Set(lastParsed.tagMatches.map(m => m.tag));
        const additionalMatches = fallbackResult.tagMatches.filter(m => !llmTags.has(m.tag));
        return {
            tagMatches: [...lastParsed.tagMatches, ...additionalMatches],
            checkboxDecisions: lastParsed.checkboxDecisions.length > 0
                ? lastParsed.checkboxDecisions
                : fallbackResult.checkboxDecisions,
            llmRawResponse: undefined,
            mode: 'unified_ai', // Hybride LLM + fallback
        };
    }
    return fallbackResult;
}
/**
 * Valide la cohérence des résultats de mapping (Tags + Checkboxes).
 * Retourne une liste d'issues détectées.
 */
function validateMappingResults(tagMatches, tagContexts, targetParagraphs, checkboxDecisions = [], templateCheckboxPairs = []) {
    const issues = [];
    // 1. Vérifier les doublons (plusieurs tags au même paragraphe non-tableau)
    const paragraphCounts = new Map();
    for (const match of tagMatches) {
        const tags = paragraphCounts.get(match.targetParagraphIndex) || [];
        tags.push(match.tag);
        paragraphCounts.set(match.targetParagraphIndex, tags);
    }
    for (const [idx, tags] of paragraphCounts) {
        if (tags.length > 1) {
            const paragraph = targetParagraphs.find(p => p.index === idx);
            // Les doublons sont OK pour les cellules de tableau (DEBUT + FIN)
            if (!(paragraph === null || paragraph === void 0 ? void 0 : paragraph.isTableCell)) {
                // Vérifier si ces tags sont censés être ensemble (même cellule template)
                const contexts = tags.map(t => tagContexts.find(c => c.tag === t)).filter(Boolean);
                const sameCell = contexts.every(c => {
                    var _a, _b, _c;
                    return (c === null || c === void 0 ? void 0 : c.tableIndex) === ((_a = contexts[0]) === null || _a === void 0 ? void 0 : _a.tableIndex) &&
                        (c === null || c === void 0 ? void 0 : c.rowIndex) === ((_b = contexts[0]) === null || _b === void 0 ? void 0 : _b.rowIndex) &&
                        (c === null || c === void 0 ? void 0 : c.columnIndex) === ((_c = contexts[0]) === null || _c === void 0 ? void 0 : _c.columnIndex);
                });
                if (!sameCell) {
                    issues.push(`Tags ${tags.join(', ')} au même paragraphe ${idx} (non-tableau)`);
                }
            }
        }
    }
    // 2. Vérifier que les tags de même cellule template sont matchés ensemble
    const cellGroups = new Map();
    for (const ctx of tagContexts) {
        if (ctx.tableIndex !== undefined && ctx.rowIndex !== undefined && ctx.columnIndex !== undefined) {
            const key = `T${ctx.tableIndex}R${ctx.rowIndex}C${ctx.columnIndex}`;
            if (!cellGroups.has(key))
                cellGroups.set(key, []);
            cellGroups.get(key).push(ctx);
        }
    }
    for (const [cellKey, tagsInCell] of cellGroups) {
        if (tagsInCell.length > 1) {
            const matchedTo = new Set();
            for (const ctx of tagsInCell) {
                const match = tagMatches.find(m => m.tag === ctx.tag);
                if (match)
                    matchedTo.add(match.targetParagraphIndex);
            }
            if (matchedTo.size > 1) {
                const tagNames = tagsInCell.map(t => t.tag).join(', ');
                issues.push(`Tags de même cellule ${cellKey} (${tagNames}) matchés à ${matchedTo.size} paragraphes différents`);
            }
        }
    }
    // 3. Vérifier la cohérence SÉMANTIQUE des tags hors-tableau
    // Un tag comme NOM_COMMERCIAL doit être près d'un texte contenant "nom commercial"
    for (const match of tagMatches) {
        const ctx = tagContexts.find(c => c.tag === match.tag);
        if (!ctx)
            continue;
        // Ignorer les tags de tableau (déjà validés par position)
        if (ctx.tableIndex !== undefined)
            continue;
        const targetParagraph = targetParagraphs.find(p => p.index === match.targetParagraphIndex);
        if (!targetParagraph)
            continue;
        // Extraire les mots-clés du label template
        const labelKeywords = extractSemanticKeywords(ctx.labelBefore);
        const targetText = targetParagraph.text.toLowerCase();
        // Calculer le score de correspondance sémantique
        let matchScore = 0;
        let matchedKeywords = [];
        for (const kw of labelKeywords) {
            if (targetText.includes(kw)) {
                matchScore += kw.length;
                matchedKeywords.push(kw);
            }
        }
        // Si aucun mot-clé ne correspond, c'est probablement une erreur
        if (labelKeywords.length >= 2 && matchScore < 4) {
            issues.push(`Tag {{${match.tag}}} (label: "${ctx.labelBefore.substring(0, 30)}...") ` +
                `placé au paragraphe "${targetParagraph.text.substring(0, 40)}..." - ` +
                `Aucun mot-clé correspondant (attendu: ${labelKeywords.slice(0, 3).join(', ')})`);
        }
    }
    // 4. Vérifier la couverture des tags critiques
    const matchedTags = new Set(tagMatches.map(m => m.tag));
    const missingTags = tagContexts.filter(c => !matchedTags.has(c.tag));
    if (missingTags.length > tagContexts.length * 0.3) {
        issues.push(`${missingTags.length}/${tagContexts.length} tags non matchés`);
    }
    // 5. Vérifier les CHECKBOXES - Paires Oui/Non
    if (checkboxDecisions.length > 0) {
        // Détecter les paires Oui/Non consécutives
        for (let i = 0; i < checkboxDecisions.length - 1; i++) {
            const current = checkboxDecisions[i];
            const next = checkboxDecisions[i + 1];
            const currentLabel = current.label.toLowerCase().trim();
            const nextLabel = next.label.toLowerCase().trim();
            // Vérifier si c'est une paire Oui/Non
            const isOuiNonPair = (currentLabel === 'oui' && nextLabel === 'non') ||
                (currentLabel === 'non' && nextLabel === 'oui');
            if (isOuiNonPair) {
                // Les deux ne doivent pas être cochées
                if (current.shouldBeChecked && next.shouldBeChecked) {
                    issues.push(`Checkboxes Oui/Non (idx ${current.targetIndex} + ${next.targetIndex}): ` +
                        `les deux sont cochées - une seule doit l'être`);
                }
                // Au moins une doit être cochée (optionnel, dépend du contexte)
                // if (!current.shouldBeChecked && !next.shouldBeChecked) {
                //     issues.push(`Paire Oui/Non (idx ${current.targetIndex} + ${next.targetIndex}): aucune cochée`);
                // }
            }
        }
        // Vérifier la cohérence avec les paires template
        for (const pair of templateCheckboxPairs) {
            // Trouver les décisions correspondantes
            const ouiDecision = checkboxDecisions.find(d => d.label.toLowerCase().includes('oui'));
            const nonDecision = checkboxDecisions.find(d => d.label.toLowerCase().includes('non'));
            if (ouiDecision && nonDecision) {
                // Vérifier que l'état correspond au template
                if (pair.value === true && !ouiDecision.shouldBeChecked) {
                    issues.push(`Checkbox "Oui" devrait être cochée (template: ${pair.question.substring(0, 30)}...)`);
                }
                if (pair.value === false && !nonDecision.shouldBeChecked) {
                    issues.push(`Checkbox "Non" devrait être cochée (template: ${pair.question.substring(0, 30)}...)`);
                }
            }
        }
    }
    return issues;
}
/**
 * Extrait les mots-clés sémantiques significatifs d'un label.
 */
function extractSemanticKeywords(label) {
    const stopWords = new Set([
        'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'à', 'au', 'aux',
        'en', 'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'ce', 'cette', 'ces',
        'est', 'sont', 'être', 'avoir', 'qui', 'que', 'dont', 'où',
    ]);
    return label
        .toLowerCase()
        .replace(/[^a-zàâäéèêëïîôùûç\s]/gi, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w));
}
/**
 * Construit le feedback de correction pour le LLM.
 */
function buildCorrectionFeedback(issues, currentMatches, checkboxDecisions = []) {
    let feedback = `\n## CORRECTION REQUISE\n\nTes réponses précédentes contiennent des erreurs:\n`;
    for (const issue of issues) {
        feedback += `- ❌ ${issue}\n`;
    }
    feedback += `\n### Règles rappelées:\n`;
    feedback += `- Les tags de la MÊME cellule template (ex: CA_N_DEBUT et CA_N_FIN) DOIVENT être matchés au MÊME paragraphe cible\n`;
    feedback += `- Chaque tag ne peut être utilisé qu'une fois\n`;
    feedback += `- Utilise la position de colonne pour les tableaux multi-colonnes\n`;
    feedback += `- **SÉMANTIQUE**: Un tag doit être placé près d'un texte contenant les mêmes mots-clés que son label template\n`;
    feedback += `  Exemple: {{NOM_COMMERCIAL}} doit être après "Nom commercial:" pas après "Adresse:"\n`;
    feedback += `- **CHECKBOXES**: Pour les paires Oui/Non, UNE SEULE doit être cochée\n`;
    feedback += `  Copie l'état du template: si "Oui" est coché dans le template, coche "Oui" dans la cible\n`;
    feedback += `\n### Tes matches actuels (à corriger):\n`;
    for (const match of currentMatches.slice(0, 15)) {
        feedback += `- {{${match.tag}}} → idx=${match.targetParagraphIndex}\n`;
    }
    if (checkboxDecisions.length > 0) {
        feedback += `\n### Tes décisions checkboxes (à corriger):\n`;
        for (const cb of checkboxDecisions) {
            const state = cb.shouldBeChecked ? '☑' : '☐';
            feedback += `- ${state} idx=${cb.targetIndex} "${cb.label}"\n`;
        }
    }
    feedback += `\nAnalyse chaque élément et vérifie la cohérence avec le template.\n`;
    feedback += `Corrige tes erreurs et renvoie le JSON complet.\n`;
    return feedback;
}
// ============================================================================
// GÉNÉRATION DU PROMPT UNIFIÉ - FEW-SHOT LEARNING
// ============================================================================
/**
 * Construit le prompt unifié avec Few-Shot Learning.
 *
 * Le prompt montre des exemples concrets du template pour que l'IA
 * apprenne le pattern et l'applique au document cible.
 */
function buildUnifiedPrompt(tagContexts, extractedTags, targetParagraphs, templateCheckboxes, targetCheckboxes, templateCheckboxPairs, docType, correctionFeedback = '') {
    // === SECTION 0: CORRECTION FEEDBACK (si présent) ===
    const correctionSection = correctionFeedback
        ? `\n⚠️ ATTENTION - CORRECTION REQUISE ⚠️\n${correctionFeedback}\n\n---\n\n`
        : '';
    // === SECTION 1: CONTEXTE ===
    const contextSection = `${correctionSection}# TÂCHE: Mapping de document ${docType} par Transfer Learning

## CONTEXTE
Tu analyses un document administratif français.
Tu as un TEMPLATE DE RÉFÉRENCE avec des tags {{TAG}} et des checkboxes déjà configurées.
Tu dois placer ces mêmes tags et décider l'état des checkboxes dans le DOCUMENT CIBLE.

## MÉTHODE (OBLIGATOIRE)
Pour chaque élément, tu as appris son CONTEXTE dans le template.
Tu dois trouver le MÊME CONTEXTE dans le document cible.`;
    // === SECTION 2: APPRENTISSAGE TAGS (Few-Shot) ===
    const tagSection = buildTagFewShotSection(tagContexts, targetParagraphs, extractedTags);
    // === SECTION 3: APPRENTISSAGE CHECKBOXES (Few-Shot) ===
    const checkboxSection = buildCheckboxFewShotSection(templateCheckboxes, targetCheckboxes, templateCheckboxPairs);
    // === SECTION 4: PARAGRAPHES CIBLES ===
    const targetSection = buildTargetSection(targetParagraphs, targetCheckboxes);
    // === SECTION 5: FORMAT DE RÉPONSE ===
    const responseFormat = buildResponseFormat(extractedTags, targetCheckboxes);
    return `${contextSection}

${tagSection}

${checkboxSection}

${targetSection}

${responseFormat}`;
}
/**
 * Construit la section Few-Shot pour les tags.
 */
function buildTagFewShotSection(tagContexts, targetParagraphs, extractedTags) {
    const limitedContexts = tagContexts.slice(0, 40);
    const examples = [];
    // Grouper les tags par cellule pour afficher les contraintes
    const cellGroups = new Map();
    for (const ctx of tagContexts) {
        if (ctx.tableIndex !== undefined && ctx.rowIndex !== undefined && ctx.columnIndex !== undefined) {
            const key = `T${ctx.tableIndex}R${ctx.rowIndex}C${ctx.columnIndex}`;
            if (!cellGroups.has(key))
                cellGroups.set(key, []);
            cellGroups.get(key).push(ctx);
        }
    }
    for (const ctx of limitedContexts) {
        // Trouver un candidat probable dans la cible
        const candidate = findBestCandidate(ctx, targetParagraphs);
        const candidateInfo = candidate
            ? `idx=${candidate.index} ("${candidate.text.substring(0, 40)}...")`
            : 'À trouver';
        // Info de position pour les tableaux
        let positionInfo = '';
        if (ctx.tableIndex !== undefined) {
            positionInfo = `, Position: Table${ctx.tableIndex} Row${ctx.rowIndex} Col${ctx.columnIndex}`;
            // Vérifier si d'autres tags sont dans la même cellule
            const cellKey = `T${ctx.tableIndex}R${ctx.rowIndex}C${ctx.columnIndex}`;
            const sameCell = cellGroups.get(cellKey) || [];
            if (sameCell.length > 1) {
                const otherTags = sameCell.filter(t => t.tag !== ctx.tag).map(t => t.tag);
                positionInfo += ` [MÊME CELLULE QUE: ${otherTags.join(', ')}]`;
            }
        }
        examples.push(`### {{${ctx.tag}}}
- Contexte template: "${ctx.labelBefore.substring(0, 60)}"
- Type: ${ctx.type}${ctx.section ? `, Section: ${ctx.section}` : ''}${positionInfo}
- Candidat cible: ${candidateInfo}`);
    }
    const tagsToMap = extractedTags.map((t) => `{{${t.tag}}}`).join(', ');
    // Règles de validation
    const validationRules = `
### ⚠️ RÈGLES DE VALIDATION (OBLIGATOIRE)
1. **Tags de même cellule**: Si deux tags sont dans la MÊME CELLULE template (ex: CA_N_DEBUT et CA_N_FIN), ils DOIVENT être matchés au MÊME targetIdx
2. **Tableaux multi-colonnes**: Les tags CA_N, CA_N1, CA_N2 sont dans des COLONNES DIFFÉRENTES, ils doivent aller dans des cellules DIFFÉRENTES
3. **Pas de doublons**: Chaque tag doit avoir un targetIdx unique SAUF si les tags partagent une cellule template`;
    return `## APPRENTISSAGE TAGS (Few-Shot)

${examples.join('\n\n')}
${validationRules}

### Tags à placer
${tagsToMap}`;
}
/**
 * Construit la section Few-Shot pour les checkboxes.
 */
function buildCheckboxFewShotSection(templateCheckboxes, targetCheckboxes, pairs) {
    if (templateCheckboxes.length === 0) {
        return '## CHECKBOXES\nAucune checkbox dans le template.';
    }
    const examples = [];
    // Exemples de checkboxes du template
    for (const cb of templateCheckboxes.slice(0, 15)) {
        const status = cb.checked ? '☑ COCHÉ' : '☐ NON COCHÉ';
        const candidate = findMatchingCheckbox(cb, targetCheckboxes);
        const candidateInfo = candidate
            ? `idx=${candidate.index} ("${candidate.label.substring(0, 30)}...")`
            : 'À trouver';
        examples.push(`- ${status}: "${cb.label.substring(0, 50)}" → Candidat: ${candidateInfo}`);
    }
    // Paires Oui/Non
    let pairsSection = '';
    if (pairs.length > 0) {
        const pairsExamples = pairs.slice(0, 5).map((p) => {
            const answer = p.value === true ? 'OUI coché' : p.value === false ? 'NON coché' : 'aucun';
            return `- "${p.question.substring(0, 40)}": ${answer}`;
        });
        pairsSection = `

### Paires Oui/Non détectées
${pairsExamples.join('\n')}`;
    }
    return `## APPRENTISSAGE CHECKBOXES (Few-Shot)

### Exemples du template
${examples.join('\n')}
${pairsSection}

### Règles
- Pour les paires Oui/Non: une seule doit être cochée
- Analyse le contenu du document pour décider
- En cas de doute: NE COCHE PAS`;
}
/**
 * Construit la section des paragraphes cibles.
 */
function buildTargetSection(targetParagraphs, targetCheckboxes) {
    // Filtrer et limiter les paragraphes
    const paragraphs = targetParagraphs
        .filter((p) => !p.hasExistingTag && p.text.length > 2)
        .slice(0, 80)
        .map((p) => ({
        idx: p.index,
        text: p.text.substring(0, 80),
        section: p.section || '',
        isCell: p.isTableCell,
        endsWithColon: p.text.trim().endsWith(':'),
    }));
    // Checkboxes cibles
    const checkboxes = targetCheckboxes.slice(0, 20).map((cb) => ({
        idx: cb.index,
        label: cb.label.substring(0, 60),
        currentState: cb.checked ? 'coché' : 'non coché',
        type: cb.type,
    }));
    return `## DOCUMENT CIBLE

### Paragraphes disponibles
\`\`\`json
${JSON.stringify(paragraphs, null, 2)}
\`\`\`

${checkboxes.length > 0
        ? `### Checkboxes à analyser
\`\`\`json
${JSON.stringify(checkboxes, null, 2)}
\`\`\``
        : ''}`;
}
/**
 * Construit le format de réponse attendu.
 */
function buildResponseFormat(extractedTags, targetCheckboxes) {
    const hasCheckboxes = targetCheckboxes.length > 0;
    return `## RÈGLES D'INSERTION

| Situation | insertionPoint |
|-----------|----------------|
| Paragraphe finit par ":" | "after_colon" |
| Cellule de tableau (isCell=true) | "table_cell" |
| Paragraphe vide hors tableau | "replace_empty" |
| Autre | "inline" |

## FORMAT DE RÉPONSE (JSON STRICT)

\`\`\`json
{
  "tags": [
    {"tag": "NOM_TAG", "targetIdx": 0, "confidence": 0.9, "insertionPoint": "after_colon", "reason": "court"}
  ]${hasCheckboxes
        ? `,
  "checkboxes": [
    {"targetIdx": 0, "checked": true, "confidence": 0.9, "reason": "court"}
  ]`
        : ''}
}
\`\`\`

## CONTRAINTES
- targetIdx = un des "idx" listés ci-dessus
- confidence >= 0.7
- Réponds UNIQUEMENT avec le JSON, rien d'autre`;
}
// ============================================================================
// PARSING DE LA RÉPONSE UNIFIÉE
// ============================================================================
/**
 * Parse la réponse unifiée du LLM.
 */
function parseUnifiedResponse(response) {
    const result = {
        tagMatches: [],
        checkboxDecisions: [],
    };
    if (!response || typeof response !== 'string') {
        console.warn('⚠️ parseUnifiedResponse: Réponse vide');
        return result;
    }
    // Extraire le JSON
    const json = extractJSON(response);
    if (!json) {
        console.warn('⚠️ parseUnifiedResponse: Aucun JSON trouvé');
        return result;
    }
    try {
        const parsed = JSON.parse(json);
        // Parser les tags
        const tags = parsed.tags || parsed.matches || [];
        if (Array.isArray(tags)) {
            for (const item of tags) {
                const match = validateTagMatch(item);
                if (match) {
                    result.tagMatches.push(match);
                }
            }
        }
        // Parser les checkboxes
        const checkboxes = parsed.checkboxes || parsed.checkboxDecisions || [];
        if (Array.isArray(checkboxes)) {
            for (const item of checkboxes) {
                const decision = validateCheckboxDecision(item);
                if (decision) {
                    result.checkboxDecisions.push(decision);
                }
            }
        }
        console.log(`✅ Parsing: ${result.tagMatches.length} tags, ${result.checkboxDecisions.length} checkboxes`);
    }
    catch (error) {
        console.error('❌ Erreur parsing JSON:', error.message);
    }
    return result;
}
/**
 * Extrait le JSON de la réponse.
 */
function extractJSON(response) {
    const cleaned = response.trim();
    // Stratégie 1: Bloc Markdown
    const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        const content = markdownMatch[1].trim();
        if (content.startsWith('{'))
            return content;
    }
    // Stratégie 2: JSON brut
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
        return cleaned.substring(jsonStart, jsonEnd + 1);
    }
    return null;
}
/**
 * Valide et normalise un match de tag.
 */
function validateTagMatch(item) {
    var _a;
    if (!item.tag || typeof item.tag !== 'string')
        return null;
    const idx = ((_a = item.targetIdx) !== null && _a !== void 0 ? _a : item.targetParagraphIndex);
    if (idx === undefined || typeof idx !== 'number' || idx < 0)
        return null;
    const confidence = item.confidence || 0.8;
    if (confidence < 0.7)
        return null;
    const insertionPoint = normalizeInsertionPoint(item.insertionPoint);
    return {
        tag: item.tag,
        targetParagraphIndex: idx,
        confidence,
        insertionPoint,
        reason: item.reason || undefined,
    };
}
/**
 * Valide et normalise une décision de checkbox.
 */
function validateCheckboxDecision(item) {
    var _a, _b, _c;
    const idx = ((_b = (_a = item.targetIdx) !== null && _a !== void 0 ? _a : item.targetIndex) !== null && _b !== void 0 ? _b : item.idx);
    if (idx === undefined || typeof idx !== 'number' || idx < 0)
        return null;
    const checked = (_c = item.checked) !== null && _c !== void 0 ? _c : item.shouldBeChecked;
    if (checked === undefined)
        return null;
    const confidence = item.confidence || 0.8;
    if (confidence < 0.7)
        return null;
    return {
        targetIndex: idx,
        label: item.label || '',
        shouldBeChecked: Boolean(checked),
        confidence,
        reason: item.reason || undefined,
    };
}
/**
 * Normalise le point d'insertion.
 */
function normalizeInsertionPoint(point) {
    const valid = ['after_colon', 'table_cell', 'replace_empty', 'inline', 'checkbox'];
    if (point && valid.includes(point)) {
        return point;
    }
    return 'after_colon';
}
// ============================================================================
// FONCTIONS UTILITAIRES - SCORING SÉMANTIQUE
// ============================================================================
/**
 * Trouve le meilleur candidat pour un tag dans les paragraphes cibles.
 */
function findBestCandidate(ctx, targetParagraphs, usedParagraphs = new Set()) {
    const labelLower = ctx.labelBefore.toLowerCase();
    const keywords = extractKeywords(labelLower);
    if (keywords.length === 0)
        return null;
    let bestMatch = null;
    let bestScore = 0;
    for (const p of targetParagraphs) {
        if (p.hasExistingTag)
            continue;
        if (usedParagraphs.has(p.index))
            continue;
        const textLower = p.text.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
            if (textLower.includes(kw)) {
                score += kw.length;
            }
        }
        // Bonus
        if (p.text.trim().endsWith(':'))
            score += 5;
        if (ctx.section && p.section === ctx.section)
            score += 3;
        if (ctx.type === 'table_cell' && p.isTableCell)
            score += 5;
        // Bonus pour matching de row header (pour les tableaux)
        if (p.rowHeader && ctx.labelBefore.includes(p.rowHeader.substring(0, 20))) {
            score += 10;
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = p;
        }
    }
    return bestScore >= 5 ? bestMatch : null;
}
/**
 * Trouve une checkbox correspondante.
 */
function findMatchingCheckbox(templateCb, targetCheckboxes) {
    const templateLabel = normalizeLabel(templateCb.label);
    // Cas Oui/Non
    if (isOuiLabel(templateLabel)) {
        return targetCheckboxes.find((cb) => isOuiLabel(normalizeLabel(cb.label))) || null;
    }
    if (isNonLabel(templateLabel)) {
        return targetCheckboxes.find((cb) => isNonLabel(normalizeLabel(cb.label))) || null;
    }
    // Matching par mots-clés
    const words = templateLabel.split(/\s+/).filter((w) => w.length >= 3);
    let bestMatch = null;
    let bestScore = 0;
    for (const cb of targetCheckboxes) {
        const targetLabel = normalizeLabel(cb.label);
        let score = 0;
        for (const word of words) {
            if (targetLabel.includes(word))
                score += word.length;
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = cb;
        }
    }
    return bestScore >= 4 ? bestMatch : null;
}
/**
 * Extrait les mots-clés significatifs.
 */
function extractKeywords(label) {
    const stopWords = new Set([
        'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'à', 'au', 'aux',
        'en', 'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'ce', 'cette', 'ces',
    ]);
    return label
        .replace(/[^a-zàâäéèêëïîôùûç\s]/gi, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopWords.has(w));
}
/**
 * Normalise un label.
 */
function normalizeLabel(label) {
    return label
        .toLowerCase()
        .replace(/[☑☐✓✔□■○◯◻]/g, '')
        .replace(/[^\w\sàâäéèêëïîôùûç]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function isOuiLabel(label) {
    return label === 'oui' || label.startsWith('oui ') || /^\s*oui\s*$/.test(label);
}
function isNonLabel(label) {
    return label === 'non' || label.startsWith('non ') || /^\s*non\s*$/.test(label);
}
// ============================================================================
// FALLBACK SÉMANTIQUE (SANS LLM)
// ============================================================================
/**
 * Fallback quand le LLM échoue: matching sémantique basé sur les patterns.
 */
function performSemanticFallback(context) {
    console.log('🔄 Fallback vers matching sémantique...');
    const tagMatches = semanticTagMatching(context.tagContexts, context.targetParagraphs);
    const checkboxDecisions = semanticCheckboxMatching(context.templateCheckboxes, context.targetCheckboxes);
    console.log(`✅ Fallback: ${tagMatches.length} tags, ${checkboxDecisions.length} checkboxes`);
    return {
        tagMatches,
        checkboxDecisions,
        mode: 'fallback_semantic',
    };
}
/**
 * Matching sémantique des tags (fallback).
 * Utilise d'abord le matching par position pour les cellules de tableau,
 * puis le matching par mots-clés pour le reste.
 *
 * IMPORTANT: Les tags dans la MÊME cellule template (ex: CA_N_DEBUT et CA_N_FIN)
 * sont matchés à la MÊME cellule cible.
 */
function semanticTagMatching(tagContexts, targetParagraphs) {
    const matches = [];
    const usedParagraphs = new Set();
    const usedTags = new Set();
    // Phase 1: GROUPER les tags par cellule de tableau
    // Les tags de la même cellule (ex: CA_N_DEBUT + CA_N_FIN) doivent aller ensemble
    const cellGroups = new Map();
    for (const ctx of tagContexts) {
        if (ctx.tableIndex !== undefined && ctx.rowIndex !== undefined && ctx.columnIndex !== undefined) {
            const cellKey = `T${ctx.tableIndex}R${ctx.rowIndex}C${ctx.columnIndex}`;
            if (!cellGroups.has(cellKey)) {
                cellGroups.set(cellKey, []);
            }
            cellGroups.get(cellKey).push(ctx);
        }
    }
    // Phase 2: Matching par POSITION pour chaque GROUPE de cellule
    for (const [cellKey, tagsInCell] of cellGroups) {
        // Prendre le premier tag pour trouver la position
        const firstTag = tagsInCell[0];
        if (!firstTag || usedTags.has(firstTag.tag))
            continue;
        const positionMatch = targetParagraphs.find((p) => p.isTableCell &&
            p.tableIndex === firstTag.tableIndex &&
            p.rowIndex === firstTag.rowIndex &&
            p.columnIndex === firstTag.columnIndex &&
            !usedParagraphs.has(p.index));
        if (positionMatch) {
            // Matcher TOUS les tags de cette cellule au MÊME paragraphe cible
            for (const ctx of tagsInCell) {
                if (usedTags.has(ctx.tag))
                    continue;
                matches.push({
                    tag: ctx.tag,
                    targetParagraphIndex: positionMatch.index,
                    confidence: 0.95,
                    insertionPoint: 'table_cell',
                    reason: `Position exacte: ${cellKey} (${tagsInCell.length} tags dans cette cellule)`,
                });
                usedTags.add(ctx.tag);
            }
            usedParagraphs.add(positionMatch.index);
        }
    }
    // Phase 3: Matching par MOTS-CLÉS pour les tags restants (hors tableau)
    for (const ctx of tagContexts) {
        if (usedTags.has(ctx.tag))
            continue;
        const candidate = findBestCandidate(ctx, targetParagraphs, usedParagraphs);
        if (candidate) {
            let insertionPoint = 'inline';
            if (candidate.text.trim().endsWith(':'))
                insertionPoint = 'after_colon';
            else if (candidate.isTableCell)
                insertionPoint = 'table_cell';
            else if (candidate.text.trim().length < 5)
                insertionPoint = 'replace_empty';
            matches.push({
                tag: ctx.tag,
                targetParagraphIndex: candidate.index,
                confidence: 0.75,
                insertionPoint,
            });
            usedParagraphs.add(candidate.index);
            usedTags.add(ctx.tag);
        }
    }
    return matches;
}
/**
 * Matching sémantique des checkboxes (fallback).
 */
function semanticCheckboxMatching(templateCheckboxes, targetCheckboxes) {
    const decisions = [];
    const usedTargets = new Set();
    for (const templateCb of templateCheckboxes) {
        const match = findMatchingCheckbox(templateCb, targetCheckboxes);
        if (match && !usedTargets.has(match.index)) {
            decisions.push({
                targetIndex: match.index,
                label: match.label,
                shouldBeChecked: templateCb.checked, // Copie l'état du template
                confidence: 0.75,
                reason: 'Fallback: copie état template',
            });
            usedTargets.add(match.index);
        }
    }
    return decisions;
}
// ============================================================================
// APPLICATION DES RÉSULTATS
// ============================================================================
/**
 * Applique les décisions de checkboxes au XML.
 */
function applyCheckboxDecisions(xml, decisions, targetCheckboxes) {
    // Convertir les décisions en CheckboxMatch
    const matches = [];
    for (const decision of decisions) {
        const targetCb = targetCheckboxes.find((cb) => cb.index === decision.targetIndex);
        if (!targetCb)
            continue;
        const templateCb = {
            ...targetCb,
            checked: decision.shouldBeChecked,
        };
        matches.push({
            templateCheckbox: templateCb,
            targetCheckbox: targetCb,
            newState: decision.shouldBeChecked,
        });
    }
    return (0, checkbox_utils_1.applyCheckboxesToXml)(xml, matches);
}
