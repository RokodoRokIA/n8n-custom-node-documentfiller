/**
 * ============================================================================
 * STRUCTURE PARSER SERVICE - Analyse sémantique des documents DOCX
 * ============================================================================
 *
 * Ce service parse la structure d'un document DOCX et détecte les éléments
 * sémantiques: titres, listes, sections, paragraphes.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Les titres sont détectés via les styles Word (Heading1, Heading2, etc.)
 * - Les listes utilisent <w:numPr> pour le niveau et le type
 * - Les sections sont détectées par pattern (A., B., 1., etc.)
 *
 * @author Rokodo
 * @version 1.0.0
 */

import type {
	ExtractedContent,
	ExtractedSection,
	ExtractedParagraph,
	SectionContent,
	SectionParagraph,
	SectionHeading,
	SectionList,
	ExtractedListItem,
	ExtractedTextStyle,
	HeadingLevel,
} from '../../shared/types/extraction.types';
import {
	detectHeadingLevel,
	detectListItem,
	detectSectionInfo,
	extractAlignment,
	isBold,
	isItalic,
	isUnderline,
} from '../../shared/utils/style-detector.utils';

// ============================================================================
// TYPES INTERNES
// ============================================================================

interface ParsedElement {
	type: 'paragraph' | 'heading' | 'listItem';
	text: string;
	headingLevel?: HeadingLevel;
	listLevel?: number;
	listOrdered?: boolean;
	style?: ExtractedTextStyle;
	sectionId?: string;
}

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Parse la structure d'un document DOCX et retourne le contenu organisé.
 *
 * @param xml - Contenu XML de word/document.xml
 * @param preserveHierarchy - Si true, organise par sections/sous-sections
 * @param includeStyles - Si true, inclut les infos de style
 * @returns Contenu structuré
 */
export function parseDocumentStructure(
	xml: string,
	preserveHierarchy: boolean = true,
	includeStyles: boolean = false
): ExtractedContent {
	// Extraire le body
	const bodyMatch = xml.match(/<w:body>([\s\S]*?)<\/w:body>/);
	if (!bodyMatch) {
		return { sections: [], paragraphs: [] };
	}

	const bodyXml = bodyMatch[1];

	// Parser tous les éléments
	const elements = parseAllElements(bodyXml, includeStyles);

	if (preserveHierarchy) {
		// Organiser en sections hiérarchiques
		const sections = buildHierarchy(elements);
		return { sections };
	} else {
		// Liste plate de paragraphes
		const paragraphs = elements.map((el) => elementToParagraph(el));
		return { paragraphs };
	}
}

/**
 * Parse tous les éléments du document (paragraphes).
 */
function parseAllElements(
	bodyXml: string,
	includeStyles: boolean
): ParsedElement[] {
	const elements: ParsedElement[] = [];

	// Matcher les paragraphes (en excluant ceux dans les tableaux pour l'instant)
	// On traite les tableaux séparément
	const paragraphRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
	let match;

	while ((match = paragraphRegex.exec(bodyXml)) !== null) {
		const paragraphXml = match[0];

		// Ignorer les paragraphes dans les tableaux (traités séparément)
		// On vérifie si on est dans un <w:tc>
		const beforeMatch = bodyXml.substring(0, match.index);
		const lastTcOpen = beforeMatch.lastIndexOf('<w:tc');
		const lastTcClose = beforeMatch.lastIndexOf('</w:tc>');
		if (lastTcOpen > lastTcClose) {
			// On est dans une cellule de tableau, ignorer
			continue;
		}

		const element = parseParagraphElement(paragraphXml, includeStyles);
		if (element) {
			elements.push(element);
		}
	}

	return elements;
}

/**
 * Parse un paragraphe et détermine son type.
 */
function parseParagraphElement(
	paragraphXml: string,
	includeStyles: boolean
): ParsedElement | null {
	// Extraire le texte
	const text = extractParagraphText(paragraphXml);
	if (!text.trim()) {
		return null;
	}

	// Détecter le type
	const headingLevel = detectHeadingLevel(paragraphXml);
	const listInfo = detectListItem(paragraphXml);

	// Extraire le style si demandé
	let style: ExtractedTextStyle | undefined;
	if (includeStyles) {
		style = extractParagraphStyle(paragraphXml);
	}

	// Détecter si c'est une section
	const sectionInfo = detectSectionInfo(text);

	if (headingLevel) {
		return {
			type: 'heading',
			text: text.trim(),
			headingLevel,
			style,
			sectionId: sectionInfo?.id,
		};
	}

	if (listInfo) {
		return {
			type: 'listItem',
			text: text.trim(),
			listLevel: listInfo.level,
			listOrdered: false, // On ne peut pas facilement le détecter sans numbering.xml
			style,
		};
	}

	return {
		type: 'paragraph',
		text: text.trim(),
		style,
		sectionId: sectionInfo?.id,
	};
}

/**
 * Extrait le texte d'un paragraphe.
 */
function extractParagraphText(paragraphXml: string): string {
	const textParts: string[] = [];
	const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
	let match;

	while ((match = textRegex.exec(paragraphXml)) !== null) {
		textParts.push(match[1]);
	}

	return textParts.join('');
}

/**
 * Extrait le style dominant d'un paragraphe.
 */
function extractParagraphStyle(paragraphXml: string): ExtractedTextStyle {
	// On prend le style du premier run non vide
	const runRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
	let match;

	while ((match = runRegex.exec(paragraphXml)) !== null) {
		const runXml = match[0];
		// Vérifier que le run contient du texte
		if (/<w:t[^>]*>[^<]+<\/w:t>/.test(runXml)) {
			return {
				bold: isBold(runXml),
				italic: isItalic(runXml),
				underline: isUnderline(runXml),
			};
		}
	}

	return {};
}

/**
 * Construit la hiérarchie de sections à partir des éléments.
 */
function buildHierarchy(elements: ParsedElement[]): ExtractedSection[] {
	const sections: ExtractedSection[] = [];
	let currentSection: ExtractedSection | null = null;
	let currentList: SectionList | null = null;
	let sectionCounter = 0;

	for (const element of elements) {
		if (element.type === 'heading') {
			// Fermer la liste en cours
			if (currentList && currentSection) {
				currentSection.content.push(currentList);
				currentList = null;
			}

			// Créer une nouvelle section ou sous-section
			const level = element.headingLevel ?? 1;

			if (level === 1 || !currentSection) {
				// Nouvelle section principale
				if (currentSection) {
					sections.push(currentSection);
				}
				sectionCounter++;
				currentSection = {
					id: `section_${sectionCounter}`,
					title: element.text,
					level: 1,
					content: [],
					subsections: [],
				};
			} else {
				// Ajouter comme contenu (heading dans la section)
				currentSection.content.push({
					type: 'heading',
					text: element.text,
					level: level as 1 | 2 | 3 | 4 | 5 | 6,
				} as SectionHeading);
			}
		} else if (element.type === 'listItem') {
			// Ajouter à la liste en cours ou créer une nouvelle
			if (!currentList) {
				currentList = {
					type: 'list',
					items: [],
					ordered: element.listOrdered ?? false,
				};
			}

			currentList.items.push({
				text: element.text,
				level: element.listLevel ?? 0,
				style: element.style,
			});
		} else {
			// Paragraphe normal
			// Fermer la liste en cours
			if (currentList && currentSection) {
				currentSection.content.push(currentList);
				currentList = null;
			}

			if (!currentSection) {
				// Créer une section par défaut si on n'en a pas
				sectionCounter++;
				currentSection = {
					id: `section_${sectionCounter}`,
					title: 'Introduction',
					level: 1,
					content: [],
				};
			}

			currentSection.content.push({
				type: 'paragraph',
				text: element.text,
				style: element.style,
			} as SectionParagraph);
		}
	}

	// Fermer la dernière liste et section
	if (currentList && currentSection) {
		currentSection.content.push(currentList);
	}
	if (currentSection) {
		sections.push(currentSection);
	}

	return sections;
}

/**
 * Convertit un élément parsé en ExtractedParagraph.
 */
function elementToParagraph(element: ParsedElement): ExtractedParagraph {
	return {
		text: element.text,
		type: element.type,
		headingLevel: element.headingLevel,
		listIndex: undefined, // Nécessiterait un compteur global
		listOrdered: element.listOrdered,
		style: element.style,
		sectionId: element.sectionId,
	};
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Compte les mots dans un texte.
 */
export function countWords(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
}

/**
 * Compte les caractères dans un texte (sans espaces).
 */
export function countCharacters(text: string): number {
	return text.replace(/\s/g, '').length;
}

/**
 * Détecte le nombre de titres par niveau.
 */
export function countHeadingsByLevel(
	elements: ParsedElement[]
): Record<number, number> {
	const counts: Record<number, number> = {};

	for (const el of elements) {
		if (el.type === 'heading' && el.headingLevel) {
			counts[el.headingLevel] = (counts[el.headingLevel] || 0) + 1;
		}
	}

	return counts;
}

/**
 * Extrait tous les textes des paragraphes pour le comptage de mots.
 */
export function extractAllText(xml: string): string {
	const textParts: string[] = [];
	const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
	let match;

	while ((match = textRegex.exec(xml)) !== null) {
		textParts.push(match[1]);
	}

	return textParts.join(' ');
}
