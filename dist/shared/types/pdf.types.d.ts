/**
 * ============================================================================
 * TYPES PDF - Définitions pour la conversion DOCX vers PDF
 * ============================================================================
 *
 * Ce fichier contient tous les types TypeScript relatifs à la conversion
 * de documents DOCX vers PDF. Utilisé par le node DocxToPdf.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - pdf-lib est utilisé pour créer le PDF (pure JavaScript)
 * - Les polices standard PDF sont Helvetica, Times et Courier
 * - Les dimensions sont en points (72 points = 1 pouce)
 *
 * @author Rokodo
 * @version 1.0.0
 */
import type { PDFFont } from 'pdf-lib';
/**
 * Dimensions d'une page A4 en points.
 * 1 pouce = 72 points, A4 = 210mm x 297mm
 */
export declare const A4_WIDTH = 595.28;
export declare const A4_HEIGHT = 841.89;
/**
 * Marges par défaut en points (1 pouce = 72 points).
 */
export declare const DEFAULT_MARGINS: PageMargins;
/**
 * Options pour la conversion DOCX vers PDF.
 *
 * @example
 * const options: DocxToPdfOptions = {
 *   margins: { top: 50, bottom: 50, left: 60, right: 60 },
 *   fontSize: 11,
 *   outputFilename: 'rapport.pdf'
 * };
 */
export interface DocxToPdfOptions {
    /** Marges de page en points */
    margins?: PageMargins;
    /** Taille de police par défaut en points */
    fontSize?: number;
    /** Nom du fichier de sortie */
    outputFilename?: string;
}
/**
 * Marges de page en points.
 */
export interface PageMargins {
    top: number;
    bottom: number;
    left: number;
    right: number;
}
/**
 * Structure complète d'un document DOCX parsé pour conversion PDF.
 */
export interface DocxStructure {
    /** Liste des paragraphes du document */
    paragraphs: ParsedParagraph[];
    /** Liste des tableaux du document */
    tables: ParsedTable[];
    /** Liste des images du document */
    images: ParsedImage[];
    /** Métadonnées du document */
    metadata: PdfDocumentMetadata;
}
/**
 * Paragraphe parsé avec ses propriétés de style.
 */
export interface ParsedParagraph {
    /** Runs de texte composant le paragraphe */
    runs: ParsedRun[];
    /** Alignement du paragraphe */
    alignment?: 'left' | 'center' | 'right' | 'justify';
    /** Style du paragraphe (heading1, heading2, listItem, normal) */
    style?: ParagraphStyle;
    /** Espacement avant/après en points */
    spacing?: ParagraphSpacing;
    /** Est-ce un élément de liste ? */
    isListItem?: boolean;
    /** Niveau de liste (0 = premier niveau) */
    listLevel?: number;
}
/**
 * Run de texte avec ses propriétés de formatage.
 *
 * Un "run" est un segment de texte avec un formatage uniforme.
 * Un paragraphe peut contenir plusieurs runs avec des styles différents.
 */
export interface ParsedRun {
    /** Contenu textuel */
    text: string;
    /** Texte en gras */
    bold?: boolean;
    /** Texte en italique */
    italic?: boolean;
    /** Texte souligné */
    underline?: boolean;
    /** Taille de police en points */
    fontSize?: number;
    /** Nom de la police (sera mappé vers une police standard) */
    fontFamily?: string;
    /** Couleur du texte (format hex) */
    color?: string;
}
/**
 * Style de paragraphe détecté.
 */
export type ParagraphStyle = 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'heading5' | 'heading6' | 'listItem' | 'normal';
/**
 * Espacement de paragraphe.
 */
export interface ParagraphSpacing {
    /** Espacement avant en points */
    before?: number;
    /** Espacement après en points */
    after?: number;
    /** Interligne (multiplicateur, 1.0 = simple) */
    lineHeight?: number;
}
/**
 * Tableau parsé.
 */
export interface ParsedTable {
    /** Lignes du tableau */
    rows: ParsedTableRow[];
    /** Largeurs des colonnes en points (si définies) */
    columnWidths?: number[];
}
/**
 * Ligne de tableau.
 */
export interface ParsedTableRow {
    /** Cellules de la ligne */
    cells: ParsedTableCell[];
    /** Est-ce une ligne d'en-tête ? */
    isHeader?: boolean;
}
/**
 * Cellule de tableau.
 */
export interface ParsedTableCell {
    /** Paragraphes contenus dans la cellule */
    paragraphs: ParsedParagraph[];
    /** Fusion horizontale (nombre de colonnes) */
    colspan?: number;
    /** Fusion verticale (nombre de lignes) */
    rowspan?: number;
}
/**
 * Image parsée du document.
 */
export interface ParsedImage {
    /** ID de relation dans le DOCX */
    relationId: string;
    /** Données binaires de l'image */
    data: Buffer;
    /** Type MIME (image/png, image/jpeg) */
    mimeType: string;
    /** Largeur en points */
    width?: number;
    /** Hauteur en points */
    height?: number;
}
/**
 * Métadonnées du document pour le PDF.
 */
export interface PdfDocumentMetadata {
    /** Titre du document */
    title?: string;
    /** Auteur */
    author?: string;
    /** Sujet */
    subject?: string;
    /** Application créatrice */
    creator?: string;
}
/**
 * Polices standard PDF disponibles.
 * Ce sont les 14 polices standard PDF, toujours disponibles sans embedding.
 */
export type StandardFont = 'Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique' | 'Helvetica-BoldOblique' | 'Times-Roman' | 'Times-Bold' | 'Times-Italic' | 'Times-BoldItalic' | 'Courier' | 'Courier-Bold' | 'Courier-Oblique' | 'Courier-BoldOblique';
/**
 * Polices embarquées dans le document PDF.
 */
export interface EmbeddedFonts {
    /** Police normale */
    regular: PDFFont;
    /** Police grasse */
    bold: PDFFont;
    /** Police italique */
    italic: PDFFont;
    /** Police grasse italique */
    boldItalic: PDFFont;
}
/**
 * Style de texte pour sélection de police.
 */
export interface TextStyle {
    bold?: boolean;
    italic?: boolean;
}
/**
 * Résultat de la conversion DOCX vers PDF.
 *
 * @example
 * const result: PdfConversionResult = {
 *   success: true,
 *   buffer: pdfBuffer,
 *   filename: 'document.pdf',
 *   warnings: ['Police Arial mappée vers Helvetica'],
 *   stats: { ... }
 * };
 */
export interface PdfConversionResult {
    /** Indique si la conversion a réussi */
    success: boolean;
    /** Buffer contenant le PDF généré */
    buffer: Buffer;
    /** Nom du fichier de sortie */
    filename: string;
    /** Avertissements non bloquants */
    warnings: string[];
    /** Statistiques de conversion */
    stats: PdfConversionStats;
}
/**
 * Statistiques de conversion.
 */
export interface PdfConversionStats {
    /** Taille du fichier DOCX en octets */
    inputSize: number;
    /** Taille du fichier PDF en octets */
    outputSize: number;
    /** Nombre de paragraphes traités */
    paragraphsProcessed: number;
    /** Nombre de tableaux traités */
    tablesProcessed: number;
    /** Nombre d'images traitées */
    imagesProcessed: number;
    /** Nombre de pages générées */
    pagesGenerated: number;
    /** Temps de traitement en millisecondes */
    processingTimeMs: number;
}
/**
 * Contexte de rendu PDF (état pendant la génération).
 */
export interface PdfRenderContext {
    /** Position Y courante sur la page */
    currentY: number;
    /** Numéro de page courant (1-based) */
    currentPage: number;
    /** Largeur de contenu disponible (page - marges) */
    contentWidth: number;
    /** Hauteur de contenu disponible (page - marges) */
    contentHeight: number;
}
