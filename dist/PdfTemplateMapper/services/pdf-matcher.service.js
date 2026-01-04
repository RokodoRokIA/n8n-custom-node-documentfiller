"use strict";
/**
 * ============================================================================
 * SERVICE PDF MATCHER - Matching LLM avec positions PDF
 * ============================================================================
 *
 * Ce service utilise un LLM pour matcher les champs d'un template PDF
 * avec les champs d'un document cible. Il exploite les positions absolues
 * pour un matching plus précis.
 *
 * STRATÉGIES DE MATCHING:
 * 1. Position directe: Si les positions sont très proches (±10px)
 * 2. Position relative: Si les positions relatives sont similaires (% de page)
 * 3. Sémantique: Si les labels sont sémantiquement équivalents
 * 4. LLM hybride: Combine position + sémantique pour les cas ambigus
 *
 * @author Rokodo
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPdfMatchingAgent = runPdfMatchingAgent;
exports.findBestMatch = findBestMatch;
exports.validateMatches = validateMatches;
const llm_service_1 = require("../../TemplateMapper/services/llm.service");
// ============================================================================
// CONFIGURATION
// ============================================================================
/** Score minimum pour un match direct par position */
const POSITION_MATCH_THRESHOLD = 0.8;
/** Score minimum pour un match sémantique */
const SEMANTIC_MATCH_THRESHOLD = 0.7;
/** Tolérance de position par défaut (en points) */
const DEFAULT_POSITION_TOLERANCE = 15;
// ============================================================================
// AGENT REACT POUR MATCHING PDF
// ============================================================================
/**
 * Lance l'agent ReAct pour matcher les champs PDF.
 *
 * @param model - Modèle LLM connecté
 * @param templateContent - Contenu du template extrait
 * @param targetContent - Contenu du document cible extrait
 * @param options - Options de mapping
 * @returns Résultats du matching
 */
async function runPdfMatchingAgent(model, templateContent, targetContent, options) {
    var _a;
    const { positionTolerance = DEFAULT_POSITION_TOLERANCE, debug = false } = options;
    if (debug) {
        console.log('\n🤖 Agent PDF Matcher démarré');
        console.log(`   Tags template: ${((_a = templateContent.tags) === null || _a === void 0 ? void 0 : _a.length) || 0}`);
        console.log(`   Champs cible: ${targetContent.pages.reduce((sum, p) => sum + p.fields.length, 0)}`);
    }
    // Initialiser l'état de l'agent
    const state = {
        iteration: 0,
        maxIterations: 3,
        expectedPlacements: buildExpectedPlacements(templateContent),
        appliedPlacements: [],
        issues: [],
        satisfaction: 0,
    };
    const matches = [];
    // Phase 1: Matching par position directe
    if (debug)
        console.log('\n   Phase 1: Matching par position...');
    const positionMatches = matchByPosition(state.expectedPlacements, targetContent, positionTolerance);
    matches.push(...positionMatches);
    updatePlacementStatus(state, positionMatches, 'matched');
    if (debug) {
        console.log(`   → ${positionMatches.length} matchs par position`);
    }
    // Phase 2: Matching sémantique pour les non-matchés
    const unmatchedTags = state.expectedPlacements.filter(p => p.status === 'pending');
    if (unmatchedTags.length > 0 && debug) {
        console.log(`\n   Phase 2: Matching sémantique (${unmatchedTags.length} restants)...`);
    }
    const semanticMatches = matchBySemantic(unmatchedTags, targetContent);
    matches.push(...semanticMatches);
    updatePlacementStatus(state, semanticMatches, 'matched');
    if (debug) {
        console.log(`   → ${semanticMatches.length} matchs sémantiques`);
    }
    // Phase 3: LLM pour les cas difficiles
    const stillUnmatched = state.expectedPlacements.filter(p => p.status === 'pending');
    if (stillUnmatched.length > 0) {
        if (debug) {
            console.log(`\n   Phase 3: LLM matching (${stillUnmatched.length} restants)...`);
        }
        const llmMatches = await matchWithLLM(model, stillUnmatched, targetContent, templateContent, debug);
        matches.push(...llmMatches);
        updatePlacementStatus(state, llmMatches, 'matched');
        if (debug) {
            console.log(`   → ${llmMatches.length} matchs LLM`);
        }
    }
    // Calculer la satisfaction
    const matchedCount = state.expectedPlacements.filter(p => p.status === 'matched').length;
    state.satisfaction = Math.round((matchedCount / state.expectedPlacements.length) * 100);
    // Identifier les problèmes
    for (const placement of state.expectedPlacements) {
        if (placement.status === 'pending') {
            state.issues.push({
                type: 'no_match',
                severity: 'warning',
                tag: placement.tag,
                description: `Aucun match trouvé pour {{${placement.tag}}}`,
                position: placement.expectedPosition,
            });
        }
    }
    if (debug) {
        console.log(`\n   Résultat final: ${matches.length}/${state.expectedPlacements.length} matchs`);
        console.log(`   Satisfaction: ${state.satisfaction}%`);
    }
    return { matches, state };
}
// ============================================================================
// CONSTRUCTION DES PLACEMENTS ATTENDUS
// ============================================================================
/**
 * Construit la liste des placements attendus depuis le template.
 */
function buildExpectedPlacements(templateContent) {
    const placements = [];
    if (!templateContent.tags)
        return placements;
    for (const tag of templateContent.tags) {
        placements.push({
            tag: tag.tag,
            expectedPosition: {
                x: tag.position.x,
                y: tag.position.y,
                page: tag.position.page,
            },
            templateContext: {
                labelBefore: tag.context.textBefore,
                labelAfter: tag.context.textAfter,
            },
            status: 'pending',
        });
    }
    return placements;
}
/**
 * Met à jour le statut des placements après matching.
 */
function updatePlacementStatus(state, matches, newStatus) {
    for (const match of matches) {
        const placement = state.expectedPlacements.find(p => p.tag === match.tag);
        if (placement) {
            placement.status = newStatus;
        }
    }
}
// ============================================================================
// MATCHING PAR POSITION
// ============================================================================
/**
 * Match les tags par proximité de position.
 */
function matchByPosition(expectedPlacements, targetContent, tolerance) {
    const matches = [];
    for (const placement of expectedPlacements) {
        if (placement.status !== 'pending')
            continue;
        // Chercher les champs à la même position relative
        const targetPage = targetContent.pages.find(p => p.pageNumber === placement.expectedPosition.page);
        if (!targetPage)
            continue;
        // Calculer la position relative (% de la page)
        const templateRelX = placement.expectedPosition.x / targetPage.width;
        const templateRelY = placement.expectedPosition.y / targetPage.height;
        let bestMatch = null;
        let bestScore = 0;
        for (const field of targetPage.fields) {
            // Position relative du champ cible
            const targetRelX = field.inputZone.x / targetPage.width;
            const targetRelY = field.inputZone.y / targetPage.height;
            // Distance relative
            const relDistance = Math.sqrt(Math.pow(templateRelX - targetRelX, 2) +
                Math.pow(templateRelY - targetRelY, 2));
            // Score inversement proportionnel à la distance
            const score = Math.max(0, 1 - relDistance * 5);
            if (score > bestScore && score >= POSITION_MATCH_THRESHOLD) {
                bestScore = score;
                bestMatch = field;
            }
        }
        if (bestMatch) {
            matches.push({
                tag: placement.tag,
                targetField: bestMatch,
                confidence: bestScore,
                reason: 'Position relative similaire',
                placementPosition: {
                    x: bestMatch.inputZone.x,
                    y: bestMatch.inputZone.y,
                    page: bestMatch.inputZone.page,
                },
            });
        }
    }
    return matches;
}
// ============================================================================
// MATCHING SÉMANTIQUE
// ============================================================================
/**
 * Match les tags par similarité sémantique des labels.
 */
function matchBySemantic(expectedPlacements, targetContent) {
    const matches = [];
    // Collecter tous les champs cibles
    const allTargetFields = [];
    for (const page of targetContent.pages) {
        allTargetFields.push(...page.fields);
    }
    for (const placement of expectedPlacements) {
        if (placement.status !== 'pending')
            continue;
        // Extraire les mots-clés du contexte template
        const templateKeywords = extractKeywords(placement.templateContext.labelBefore);
        if (templateKeywords.length === 0)
            continue;
        let bestMatch = null;
        let bestScore = 0;
        for (const field of allTargetFields) {
            // Comparer avec le label du champ cible
            const fieldKeywords = extractKeywords(field.label);
            const score = calculateKeywordSimilarity(templateKeywords, fieldKeywords);
            if (score > bestScore && score >= SEMANTIC_MATCH_THRESHOLD) {
                bestScore = score;
                bestMatch = field;
            }
        }
        if (bestMatch) {
            matches.push({
                tag: placement.tag,
                targetField: bestMatch,
                confidence: bestScore,
                reason: `Labels similaires: "${placement.templateContext.labelBefore}" ≈ "${bestMatch.label}"`,
                placementPosition: {
                    x: bestMatch.inputZone.x,
                    y: bestMatch.inputZone.y,
                    page: bestMatch.inputZone.page,
                },
            });
        }
    }
    return matches;
}
/**
 * Extrait les mots-clés significatifs d'un texte.
 */
function extractKeywords(text) {
    const stopWords = new Set([
        'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'à', 'au', 'aux',
        'en', 'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'ce', 'cette', 'ces',
        'qui', 'que', 'dont', 'où', 'si', 'ne', 'pas', 'plus', 'moins',
    ]);
    return text
        .toLowerCase()
        .replace(/[^a-zàâäéèêëïîôùûç\s]/gi, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w));
}
/**
 * Calcule la similarité entre deux ensembles de mots-clés.
 */
function calculateKeywordSimilarity(keywords1, keywords2) {
    if (keywords1.length === 0 || keywords2.length === 0)
        return 0;
    let matches = 0;
    for (const kw1 of keywords1) {
        for (const kw2 of keywords2) {
            // Match exact ou partiel
            if (kw1 === kw2 || kw1.includes(kw2) || kw2.includes(kw1)) {
                matches++;
                break;
            }
        }
    }
    return matches / Math.max(keywords1.length, keywords2.length);
}
// ============================================================================
// MATCHING LLM
// ============================================================================
/**
 * Utilise le LLM pour matcher les cas difficiles.
 */
async function matchWithLLM(model, unmatchedPlacements, targetContent, templateContent, debug) {
    if (unmatchedPlacements.length === 0)
        return [];
    const prompt = buildLLMMatchingPrompt(unmatchedPlacements, targetContent, templateContent);
    if (debug) {
        console.log(`   Prompt LLM: ${Math.round(prompt.length / 1000)}KB`);
    }
    try {
        const response = await (0, llm_service_1.callConnectedLLM)(model, prompt);
        return parseLLMMatchingResponse(response, unmatchedPlacements, targetContent);
    }
    catch (error) {
        if (debug) {
            console.log(`   ❌ Erreur LLM: ${error.message}`);
        }
        return [];
    }
}
/**
 * Construit le prompt pour le matching LLM.
 */
function buildLLMMatchingPrompt(unmatchedPlacements, targetContent, _templateContent) {
    // Collecter les champs cibles disponibles
    const targetFields = [];
    for (const page of targetContent.pages) {
        for (const field of page.fields) {
            targetFields.push({
                id: field.id,
                label: field.label,
                page: field.inputZone.page,
                x: Math.round(field.inputZone.x),
                y: Math.round(field.inputZone.y),
            });
        }
    }
    const prompt = `# MATCHING DE CHAMPS PDF (Transfer Learning)

## CONTEXTE
Tu dois associer des tags d'un template PDF aux champs d'un document cible similaire.
Les documents sont du même type mais peuvent avoir des différences de mise en page.

## TAGS À MATCHER (${unmatchedPlacements.length})
${unmatchedPlacements.map(p => `- **{{${p.tag}}}**
  - Position template: page ${p.expectedPosition.page}, x=${Math.round(p.expectedPosition.x)}, y=${Math.round(p.expectedPosition.y)}
  - Contexte: "${p.templateContext.labelBefore}"`).join('\n')}

## CHAMPS CIBLES DISPONIBLES (${targetFields.length})
\`\`\`json
${JSON.stringify(targetFields.slice(0, 40), null, 2)}
\`\`\`

## INSTRUCTIONS
1. Pour chaque tag, trouve le champ cible qui correspond le mieux
2. Base-toi sur:
   - La similarité sémantique du label (même concept = match)
   - La position relative dans la page (haut/milieu/bas, gauche/centre/droite)
   - Le type de champ attendu
3. Ne force pas un match si aucun champ ne correspond

## FORMAT DE RÉPONSE (JSON STRICT)
\`\`\`json
{
  "matches": [
    {"tag": "NOM_TAG", "fieldId": "field_1_0", "confidence": 0.85, "reason": "explication courte"}
  ]
}
\`\`\`

RÉPONDS UNIQUEMENT AVEC LE JSON.`;
    return prompt;
}
/**
 * Parse la réponse du LLM pour le matching.
 */
function parseLLMMatchingResponse(response, _unmatchedPlacements, targetContent) {
    const results = [];
    // Extraire le JSON
    let json = null;
    const markdownMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        json = markdownMatch[1].trim();
    }
    else {
        const jsonStart = response.indexOf('{');
        const jsonEnd = response.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            json = response.substring(jsonStart, jsonEnd + 1);
        }
    }
    if (!json)
        return results;
    try {
        const parsed = JSON.parse(json);
        const matches = parsed.matches || [];
        // Créer un index des champs cibles
        const fieldIndex = new Map();
        for (const page of targetContent.pages) {
            for (const field of page.fields) {
                fieldIndex.set(field.id, field);
            }
        }
        for (const match of matches) {
            if (!match.tag || !match.fieldId)
                continue;
            const targetField = fieldIndex.get(match.fieldId);
            if (!targetField)
                continue;
            const confidence = typeof match.confidence === 'number' ? match.confidence : 0.7;
            if (confidence < 0.5)
                continue;
            results.push({
                tag: match.tag,
                targetField,
                confidence,
                reason: match.reason || 'LLM matching',
                placementPosition: {
                    x: targetField.inputZone.x,
                    y: targetField.inputZone.y,
                    page: targetField.inputZone.page,
                },
            });
        }
    }
    catch (error) {
        console.error('Erreur parsing réponse LLM:', error.message);
    }
    return results;
}
// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================
/**
 * Trouve le meilleur match pour un tag donné.
 */
function findBestMatch(tag, matches) {
    return matches
        .filter(m => m.tag === tag)
        .sort((a, b) => b.confidence - a.confidence)[0];
}
/**
 * Valide les matches pour éviter les conflits.
 */
function validateMatches(matches) {
    const valid = [];
    const usedFields = new Map(); // fieldId -> tag
    const conflicts = [];
    // Trier par confiance décroissante
    const sorted = [...matches].sort((a, b) => b.confidence - a.confidence);
    for (const match of sorted) {
        const fieldId = match.targetField.id;
        const existingTag = usedFields.get(fieldId);
        if (existingTag) {
            // Conflit détecté
            conflicts.push({
                tag1: existingTag,
                tag2: match.tag,
                fieldId,
            });
        }
        else {
            valid.push(match);
            usedFields.set(fieldId, match.tag);
        }
    }
    return { valid, conflicts };
}
