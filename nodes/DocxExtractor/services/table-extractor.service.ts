/**
 * ============================================================================
 * TABLE EXTRACTOR SERVICE - Extraction des tableaux DOCX
 * ============================================================================
 *
 * Ce service extrait les tableaux d'un document DOCX et les convertit
 * en structures JSON exploitables.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Les tableaux DOCX utilisent <w:tbl>, <w:tr> (ligne), <w:tc> (cellule)
 * - La première ligne est souvent l'en-tête
 * - On peut convertir en array d'objets si les headers sont détectés
 *
 * @author Rokodo
 * @version 1.0.0
 */

import type {
	ExtractedTable,
	ExtractedTableRow,
	ExtractedTableCell,
	ExtractedTextStyle,
} from '../../shared/types/extraction.types';
import { isBold, isItalic, isUnderline } from '../../shared/utils/style-detector.utils';

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Extrait tous les tableaux d'un document DOCX.
 *
 * @param xml - Contenu XML de word/document.xml
 * @param tableFormat - Format de sortie: 'array' ou 'objects'
 * @param includeStyles - Si true, inclut les styles des cellules
 * @returns Array de tableaux extraits
 */
export function extractTables(
	xml: string,
	tableFormat: 'array' | 'objects' = 'objects',
	includeStyles: boolean = false
): ExtractedTable[] {
	const tables: ExtractedTable[] = [];

	// Matcher tous les tableaux
	const tableRegex = /<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/g;
	let tableMatch;
	let tableIndex = 0;

	while ((tableMatch = tableRegex.exec(xml)) !== null) {
		tableIndex++;
		const tableXml = tableMatch[0];
		const table = parseTable(tableXml, `table_${tableIndex}`, tableFormat, includeStyles);
		tables.push(table);
	}

	return tables;
}

/**
 * Parse un tableau XML.
 */
function parseTable(
	tableXml: string,
	id: string,
	tableFormat: 'array' | 'objects',
	includeStyles: boolean
): ExtractedTable {
	const rows: ExtractedTableRow[] = [];

	// Parser les lignes
	const rowRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
	let rowMatch;
	let isFirstRow = true;

	while ((rowMatch = rowRegex.exec(tableXml)) !== null) {
		const rowXml = rowMatch[0];
		const row = parseTableRow(rowXml, isFirstRow, includeStyles);
		rows.push(row);
		isFirstRow = false;
	}

	// Détecter les headers (première ligne si elle semble être un header)
	let headers: string[] | undefined;
	if (rows.length > 0 && isLikelyHeaderRow(rows[0])) {
		headers = rows[0].cells.map((cell) => cell.text.trim());
		rows[0].isHeader = true;
	}

	// Calculer les dimensions
	const rowCount = rows.length;
	const columnCount = Math.max(...rows.map((r) => r.cells.length), 0);

	// Construire le résultat
	const table: ExtractedTable = {
		id,
		rows,
		rowCount,
		columnCount,
	};

	// Ajouter les headers si détectés
	if (headers && headers.length > 0) {
		table.headers = headers;

		// Convertir en array d'objets si demandé
		if (tableFormat === 'objects' && rows.length > 1) {
			table.data = convertRowsToObjects(rows.slice(1), headers);
		}
	}

	return table;
}

/**
 * Parse une ligne de tableau.
 */
function parseTableRow(
	rowXml: string,
	isFirstRow: boolean,
	includeStyles: boolean
): ExtractedTableRow {
	const cells: ExtractedTableCell[] = [];

	// Parser les cellules
	const cellRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
	let cellMatch;

	while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
		const cellXml = cellMatch[0];
		const cell = parseTableCell(cellXml, includeStyles);
		cells.push(cell);
	}

	return {
		cells,
		isHeader: isFirstRow,
	};
}

/**
 * Parse une cellule de tableau.
 */
function parseTableCell(
	cellXml: string,
	includeStyles: boolean
): ExtractedTableCell {
	// Extraire le texte de tous les paragraphes
	const textParts: string[] = [];
	const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
	let match;

	while ((match = textRegex.exec(cellXml)) !== null) {
		textParts.push(match[1]);
	}

	const text = textParts.join(' ').trim();

	// Détecter colspan (gridSpan)
	let colspan: number | undefined;
	const gridSpanMatch = cellXml.match(/<w:gridSpan\s+w:val="(\d+)"/);
	if (gridSpanMatch) {
		colspan = parseInt(gridSpanMatch[1], 10);
	}

	// Détecter rowspan (vMerge) - note: difficile à compter exactement
	let rowspan: number | undefined;
	if (/<w:vMerge\s+w:val="restart"/.test(cellXml)) {
		rowspan = undefined; // Indique le début d'une fusion, mais on ne sait pas la longueur
	}

	// Style
	let style: ExtractedTextStyle | undefined;
	if (includeStyles) {
		style = extractCellStyle(cellXml);
	}

	return {
		text,
		colspan,
		rowspan,
		style,
	};
}

/**
 * Extrait le style d'une cellule (du premier run).
 */
function extractCellStyle(cellXml: string): ExtractedTextStyle {
	const runRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/;
	const match = runRegex.exec(cellXml);

	if (match) {
		const runXml = match[0];
		return {
			bold: isBold(runXml),
			italic: isItalic(runXml),
			underline: isUnderline(runXml),
		};
	}

	return {};
}

/**
 * Détermine si une ligne semble être un header.
 * Critères: texte en gras, texte court, pas de nombres seuls.
 */
function isLikelyHeaderRow(row: ExtractedTableRow): boolean {
	if (row.cells.length === 0) return false;

	let boldCount = 0;
	let shortTextCount = 0;
	let validHeaderCount = 0;

	for (const cell of row.cells) {
		const text = cell.text.trim();

		// Header vide = pas un header
		if (!text) continue;

		// Vérifier si c'est du texte court
		if (text.length < 50) {
			shortTextCount++;
		}

		// Vérifier si c'est en gras
		if (cell.style?.bold) {
			boldCount++;
		}

		// Un header est généralement du texte, pas juste des nombres
		if (!/^\d+([.,]\d+)?$/.test(text)) {
			validHeaderCount++;
		}
	}

	const totalCells = row.cells.length;

	// Au moins 50% des cellules doivent ressembler à des headers
	const isLikelyHeader =
		(shortTextCount >= totalCells * 0.5 && validHeaderCount >= totalCells * 0.5) ||
		boldCount >= totalCells * 0.5;

	return isLikelyHeader;
}

/**
 * Convertit les lignes en array d'objets clé-valeur.
 */
function convertRowsToObjects(
	rows: ExtractedTableRow[],
	headers: string[]
): Record<string, string>[] {
	return rows.map((row) => {
		const obj: Record<string, string> = {};

		for (let i = 0; i < headers.length; i++) {
			const key = headers[i] || `column_${i + 1}`;
			const value = row.cells[i]?.text ?? '';
			obj[key] = value;
		}

		return obj;
	});
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Compte le nombre total de cellules dans tous les tableaux.
 */
export function countTotalCells(tables: ExtractedTable[]): number {
	let total = 0;

	for (const table of tables) {
		for (const row of table.rows) {
			total += row.cells.length;
		}
	}

	return total;
}

/**
 * Vérifie si un tableau contient une cellule fusionnée.
 */
export function hasMergedCells(table: ExtractedTable): boolean {
	for (const row of table.rows) {
		for (const cell of row.cells) {
			if (cell.colspan && cell.colspan > 1) return true;
			if (cell.rowspan && cell.rowspan > 1) return true;
		}
	}
	return false;
}

/**
 * Extrait tous les textes des cellules d'un tableau.
 */
export function extractTableTexts(table: ExtractedTable): string[] {
	const texts: string[] = [];

	for (const row of table.rows) {
		for (const cell of row.cells) {
			if (cell.text.trim()) {
				texts.push(cell.text.trim());
			}
		}
	}

	return texts;
}
