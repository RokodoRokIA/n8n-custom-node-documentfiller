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
import { DocumentType, TagContext, ExtractedTag, TargetParagraph } from '../../shared/types';
import { ExtractedCheckbox, CheckboxPair } from '../../shared/utils/checkbox.utils';
/**
 * Génère le prompt avec approche Few-Shot Learning.
 *
 * PRINCIPE: Montrer des exemples concrets plutôt que des règles abstraites.
 * L'IA voit: "Dans le template, {{NOM}} était après 'Nom commercial :'"
 * Elle doit trouver: "Dans la cible, 'Nom commercial :' est au paragraphe X"
 */
export declare function generateTransferLearningPrompt(tagContexts: TagContext[], targetParagraphs: TargetParagraph[], extractedTags: ExtractedTag[], docType: DocumentType): string;
/**
 * Génère la section Few-Shot pour les checkboxes.
 *
 * @param templateCheckboxes - Checkboxes extraites du template
 * @param targetCheckboxes - Checkboxes extraites de la cible
 * @param pairs - Paires Oui/Non identifiées
 * @returns Section du prompt pour les checkboxes
 */
export declare function generateCheckboxFewShot(templateCheckboxes: ExtractedCheckbox[], targetCheckboxes: ExtractedCheckbox[], pairs: CheckboxPair[]): string;
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
export declare function generateDirectMappingPrompt(targetParagraphs: TargetParagraph[], extractedTags: ExtractedTag[], docType: DocumentType): string;
/**
 * Vérifie et log un avertissement si le prompt est trop grand.
 * Retourne le prompt (potentiellement tronqué en mode strict).
 *
 * @param prompt - Le prompt généré
 * @param strict - Si true, tronque le prompt (non recommandé)
 * @returns Le prompt (peut être le même ou tronqué)
 */
export declare function validatePromptSize(prompt: string, strict?: boolean): string;
