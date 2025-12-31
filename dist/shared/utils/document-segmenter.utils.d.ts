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
export declare function segmentDocument(xml: string, options?: SegmentationOptions): SegmentationResult;
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
export declare function matchSegments(templateSegments: DocumentSegment[], targetSegments: DocumentSegment[]): Map<string, {
    templateSegment: DocumentSegment;
    targetSegment: DocumentSegment;
    score: number;
}>;
/**
 * Extrait uniquement les segments pertinents (ceux avec tags ou haute pertinence).
 */
export declare function extractRelevantSegments(result: SegmentationResult, options?: {
    minRelevance?: number;
    onlyWithTags?: boolean;
}): DocumentSegment[];
