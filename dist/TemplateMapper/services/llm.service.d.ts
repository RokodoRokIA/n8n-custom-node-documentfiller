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
import { LLMModel, MatchResult } from '../../shared/types';
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
export declare function callConnectedLLM(model: LLMModel, prompt: string): Promise<string>;
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
export declare function parseMatchResponse(response: string): MatchResult[];
export type { LLMModel };
