/**
 * ============================================================================
 * DOCUMENT SEGMENTER - Division des documents DOCX en pages/sections
 * ============================================================================
 *
 * Ce module permet de diviser un document DOCX en segments logiques
 * (pages, sections, tableaux) pour faciliter le matching entre templates.
 *
 * POURQUOI SEGMENTER ?
 * - Les documents administratifs (DC1, DC2, AE) sont longs (10+ pages)
 * - Les tags sont souvent concentrés sur certaines pages/sections
 * - Matcher section par section améliore la précision
 * - Évite de scroller tout le document pour trouver les correspondances
 *
 * STRATÉGIES DE SEGMENTATION :
 * 1. Par sections lettrées (A, B, C, D, E...) - Typique des formulaires admin
 * 2. Par tableaux (<w:tbl>) - Structure principale des DC1/DC2
 * 3. Par sauts de page (<w:br w:type="page"/>) - Si présents
 * 4. Par sauts de section (<w:sectPr>) - Divisions Word explicites
 *
 * @author Rokodo
 * @version 2.0.0
 */

import { extractTextFromXml } from './xml.utils';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Représente un segment logique du document.
 */
export interface DocumentSegment {
	/** Identifiant unique du segment */
	id: string;
	/** Type de segment */
	type: 'section' | 'table' | 'page' | 'paragraph_group';
	/** Titre ou label du segment (ex: "Section E - Capacités économiques") */
	title: string;
	/** Lettre de section si applicable (A, B, C...) */
	sectionLetter?: string;
	/** Index du tableau si type = 'table' */
	tableIndex?: number;
	/** Contenu XML brut du segment */
	xml: string;
	/** Texte extrait (pour le matching) */
	text: string;
	/** Position de début dans le XML original */
	startOffset: number;
	/** Position de fin dans le XML original */
	endOffset: number;
	/** Paragraphes contenus dans ce segment */
	paragraphCount: number;
	/** Tags {{TAG}} trouvés dans ce segment */
	tags: string[];
	/** Métadonnées supplémentaires */
	metadata: Record<string, unknown>;
}

/**
 * Résultat de la segmentation d'un document.
 */
export interface SegmentationResult {
	/** Liste des segments extraits */
	segments: DocumentSegment[];
	/** Stratégie utilisée */
	strategy: 'sections' | 'tables' | 'pages' | 'hybrid';
	/** Statistiques */
	stats: {
		totalSegments: number;
		segmentsWithTags: number;
		totalTags: number;
		totalParagraphs: number;
	};
}

/**
 * Options de segmentation.
 */
export interface SegmentationOptions {
	/** Stratégie préférée (auto = détection automatique) */
	strategy?: 'auto' | 'sections' | 'tables' | 'pages' | 'hybrid';
	/** Inclure les segments vides */
	includeEmpty?: boolean;
	/** Taille minimale d'un segment (en caractères) */
	minSegmentSize?: number;
	/** Fusionner les petits segments consécutifs */
	mergeSmallSegments?: boolean;
}

// ============================================================================
// REGEX PATTERNS
// ============================================================================

/** Pattern pour détecter les marqueurs de section (A -, B -, etc.) */
const SECTION_MARKER_REGEX = /^([A-H])\s*[-–—:]\s*(.+?)(?:\s*$|\.)/i;

/** Pattern pour détecter les sections dans le texte */
const SECTION_TEXT_PATTERNS = [
	/([A-H])\s*[-–—]\s*Identification/i,
	/([A-H])\s*[-–—]\s*Objet/i,
	/([A-H])\s*[-–—]\s*(?:Renseignements|Capacit[ée]s)/i,
	/Section\s+([A-H])/i,
];

/** Pattern pour les tags {{TAG}} */
const TAG_REGEX = /\{\{([A-Z_0-9]+)\}\}/g;

/** Pattern pour les tableaux XML */
const TABLE_REGEX = /<w:tbl[^>]*>[\s\S]*?<\/w:tbl>/g;

/** Pattern pour les paragraphes XML */
const PARAGRAPH_REGEX = /<w:p[^>]*>[\s\S]*?<\/w:p>/g;

/** Pattern pour les sauts de page */
const PAGE_BREAK_REGEX = /<w:br\s+w:type="page"\s*\/?>/g;

/** Pattern pour les sections Word */
const SECTION_BREAK_REGEX = /<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/g;

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Segmente un document DOCX en parties logiques.
 *
 * @param xml - Le XML du document (word/document.xml)
 * @param options - Options de segmentation
 * @returns Le résultat de la segmentation
 *
 * @example
 * const { xml } = loadDocxContent(buffer);
 * const result = segmentDocument(xml, { strategy: 'auto' });
 * console.log(`${result.segments.length} segments trouvés`);
 *
 * // Trouver le segment avec le tag CA_N
 * const caSegment = result.segments.find(s => s.tags.includes('CA_N'));
 */
export function segmentDocument(
	xml: string,
	options: SegmentationOptions = {}
): SegmentationResult {
	const {
		strategy = 'auto',
		includeEmpty = false,
		minSegmentSize = 50,
		mergeSmallSegments = true,
	} = options;

	// Déterminer la stratégie à utiliser
	const effectiveStrategy = strategy === 'auto' ? detectBestStrategy(xml) : strategy;

	let segments: DocumentSegment[];

	switch (effectiveStrategy) {
		case 'sections':
			segments = segmentBySections(xml);
			break;
		case 'tables':
			segments = segmentByTables(xml);
			break;
		case 'pages':
			segments = segmentByPages(xml);
			break;
		case 'hybrid':
		default:
			segments = segmentHybrid(xml);
			break;
	}

	// Filtrer les segments vides si demandé
	if (!includeEmpty) {
		segments = segments.filter((s) => s.text.trim().length >= minSegmentSize);
	}

	// Fusionner les petits segments si demandé
	if (mergeSmallSegments) {
		segments = mergeSmallConsecutiveSegments(segments, minSegmentSize * 2);
	}

	// Calculer les statistiques
	const stats = {
		totalSegments: segments.length,
		segmentsWithTags: segments.filter((s) => s.tags.length > 0).length,
		totalTags: segments.reduce((sum, s) => sum + s.tags.length, 0),
		totalParagraphs: segments.reduce((sum, s) => sum + s.paragraphCount, 0),
	};

	return {
		segments,
		strategy: effectiveStrategy,
		stats,
	};
}

// ============================================================================
// DÉTECTION DE STRATÉGIE
// ============================================================================

/**
 * Détecte la meilleure stratégie de segmentation pour un document.
 */
function detectBestStrategy(xml: string): 'sections' | 'tables' | 'pages' | 'hybrid' {
	const tableCount = (xml.match(TABLE_REGEX) || []).length;
	const pageBreakCount = (xml.match(PAGE_BREAK_REGEX) || []).length;
	const text = extractTextFromXml(xml);

	// Vérifier si le document a des sections lettrées
	const hasSectionMarkers = SECTION_TEXT_PATTERNS.some((pattern) => pattern.test(text));

	// Si beaucoup de tableaux et des marqueurs de section → hybrid
	if (tableCount >= 5 && hasSectionMarkers) {
		return 'hybrid';
	}

	// Si principalement des tableaux → tables
	if (tableCount >= 8) {
		return 'tables';
	}

	// Si des sauts de page → pages
	if (pageBreakCount >= 3) {
		return 'pages';
	}

	// Si des marqueurs de section → sections
	if (hasSectionMarkers) {
		return 'sections';
	}

	// Par défaut, utiliser hybrid
	return 'hybrid';
}

// ============================================================================
// SEGMENTATION PAR TABLEAUX
// ============================================================================

/**
 * Segmente le document par tableaux (<w:tbl>).
 * Idéal pour les formulaires DC1/DC2 structurés en tableaux.
 */
function segmentByTables(xml: string): DocumentSegment[] {
	const segments: DocumentSegment[] = [];
	let tableIndex = 0;
	let lastEnd = 0;

	// Trouver tous les tableaux
	const tableMatches = [...xml.matchAll(/<w:tbl[^>]*>[\s\S]*?<\/w:tbl>/g)];

	for (const match of tableMatches) {
		const tableXml = match[0];
		const startOffset = match.index!;
		const endOffset = startOffset + tableXml.length;

		// Extraire le texte du tableau
		const text = extractTextFromXml(tableXml);

		// Extraire les tags
		const tags = extractTagsFromSegment(tableXml);

		// Détecter si c'est une section lettrée
		const sectionMatch = detectSectionFromText(text);

		// Compter les paragraphes
		const paragraphCount = (tableXml.match(PARAGRAPH_REGEX) || []).length;

		// Créer un titre descriptif
		const title = createTableTitle(text, tableIndex, sectionMatch);

		segments.push({
			id: `table-${tableIndex}`,
			type: 'table',
			title,
			sectionLetter: sectionMatch?.letter,
			tableIndex,
			xml: tableXml,
			text,
			startOffset,
			endOffset,
			paragraphCount,
			tags,
			metadata: {
				hasFinancialData: /chiffre\s*d'affaires|CA|exercice/i.test(text),
				hasContactInfo: /email|téléphone|adresse/i.test(text),
				hasIdentification: /SIRET|SIREN|nom\s*commercial/i.test(text),
			},
		});

		tableIndex++;
		lastEnd = endOffset;
	}

	return segments;
}

/**
 * Crée un titre descriptif pour un tableau.
 */
function createTableTitle(
	text: string,
	index: number,
	sectionMatch: { letter: string; title: string } | null
): string {
	if (sectionMatch) {
		return `Section ${sectionMatch.letter} - ${sectionMatch.title}`;
	}

	// Essayer de trouver un titre dans les premières lignes
	const lines = text.split('\n').filter((l) => l.trim().length > 5);
	if (lines.length > 0) {
		const firstLine = lines[0].trim().substring(0, 60);
		return `Tableau ${index + 1}: ${firstLine}${firstLine.length >= 60 ? '...' : ''}`;
	}

	return `Tableau ${index + 1}`;
}

// ============================================================================
// SEGMENTATION PAR SECTIONS
// ============================================================================

/**
 * Segmente le document par sections lettrées (A, B, C...).
 * Idéal pour les documents administratifs français.
 */
function segmentBySections(xml: string): DocumentSegment[] {
	const segments: DocumentSegment[] = [];
	const text = extractTextFromXml(xml);

	// Trouver tous les marqueurs de section
	const sectionPositions: { letter: string; title: string; textPos: number }[] = [];

	for (const pattern of SECTION_TEXT_PATTERNS) {
		let match;
		const regex = new RegExp(pattern.source, 'gi');
		while ((match = regex.exec(text)) !== null) {
			const letter = match[1].toUpperCase();
			// Éviter les doublons
			if (!sectionPositions.find((s) => s.letter === letter)) {
				sectionPositions.push({
					letter,
					title: match[0],
					textPos: match.index,
				});
			}
		}
	}

	// Trier par position
	sectionPositions.sort((a, b) => a.textPos - b.textPos);

	if (sectionPositions.length === 0) {
		// Pas de sections trouvées, retourner le document entier
		return [createFullDocumentSegment(xml)];
	}

	// Créer les segments basés sur les sections
	for (let i = 0; i < sectionPositions.length; i++) {
		const current = sectionPositions[i];
		const next = sectionPositions[i + 1];

		// Approximer les positions XML (ratio texte/XML)
		const ratio = xml.length / text.length;
		const approxStart = Math.floor(current.textPos * ratio);
		const approxEnd = next ? Math.floor(next.textPos * ratio) : xml.length;

		// Extraire la portion XML approximative
		const segmentXml = xml.substring(approxStart, approxEnd);
		const segmentText = extractTextFromXml(segmentXml);

		segments.push({
			id: `section-${current.letter}`,
			type: 'section',
			title: `Section ${current.letter}`,
			sectionLetter: current.letter,
			xml: segmentXml,
			text: segmentText,
			startOffset: approxStart,
			endOffset: approxEnd,
			paragraphCount: (segmentXml.match(PARAGRAPH_REGEX) || []).length,
			tags: extractTagsFromSegment(segmentXml),
			metadata: {},
		});
	}

	return segments;
}

// ============================================================================
// SEGMENTATION PAR PAGES
// ============================================================================

/**
 * Segmente le document par sauts de page.
 */
function segmentByPages(xml: string): DocumentSegment[] {
	const segments: DocumentSegment[] = [];
	const pageBreakPositions: number[] = [];

	// Trouver tous les sauts de page
	let match;
	const regex = new RegExp(PAGE_BREAK_REGEX.source, 'g');
	while ((match = regex.exec(xml)) !== null) {
		pageBreakPositions.push(match.index);
	}

	if (pageBreakPositions.length === 0) {
		return [createFullDocumentSegment(xml)];
	}

	// Créer les segments
	let lastPos = 0;
	for (let i = 0; i <= pageBreakPositions.length; i++) {
		const endPos = pageBreakPositions[i] || xml.length;
		const segmentXml = xml.substring(lastPos, endPos);
		const segmentText = extractTextFromXml(segmentXml);

		segments.push({
			id: `page-${i + 1}`,
			type: 'page',
			title: `Page ${i + 1}`,
			xml: segmentXml,
			text: segmentText,
			startOffset: lastPos,
			endOffset: endPos,
			paragraphCount: (segmentXml.match(PARAGRAPH_REGEX) || []).length,
			tags: extractTagsFromSegment(segmentXml),
			metadata: {},
		});

		lastPos = endPos;
	}

	return segments;
}

// ============================================================================
// SEGMENTATION HYBRIDE
// ============================================================================

/**
 * Segmentation hybride combinant tableaux et sections.
 * Meilleure approche pour les documents DC1/DC2/AE.
 */
function segmentHybrid(xml: string): DocumentSegment[] {
	// D'abord segmenter par tableaux
	const tableSegments = segmentByTables(xml);

	// Enrichir avec les informations de section
	const text = extractTextFromXml(xml);

	for (const segment of tableSegments) {
		if (!segment.sectionLetter) {
			// Essayer de trouver la section dans le contexte
			const sectionMatch = detectSectionFromText(segment.text);
			if (sectionMatch) {
				segment.sectionLetter = sectionMatch.letter;
				segment.title = `Section ${sectionMatch.letter} - ${segment.title}`;
			}
		}

		// Ajouter des métadonnées de contenu
		enrichSegmentMetadata(segment);
	}

	return tableSegments;
}

/**
 * Enrichit un segment avec des métadonnées utiles.
 */
function enrichSegmentMetadata(segment: DocumentSegment): void {
	const text = segment.text.toLowerCase();

	segment.metadata = {
		...segment.metadata,
		// Catégories de contenu
		hasFinancialData: /chiffre\s*d'affaires|CA\s|exercice\s*du|montant/i.test(text),
		hasContactInfo: /email|@|téléphone|télécopie|fax|adresse\s*(électronique|postale)/i.test(
			text
		),
		hasIdentification: /siret|siren|nom\s*commercial|dénomination|raison\s*sociale/i.test(text),
		hasLegalInfo: /forme\s*juridique|rcs|capital|représentant/i.test(text),
		hasDates: /du\s*\.\.\.|exercice|année|période/i.test(text),
		// Score de pertinence (plus c'est haut, plus c'est susceptible de contenir des données)
		relevanceScore: calculateRelevanceScore(segment),
	};
}

/**
 * Calcule un score de pertinence pour le segment.
 */
function calculateRelevanceScore(segment: DocumentSegment): number {
	let score = 0;

	// Tags présents = très pertinent
	score += segment.tags.length * 20;

	// Contenu identifiable
	if (segment.metadata.hasIdentification) score += 15;
	if (segment.metadata.hasContactInfo) score += 10;
	if (segment.metadata.hasFinancialData) score += 15;
	if (segment.metadata.hasLegalInfo) score += 5;

	// Taille du contenu
	if (segment.text.length > 500) score += 5;
	if (segment.paragraphCount > 5) score += 5;

	return Math.min(100, score);
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Extrait les tags d'un segment XML.
 */
function extractTagsFromSegment(xml: string): string[] {
	const tags: string[] = [];
	let match;
	const regex = new RegExp(TAG_REGEX.source, 'g');

	while ((match = regex.exec(xml)) !== null) {
		const tagName = match[1];
		if (!tags.includes(tagName)) {
			tags.push(tagName);
		}
	}

	return tags;
}

/**
 * Détecte une section lettrée dans le texte.
 */
function detectSectionFromText(text: string): { letter: string; title: string } | null {
	for (const pattern of SECTION_TEXT_PATTERNS) {
		const match = text.match(pattern);
		if (match) {
			return {
				letter: match[1].toUpperCase(),
				title: match[0].substring(0, 50),
			};
		}
	}

	// Essayer le pattern simple
	const simpleMatch = text.match(SECTION_MARKER_REGEX);
	if (simpleMatch) {
		return {
			letter: simpleMatch[1].toUpperCase(),
			title: simpleMatch[2].substring(0, 50),
		};
	}

	return null;
}

/**
 * Crée un segment représentant le document entier.
 */
function createFullDocumentSegment(xml: string): DocumentSegment {
	const text = extractTextFromXml(xml);

	return {
		id: 'full-document',
		type: 'paragraph_group',
		title: 'Document complet',
		xml,
		text,
		startOffset: 0,
		endOffset: xml.length,
		paragraphCount: (xml.match(PARAGRAPH_REGEX) || []).length,
		tags: extractTagsFromSegment(xml),
		metadata: {},
	};
}

/**
 * Fusionne les petits segments consécutifs.
 */
function mergeSmallConsecutiveSegments(
	segments: DocumentSegment[],
	minSize: number
): DocumentSegment[] {
	if (segments.length <= 1) return segments;

	const merged: DocumentSegment[] = [];
	let current: DocumentSegment | null = null;

	for (const segment of segments) {
		if (!current) {
			current = { ...segment };
			continue;
		}

		// Si le segment actuel ou le suivant est petit, fusionner
		if (current.text.length < minSize || segment.text.length < minSize) {
			current = {
				...current,
				id: `${current.id}+${segment.id}`,
				title: `${current.title} + ${segment.title}`,
				xml: current.xml + segment.xml,
				text: current.text + '\n' + segment.text,
				endOffset: segment.endOffset,
				paragraphCount: current.paragraphCount + segment.paragraphCount,
				tags: [...new Set([...current.tags, ...segment.tags])],
				metadata: { ...current.metadata, ...segment.metadata },
			};
		} else {
			merged.push(current);
			current = { ...segment };
		}
	}

	if (current) {
		merged.push(current);
	}

	return merged;
}

// ============================================================================
// FONCTIONS DE CORRESPONDANCE
// ============================================================================

/**
 * Trouve les segments correspondants entre un template et un document cible.
 *
 * @param templateSegments - Segments du template (avec tags)
 * @param targetSegments - Segments du document cible
 * @returns Mapping des correspondances
 *
 * @example
 * const templateResult = segmentDocument(templateXml);
 * const targetResult = segmentDocument(targetXml);
 * const matches = matchSegments(templateResult.segments, targetResult.segments);
 */
export function matchSegments(
	templateSegments: DocumentSegment[],
	targetSegments: DocumentSegment[]
): Map<string, { templateSegment: DocumentSegment; targetSegment: DocumentSegment; score: number }> {
	const matches = new Map<
		string,
		{ templateSegment: DocumentSegment; targetSegment: DocumentSegment; score: number }
	>();

	// Ne traiter que les segments du template qui ont des tags
	const segmentsWithTags = templateSegments.filter((s) => s.tags.length > 0);

	for (const templateSeg of segmentsWithTags) {
		let bestMatch: DocumentSegment | null = null;
		let bestScore = 0;

		for (const targetSeg of targetSegments) {
			const score = calculateSegmentSimilarity(templateSeg, targetSeg);

			if (score > bestScore) {
				bestScore = score;
				bestMatch = targetSeg;
			}
		}

		if (bestMatch && bestScore >= 30) {
			matches.set(templateSeg.id, {
				templateSegment: templateSeg,
				targetSegment: bestMatch,
				score: bestScore,
			});
		}
	}

	return matches;
}

/**
 * Calcule la similarité entre deux segments.
 */
function calculateSegmentSimilarity(
	template: DocumentSegment,
	target: DocumentSegment
): number {
	let score = 0;

	// Même lettre de section = forte correspondance
	if (template.sectionLetter && template.sectionLetter === target.sectionLetter) {
		score += 40;
	}

	// Même type de contenu
	if (template.metadata.hasFinancialData && target.metadata.hasFinancialData) {
		score += 20;
	}
	if (template.metadata.hasContactInfo && target.metadata.hasContactInfo) {
		score += 15;
	}
	if (template.metadata.hasIdentification && target.metadata.hasIdentification) {
		score += 15;
	}

	// Même index de tableau
	if (
		template.type === 'table' &&
		target.type === 'table' &&
		template.tableIndex === target.tableIndex
	) {
		score += 30;
	}

	// Similarité de texte (mots-clés communs)
	const templateWords = new Set(
		template.text
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length > 4)
	);
	const targetWords = new Set(
		target.text
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length > 4)
	);

	let commonWords = 0;
	for (const word of templateWords) {
		if (targetWords.has(word)) commonWords++;
	}

	if (templateWords.size > 0) {
		score += Math.min(20, (commonWords / templateWords.size) * 20);
	}

	return Math.min(100, score);
}

/**
 * Extrait uniquement les segments pertinents (ceux avec tags ou haute pertinence).
 */
export function extractRelevantSegments(
	result: SegmentationResult,
	options: { minRelevance?: number; onlyWithTags?: boolean } = {}
): DocumentSegment[] {
	const { minRelevance = 30, onlyWithTags = false } = options;

	return result.segments.filter((segment) => {
		if (onlyWithTags && segment.tags.length === 0) {
			return false;
		}

		const relevance = (segment.metadata.relevanceScore as number) || 0;
		return relevance >= minRelevance || segment.tags.length > 0;
	});
}
