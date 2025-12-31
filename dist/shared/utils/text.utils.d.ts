/**
 * ============================================================================
 * UTILITAIRES TEXTE - Manipulation et nettoyage de chaînes
 * ============================================================================
 *
 * Ce module contient les fonctions utilitaires pour manipuler le texte
 * extrait des documents Word.
 *
 * PROBLÈMES COURANTS RÉSOLUS :
 * - Les espaces insécables (non-breaking spaces) de Word
 * - Les caractères spéciaux de la Private Use Area (puces, symboles)
 * - Les caractères de contrôle invisibles
 * - Les espaces multiples consécutifs
 *
 * @author Rokodo
 * @version 2.0.0
 */
/**
 * Normalise le texte en supprimant les caractères spéciaux Word.
 *
 * Word utilise des caractères spéciaux pour le formatage interne qui
 * peuvent perturber le traitement du texte. Cette fonction les nettoie.
 *
 * CARACTÈRES SUPPRIMÉS OU REMPLACÉS :
 * - Private Use Area (U+E000-U+F8FF) : puces personnalisées, symboles Word
 * - Caractères de contrôle (U+0000-U+001F) : caractères invisibles
 * - Espaces insécables (U+00A0) : remplacés par des espaces normaux
 * - Espaces multiples : réduits à un seul espace
 *
 * @param text - Le texte à normaliser
 * @returns Le texte nettoyé et normalisé
 *
 * @example
 * // Espace insécable remplacé par espace normal
 * normalizeText('Nom\u00A0commercial');  // "Nom commercial"
 *
 * // Caractères spéciaux supprimés
 * normalizeText('\uE000Point de puce');  // "Point de puce"
 */
export declare function normalizeText(text: string): string;
/**
 * Expression régulière pour détecter les tags {{TAG}}.
 *
 * Format accepté : {{LETTRES_MAJUSCULES_ET_CHIFFRES}}
 * Exemples valides : {{NOM}}, {{NOM_COMMERCIAL}}, {{CA_2024}}
 */
export declare const TAG_REGEX: RegExp;
/**
 * Expression régulière pour un seul tag (sans flag global).
 */
export declare const TAG_REGEX_SINGLE: RegExp;
/**
 * Vérifie si un texte contient déjà un tag {{...}}.
 *
 * Utilisé pour éviter d'insérer des tags dans des paragraphes
 * qui en contiennent déjà.
 *
 * @param text - Le texte à vérifier
 * @returns true si le texte contient un tag
 *
 * @example
 * hasExistingTag('Nom commercial');           // false
 * hasExistingTag('Nom : {{NOM_COMMERCIAL}}'); // true
 */
export declare function hasExistingTag(text: string): boolean;
/**
 * Extrait tous les noms de tags d'un texte.
 *
 * @param text - Le texte contenant des tags
 * @returns Liste des noms de tags (sans les accolades), sans doublons
 *
 * @example
 * extractTagNames('{{NOM}} et {{PRENOM}}');  // ['NOM', 'PRENOM']
 * extractTagNames('{{NOM}} + {{NOM}}');      // ['NOM'] (pas de doublon)
 */
export declare function extractTagNames(text: string): string[];
/**
 * Retire les accolades d'un tag.
 *
 * @param fullTag - Le tag complet avec accolades
 * @returns Le nom du tag sans accolades
 *
 * @example
 * stripTagBraces('{{NOM_COMMERCIAL}}');  // 'NOM_COMMERCIAL'
 */
export declare function stripTagBraces(fullTag: string): string;
/**
 * Ajoute les accolades à un nom de tag.
 *
 * @param tagName - Le nom du tag sans accolades
 * @returns Le tag complet avec accolades
 *
 * @example
 * wrapWithBraces('NOM_COMMERCIAL');  // '{{NOM_COMMERCIAL}}'
 */
export declare function wrapWithBraces(tagName: string): string;
/**
 * Détecte la section du document basée sur le texte du paragraphe.
 *
 * Les documents administratifs français sont souvent organisés en sections
 * identifiées par une lettre (A, B, C, D, E...) suivie d'un tiret ou deux-points.
 *
 * @param text - Le texte du paragraphe actuel
 * @param previousSection - La section précédemment détectée (par défaut)
 * @returns La section détectée ou la section précédente si non trouvée
 *
 * @example
 * detectSection('A - Identification du candidat', '');  // 'A'
 * detectSection('Nom commercial :', 'A');               // 'A' (conserve)
 * detectSection('B : Capacités', 'A');                  // 'B'
 */
export declare function detectSection(text: string, previousSection: string): string;
/**
 * Tronque un texte à une longueur maximale avec ellipse.
 *
 * @param text - Le texte à tronquer
 * @param maxLength - Longueur maximale (défaut: 100)
 * @returns Le texte tronqué avec "..." si nécessaire
 *
 * @example
 * truncate('Un texte très long...', 10);  // 'Un texte t...'
 */
export declare function truncate(text: string, maxLength?: number): string;
/**
 * Vérifie si un texte contient des lettres (alphabétiques).
 * Utile pour distinguer les vrais labels des espaces/symboles.
 *
 * @param text - Le texte à vérifier
 * @returns true si le texte contient au moins une lettre
 *
 * @example
 * containsLetters('Nom :');    // true
 * containsLetters('---');      // false
 * containsLetters('123');      // false
 * containsLetters('ABC123');   // true
 */
export declare function containsLetters(text: string): boolean;
