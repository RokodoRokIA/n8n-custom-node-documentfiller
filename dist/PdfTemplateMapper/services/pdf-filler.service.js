"use strict";
/**
 * ============================================================================
 * SERVICE PDF FILLER - Remplissage de PDF avec données
 * ============================================================================
 *
 * Ce service remplit un PDF avec des données en superposant du texte
 * aux positions identifiées par le matching. Il utilise pdf-lib pour
 * la manipulation du PDF.
 *
 * FONCTIONNALITÉS:
 * - Insertion de texte à des positions précises
 * - Gestion des polices (Helvetica par défaut)
 * - Ajustement automatique de la taille de police
 * - Support du texte multiligne
 *
 * @author Rokodo
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillPdf = fillPdf;
exports.fillCheckbox = fillCheckbox;
exports.fillCheckboxes = fillCheckboxes;
exports.drawDebugRectangle = drawDebugRectangle;
exports.loadPdfDocument = loadPdfDocument;
exports.savePdfDocument = savePdfDocument;
exports.getPdfInfo = getPdfInfo;
exports.createEmptyPdf = createEmptyPdf;
exports.copyPage = copyPage;
exports.extractPage = extractPage;
exports.mergePdfs = mergePdfs;
const pdf_lib_1 = require("pdf-lib");
// ============================================================================
// CONFIGURATION
// ============================================================================
/** Taille de police par défaut */
const DEFAULT_FONT_SIZE = 10;
/** Marge de sécurité pour le texte (en points) */
const TEXT_MARGIN = 2;
/** Hauteur de ligne par défaut (multiplicateur) */
const LINE_HEIGHT_MULTIPLIER = 1.2;
// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================
/**
 * Remplit un PDF avec les données fournies aux positions matchées.
 *
 * @param pdfBuffer - Buffer du PDF original
 * @param matches - Résultats du matching
 * @param data - Données à insérer (tag -> valeur)
 * @param options - Options de remplissage
 * @returns Résultat avec le PDF modifié
 */
async function fillPdf(pdfBuffer, matches, data, options = {}) {
    const { fontSize = DEFAULT_FONT_SIZE, fontColor = { r: 0, g: 0, b: 0 }, debug = false, } = options;
    if (debug) {
        console.log('\n✏️ Remplissage PDF en cours...');
        console.log(`   Matchs à remplir: ${matches.length}`);
        console.log(`   Données fournies: ${Object.keys(data).length} champs`);
    }
    const errors = [];
    const warnings = [];
    const placements = [];
    // Charger le PDF
    const pdfDoc = await pdf_lib_1.PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    // Charger la police
    const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    // Remplir chaque match
    for (const match of matches) {
        const value = data[match.tag];
        if (value === undefined) {
            warnings.push(`Aucune donnée pour le tag {{${match.tag}}}`);
            continue;
        }
        const pageIndex = match.placementPosition.page - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) {
            errors.push(`Page ${match.placementPosition.page} invalide pour {{${match.tag}}}`);
            continue;
        }
        const page = pages[pageIndex];
        try {
            // Calculer la taille de police ajustée
            const maxWidth = match.targetField.inputZone.width - TEXT_MARGIN * 2;
            const adjustedFontSize = calculateOptimalFontSize(value, font, maxWidth, fontSize);
            // Position d'insertion
            const x = match.placementPosition.x + TEXT_MARGIN;
            const y = match.placementPosition.y;
            // Dessiner le texte
            const textHeight = drawText(page, value, x, y, {
                font,
                fontSize: adjustedFontSize,
                color: fontColor,
                maxWidth,
            });
            // Enregistrer le placement
            placements.push({
                fieldId: match.targetField.id,
                value,
                position: {
                    x,
                    y,
                    page: match.placementPosition.page,
                },
                style: {
                    fontSize: adjustedFontSize,
                },
                maxWidth,
            });
            if (debug) {
                console.log(`   ✓ {{${match.tag}}} = "${value.substring(0, 30)}..." à (${Math.round(x)}, ${Math.round(y)})`);
            }
        }
        catch (error) {
            errors.push(`Erreur lors du remplissage de {{${match.tag}}}: ${error.message}`);
        }
    }
    // Sauvegarder le PDF modifié
    const modifiedPdfBuffer = Buffer.from(await pdfDoc.save());
    if (debug) {
        console.log(`   Placements effectués: ${placements.length}`);
        console.log(`   Erreurs: ${errors.length}`);
        console.log(`   Avertissements: ${warnings.length}`);
    }
    return {
        pdfBuffer: modifiedPdfBuffer,
        placements,
        errors,
        warnings,
    };
}
// ============================================================================
// DESSIN DE TEXTE
// ============================================================================
/**
 * Dessine du texte sur une page PDF.
 * Gère automatiquement le retour à la ligne si nécessaire.
 *
 * @returns Hauteur totale utilisée
 */
function drawText(page, text, x, y, options) {
    const { font, fontSize, color, maxWidth } = options;
    const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
    // Si pas de contrainte de largeur, dessiner simplement
    if (!maxWidth) {
        page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: (0, pdf_lib_1.rgb)(color.r, color.g, color.b),
        });
        return lineHeight;
    }
    // Découper le texte en lignes si nécessaire
    const lines = wrapText(text, font, fontSize, maxWidth);
    let currentY = y;
    for (const line of lines) {
        page.drawText(line, {
            x,
            y: currentY,
            size: fontSize,
            font,
            color: (0, pdf_lib_1.rgb)(color.r, color.g, color.b),
        });
        currentY -= lineHeight;
    }
    return lines.length * lineHeight;
}
/**
 * Découpe un texte en lignes pour respecter une largeur maximale.
 */
function wrapText(text, font, fontSize, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        }
        else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}
/**
 * Calcule la taille de police optimale pour faire tenir le texte.
 */
function calculateOptimalFontSize(text, font, maxWidth, preferredSize) {
    let fontSize = preferredSize;
    const minFontSize = 6;
    // Réduire progressivement si le texte ne tient pas
    while (fontSize > minFontSize) {
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        if (textWidth <= maxWidth) {
            return fontSize;
        }
        fontSize -= 0.5;
    }
    return minFontSize;
}
// ============================================================================
// FONCTIONS DE REMPLISSAGE SPÉCIALISÉES
// ============================================================================
/**
 * Remplit un champ checkbox.
 */
async function fillCheckbox(page, x, y, checked, options = {}) {
    const { size = 12, color = { r: 0, g: 0, b: 0 } } = options;
    if (checked) {
        // Dessiner un X ou une coche
        const checkmark = '✓';
        const pdfDoc = page.doc;
        const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.ZapfDingbats);
        // Utiliser le caractère 4 de ZapfDingbats (coche)
        page.drawText('4', {
            x: x + 1,
            y: y - size + 3,
            size: size - 2,
            font,
            color: (0, pdf_lib_1.rgb)(color.r, color.g, color.b),
        });
    }
}
/**
 * Remplit plusieurs checkboxes en détectant leurs positions.
 */
async function fillCheckboxes(pdfBuffer, pdfContent, checkboxData, fieldConfig, targetPage, debug = false) {
    const issues = [];
    let filled = 0;
    // Charger le PDF
    const pdfDoc = await pdf_lib_1.PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    // Pour chaque checkbox à cocher (valeur = true)
    for (const [fieldName, checked] of Object.entries(checkboxData)) {
        if (checked !== true)
            continue;
        const config = fieldConfig[fieldName];
        if (!config || config.type !== 'checkbox') {
            // Si pas de config, essayer de trouver le label directement
            if (!config) {
                issues.push(`Configuration manquante pour checkbox "${fieldName}"`);
                continue;
            }
        }
        // Chercher le label dans le PDF
        let foundPosition = null;
        const labels = (config === null || config === void 0 ? void 0 : config.labels) || [fieldName];
        for (const page of pdfContent.pages) {
            // Chercher sur toutes les pages ou seulement la page cible
            if (foundPosition)
                break;
            for (const line of page.lines) {
                for (const label of labels) {
                    if (line.text.toLowerCase().includes(label.toLowerCase())) {
                        // Position trouvée - la checkbox est généralement à gauche du label
                        foundPosition = {
                            page: page.pageNumber,
                            x: line.x - 12, // Offset à gauche du label
                            y: line.y,
                        };
                        if (debug) {
                            console.log(`   📍 ${fieldName}: trouvé "${label}" à (${line.x}, ${line.y})`);
                        }
                        break;
                    }
                }
                if (foundPosition)
                    break;
            }
        }
        if (!foundPosition) {
            issues.push(`Position non trouvée pour checkbox "${fieldName}" (labels: ${labels.join(', ')})`);
            continue;
        }
        // Vérifier que la page existe
        const pageIndex = foundPosition.page - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) {
            issues.push(`Page ${foundPosition.page} invalide pour checkbox "${fieldName}"`);
            continue;
        }
        const pdfPage = pages[pageIndex];
        // Dessiner la coche (X)
        pdfPage.drawText('X', {
            x: foundPosition.x,
            y: foundPosition.y - 2,
            size: 10,
            font,
            color: (0, pdf_lib_1.rgb)(0, 0, 0),
        });
        filled++;
        if (debug) {
            console.log(`   ☑️ ${fieldName} coché à (${foundPosition.x}, ${foundPosition.y})`);
        }
    }
    // Sauvegarder le PDF modifié
    const modifiedPdfBuffer = Buffer.from(await pdfDoc.save());
    return {
        pdfBuffer: modifiedPdfBuffer,
        filled,
        issues,
    };
}
/**
 * Dessine un rectangle (pour debug ou mise en évidence).
 */
function drawDebugRectangle(page, x, y, width, height, options = {}) {
    const { borderColor = { r: 1, g: 0, b: 0 }, borderWidth = 0.5, } = options;
    page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        borderColor: (0, pdf_lib_1.rgb)(borderColor.r, borderColor.g, borderColor.b),
        borderWidth,
    });
}
// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================
/**
 * Charge un PDF depuis un buffer et retourne le document.
 */
async function loadPdfDocument(buffer) {
    return pdf_lib_1.PDFDocument.load(buffer);
}
/**
 * Sauvegarde un document PDF en buffer.
 */
async function savePdfDocument(doc) {
    const bytes = await doc.save();
    return Buffer.from(bytes);
}
/**
 * Obtient les informations de base d'un PDF.
 */
async function getPdfInfo(buffer) {
    const doc = await pdf_lib_1.PDFDocument.load(buffer);
    const pages = doc.getPages();
    return {
        pageCount: pages.length,
        pages: pages.map(page => ({
            width: page.getWidth(),
            height: page.getHeight(),
        })),
    };
}
/**
 * Crée un nouveau PDF vide.
 */
async function createEmptyPdf() {
    return pdf_lib_1.PDFDocument.create();
}
/**
 * Copie une page d'un PDF vers un autre.
 */
async function copyPage(sourcePdf, targetPdf, pageIndex) {
    const [copiedPage] = await targetPdf.copyPages(sourcePdf, [pageIndex]);
    targetPdf.addPage(copiedPage);
    return copiedPage;
}
/**
 * Extrait une page d'un PDF.
 */
async function extractPage(pdfBuffer, pageNumber) {
    const sourcePdf = await pdf_lib_1.PDFDocument.load(pdfBuffer);
    const newPdf = await pdf_lib_1.PDFDocument.create();
    const pageIndex = pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) {
        throw new Error(`Page ${pageNumber} invalide (document a ${sourcePdf.getPageCount()} pages)`);
    }
    const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
    newPdf.addPage(copiedPage);
    return Buffer.from(await newPdf.save());
}
/**
 * Fusionne plusieurs PDFs en un seul.
 */
async function mergePdfs(pdfBuffers) {
    const mergedPdf = await pdf_lib_1.PDFDocument.create();
    for (const buffer of pdfBuffers) {
        const pdf = await pdf_lib_1.PDFDocument.load(buffer);
        const pageIndices = pdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
        for (const page of copiedPages) {
            mergedPdf.addPage(page);
        }
    }
    return Buffer.from(await mergedPdf.save());
}
