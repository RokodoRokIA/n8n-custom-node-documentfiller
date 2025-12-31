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

// ============================================================================
// NORMALISATION DU TEXTE
// ============================================================================

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
export function normalizeText(text: string): string {
	return text
		// Supprimer les caractères de la Private Use Area (puces Word, symboles, etc.)
		// Ces caractères sont dans la plage Unicode U+E000 à U+F8FF
		.replace(/[\uE000-\uF8FF]/g, '')

		// Supprimer les caractères de contrôle (invisibles)
		// Ces caractères sont dans la plage Unicode U+0000 à U+001F
		.replace(/[\u0000-\u001F]/g, '')

		// Remplacer les espaces insécables par des espaces normaux
		// L'espace insécable (U+00A0) est souvent utilisé par Word
		.replace(/\u00A0/g, ' ')

		// Réduire les espaces multiples à un seul espace
		.replace(/\s+/g, ' ')

		// Supprimer les espaces en début et fin
		.trim();
}

// ============================================================================
// DÉTECTION DE TAGS
// ============================================================================

/**
 * Expression régulière pour détecter les tags {{TAG}}.
 *
 * Format accepté : {{LETTRES_MAJUSCULES_ET_CHIFFRES}}
 * Exemples valides : {{NOM}}, {{NOM_COMMERCIAL}}, {{CA_2024}}
 */
export const TAG_REGEX = /\{\{[A-Z_0-9]+\}\}/g;

/**
 * Expression régulière pour un seul tag (sans flag global).
 */
export const TAG_REGEX_SINGLE = /\{\{[A-Z_0-9]+\}\}/;

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
export function hasExistingTag(text: string): boolean {
	return TAG_REGEX_SINGLE.test(text);
}

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
export function extractTagNames(text: string): string[] {
	const matches = text.match(TAG_REGEX) || [];
	const tagNames = matches.map(tag => tag.replace(/[{}]/g, ''));

	// Retourner sans doublons
	return [...new Set(tagNames)];
}

/**
 * Retire les accolades d'un tag.
 *
 * @param fullTag - Le tag complet avec accolades
 * @returns Le nom du tag sans accolades
 *
 * @example
 * stripTagBraces('{{NOM_COMMERCIAL}}');  // 'NOM_COMMERCIAL'
 */
export function stripTagBraces(fullTag: string): string {
	return fullTag.replace(/[{}]/g, '');
}

/**
 * Ajoute les accolades à un nom de tag.
 *
 * @param tagName - Le nom du tag sans accolades
 * @returns Le tag complet avec accolades
 *
 * @example
 * wrapWithBraces('NOM_COMMERCIAL');  // '{{NOM_COMMERCIAL}}'
 */
export function wrapWithBraces(tagName: string): string {
	return `{{${tagName}}}`;
}

// ============================================================================
// DÉTECTION DE SECTIONS
// ============================================================================

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
export function detectSection(text: string, previousSection: string): string {
	// Pattern : lettre majuscule suivie d'un tiret, tiret long ou deux-points
	// Exemples : "A -", "A –", "A:", "B - "
	const sectionMatch = text.match(/^([A-Z])\s*[-–:]/);

	if (sectionMatch) {
		return sectionMatch[1];
	}

	// Pas de nouvelle section détectée, conserver la précédente
	return previousSection;
}

// ============================================================================
// UTILITAIRES DE FORMATAGE
// ============================================================================

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
export function truncate(text: string, maxLength: number = 100): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.substring(0, maxLength) + '...';
}

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
export function containsLetters(text: string): boolean {
	// Inclut les lettres accentuées françaises (À-ÿ)
	return /[a-zA-ZÀ-ÿ]/.test(text);
}
