/**
 * ============================================================================
 * SERVICE PDF EXTRACTOR - Extraction de texte avec positions
 * ============================================================================
 *
 * Ce service extrait le contenu textuel d'un PDF avec les positions absolues
 * de chaque élément. Il utilise pdfjs-dist (Mozilla pdf.js) pour le parsing.
 *
 * FONCTIONNALITÉS:
 * - Extraction de texte avec coordonnées (x, y, width, height)
 * - Reconstruction des lignes de texte
 * - Détection des zones vides (potentiels champs de saisie)
 * - Extraction des tags {{TAG}} avec leur contexte
 *
 * COORDONNÉES PDF:
 * - Origine (0, 0) = coin inférieur gauche
 * - Y augmente vers le haut
 * - Unité = points (72 points = 1 pouce)
 *
 * @author Rokodo
 * @version 1.0.0
 */

import type {
	PdfTextElement,
	PdfTextLine,
	PdfEmptyZone,
	PdfField,
	PdfPageContent,
	PdfDocumentContent,
	PdfTemplateTag,
} from '../types';

// Import pdfjs-dist (version 3.x compatible CommonJS)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Types pour pdfjs-dist
interface TextItem {
	str: string;
	transform: number[];
	width: number;
	height: number;
	fontName?: string;
}

interface TextMarkedContent {
	type: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Tolérance verticale pour considérer des éléments sur la même ligne (en points) */
const LINE_Y_TOLERANCE = 3;

/** Espace minimum entre deux éléments pour les considérer séparés (en points) */
const WORD_GAP_THRESHOLD = 5;

/** Largeur minimum d'une zone vide pour être considérée comme champ (en points) */
const MIN_EMPTY_ZONE_WIDTH = 30;

/** Pattern pour détecter les tags */
const TAG_PATTERN = /\{\{([A-Z_0-9]+)\}\}/g;

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Extrait le contenu complet d'un PDF avec positions.
 *
 * @param pdfBuffer - Buffer contenant le PDF
 * @param options - Options d'extraction
 * @returns Contenu du document avec structure complète
 */
export async function extractPdfContent(
	pdfBuffer: Buffer,
	options: {
		maxPages?: number;
		extractFields?: boolean;
		debug?: boolean;
	} = {}
): Promise<PdfDocumentContent> {
	const { maxPages, extractFields = true, debug = false } = options;

	if (debug) {
		console.log('\n📄 Extraction PDF en cours...');
	}

	// Charger le document PDF
	const data = new Uint8Array(pdfBuffer);
	const loadingTask = pdfjsLib.getDocument({ data });
	const pdfDoc = await loadingTask.promise;

	const pageCount = pdfDoc.numPages;
	const pagesToProcess = maxPages ? Math.min(maxPages, pageCount) : pageCount;

	if (debug) {
		console.log(`   Pages totales: ${pageCount}`);
		console.log(`   Pages à traiter: ${pagesToProcess}`);
	}

	// Extraire les métadonnées
	const metadata = await pdfDoc.getMetadata().catch(() => null);
	const info = metadata?.info as Record<string, unknown> | undefined;

	// Traiter chaque page
	const pages: PdfPageContent[] = [];

	for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
		const page = await pdfDoc.getPage(pageNum);
		const pageContent = await extractPageContent(page, pageNum, extractFields, debug);
		pages.push(pageContent);
	}

	// Extraire les tags si présents
	const tags = extractTagsFromPages(pages);

	if (debug) {
		console.log(`   Tags trouvés: ${tags.length}`);
		console.log('   Extraction terminée.\n');
	}

	return {
		pageCount,
		pages,
		metadata: {
			title: info?.Title as string | undefined,
			author: info?.Author as string | undefined,
			creator: info?.Creator as string | undefined,
		},
		tags: tags.length > 0 ? tags : undefined,
	};
}

// ============================================================================
// EXTRACTION DE PAGE
// ============================================================================

/**
 * Extrait le contenu d'une page PDF.
 */
async function extractPageContent(
	page: { getViewport: (opts: { scale: number }) => { width: number; height: number }; getTextContent: () => Promise<{ items: (TextItem | TextMarkedContent)[] }> },
	pageNumber: number,
	extractFields: boolean,
	debug: boolean
): Promise<PdfPageContent> {
	const viewport = page.getViewport({ scale: 1.0 });
	const textContent = await page.getTextContent();

	// Extraire les éléments de texte bruts
	const textElements = extractTextElements(textContent.items, viewport, pageNumber);

	// Reconstruire les lignes
	const lines = reconstructLines(textElements);

	// Détecter les zones vides
	const emptyZones = detectEmptyZones(lines, viewport.width, viewport.height, pageNumber);

	// Détecter les champs si demandé
	const fields = extractFields ? detectFields(lines, emptyZones, pageNumber) : [];

	if (debug) {
		console.log(`   Page ${pageNumber}: ${textElements.length} éléments, ${lines.length} lignes, ${fields.length} champs`);
	}

	return {
		pageNumber,
		width: viewport.width,
		height: viewport.height,
		textElements,
		lines,
		emptyZones,
		fields,
	};
}

/**
 * Extrait les éléments de texte individuels.
 */
function extractTextElements(
	items: (TextItem | TextMarkedContent)[],
	_viewport: { width: number; height: number },
	pageNumber: number
): PdfTextElement[] {
	const elements: PdfTextElement[] = [];
	let index = 0;

	for (const item of items) {
		// Ignorer les éléments marqués (non-texte)
		if (!('str' in item)) continue;

		const textItem = item as TextItem;
		if (!textItem.str || textItem.str.trim() === '') continue;

		// Calculer la position
		// transform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
		const transform = textItem.transform;
		const x = transform[4];
		const y = transform[5];
		const width = textItem.width;
		const height = textItem.height;

		elements.push({
			text: textItem.str,
			x,
			y,
			width,
			height,
			page: pageNumber,
			fontSize: height, // Approximation
			fontName: textItem.fontName,
			index: index++,
		});
	}

	return elements;
}

// ============================================================================
// RECONSTRUCTION DES LIGNES
// ============================================================================

/**
 * Reconstruit les lignes de texte à partir des éléments.
 * Groupe les éléments ayant approximativement le même Y.
 */
function reconstructLines(elements: PdfTextElement[]): PdfTextLine[] {
	if (elements.length === 0) return [];

	// Trier par Y décroissant (haut vers bas), puis par X croissant
	const sorted = [...elements].sort((a, b) => {
		const yDiff = b.y - a.y;
		if (Math.abs(yDiff) > LINE_Y_TOLERANCE) return yDiff;
		return a.x - b.x;
	});

	const lines: PdfTextLine[] = [];
	let currentLineElements: PdfTextElement[] = [];
	let currentY = sorted[0].y;
	let lineIndex = 0;

	for (const element of sorted) {
		// Nouveau groupe si Y est significativement différent
		if (Math.abs(element.y - currentY) > LINE_Y_TOLERANCE) {
			if (currentLineElements.length > 0) {
				lines.push(createLine(currentLineElements, lineIndex++));
			}
			currentLineElements = [element];
			currentY = element.y;
		} else {
			currentLineElements.push(element);
		}
	}

	// Dernière ligne
	if (currentLineElements.length > 0) {
		lines.push(createLine(currentLineElements, lineIndex));
	}

	return lines;
}

/**
 * Crée une ligne à partir d'éléments groupés.
 */
function createLine(elements: PdfTextElement[], lineIndex: number): PdfTextLine {
	// Trier par X pour reconstruire le texte dans l'ordre
	const sorted = [...elements].sort((a, b) => a.x - b.x);

	// Reconstruire le texte avec espaces appropriés
	let text = '';
	let lastEnd = 0;

	for (const elem of sorted) {
		// Ajouter un espace si gap significatif
		if (text.length > 0 && elem.x - lastEnd > WORD_GAP_THRESHOLD) {
			text += ' ';
		}
		text += elem.text;
		lastEnd = elem.x + elem.width;
	}

	// Calculer les dimensions de la ligne
	const minX = Math.min(...sorted.map(e => e.x));
	const maxX = Math.max(...sorted.map(e => e.x + e.width));
	const avgY = sorted.reduce((sum, e) => sum + e.y, 0) / sorted.length;
	const maxHeight = Math.max(...sorted.map(e => e.height));

	return {
		text,
		x: minX,
		y: avgY,
		width: maxX - minX,
		height: maxHeight,
		page: sorted[0].page,
		elements: sorted,
		lineIndex,
	};
}

// ============================================================================
// DÉTECTION DES ZONES VIDES
// ============================================================================

/**
 * Détecte les zones vides potentiellement destinées à la saisie.
 */
function detectEmptyZones(
	lines: PdfTextLine[],
	pageWidth: number,
	_pageHeight: number,
	pageNumber: number
): PdfEmptyZone[] {
	const zones: PdfEmptyZone[] = [];

	for (const line of lines) {
		// Zone après deux-points
		if (line.text.trim().endsWith(':')) {
			const colonEnd = line.x + line.width;
			const remainingWidth = pageWidth - colonEnd - 50; // Marge droite

			if (remainingWidth >= MIN_EMPTY_ZONE_WIDTH) {
				zones.push({
					x: colonEnd + 5,
					y: line.y,
					width: remainingWidth,
					height: line.height,
					page: pageNumber,
					precedingText: line.text.trim(),
					type: 'after_colon',
				});
			}
		}

		// Détecter les gaps dans la ligne
		const gaps = detectGapsInLine(line, pageNumber);
		zones.push(...gaps);
	}

	return zones;
}

/**
 * Détecte les gaps significatifs dans une ligne de texte.
 */
function detectGapsInLine(line: PdfTextLine, pageNumber: number): PdfEmptyZone[] {
	const gaps: PdfEmptyZone[] = [];
	const elements = line.elements;

	if (elements.length < 2) return gaps;

	for (let i = 0; i < elements.length - 1; i++) {
		const current = elements[i];
		const next = elements[i + 1];
		const gapStart = current.x + current.width;
		const gapWidth = next.x - gapStart;

		// Gap significatif (potentiel champ de saisie)
		if (gapWidth >= MIN_EMPTY_ZONE_WIDTH) {
			gaps.push({
				x: gapStart,
				y: line.y,
				width: gapWidth,
				height: line.height,
				page: pageNumber,
				precedingText: current.text,
				type: 'gap',
			});
		}
	}

	return gaps;
}

// ============================================================================
// DÉTECTION DES CHAMPS
// ============================================================================

/**
 * Détecte les champs (label + zone de saisie) dans une page.
 */
function detectFields(
	lines: PdfTextLine[],
	emptyZones: PdfEmptyZone[],
	pageNumber: number
): PdfField[] {
	const fields: PdfField[] = [];
	let fieldIndex = 0;

	// Méthode 1: Champs basés sur les deux-points
	for (const line of lines) {
		const colonIndex = line.text.indexOf(':');
		if (colonIndex === -1) continue;

		const label = line.text.substring(0, colonIndex + 1).trim();
		if (label.length < 3) continue;

		// Chercher une zone vide correspondante
		const matchingZone = emptyZones.find(
			z => z.page === pageNumber &&
				Math.abs(z.y - line.y) < LINE_Y_TOLERANCE &&
				z.type === 'after_colon'
		);

		if (matchingZone) {
			fields.push({
				id: `field_${pageNumber}_${fieldIndex++}`,
				label,
				labelPosition: {
					x: line.x,
					y: line.y,
					width: line.width,
					height: line.height,
					page: pageNumber,
				},
				inputZone: {
					x: matchingZone.x,
					y: matchingZone.y,
					width: matchingZone.width,
					height: matchingZone.height,
					page: pageNumber,
				},
				fieldType: detectFieldType(label),
				confidence: 0.9,
			});
		}
	}

	// Méthode 2: Champs basés sur les gaps
	for (const zone of emptyZones) {
		if (zone.type !== 'gap' || !zone.precedingText) continue;

		// Éviter les doublons avec les champs déjà détectés
		const exists = fields.some(
			f => f.inputZone.page === pageNumber &&
				Math.abs(f.inputZone.x - zone.x) < 10 &&
				Math.abs(f.inputZone.y - zone.y) < LINE_Y_TOLERANCE
		);

		if (!exists) {
			fields.push({
				id: `field_${pageNumber}_${fieldIndex++}`,
				label: zone.precedingText,
				labelPosition: {
					x: zone.x - 100, // Estimation
					y: zone.y,
					width: 100,
					height: zone.height,
					page: zone.page,
				},
				inputZone: {
					x: zone.x,
					y: zone.y,
					width: zone.width,
					height: zone.height,
					page: zone.page,
				},
				fieldType: 'text',
				confidence: 0.7,
			});
		}
	}

	return fields;
}

/**
 * Détermine le type de champ basé sur le label.
 */
function detectFieldType(label: string): PdfField['fieldType'] {
	const labelLower = label.toLowerCase();

	if (labelLower.includes('date') || labelLower.includes('le ') || labelLower.includes('du ')) {
		return 'date';
	}

	if (labelLower.includes('oui') || labelLower.includes('non') || labelLower.includes('cochez')) {
		return 'checkbox';
	}

	if (
		labelLower.includes('montant') ||
		labelLower.includes('prix') ||
		labelLower.includes('€') ||
		labelLower.includes('nombre') ||
		labelLower.includes('n°') ||
		labelLower.includes('siret')
	) {
		return 'number';
	}

	if (labelLower.includes('adresse') || labelLower.includes('description') || labelLower.includes('observations')) {
		return 'multiline';
	}

	return 'text';
}

// ============================================================================
// EXTRACTION DES TAGS
// ============================================================================

/**
 * Extrait tous les tags {{TAG}} des pages.
 */
function extractTagsFromPages(pages: PdfPageContent[]): PdfTemplateTag[] {
	const tags: PdfTemplateTag[] = [];

	for (const page of pages) {
		for (const line of page.lines) {
			let match;
			TAG_PATTERN.lastIndex = 0;

			while ((match = TAG_PATTERN.exec(line.text)) !== null) {
				const tagName = match[1];
				const fullTag = match[0];
				const matchIndex = match.index;

				// Estimer la position X du tag dans la ligne
				const textBeforeTag = line.text.substring(0, matchIndex);
				const avgCharWidth = line.width / line.text.length;
				const tagX = line.x + textBeforeTag.length * avgCharWidth;
				const tagWidth = fullTag.length * avgCharWidth;

				// Extraire le contexte
				const textBefore = line.text.substring(0, matchIndex).trim();
				const textAfter = line.text.substring(matchIndex + fullTag.length).trim();

				tags.push({
					tag: tagName,
					fullTag,
					position: {
						x: tagX,
						y: line.y,
						width: tagWidth,
						height: line.height,
						page: page.pageNumber,
					},
					context: {
						textBefore: textBefore.substring(Math.max(0, textBefore.length - 50)),
						textAfter: textAfter.substring(0, 50),
						lineText: line.text,
					},
					placementType: determinePlacementType(textBefore),
				});
			}
		}
	}

	return tags;
}

/**
 * Détermine le type de placement basé sur le contexte.
 */
function determinePlacementType(textBefore: string): PdfTemplateTag['placementType'] {
	if (textBefore.endsWith(':')) return 'after_colon';
	if (textBefore.length === 0) return 'replace';
	return 'inline';
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Trouve les lignes contenant un texte spécifique.
 */
export function findLinesContaining(
	content: PdfDocumentContent,
	searchText: string,
	options: { caseSensitive?: boolean; page?: number } = {}
): PdfTextLine[] {
	const { caseSensitive = false, page } = options;
	const search = caseSensitive ? searchText : searchText.toLowerCase();
	const results: PdfTextLine[] = [];

	for (const pageContent of content.pages) {
		if (page !== undefined && pageContent.pageNumber !== page) continue;

		for (const line of pageContent.lines) {
			const lineText = caseSensitive ? line.text : line.text.toLowerCase();
			if (lineText.includes(search)) {
				results.push(line);
			}
		}
	}

	return results;
}

/**
 * Trouve les champs proches d'une position donnée.
 */
export function findFieldsNearPosition(
	content: PdfDocumentContent,
	x: number,
	y: number,
	page: number,
	tolerance: number = 20
): PdfField[] {
	const pageContent = content.pages.find(p => p.pageNumber === page);
	if (!pageContent) return [];

	return pageContent.fields.filter(field => {
		const dx = Math.abs(field.inputZone.x - x);
		const dy = Math.abs(field.inputZone.y - y);
		return dx <= tolerance && dy <= tolerance;
	});
}

/**
 * Calcule la similarité de position entre deux éléments.
 */
export function calculatePositionSimilarity(
	pos1: { x: number; y: number },
	pos2: { x: number; y: number },
	tolerance: number = 50
): number {
	const distance = Math.sqrt(
		Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
	);

	if (distance > tolerance * 2) return 0;
	if (distance < tolerance / 2) return 1;

	return 1 - (distance / (tolerance * 2));
}
