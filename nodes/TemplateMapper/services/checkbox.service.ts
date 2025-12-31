/**
 * ============================================================================
 * SERVICE CHECKBOX - Analyse et injection des checkboxes par IA
 * ============================================================================
 *
 * Ce service permet à l'IA d'analyser le contenu du document et de DÉCIDER
 * quelles checkboxes doivent être cochées ou non.
 *
 * FONCTIONNALITÉS :
 * - Génération de prompts pour l'analyse des checkboxes
 * - Parsing des décisions du LLM
 * - Application intelligente des états de checkboxes
 *
 * POURQUOI CE SERVICE :
 * L'approche précédente copiait simplement l'état du template vers la cible.
 * Maintenant, l'IA analyse le CONTENU du document cible et DÉCIDE
 * intelligemment quel devrait être l'état de chaque checkbox.
 *
 * @author Rokodo
 * @version 1.0.0
 */

import {
	ExtractedCheckbox,
	CheckboxPair,
	CheckboxMatch,
	applyCheckboxesToXml,
} from '../../shared/utils/checkbox.utils';
import { LLMModel } from '../../shared/types';
import { callConnectedLLM } from './llm.service';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Décision de l'IA pour une checkbox.
 */
export interface CheckboxDecision {
	/** Index de la checkbox dans le document cible */
	targetIndex: number;
	/** Label de la checkbox (pour vérification) */
	label: string;
	/** Décision: true = coché, false = non coché */
	shouldBeChecked: boolean;
	/** Confiance de l'IA (0-1) */
	confidence: number;
	/** Raison de la décision */
	reason?: string;
}

/**
 * Résultat de l'analyse des checkboxes par l'IA.
 */
export interface CheckboxAnalysisResult {
	/** Décisions pour chaque checkbox */
	decisions: CheckboxDecision[];
	/** Checkboxes appliquées avec succès */
	applied: string[];
	/** Checkboxes en échec */
	failed: string[];
	/** XML modifié */
	xml: string;
	/** Mode utilisé */
	mode: 'ai_analysis' | 'fallback_template_copy';
}

// ============================================================================
// GÉNÉRATION DU PROMPT POUR L'ANALYSE DES CHECKBOXES
// ============================================================================

/**
 * Génère un prompt pour que l'IA analyse et décide l'état des checkboxes.
 *
 * L'IA doit:
 * 1. Comprendre le contexte de chaque checkbox
 * 2. Analyser le contenu du document
 * 3. Décider si chaque checkbox devrait être cochée ou non
 *
 * @param templateCheckboxes - Checkboxes du template (pour contexte)
 * @param targetCheckboxes - Checkboxes du document cible
 * @param templatePairs - Paires Oui/Non détectées dans le template
 * @param documentContext - Contexte textuel du document cible
 * @returns Le prompt formaté pour l'IA
 */
export function generateCheckboxAnalysisPrompt(
	templateCheckboxes: ExtractedCheckbox[],
	targetCheckboxes: ExtractedCheckbox[],
	templatePairs: CheckboxPair[],
	documentContext: string
): string {
	// Préparer la liste des checkboxes cibles à analyser
	const checkboxList = targetCheckboxes.map((cb, idx) => ({
		idx: cb.index,
		label: cb.label.substring(0, 80),
		currentState: cb.checked ? 'coché' : 'non coché',
		type: cb.type,
		section: cb.section || 'N/A',
	}));

	// Préparer les exemples du template (Few-Shot Learning)
	const templateExamples = templateCheckboxes.slice(0, 10).map(cb => ({
		label: cb.label.substring(0, 60),
		state: cb.checked ? 'COCHÉ' : 'NON COCHÉ',
		context: cb.questionContext || 'N/A',
	}));

	// Préparer les paires Oui/Non comme exemples
	const pairsExamples = templatePairs.slice(0, 5).map(pair => ({
		question: pair.question,
		answer: pair.value === true ? 'OUI' : pair.value === false ? 'NON' : 'AUCUN',
	}));

	return `# TÂCHE: Analyse et décision des états de checkboxes

## CONTEXTE
Tu analyses un document administratif français et tu dois décider quelles checkboxes
doivent être cochées en fonction du CONTENU du document.

## MÉTHODE D'ANALYSE (OBLIGATOIRE)
1. Lis attentivement chaque checkbox et son label
2. Cherche dans le contenu du document les informations correspondantes
3. Décide si la checkbox devrait être cochée selon la logique du document
4. Pour les paires Oui/Non, une seule doit être cochée

## EXEMPLES D'APPRENTISSAGE (TEMPLATE DE RÉFÉRENCE)
${templateExamples.length > 0 ? `
Ces checkboxes étaient dans le template de référence:
\`\`\`json
${JSON.stringify(templateExamples, null, 2)}
\`\`\`
` : 'Aucun template de référence disponible.'}

${pairsExamples.length > 0 ? `
### Paires Oui/Non du template:
\`\`\`json
${JSON.stringify(pairsExamples, null, 2)}
\`\`\`
` : ''}

## CHECKBOXES À ANALYSER (DOCUMENT CIBLE)
\`\`\`json
${JSON.stringify(checkboxList, null, 2)}
\`\`\`

## CONTENU DU DOCUMENT (pour analyse)
\`\`\`
${documentContext.substring(0, 4000)}
\`\`\`

## FORMAT DE RÉPONSE (JSON STRICT)
\`\`\`json
{
  "checkboxDecisions": [
    {
      "targetIndex": 0,
      "label": "label de la checkbox",
      "shouldBeChecked": true,
      "confidence": 0.9,
      "reason": "Explication courte de la décision"
    }
  ]
}
\`\`\`

## RÈGLES DE DÉCISION
1. **Paires Oui/Non**: Si tu trouves "Oui" et "Non" pour la même question:
   - Coche "Oui" si le document indique une réponse affirmative
   - Coche "Non" si le document indique une réponse négative
   - Ne coche aucun si l'information n'est pas claire

2. **Checkboxes isolées**: Coche si le document confirme l'information

3. **Confidence minimum**: 0.7 (sinon, garde l'état actuel)

4. **En cas de doute**: NE COCHE PAS (shouldBeChecked: false)

## CONTRAINTES
- targetIndex = un des "idx" de la liste ci-dessus
- confidence >= 0.7 pour appliquer la décision
- Réponds UNIQUEMENT avec le JSON, rien d'autre`;
}

// ============================================================================
// PARSING DES DÉCISIONS DU LLM
// ============================================================================

/**
 * Parse la réponse du LLM pour extraire les décisions sur les checkboxes.
 *
 * @param response - Réponse brute du LLM
 * @returns Liste des décisions validées
 */
export function parseCheckboxDecisions(response: string): CheckboxDecision[] {
	if (!response || typeof response !== 'string') {
		console.warn('⚠️ parseCheckboxDecisions: Réponse vide ou invalide');
		return [];
	}

	// Extraire le JSON de la réponse
	const json = extractCheckboxJSON(response);
	if (!json) {
		console.warn('⚠️ parseCheckboxDecisions: Aucun JSON valide trouvé');
		console.warn('   Début de la réponse:', response.substring(0, 200));
		return [];
	}

	try {
		const parsed = JSON.parse(json);

		// Vérifier la structure
		const decisions = parsed.checkboxDecisions || parsed.decisions || parsed.matches;
		if (!decisions || !Array.isArray(decisions)) {
			console.warn('⚠️ parseCheckboxDecisions: Pas de tableau de décisions');
			return [];
		}

		// Valider et filtrer les décisions
		const validDecisions: CheckboxDecision[] = [];

		for (const decision of decisions) {
			const validation = validateCheckboxDecision(decision);
			if (validation.valid) {
				validDecisions.push({
					targetIndex: decision.targetIndex ?? decision.targetIdx ?? decision.idx,
					label: decision.label || '',
					shouldBeChecked: Boolean(decision.shouldBeChecked ?? decision.checked),
					confidence: decision.confidence || 0.8,
					reason: decision.reason || '',
				});
			} else {
				console.warn(`⚠️ Décision rejetée: ${validation.reason}`);
			}
		}

		console.log(`✅ parseCheckboxDecisions: ${validDecisions.length} décisions valides`);
		return validDecisions;
	} catch (error) {
		console.error('❌ parseCheckboxDecisions: Erreur de parsing:', (error as Error).message);
		return [];
	}
}

/**
 * Extrait le JSON de la réponse avec plusieurs stratégies.
 */
function extractCheckboxJSON(response: string): string | null {
	const cleaned = response.trim();

	// Stratégie 1: Bloc Markdown ```json ... ```
	const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	if (markdownMatch) {
		const content = markdownMatch[1].trim();
		if (content.startsWith('{') || content.startsWith('[')) return content;
	}

	// Stratégie 2: JSON brut { ... }
	const jsonStart = cleaned.indexOf('{');
	const jsonEnd = cleaned.lastIndexOf('}');
	if (jsonStart !== -1 && jsonEnd > jsonStart) {
		return cleaned.substring(jsonStart, jsonEnd + 1);
	}

	return null;
}

/**
 * Valide une décision de checkbox.
 */
function validateCheckboxDecision(
	decision: Record<string, unknown>
): { valid: boolean; reason: string } {
	const idx = decision.targetIndex ?? decision.targetIdx ?? decision.idx;
	if (idx === undefined || idx === null || typeof idx !== 'number') {
		return { valid: false, reason: 'targetIndex manquant' };
	}

	if (idx < 0) {
		return { valid: false, reason: `targetIndex négatif (${idx})` };
	}

	if (decision.shouldBeChecked === undefined && decision.checked === undefined) {
		return { valid: false, reason: 'shouldBeChecked manquant' };
	}

	const confidence = decision.confidence as number;
	if (typeof confidence === 'number' && confidence < 0.7) {
		return { valid: false, reason: `confidence trop basse (${confidence})` };
	}

	return { valid: true, reason: '' };
}

// ============================================================================
// ANALYSE DES CHECKBOXES PAR L'IA
// ============================================================================

/**
 * Analyse les checkboxes avec l'IA et applique les décisions.
 *
 * C'est la fonction principale qui:
 * 1. Génère le prompt d'analyse
 * 2. Appelle le LLM
 * 3. Parse les décisions
 * 4. Applique les modifications au XML
 *
 * @param model - Modèle LLM connecté
 * @param targetXml - XML du document cible
 * @param templateCheckboxes - Checkboxes du template
 * @param targetCheckboxes - Checkboxes du document cible
 * @param templatePairs - Paires Oui/Non du template
 * @param documentContext - Contexte textuel du document
 * @param debug - Mode debug
 * @returns Résultat de l'analyse avec le XML modifié
 */
export async function analyzeCheckboxesWithAI(
	model: LLMModel,
	targetXml: string,
	templateCheckboxes: ExtractedCheckbox[],
	targetCheckboxes: ExtractedCheckbox[],
	templatePairs: CheckboxPair[],
	documentContext: string,
	debug: boolean = false
): Promise<CheckboxAnalysisResult> {
	// Si pas de checkboxes cibles, retourner sans modification
	if (targetCheckboxes.length === 0) {
		return {
			decisions: [],
			applied: [],
			failed: [],
			xml: targetXml,
			mode: 'ai_analysis',
		};
	}

	// Générer le prompt
	const prompt = generateCheckboxAnalysisPrompt(
		templateCheckboxes,
		targetCheckboxes,
		templatePairs,
		documentContext
	);

	if (debug) {
		console.log('\n☑️ === ANALYSE CHECKBOXES PAR IA ===');
		console.log(`   Checkboxes cibles: ${targetCheckboxes.length}`);
		console.log(`   Taille du prompt: ${Math.round(prompt.length / 1000)}KB`);
	}

	try {
		// Appeler le LLM
		const llmResponse = await callConnectedLLM(model, prompt);

		if (debug) {
			console.log(`   Réponse LLM: ${llmResponse.substring(0, 300)}...`);
		}

		// Parser les décisions
		const decisions = parseCheckboxDecisions(llmResponse);

		if (decisions.length === 0) {
			console.warn('⚠️ L\'IA n\'a retourné aucune décision de checkbox, fallback vers copie du template');
			return fallbackToTemplateCopy(targetXml, templateCheckboxes, targetCheckboxes);
		}

		// Convertir les décisions en CheckboxMatch pour applyCheckboxesToXml
		const matches = convertDecisionsToMatches(decisions, targetCheckboxes);

		if (debug) {
			console.log(`   Décisions valides: ${decisions.length}`);
			decisions.forEach(d => {
				const arrow = d.shouldBeChecked ? '☑' : '☐';
				console.log(`     - idx=${d.targetIndex} "${d.label.substring(0, 30)}" → ${arrow} (${d.reason || 'N/A'})`);
			});
		}

		// Appliquer les modifications
		const result = applyCheckboxesToXml(targetXml, matches);

		return {
			decisions,
			applied: result.applied,
			failed: result.failed,
			xml: result.xml,
			mode: 'ai_analysis',
		};
	} catch (error) {
		console.error('❌ Erreur lors de l\'analyse IA des checkboxes:', (error as Error).message);
		return fallbackToTemplateCopy(targetXml, templateCheckboxes, targetCheckboxes);
	}
}

/**
 * Convertit les décisions de l'IA en CheckboxMatch pour l'application.
 */
function convertDecisionsToMatches(
	decisions: CheckboxDecision[],
	targetCheckboxes: ExtractedCheckbox[]
): CheckboxMatch[] {
	const matches: CheckboxMatch[] = [];

	for (const decision of decisions) {
		// Trouver la checkbox cible correspondante
		const targetCb = targetCheckboxes.find(cb => cb.index === decision.targetIndex);
		if (!targetCb) {
			console.warn(`⚠️ Checkbox cible non trouvée pour index ${decision.targetIndex}`);
			continue;
		}

		// Créer un "template checkbox" fictif pour le match
		// On utilise la même checkbox mais avec l'état décidé par l'IA
		const templateCb: ExtractedCheckbox = {
			...targetCb,
			checked: decision.shouldBeChecked,
		};

		matches.push({
			templateCheckbox: templateCb,
			targetCheckbox: targetCb,
			newState: decision.shouldBeChecked,
		});
	}

	return matches;
}

/**
 * Fallback: copie les états du template vers la cible (ancien comportement).
 */
function fallbackToTemplateCopy(
	targetXml: string,
	templateCheckboxes: ExtractedCheckbox[],
	targetCheckboxes: ExtractedCheckbox[]
): CheckboxAnalysisResult {
	console.log('⚠️ Utilisation du fallback: copie des états du template');

	// Import dynamique pour éviter les dépendances circulaires
	const { matchCheckboxes } = require('../../shared/utils/checkbox.utils');
	const matches = matchCheckboxes(templateCheckboxes, targetCheckboxes);
	const result = applyCheckboxesToXml(targetXml, matches);

	return {
		decisions: [],
		applied: result.applied,
		failed: result.failed,
		xml: result.xml,
		mode: 'fallback_template_copy',
	};
}

// ============================================================================
// EXTRACTION DU CONTEXTE DOCUMENT
// ============================================================================

/**
 * Extrait le contexte textuel du document pour l'analyse des checkboxes.
 *
 * @param xml - XML du document
 * @returns Texte brut du document (pour l'analyse IA)
 */
export function extractDocumentContext(xml: string): string {
	// Extraire tous les paragraphes
	const paragraphs: string[] = [];
	const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
	let match;

	while ((match = paragraphRegex.exec(xml)) !== null) {
		const text = match[0]
			.replace(/<[^>]+>/g, '') // Supprimer les balises XML
			.replace(/\s+/g, ' ')     // Normaliser les espaces
			.trim();

		if (text.length > 3) {
			paragraphs.push(text);
		}
	}

	return paragraphs.join('\n');
}
