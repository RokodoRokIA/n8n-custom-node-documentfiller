/**
 * ============================================================================
 * SERVICE LLM - Gestion des appels aux modèles de langage
 * ============================================================================
 *
 * Ce service gère toutes les interactions avec les LLM (Large Language Models)
 * pour le matching sémantique des tags.
 *
 * FONCTIONNALITÉS :
 * - Appels via modèle connecté (n8n LangChain)
 * - Parsing des réponses JSON du LLM
 *
 * MODÈLES SUPPORTÉS :
 * Tous les LLM disponibles dans n8n sont supportés via la connexion :
 * - OpenAI (GPT-4, GPT-4o, GPT-4o-mini, etc.)
 * - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, etc.)
 * - Google (Gemini Pro, Gemini Ultra, etc.)
 * - Mistral (Mistral Large, Mixtral, etc.)
 * - Ollama (modèles locaux : LLaMA, Mistral, etc.)
 * - Groq (LLaMA, Mixtral accéléré)
 * - Azure OpenAI
 * - AWS Bedrock
 * - Cohere
 * - Et tous les autres...
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Un LLM analyse le document et trouve où placer les tags
 * - Il retourne un JSON avec les correspondances trouvées
 * - Le "matching sémantique" = trouver des correspondances basées sur le sens
 *
 * @author Rokodo
 * @version 3.0.0 - Support universel de tous les LLM
 */

import { LLMModel, LLMResponse, MatchResult, LLMMatchItem, InsertionPoint } from '../../shared/types';

// ============================================================================
// APPELS LLM
// ============================================================================

/**
 * Appelle un modèle LLM connecté via n8n (LangChain).
 *
 * Cette fonction est utilisée quand l'utilisateur connecte un nœud LLM
 * (comme "OpenAI Chat Model" ou "Anthropic Chat Model") au TemplateMapper.
 *
 * @param model - Le modèle LLM connecté
 * @param prompt - Le prompt à envoyer
 * @returns La réponse textuelle du modèle
 *
 * @example
 * const model = await this.getInputConnectionData(NodeConnectionTypes.AiLanguageModel, i);
 * const response = await callConnectedLLM(model, prompt);
 */
export async function callConnectedLLM(model: LLMModel, prompt: string): Promise<string> {
	const response: LLMResponse = await model.invoke(prompt);

	// Le format de réponse varie selon le fournisseur
	if (typeof response === 'string') {
		return response;
	}

	if (response && typeof response === 'object') {
		// Format OpenAI/Anthropic standard
		if ('content' in response) {
			return String(response.content);
		}
		// Format alternatif
		if ('text' in response) {
			return String((response as { text: string }).text);
		}
		// Fallback : sérialiser l'objet
		return JSON.stringify(response);
	}

	return '';
}


// ============================================================================
// PARSING DES RÉPONSES - VERSION ROBUSTE
// ============================================================================

/**
 * Parse la réponse JSON du LLM avec plusieurs stratégies de récupération.
 *
 * AMÉLIORATIONS v3.0:
 * - Multiple stratégies d'extraction JSON
 * - Logging détaillé pour le debug
 * - Récupération des erreurs courantes des LLM
 * - Validation stricte des champs
 *
 * @param response - La réponse brute du LLM
 * @returns Liste des résultats de matching validés
 */
export function parseMatchResponse(response: string): MatchResult[] {
	if (!response || typeof response !== 'string') {
		console.warn('⚠️ parseMatchResponse: Réponse vide ou invalide');
		return [];
	}

	// Essayer plusieurs stratégies d'extraction
	const json = extractJSON(response);

	if (!json) {
		console.warn('⚠️ parseMatchResponse: Aucun JSON valide trouvé dans la réponse');
		console.warn('   Début de la réponse:', response.substring(0, 200));
		return [];
	}

	try {
		const parsed = JSON.parse(json);

		// Vérifier la structure
		if (!parsed.matches) {
			console.warn('⚠️ parseMatchResponse: Pas de champ "matches" dans le JSON');
			return [];
		}

		if (!Array.isArray(parsed.matches)) {
			console.warn('⚠️ parseMatchResponse: "matches" n\'est pas un tableau');
			return [];
		}

		// Filtrer et valider chaque match
		const validMatches: MatchResult[] = [];
		const invalidMatches: { match: LLMMatchItem; reason: string }[] = [];

		for (const match of parsed.matches) {
			const validation = validateMatch(match);

			if (validation.valid) {
				validMatches.push({
					tag: match.tag,
					targetParagraphIndex: match.targetParagraphIndex ?? match.targetIdx ?? 0,
					confidence: match.confidence,
					insertionPoint: normalizeInsertionPoint(match.insertionPoint),
					reason: match.reason,
				});
			} else {
				invalidMatches.push({ match, reason: validation.reason });
			}
		}

		// Log des résultats
		if (validMatches.length > 0) {
			console.log(`✅ parseMatchResponse: ${validMatches.length} matches valides`);
		}
		if (invalidMatches.length > 0) {
			console.warn(`⚠️ parseMatchResponse: ${invalidMatches.length} matches rejetés:`);
			invalidMatches.slice(0, 3).forEach(({ match, reason }) => {
				console.warn(`   - ${match.tag || 'N/A'}: ${reason}`);
			});
		}

		return validMatches;
	} catch (error) {
		console.error('❌ parseMatchResponse: Erreur de parsing JSON:', (error as Error).message);
		console.error('   JSON extrait:', json.substring(0, 200));
		return [];
	}
}

/**
 * Extrait le JSON de la réponse avec plusieurs stratégies.
 */
function extractJSON(response: string): string | null {
	const cleaned = response.trim();

	// Stratégie 1: Bloc Markdown ```json ... ```
	const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	if (markdownMatch) {
		const content = markdownMatch[1].trim();
		if (content.startsWith('{')) return content;
	}

	// Stratégie 2: JSON brut { ... }
	const jsonStart = cleaned.indexOf('{');
	const jsonEnd = cleaned.lastIndexOf('}');
	if (jsonStart !== -1 && jsonEnd > jsonStart) {
		return cleaned.substring(jsonStart, jsonEnd + 1);
	}

	// Stratégie 3: Tableau JSON [ ... ]
	const arrayStart = cleaned.indexOf('[');
	const arrayEnd = cleaned.lastIndexOf(']');
	if (arrayStart !== -1 && arrayEnd > arrayStart) {
		// Envelopper dans un objet matches
		const array = cleaned.substring(arrayStart, arrayEnd + 1);
		return `{"matches": ${array}}`;
	}

	return null;
}

/**
 * Valide un match individuel.
 */
function validateMatch(match: LLMMatchItem): { valid: boolean; reason: string } {
	if (!match.tag || typeof match.tag !== 'string') {
		return { valid: false, reason: 'tag manquant ou invalide' };
	}

	const idx = match.targetParagraphIndex ?? match.targetIdx;
	if (idx === undefined || idx === null || typeof idx !== 'number') {
		return { valid: false, reason: 'targetIdx manquant' };
	}

	if (idx < 0) {
		return { valid: false, reason: `targetIdx négatif (${idx})` };
	}

	if (typeof match.confidence !== 'number') {
		return { valid: false, reason: 'confidence manquant' };
	}

	if (match.confidence < 0.7) {
		return { valid: false, reason: `confidence trop basse (${match.confidence})` };
	}

	return { valid: true, reason: '' };
}

/**
 * Normalise le insertionPoint avec valeur par défaut.
 */
function normalizeInsertionPoint(point: string | undefined): InsertionPoint {
	const validPoints: InsertionPoint[] = ['after_colon', 'table_cell', 'replace_empty', 'inline', 'checkbox'];
	if (point && validPoints.includes(point as InsertionPoint)) {
		return point as InsertionPoint;
	}
	return 'after_colon';
}

// ============================================================================
// TYPES EXPORTÉS POUR LE NŒUD PRINCIPAL
// ============================================================================

export type { LLMModel };
