/**
 * DocxTemplateFiller - Remplissage intelligent de documents DOCX
 *
 * Trois modes de fonctionnement:
 * 1. Mode Standard: Mapping fixe basé sur le schéma TagsSchema (rapide, gratuit)
 * 2. Mode IA (LLM): Mapping dynamique avec n'importe quel modèle LLM connecté
 * 3. Mode Hybride: Standard d'abord, puis IA pour les tags non reconnus
 *
 * Le mode IA utilise l'input ai_languageModel de n8n, permettant de connecter:
 * - OpenAI (GPT-4, GPT-4o, GPT-3.5)
 * - Anthropic (Claude)
 * - Ollama (modèles locaux)
 * - Azure OpenAI
 * - Google (Gemini)
 * - Mistral
 * - Et tout autre LLM compatible LangChain
 */
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class DocxTemplateFiller implements INodeType {
    description: INodeTypeDescription;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
