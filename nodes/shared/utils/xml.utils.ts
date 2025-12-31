/**
 * ============================================================================
 * UTILITAIRES XML - Manipulation de contenu XML Word
 * ============================================================================
 *
 * Ce module contient toutes les fonctions utilitaires pour manipuler le XML
 * des documents Word (DOCX). Les fichiers DOCX sont des archives ZIP contenant
 * des fichiers XML, principalement word/document.xml.
 *
 * STRUCTURE XML WORD (pour les développeurs juniors) :
 * ----------------------------------------------------
 * - <w:p>     : Paragraphe (paragraph)
 * - <w:r>     : Run - une portion de texte avec un formatage uniforme
 * - <w:t>     : Texte brut (text)
 * - <w:tc>    : Cellule de tableau (table cell)
 * - <w:tr>    : Ligne de tableau (table row)
 * - <w:tbl>   : Tableau (table)
 * - <w:rPr>   : Propriétés de run (formatage du texte)
 * - <w:pPr>   : Propriétés de paragraphe
 *
 * EXEMPLE DE STRUCTURE XML :
 * ```xml
 * <w:p>                           <!-- Paragraphe -->
 *   <w:pPr>...</w:pPr>           <!-- Propriétés du paragraphe -->
 *   <w:r>                         <!-- Run 1 -->
 *     <w:rPr>...</w:rPr>         <!-- Formatage (gras, italique, etc.) -->
 *     <w:t>Nom : </w:t>          <!-- Texte -->
 *   </w:r>
 *   <w:r>                         <!-- Run 2 -->
 *     <w:t>{{NOM}}</w:t>         <!-- Tag à remplacer -->
 *   </w:r>
 * </w:p>
 * ```
 *
 * @author Rokodo
 * @version 2.0.0
 */

import { XmlValidationResult } from '../types';

// ============================================================================
// EXTRACTION DE TEXTE
// ============================================================================

/**
 * Extrait le texte brut d'un contenu XML Word.
 *
 * Cette fonction trouve tous les éléments <w:t> (texte) et concatène
 * leur contenu pour obtenir le texte visible du document.
 *
 * @param xmlContent - Contenu XML à analyser
 * @returns Le texte extrait, concaténé
 *
 * @example
 * const xml = '<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>World</w:t></w:r></w:p>';
 * const text = extractTextFromXml(xml); // "Hello World"
 */
export function extractTextFromXml(xmlContent: string): string {
	const textParts: string[] = [];

	// Expression régulière pour trouver le contenu des balises <w:t>
	// Note: [^>]* permet de gérer les attributs comme xml:space="preserve"
	const textTagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;

	let match;
	while ((match = textTagRegex.exec(xmlContent)) !== null) {
		textParts.push(match[1]);
	}

	return textParts.join('');
}

// ============================================================================
// RECONSTRUCTION DE TEXTE FRAGMENTÉ
// ============================================================================

/**
 * Reconstruit le texte fragmenté dans les runs XML.
 *
 * PROBLÈME RÉSOLU :
 * Word fragmente parfois le texte en plusieurs éléments <w:t> pour des raisons
 * de formatage ou de vérification orthographique. Par exemple, "{{NOM}}" peut
 * devenir "<w:t>{{</w:t><w:t>NOM</w:t><w:t>}}</w:t>", ce qui casse la détection des tags.
 *
 * Cette fonction fusionne les éléments <w:t> consécutifs dans un même <w:r>
 * pour reconstituer le texte original.
 *
 * @param xml - Le XML à reconstruire
 * @returns Le XML avec le texte reconstruit
 *
 * @example
 * // Avant: <w:r><w:t>{{</w:t><w:t>NOM</w:t><w:t>}}</w:t></w:r>
 * // Après: <w:r><w:t>{{NOM}}</w:t></w:r>
 */
export function reconstructFragmentedText(xml: string): string {
	// Expression régulière pour trouver les runs (<w:r>...</w:r>)
	const runRegex = /(<w:r[^>]*>)([\s\S]*?)(<\/w:r>)/g;

	return xml.replace(runRegex, (fullMatch, openingTag, content, closingTag) => {
		// Collecter tous les éléments <w:t> dans ce run
		const textElements: Array<{ full: string; text: string; attrs: string }> = [];
		const textTagRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;

		let textMatch;
		while ((textMatch = textTagRegex.exec(content)) !== null) {
			textElements.push({
				full: textMatch[0],      // Élément complet: <w:t...>texte</w:t>
				text: textMatch[2],      // Contenu texte uniquement
				attrs: textMatch[1],     // Attributs de la balise
			});
		}

		// Si on a plus d'un élément <w:t>, les fusionner
		if (textElements.length > 1) {
			// Combiner tout le texte
			const combinedText = textElements.map(element => element.text).join('');

			// Conserver les attributs du premier élément
			const attrs = textElements[0].attrs;

			// Reconstruire le contenu en remplaçant les éléments fragmentés
			let newContent = content;
			for (let i = textElements.length - 1; i >= 0; i--) {
				if (i === 0) {
					// Premier élément : remplacer par le texte combiné
					newContent = newContent.replace(
						textElements[i].full,
						`<w:t${attrs}>${combinedText}</w:t>`
					);
				} else {
					// Autres éléments : supprimer
					newContent = newContent.replace(textElements[i].full, '');
				}
			}

			return openingTag + newContent + closingTag;
		}

		// Pas de fragmentation, retourner tel quel
		return fullMatch;
	});
}

// ============================================================================
// VALIDATION XML
// ============================================================================

/**
 * Valide que le XML est bien formé et ne contient pas d'erreurs structurelles.
 *
 * Cette validation est importante car un XML mal formé peut corrompre
 * le document Word et le rendre illisible.
 *
 * VÉRIFICATIONS EFFECTUÉES :
 * 1. Pas de caractères invalides dans les attributs XML
 * 2. Les tags {{...}} ne sont pas dans des attributs (ce qui est invalide)
 * 3. Les balises principales sont équilibrées
 *
 * @param xml - Le XML à valider
 * @returns Un objet indiquant si le XML est valide et l'erreur éventuelle
 *
 * @example
 * const result = validateXml(xmlContent);
 * if (!result.valid) {
 *   console.error('XML invalide:', result.error);
 * }
 */
export function validateXml(xml: string): XmlValidationResult {
	try {
		// 1. Vérifier qu'il n'y a pas de caractères invalides dans les attributs
		// Un attribut corrompu contiendrait un < à l'intérieur des guillemets
		const brokenAttributeRegex = /\s[a-z:]+="[^"]*<[^"]*"/gi;
		const brokenAttribute = xml.match(brokenAttributeRegex);

		if (brokenAttribute) {
			return {
				valid: false,
				error: `Attribut XML corrompu détecté: ${brokenAttribute[0].substring(0, 50)}...`,
			};
		}

		// 2. Vérifier que les tags {{}} ne sont pas dans des attributs XML
		// Cela casserait la structure du document
		const tagInAttributeRegex = /="[^"]*\{\{[A-Z_0-9]+\}\}[^"]*"/g;
		const tagInAttribute = xml.match(tagInAttributeRegex);

		if (tagInAttribute) {
			return {
				valid: false,
				error: `Tag {{...}} trouvé dans un attribut XML (interdit): ${tagInAttribute[0]}`,
			};
		}

		// 3. Vérifier l'équilibre des balises principales
		const openBodyCount = (xml.match(/<w:body>/g) || []).length;
		const closeBodyCount = (xml.match(/<\/w:body>/g) || []).length;

		if (openBodyCount !== closeBodyCount) {
			return {
				valid: false,
				error: `Balises w:body non équilibrées: ${openBodyCount} ouvertures, ${closeBodyCount} fermetures`,
			};
		}

		return { valid: true };
	} catch (e) {
		return {
			valid: false,
			error: `Erreur de validation: ${(e as Error).message}`,
		};
	}
}

// ============================================================================
// ÉCHAPPEMENT XML
// ============================================================================

/**
 * Échappe les caractères spéciaux pour les inclure dans du XML.
 *
 * Les caractères <, >, &, " et ' ont une signification spéciale en XML
 * et doivent être échappés pour apparaître en tant que texte.
 *
 * @param value - La chaîne à échapper
 * @returns La chaîne avec les caractères spéciaux échappés
 *
 * @example
 * escapeXml('A & B');   // "A &amp; B"
 * escapeXml('<tag>');   // "&lt;tag&gt;"
 * escapeXml('"test"');  // "&quot;test&quot;"
 */
export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')   // & doit être premier (sinon on échapperait les autres)
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

// ============================================================================
// DÉTECTION DE CELLULES DE TABLEAU
// ============================================================================

/**
 * Vérifie si un paragraphe est à l'intérieur d'une cellule de tableau.
 *
 * Cette fonction est utile pour adapter le comportement d'insertion des tags
 * selon qu'on est dans un paragraphe normal ou une cellule de tableau.
 *
 * LOGIQUE :
 * On compte les balises <w:tc> (ouverture de cellule) et </w:tc> (fermeture)
 * avant le paragraphe. Si on a plus d'ouvertures que de fermetures,
 * on est à l'intérieur d'une cellule.
 *
 * @param xml - Le XML complet du document
 * @param paragraphStart - Position de début du paragraphe dans le XML
 * @param paragraphXml - Le XML du paragraphe lui-même
 * @returns true si le paragraphe est dans une cellule de tableau
 */
export function isInsideTableCell(
	xml: string,
	paragraphStart: number,
	paragraphXml: string
): boolean {
	// Cas 1: Le paragraphe lui-même contient une balise de cellule
	if (/<w:tc[^>]*>/.test(paragraphXml)) {
		return true;
	}

	// Cas 2: Chercher dans le contexte avant le paragraphe
	// On regarde jusqu'à 2000 caractères avant pour capturer les tableaux complexes
	const searchStart = Math.max(0, paragraphStart - 2000);
	const xmlBefore = xml.substring(searchStart, paragraphStart);

	// Chercher les balises de cellule avant le paragraphe
	if (/<w:tc[^>]*>/.test(xmlBefore)) {
		// Compter les ouvertures et fermetures de cellules
		const openCellCount = (xmlBefore.match(/<w:tc[^>]*>/g) || []).length;
		const closeCellCount = (xmlBefore.match(/<\/w:tc>/g) || []).length;

		// Si on a plus d'ouvertures que de fermetures, on est dans une cellule
		if (openCellCount > closeCellCount) {
			return true;
		}
	}

	// Cas 3: Vérifier après le paragraphe (cas particuliers)
	const searchEnd = Math.min(xml.length, paragraphStart + paragraphXml.length + 500);
	const xmlAfter = xml.substring(paragraphStart + paragraphXml.length, searchEnd);

	if (/<w:tc[^>]*>/.test(xmlAfter)) {
		const beforeOpenCount = (xmlBefore.match(/<w:tc[^>]*>/g) || []).length;
		const beforeCloseCount = (xmlBefore.match(/<\/w:tc>/g) || []).length;

		if (beforeOpenCount > beforeCloseCount) {
			return true;
		}
	}

	return false;
}

// ============================================================================
// EXTRACTION DE PARAGRAPHES
// ============================================================================

/**
 * Interface pour un paragraphe XML extrait.
 * Note: Différent de ExtractedParagraph dans extraction.types.ts
 */
export interface XmlParagraph {
	/** Texte brut du paragraphe */
	text: string;

	/** Position de début dans le XML */
	xmlStart: number;

	/** Position de fin dans le XML */
	xmlEnd: number;

	/** Le XML complet du paragraphe */
	xml: string;
}

/**
 * Extrait tous les paragraphes d'un document XML Word.
 *
 * @param xml - Le XML du document
 * @returns Liste des paragraphes avec leur position et contenu
 */
export function extractParagraphsFromXml(xml: string): XmlParagraph[] {
	const paragraphs: XmlParagraph[] = [];
	const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;

	let match;
	while ((match = paragraphRegex.exec(xml)) !== null) {
		const rawText = extractTextFromXml(match[0]);

		paragraphs.push({
			text: rawText,
			xmlStart: match.index,
			xmlEnd: match.index + match[0].length,
			xml: match[0],
		});
	}

	return paragraphs;
}
