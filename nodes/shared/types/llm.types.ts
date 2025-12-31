/**
 * ============================================================================
 * TYPES LLM - Définitions pour l'intégration avec les modèles de langage
 * ============================================================================
 *
 * Ce fichier contient les types relatifs à l'utilisation des LLM (Large Language Models)
 * comme GPT-4, Claude, etc. pour le matching sémantique des tags.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Un LLM est un modèle d'intelligence artificielle capable de comprendre et générer du texte
 * - On l'utilise ici pour trouver où placer les tags dans un document
 * - Le "matching sémantique" signifie qu'on trouve des correspondances basées sur le sens,
 *   pas juste sur des mots-clés exacts
 *
 * @author Rokodo
 * @version 2.0.0
 */

// ============================================================================
// INTERFACE MODÈLE LLM
// ============================================================================

/**
 * Interface générique pour un modèle LLM.
 *
 * Cette interface permet d'utiliser différents fournisseurs (OpenAI, Anthropic, etc.)
 * de manière interchangeable grâce au polymorphisme.
 *
 * @example
 * async function analyzeDocument(model: LLMModel, prompt: string) {
 *   const response = await model.invoke(prompt);
 *   return typeof response === 'string' ? response : response.content;
 * }
 */
export interface LLMModel {
	/**
	 * Invoque le modèle avec un prompt et retourne la réponse.
	 *
	 * @param input - Le prompt à envoyer au modèle (texte ou objet structuré)
	 * @returns La réponse du modèle (format variable selon le fournisseur)
	 */
	invoke(input: string | object): Promise<LLMResponse>;
}

/**
 * Type de réponse possible d'un LLM.
 * La structure varie selon le fournisseur, d'où l'union de types.
 */
export type LLMResponse =
	| string                           // Réponse texte simple
	| { content: string }              // Format OpenAI/Anthropic
	| { text: string }                 // Format alternatif
	| object;                          // Autres formats

// ============================================================================
// CONFIGURATION LLM
// ============================================================================

/**
 * Fournisseurs LLM supportés.
 */
export type LLMProvider = 'openai' | 'anthropic';

/**
 * Configuration pour un appel LLM via API HTTP.
 */
export interface LLMApiConfig {
	/** Fournisseur LLM */
	provider: LLMProvider;

	/** Clé API pour l'authentification */
	apiKey: string;

	/** Nom du modèle à utiliser (ex: 'gpt-4o', 'claude-3-5-sonnet-20241022') */
	model: string;

	/** Température pour la génération (0 = déterministe, 1 = créatif) */
	temperature?: number;

	/** Nombre maximum de tokens dans la réponse */
	maxTokens?: number;
}

// ============================================================================
// STRUCTURE DE RÉPONSE MATCHING
// ============================================================================

/**
 * Structure attendue de la réponse JSON du LLM pour le matching.
 *
 * Le LLM retourne un JSON avec la liste des correspondances trouvées.
 *
 * @example
 * const response: LLMMatchingResponse = {
 *   matches: [
 *     { tag: 'NOM_COMMERCIAL', targetIdx: 15, confidence: 0.95, insertionPoint: 'after_colon' }
 *   ]
 * };
 */
export interface LLMMatchingResponse {
	matches: LLMMatchItem[];
}

/**
 * Un élément de matching dans la réponse LLM.
 * Note : targetIdx est un alias de targetParagraphIndex pour la rétrocompatibilité.
 */
export interface LLMMatchItem {
	/** Nom du tag */
	tag: string;

	/** Index du paragraphe cible (format court) */
	targetIdx?: number;

	/** Index du paragraphe cible (format long) */
	targetParagraphIndex?: number;

	/** Score de confiance (0 à 1) */
	confidence: number;

	/** Type d'insertion */
	insertionPoint?: 'after_colon' | 'replace_empty' | 'inline' | 'checkbox' | 'table_cell';

	/** Explication du matching (optionnel) */
	reason?: string;
}
