"use strict";
/**
 * ============================================================================
 * SERVICE SEGMENT MATCHER - Matching par segment pour meilleure précision
 * ============================================================================
 *
 * Ce service améliore le matching en divisant les documents en segments
 * logiques (tableaux, sections) et en matchant segment par segment.
 *
 * AVANTAGES DE LA SEGMENTATION :
 * 1. Précision accrue : Les tags CA vont uniquement dans le segment financier
 * 2. Performance LLM : Moins de tokens par appel (segment vs document entier)
 * 3. Moins d'erreurs : Évite les confusions entre sections similaires
 * 4. Débogage facile : On sait exactement quel segment pose problème
 *
 * FLUX DE TRAVAIL :
 * 1. Segmenter le template et le document cible
 * 2. Matcher les segments entre eux (template segment ↔ target segment)
 * 3. Pour chaque paire de segments matchés, générer un prompt ciblé
 * 4. Combiner les résultats de tous les segments
 *
 * @author Rokodo
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareSegmentMatchingPlan = prepareSegmentMatchingPlan;
exports.generateSegmentPrompt = generateSegmentPrompt;
exports.resetParagraphCache = resetParagraphCache;
exports.clearAllCaches = clearAllCaches;
exports.combineSegmentResults = combineSegmentResults;
exports.logMatchingPlan = logMatchingPlan;
exports.shouldUseSegmentation = shouldUseSegmentation;
const document_segmenter_utils_1 = require("../../shared/utils/document-segmenter.utils");
const shared_1 = require("../../shared");
// ============================================================================
// CACHE POUR LES PARAGRAPHES (SCOPE PAR EXÉCUTION)
// ============================================================================
/**
 * Cache pour stocker les paragraphes globaux du document cible.
 * Cela permet de réutiliser les mêmes paragraphes (avec index globaux)
 * pour tous les segments sans les ré-extraire.
 *
 * IMPORTANT: Ce cache est vidé automatiquement:
 * - Au début de chaque traitement via resetParagraphCache()
 * - Après chaque traitement via clearAllCaches()
 */
let globalTargetParagraphsCache = null;
let cachedTargetXml = null;
let cacheTimestamp = 0;
// Timeout du cache: 30 secondes (évite les données périmées)
const CACHE_TIMEOUT_MS = 30000;
// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================
/**
 * Prépare le plan de matching par segments.
 *
 * Cette fonction analyse les deux documents, les segmente, et prépare
 * les paires de segments à traiter par le LLM.
 *
 * @param templateXml - XML du document template (avec tags)
 * @param targetXml - XML du document cible (sans tags)
 * @param extractedTags - Liste des tags extraits du template
 * @returns Plan de matching avec les paires de segments
 *
 * @example
 * const plan = prepareSegmentMatchingPlan(templateXml, targetXml, extractedTags);
 * console.log(`${plan.matchedPairs.length} paires de segments à traiter`);
 *
 * for (const pair of plan.matchedPairs) {
 *   const prompt = generateSegmentPrompt(pair, docType);
 *   const response = await callLLM(prompt);
 *   // ... traiter la réponse
 * }
 */
function prepareSegmentMatchingPlan(templateXml, targetXml, extractedTags) {
    // Réinitialiser le cache des paragraphes pour ce nouveau document
    resetParagraphCache();
    // Étape 1: Segmenter les deux documents
    const templateResult = (0, document_segmenter_utils_1.segmentDocument)(templateXml, { strategy: 'hybrid' });
    const targetResult = (0, document_segmenter_utils_1.segmentDocument)(targetXml, { strategy: 'hybrid' });
    // Étape 2: Identifier les segments du template qui contiennent des tags
    const segmentsWithTags = templateResult.segments.filter((s) => s.tags.length > 0);
    // Étape 3: Matcher les segments template ↔ cible
    const segmentMatches = (0, document_segmenter_utils_1.matchSegments)(templateResult.segments, targetResult.segments);
    // Étape 4: Préparer les paires de segments
    const matchedPairs = [];
    const unmatchedTags = [];
    for (const templateSegment of segmentsWithTags) {
        const match = segmentMatches.get(templateSegment.id);
        if (match) {
            // Extraire les contextes de tags du segment template
            const tagContexts = extractTagContextsFromSegment(templateSegment);
            // Extraire les paragraphes du segment cible avec INDEX GLOBAUX
            // On passe le XML global pour que les index et positions soient globaux
            const targetParagraphs = extractParagraphsFromSegment(match.targetSegment, targetXml);
            matchedPairs.push({
                templateSegment,
                targetSegment: match.targetSegment,
                matchScore: match.score,
                tagsToTransfer: templateSegment.tags,
                tagContexts,
                targetParagraphs,
            });
        }
        else {
            // Pas de segment correspondant trouvé
            unmatchedTags.push(...templateSegment.tags);
        }
    }
    // Statistiques
    const stats = {
        totalTemplateSegments: templateResult.stats.totalSegments,
        totalTargetSegments: targetResult.stats.totalSegments,
        matchedSegments: matchedPairs.length,
        totalTagsToTransfer: matchedPairs.reduce((sum, p) => sum + p.tagsToTransfer.length, 0),
    };
    return { matchedPairs, unmatchedTags, stats };
}
// ============================================================================
// GÉNÉRATION DE PROMPT PAR SEGMENT
// ============================================================================
/**
 * Génère un prompt ciblé pour une paire de segments avec Few-Shot Learning.
 *
 * APPROCHE v3.0:
 * - Montre des exemples concrets pour chaque tag
 * - L'IA voit le contexte du template et doit trouver l'équivalent
 * - Format JSON strict et compact
 *
 * @param pair - La paire de segments (template + cible)
 * @param docType - Type de document (DC1, DC2, AE)
 * @returns Le prompt pour le LLM
 */
const MAX_SEGMENT_PARAGRAPHS = 60;
const MAX_SEGMENT_TAG_CONTEXTS = 30;
function generateSegmentPrompt(pair, docType) {
    const limitedContexts = pair.tagContexts.slice(0, MAX_SEGMENT_TAG_CONTEXTS);
    // Préparer les paragraphes cibles
    const targetList = pair.targetParagraphs
        .filter((p) => p.text.length > 2)
        .slice(0, MAX_SEGMENT_PARAGRAPHS)
        .map((p) => ({
        idx: p.index,
        text: p.text.substring(0, 60),
        isCell: p.isTableCell,
        endsWithColon: p.text.trim().endsWith(':'),
    }));
    // Plage d'index valides
    const minIdx = targetList.length > 0 ? Math.min(...targetList.map(p => p.idx)) : 0;
    const maxIdx = targetList.length > 0 ? Math.max(...targetList.map(p => p.idx)) : 0;
    // Construire les exemples Few-Shot
    const fewShotExamples = limitedContexts.map((tc) => {
        // Trouver le candidat le plus probable
        const candidate = findBestCandidateInSegment(tc, targetList);
        return `- {{${tc.tag}}}: template="${tc.labelBefore.substring(0, 40)}" → cible=${candidate ? `idx=${candidate.idx}` : '?'}`;
    }).join('\n');
    const segmentInfo = pair.templateSegment.sectionLetter
        ? `Section ${pair.templateSegment.sectionLetter}`
        : pair.templateSegment.title.substring(0, 30);
    return `# Mapping Segment: ${segmentInfo} (${docType})

## Apprentissage (template → cible)
${fewShotExamples}

## Paragraphes cibles disponibles (idx: ${minIdx}-${maxIdx})
\`\`\`json
${JSON.stringify(targetList, null, 2)}
\`\`\`

## Tags à placer
${pair.tagsToTransfer.join(', ')}

## Règles d'insertion
- endsWithColon=true → "after_colon"
- isCell=true → "table_cell"
- Sinon → "inline"

## Réponse (JSON uniquement)
\`\`\`json
{"matches": [{"tag": "X", "targetIdx": ${minIdx}, "confidence": 0.9, "insertionPoint": "after_colon", "reason": "..."}]}
\`\`\`

CONTRAINTE: targetIdx DOIT être entre ${minIdx} et ${maxIdx}. Réponds UNIQUEMENT en JSON.`;
}
/**
 * Trouve le meilleur candidat pour un tag dans les paragraphes du segment.
 */
function findBestCandidateInSegment(ctx, paragraphs) {
    const labelLower = ctx.labelBefore.toLowerCase();
    const words = labelLower.split(/\s+/).filter(w => w.length >= 3);
    if (words.length === 0)
        return null;
    let best = null;
    let bestScore = 0;
    for (const p of paragraphs) {
        const textLower = p.text.toLowerCase();
        let score = 0;
        for (const w of words) {
            if (textLower.includes(w))
                score += w.length;
        }
        if (p.endsWithColon)
            score += 5;
        if (score > bestScore) {
            bestScore = score;
            best = { idx: p.idx, text: p.text };
        }
    }
    return bestScore >= 4 ? best : null;
}
// ============================================================================
// EXTRACTION DES DONNÉES PAR SEGMENT
// ============================================================================
/**
 * Extrait les contextes de tags d'un segment spécifique.
 *
 * @param segment - Le segment du template
 * @returns Liste des contextes de tags
 */
function extractTagContextsFromSegment(segment) {
    // Utiliser la fonction existante sur le XML du segment
    return (0, shared_1.extractTagContextsFromTemplate)(segment.xml);
}
/**
 * Extrait les paragraphes d'un segment spécifique en utilisant les INDEX GLOBAUX.
 *
 * IMPORTANT: Cette fonction filtre les paragraphes globaux du document
 * pour ne garder que ceux qui appartiennent au segment, tout en préservant
 * leurs index et positions GLOBAUX. Cela permet au LLM de retourner des
 * index qui correspondent directement au document complet.
 *
 * @param segment - Le segment cible
 * @param globalTargetXml - Le XML complet du document cible
 * @returns Liste des paragraphes avec leur index GLOBAL
 */
function extractParagraphsFromSegment(segment, globalTargetXml) {
    // Récupérer ou calculer les paragraphes globaux (avec cache et timeout)
    const needsRefresh = !isCacheValid() ||
        cachedTargetXml !== globalTargetXml ||
        !globalTargetParagraphsCache;
    if (needsRefresh) {
        globalTargetParagraphsCache = (0, shared_1.extractTargetParagraphs)(globalTargetXml);
        cachedTargetXml = globalTargetXml;
        cacheTimestamp = Date.now();
    }
    // Filtrer les paragraphes qui appartiennent à ce segment
    // basé sur leur position dans le XML global
    const segmentStart = segment.startOffset;
    const segmentEnd = segment.endOffset;
    // S'assurer que le cache est bien défini (ne devrait jamais être null ici)
    const paragraphs = globalTargetParagraphsCache !== null && globalTargetParagraphsCache !== void 0 ? globalTargetParagraphsCache : [];
    const segmentParagraphs = paragraphs.filter((p) => {
        // Un paragraphe appartient au segment si son début est dans la plage du segment
        return p.xmlStart >= segmentStart && p.xmlStart < segmentEnd;
    });
    // Les paragraphes gardent leurs index et positions GLOBAUX
    return segmentParagraphs;
}
/**
 * Réinitialise le cache des paragraphes globaux.
 * À appeler au début d'un nouveau traitement de document.
 */
function resetParagraphCache() {
    globalTargetParagraphsCache = null;
    cachedTargetXml = null;
    cacheTimestamp = Date.now();
}
/**
 * Vide TOUS les caches du module.
 * À appeler APRÈS chaque traitement pour libérer la mémoire.
 *
 * IMPORTANT: Cette fonction DOIT être appelée à la fin de chaque
 * exécution du nœud pour éviter les fuites mémoire et les données
 * corrompues entre différentes exécutions.
 */
function clearAllCaches() {
    globalTargetParagraphsCache = null;
    cachedTargetXml = null;
    cacheTimestamp = 0;
}
/**
 * Vérifie si le cache est encore valide (non expiré).
 */
function isCacheValid() {
    if (!cacheTimestamp)
        return false;
    return (Date.now() - cacheTimestamp) < CACHE_TIMEOUT_MS;
}
/**
 * Combine les résultats de matching de plusieurs segments.
 *
 * @param segmentResults - Résultats par segment
 * @param matchedPairs - Paires de segments utilisées
 * @returns Liste combinée des matches
 */
function combineSegmentResults(segmentResults, matchedPairs) {
    const allMatches = [];
    const usedTags = new Set();
    for (const pair of matchedPairs) {
        const segmentId = pair.templateSegment.id;
        const matches = segmentResults.get(segmentId) || [];
        for (const match of matches) {
            // Éviter les doublons de tags
            if (usedTags.has(match.tag)) {
                continue;
            }
            // Convertir l'index relatif au segment en index absolu
            // Note: Pour l'instant on garde l'index relatif car applyTagsToTarget
            // travaille avec l'index global dans le XML complet
            // TODO: Implémenter la conversion d'index si nécessaire
            allMatches.push(match);
            usedTags.add(match.tag);
        }
    }
    return allMatches;
}
// ============================================================================
// UTILITAIRES DE DÉBOGAGE
// ============================================================================
/**
 * Affiche un résumé du plan de matching pour le débogage.
 *
 * @param plan - Le plan de matching
 */
function logMatchingPlan(plan) {
    console.log('\n📊 PLAN DE MATCHING PAR SEGMENTS');
    console.log('═'.repeat(50));
    console.log(`Template segments: ${plan.stats.totalTemplateSegments}`);
    console.log(`Target segments: ${plan.stats.totalTargetSegments}`);
    console.log(`Segments matchés: ${plan.stats.matchedSegments}`);
    console.log(`Tags à transférer: ${plan.stats.totalTagsToTransfer}`);
    if (plan.unmatchedTags.length > 0) {
        console.log(`\n⚠️ Tags sans segment: ${plan.unmatchedTags.join(', ')}`);
    }
    console.log('\n📂 Paires de segments:');
    for (const pair of plan.matchedPairs) {
        console.log(`\n  ${pair.templateSegment.id} → ${pair.targetSegment.id}`);
        console.log(`    Score: ${pair.matchScore}%`);
        console.log(`    Tags: ${pair.tagsToTransfer.join(', ')}`);
        console.log(`    Paragraphes cible: ${pair.targetParagraphs.length}`);
    }
}
// ============================================================================
// DÉCISION D'UTILISATION DE LA SEGMENTATION
// ============================================================================
/**
 * Détermine si la segmentation doit être utilisée pour ce document.
 *
 * La segmentation est recommandée pour les documents volumineux
 * avec beaucoup de tags répartis sur plusieurs sections.
 *
 * @param templateXml - XML du template
 * @param extractedTags - Tags extraits
 * @returns true si la segmentation est recommandée
 */
function shouldUseSegmentation(templateXml, extractedTags) {
    // Critères pour utiliser la segmentation:
    // 1. Document volumineux (> 50000 caractères)
    // 2. Plus de 10 tags
    // 3. Tags répartis sur plusieurs sections (détecté par les préfixes CA_, PART_, etc.)
    const isLargeDocument = templateXml.length > 50000;
    const hasManyTags = extractedTags.length > 10;
    // Détecter si les tags sont répartis (différents préfixes)
    const tagPrefixes = new Set(extractedTags.map((t) => {
        const parts = t.tag.split('_');
        return parts.length > 1 ? parts[0] : t.tag;
    }));
    const hasDistributedTags = tagPrefixes.size >= 3;
    // Recommander la segmentation si au moins 2 critères sont remplis
    const criteriaCount = [isLargeDocument, hasManyTags, hasDistributedTags].filter(Boolean).length;
    return criteriaCount >= 2;
}
