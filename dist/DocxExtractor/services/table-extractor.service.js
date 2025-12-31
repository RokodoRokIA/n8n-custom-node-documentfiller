"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTables = extractTables;
exports.countTotalCells = countTotalCells;
exports.hasMergedCells = hasMergedCells;
exports.extractTableTexts = extractTableTexts;
const style_detector_utils_1 = require("../../shared/utils/style-detector.utils");
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
function extractTables(xml, tableFormat = 'objects', includeStyles = false) {
    const tables = [];
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
function parseTable(tableXml, id, tableFormat, includeStyles) {
    const rows = [];
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
    let headers;
    if (rows.length > 0 && isLikelyHeaderRow(rows[0])) {
        headers = rows[0].cells.map((cell) => cell.text.trim());
        rows[0].isHeader = true;
    }
    // Calculer les dimensions
    const rowCount = rows.length;
    const columnCount = Math.max(...rows.map((r) => r.cells.length), 0);
    // Construire le résultat
    const table = {
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
function parseTableRow(rowXml, isFirstRow, includeStyles) {
    const cells = [];
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
function parseTableCell(cellXml, includeStyles) {
    // Extraire le texte de tous les paragraphes
    const textParts = [];
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = textRegex.exec(cellXml)) !== null) {
        textParts.push(match[1]);
    }
    const text = textParts.join(' ').trim();
    // Détecter colspan (gridSpan)
    let colspan;
    const gridSpanMatch = cellXml.match(/<w:gridSpan\s+w:val="(\d+)"/);
    if (gridSpanMatch) {
        colspan = parseInt(gridSpanMatch[1], 10);
    }
    // Détecter rowspan (vMerge) - note: difficile à compter exactement
    let rowspan;
    if (/<w:vMerge\s+w:val="restart"/.test(cellXml)) {
        rowspan = undefined; // Indique le début d'une fusion, mais on ne sait pas la longueur
    }
    // Style
    let style;
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
function extractCellStyle(cellXml) {
    const runRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/;
    const match = runRegex.exec(cellXml);
    if (match) {
        const runXml = match[0];
        return {
            bold: (0, style_detector_utils_1.isBold)(runXml),
            italic: (0, style_detector_utils_1.isItalic)(runXml),
            underline: (0, style_detector_utils_1.isUnderline)(runXml),
        };
    }
    return {};
}
/**
 * Détermine si une ligne semble être un header.
 * Critères: texte en gras, texte court, pas de nombres seuls.
 */
function isLikelyHeaderRow(row) {
    var _a;
    if (row.cells.length === 0)
        return false;
    let boldCount = 0;
    let shortTextCount = 0;
    let validHeaderCount = 0;
    for (const cell of row.cells) {
        const text = cell.text.trim();
        // Header vide = pas un header
        if (!text)
            continue;
        // Vérifier si c'est du texte court
        if (text.length < 50) {
            shortTextCount++;
        }
        // Vérifier si c'est en gras
        if ((_a = cell.style) === null || _a === void 0 ? void 0 : _a.bold) {
            boldCount++;
        }
        // Un header est généralement du texte, pas juste des nombres
        if (!/^\d+([.,]\d+)?$/.test(text)) {
            validHeaderCount++;
        }
    }
    const totalCells = row.cells.length;
    // Au moins 50% des cellules doivent ressembler à des headers
    const isLikelyHeader = (shortTextCount >= totalCells * 0.5 && validHeaderCount >= totalCells * 0.5) ||
        boldCount >= totalCells * 0.5;
    return isLikelyHeader;
}
/**
 * Convertit les lignes en array d'objets clé-valeur.
 */
function convertRowsToObjects(rows, headers) {
    return rows.map((row) => {
        var _a, _b;
        const obj = {};
        for (let i = 0; i < headers.length; i++) {
            const key = headers[i] || `column_${i + 1}`;
            const value = (_b = (_a = row.cells[i]) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '';
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
function countTotalCells(tables) {
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
function hasMergedCells(table) {
    for (const row of table.rows) {
        for (const cell of row.cells) {
            if (cell.colspan && cell.colspan > 1)
                return true;
            if (cell.rowspan && cell.rowspan > 1)
                return true;
        }
    }
    return false;
}
/**
 * Extrait tous les textes des cellules d'un tableau.
 */
function extractTableTexts(table) {
    const texts = [];
    for (const row of table.rows) {
        for (const cell of row.cells) {
            if (cell.text.trim()) {
                texts.push(cell.text.trim());
            }
        }
    }
    return texts;
}
