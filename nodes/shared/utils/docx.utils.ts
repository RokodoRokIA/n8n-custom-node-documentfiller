/**
 * ============================================================================
 * UTILITAIRES DOCX - Opérations de haut niveau sur les documents Word
 * ============================================================================
 *
 * Ce module contient les fonctions utilitaires de haut niveau pour travailler
 * avec les documents DOCX. Il s'appuie sur xml.utils et text.utils.
 *
 * @author Rokodo
 * @version 2.0.0
 */

import PizZip from 'pizzip';
import {
	DocumentType,
	DocumentDetectionResult,
	TagContext,
	ExtractedTag,
	TargetParagraph,
	TagDataType,
} from '../types';
import {
	extractTextFromXml,
	reconstructFragmentedText,
	isInsideTableCell,
	extractParagraphsFromXml,
} from './xml.utils';
import {
	normalizeText,
	hasExistingTag,
	detectSection,
	containsLetters,
	extractTagNames,
} from './text.utils';

// ============================================================================
// CHARGEMENT DE DOCUMENTS
// ============================================================================

/**
 * Charge un document DOCX et extrait son contenu XML principal.
 *
 * @param buffer - Le buffer du fichier DOCX
 * @returns Un objet contenant le zip et le XML du document
 * @throws Error si le fichier n'est pas un DOCX valide
 *
 * @example
 * const { zip, xml } = loadDocxContent(buffer);
 * // xml contient le contenu de word/document.xml
 */
export function loadDocxContent(buffer: Buffer): { zip: PizZip; xml: string } {
	const zip = new PizZip(buffer);
	const documentFile = zip.file('word/document.xml');

	if (!documentFile) {
		throw new Error(
			'Le fichier DOCX ne contient pas de document.xml. ' +
			'Vérifiez que le fichier est un document Word valide.'
		);
	}

	let xml = documentFile.asText();

	// Reconstruire le texte fragmenté pour faciliter la détection des tags
	xml = reconstructFragmentedText(xml);

	return { zip, xml };
}

/**
 * Sauvegarde le XML modifié dans le document DOCX.
 *
 * @param zip - L'archive ZIP du document
 * @param xml - Le nouveau contenu XML
 * @returns Le buffer du document modifié
 */
export function saveDocxContent(zip: PizZip, xml: string): Buffer {
	zip.file('word/document.xml', xml);

	return zip.generate({
		type: 'nodebuffer',
		compression: 'DEFLATE',
	});
}

// ============================================================================
// DÉTECTION DU TYPE DE DOCUMENT
// ============================================================================

/**
 * Détecte automatiquement le type de document administratif.
 *
 * Cette fonction analyse le contenu et le nom du fichier pour déterminer
 * s'il s'agit d'un DC1, DC2, AE ou autre type de document.
 *
 * CRITÈRES DE DÉTECTION :
 * - Nom du fichier (DC1, DC2, AE)
 * - Présence de phrases clés ("Lettre de candidature" pour DC1, etc.)
 * - Mots-clés spécifiques à chaque type
 *
 * @param xml - Le contenu XML du document
 * @param filename - Le nom du fichier (optionnel)
 * @returns Le type détecté et le nom de l'acheteur si trouvé
 *
 * @example
 * const result = detectDocumentType(xml, 'DC1_entreprise.docx');
 * // { type: 'DC1', acheteur: 'Ville de Paris' }
 */
export function detectDocumentType(xml: string, filename?: string): DocumentDetectionResult {
	const textLower = xml.toLowerCase();
	const filenameLower = (filename || '').toLowerCase();
	let acheteur = '';

	// Essayer d'extraire le nom de l'acheteur
	const acheteurPatterns = [
		/désignation\s+(?:de\s+l[''])?acheteur\s*[:\s]+([A-Za-zÀ-ÿ\s]{5,50})/i,
		/pouvoir\s+adjudicateur\s*[:\s]+([A-Za-zÀ-ÿ\s]{5,50})/i,
		/acheteur\s*[:\s]+([A-Za-zÀ-ÿ\s]{5,50})/i,
	];

	for (const pattern of acheteurPatterns) {
		const match = xml.match(pattern);
		if (match) {
			acheteur = match[1].trim();
			break;
		}
	}

	// Système de scoring pour déterminer le type
	const scores: Record<DocumentType, number> = { DC1: 0, DC2: 0, AE: 0, UNKNOWN: 0 };

	// Score basé sur le nom du fichier (priorité haute)
	if (filenameLower.includes('dc1') && !filenameLower.includes('dc2')) {
		scores.DC1 += 50;
	}
	if (filenameLower.includes('dc2') && !filenameLower.includes('dc1')) {
		scores.DC2 += 50;
	}
	if (filenameLower.includes('_ae') || filenameLower.includes('ae_') || filenameLower === 'ae.docx') {
		scores.AE += 50;
	}

	// Score basé sur le contenu pour DC1
	if (/lettre\s+de\s+candidature/i.test(textLower)) scores.DC1 += 15;
	if (/dc\s*1\s*[-–]/i.test(textLower)) scores.DC1 += 15;
	if (textLower.includes('habilitation du mandataire')) scores.DC1 += 10;

	// Score basé sur le contenu pour DC2
	if (/déclaration\s+du\s+candidat\s+individuel/i.test(textLower)) scores.DC2 += 15;
	if (/dc\s*2\s*[-–]/i.test(textLower)) scores.DC2 += 15;
	if (textLower.includes('capacité économique et financière')) scores.DC2 += 8;

	// Score basé sur le contenu pour AE
	if (/acte\s+d['']?\s*engagement/i.test(textLower)) scores.AE += 15;
	if (textLower.includes('compte à créditer') || textLower.includes('compte bancaire')) {
		scores.AE += 10;
	}

	// Déterminer le type avec le meilleur score
	let detectedType: DocumentType = 'UNKNOWN';
	let maxScore = 0;

	for (const [docType, score] of Object.entries(scores)) {
		if (score > maxScore) {
			maxScore = score;
			detectedType = docType as DocumentType;
		}
	}

	// Score minimum requis pour valider la détection
	if (maxScore < 5) {
		detectedType = 'UNKNOWN';
	}

	return { type: detectedType, acheteur };
}

// ============================================================================
// EXTRACTION DES TAGS DU TEMPLATE
// ============================================================================

/**
 * Extrait tous les tags d'un template avec leur contexte complet.
 *
 * Cette fonction analyse un document DOCX déjà taggué et extrait :
 * - Chaque tag avec son nom
 * - Le texte qui le précède (label)
 * - Le texte qui le suit
 * - La section du document
 * - Le type de tag (texte, checkbox, etc.)
 *
 * Utilisé pour le "Transfer Learning" : apprendre d'un template
 * pour taguer un document similaire.
 *
 * @param xml - Le XML du template
 * @returns Liste des tags avec leur contexte
 */
export function extractTagContextsFromTemplate(xml: string): TagContext[] {
	const contexts: TagContext[] = [];
	const paragraphs = extractParagraphsFromXml(xml);

	// Normaliser le texte de chaque paragraphe
	const normalizedParagraphs = paragraphs.map(p => ({
		...p,
		text: normalizeText(p.text),
	}));

	let currentSection = '';

	for (let i = 0; i < normalizedParagraphs.length; i++) {
		const paragraph = normalizedParagraphs[i];
		currentSection = detectSection(paragraph.text, currentSection);

		// Trouver tous les tags dans ce paragraphe
		const tagMatches = paragraph.text.match(/\{\{[A-Z_0-9]+\}\}/g);
		if (!tagMatches) continue;

		for (const fullTag of tagMatches) {
			const tagName = fullTag.replace(/[{}]/g, '');
			const tagType = inferTagType(tagName);
			const labelBefore = extractLabelBefore(paragraph.text, fullTag, normalizedParagraphs, i);
			const labelAfter = extractLabelAfter(paragraph.text, fullTag);

			// Détecter si c'est une cellule de tableau
			const inTableCell = isInsideTableCell(xml, paragraph.xmlStart, paragraph.xml);
			const finalType = inTableCell && tagType === 'text' ? 'table_cell' : tagType;

			// Ajouter des indices sémantiques basés sur le nom du tag
			const semanticHints = getSemanticHintsForTag(tagName);

			contexts.push({
				tag: tagName,
				fullTag,
				labelBefore: cleanLabel(labelBefore + ' ' + semanticHints),
				labelAfter: cleanLabel(labelAfter),
				section: currentSection,
				type: finalType,
				xmlContext: paragraph.xml.substring(0, 500),
				paragraphIndex: i,
			});
		}
	}

	return contexts;
}

/**
 * Extrait automatiquement tous les tags d'un template XML.
 *
 * Version simplifiée qui retourne uniquement les tags et leurs types
 * déduits, sans le contexte complet.
 *
 * @param xml - Le XML du template
 * @returns Liste des tags extraits avec leur type
 */
export function extractTagsFromTemplateXml(xml: string): ExtractedTag[] {
	const tags: ExtractedTag[] = [];
	const seenTags = new Set<string>();

	// Trouver tous les tags {{TAG}}
	const tagMatches = xml.match(/\{\{[A-Z_0-9]+\}\}/g) || [];

	for (const fullTag of tagMatches) {
		const tagName = fullTag.replace(/[{}]/g, '');

		// Éviter les doublons
		if (seenTags.has(tagName)) continue;
		seenTags.add(tagName);

		// Déduire le type
		const type = inferTagDataType(tagName);

		// Trouver le contexte autour du tag
		const tagIndex = xml.indexOf(fullTag);
		const contextStart = Math.max(0, tagIndex - 200);
		const contextEnd = Math.min(xml.length, tagIndex + fullTag.length + 100);
		const contextXml = xml.substring(contextStart, contextEnd);
		const context = extractTextFromXml(contextXml)
			.replace(fullTag, '')
			.trim()
			.substring(0, 100);

		tags.push({ tag: tagName, type, context });
	}

	return tags;
}

/**
 * Génère une structure de données vide basée sur les tags extraits.
 *
 * Cette structure peut être utilisée comme template pour remplir le document.
 *
 * @param extractedTags - Les tags extraits du template
 * @returns Un objet avec chaque tag comme clé et une valeur par défaut
 */
export function generateDataStructureFromTags(
	extractedTags: ExtractedTag[]
): Record<string, unknown> {
	const structure: Record<string, unknown> = {};

	for (const { tag, type } of extractedTags) {
		switch (type) {
			case 'boolean':
				structure[tag] = false;
				break;
			case 'number':
				structure[tag] = 0;
				break;
			case 'date':
			case 'string':
			default:
				structure[tag] = '';
				break;
		}
	}

	return structure;
}

// ============================================================================
// EXTRACTION DES PARAGRAPHES DU DOCUMENT CIBLE
// ============================================================================

/**
 * Extrait tous les paragraphes du document cible avec métadonnées.
 *
 * Cette fonction prépare le document cible pour le matching avec les tags.
 *
 * @param xml - Le XML du document cible
 * @returns Liste des paragraphes avec leurs métadonnées
 */
export function extractTargetParagraphs(xml: string): TargetParagraph[] {
	const paragraphs: TargetParagraph[] = [];
	const rawParagraphs = extractParagraphsFromXml(xml);

	let currentSection = '';

	for (let i = 0; i < rawParagraphs.length; i++) {
		const p = rawParagraphs[i];
		const text = normalizeText(p.text);
		currentSection = detectSection(text, currentSection);
		const inTableCell = isInsideTableCell(xml, p.xmlStart, p.xml);

		paragraphs.push({
			index: i,
			text,
			xmlStart: p.xmlStart,
			xmlEnd: p.xmlEnd,
			section: currentSection,
			isTableCell: inTableCell,
			hasExistingTag: hasExistingTag(text),
		});
	}

	return paragraphs;
}

// ============================================================================
// FONCTIONS UTILITAIRES PRIVÉES
// ============================================================================

/**
 * Déduit le type de tag basé sur son nom.
 */
function inferTagType(tagName: string): TagContext['type'] {
	if (
		tagName.startsWith('CHECK_') ||
		tagName.includes('_OUI') ||
		tagName.includes('_NON') ||
		tagName.startsWith('EST_')
	) {
		return 'checkbox';
	}

	if (tagName.includes('DATE') || tagName.includes('_DEBUT') || tagName.includes('_FIN')) {
		return 'date';
	}

	return 'text';
}

/**
 * Déduit le type de données d'un tag basé sur son nom.
 */
function inferTagDataType(tagName: string): TagDataType {
	if (
		tagName.startsWith('CHECK_') ||
		tagName.startsWith('EST_') ||
		tagName.includes('_OUI') ||
		tagName.includes('_NON')
	) {
		return 'boolean';
	}

	if (tagName.includes('DATE') || tagName.includes('_DEBUT') || tagName.includes('_FIN')) {
		return 'date';
	}

	if (tagName.includes('MONTANT') || tagName.includes('PRIX') || tagName.includes('CA_')) {
		return 'number';
	}

	return 'string';
}

/**
 * Extrait le label qui précède un tag dans un paragraphe.
 */
function extractLabelBefore(
	paragraphText: string,
	fullTag: string,
	allParagraphs: Array<{ text: string }>,
	currentIndex: number
): string {
	const tagIndex = paragraphText.indexOf(fullTag);

	// D'abord, chercher dans le même paragraphe avant le tag
	if (tagIndex > 0) {
		const textBefore = paragraphText.substring(0, tagIndex).trim();
		if (textBefore.length > 2 && containsLetters(textBefore)) {
			return textBefore;
		}
	}

	// Sinon, chercher dans les paragraphes précédents
	for (let j = currentIndex - 1; j >= Math.max(0, currentIndex - 5); j--) {
		const prevText = allParagraphs[j].text.trim();
		if (prevText.length > 3 && !hasExistingTag(prevText) && containsLetters(prevText)) {
			return prevText.substring(0, 150);
		}
	}

	return '';
}

/**
 * Extrait le label qui suit un tag dans un paragraphe.
 */
function extractLabelAfter(paragraphText: string, fullTag: string): string {
	const tagIndex = paragraphText.indexOf(fullTag);
	const afterTagIndex = tagIndex + fullTag.length;

	if (afterTagIndex < paragraphText.length) {
		const textAfter = paragraphText.substring(afterTagIndex).trim();
		if (textAfter.length > 0 && !hasExistingTag(textAfter)) {
			return textAfter.substring(0, 50);
		}
	}

	return '';
}

/**
 * Nettoie un label en retirant les tags résiduels.
 */
function cleanLabel(label: string): string {
	return label.replace(/\{\{[A-Z_0-9]+\}\}/g, '').trim();
}

/**
 * Retourne des indices sémantiques basés sur le nom du tag.
 * Ces indices aident l'IA à mieux comprendre le contexte.
 */
function getSemanticHintsForTag(tagName: string): string {
	const hints: Record<string, string> = {
		'NOM_COMMERCIAL': 'nom commercial dénomination sociale raison sociale',
		'DENOMINATION': 'dénomination sociale',
		'ADRESSE': 'adresse postale siège',
		'ADRESSE_SIEGE': 'siège social adresse siège',
		'SIRET': 'numéro SIRET SIREN identification',
		'EMAIL': 'adresse électronique courriel email',
		'TELEPHONE': 'téléphone numéro tel',
		'FORME_JURIDIQUE': 'forme juridique statut entreprise',
		'CHECK_PME': 'PME petite moyenne entreprise artisan',
		'CA_': 'chiffre affaires exercice',
		'PART_CA': 'part pourcentage chiffre affaires',
	};

	for (const [key, hint] of Object.entries(hints)) {
		if (tagName.includes(key)) {
			return hint;
		}
	}

	return '';
}
