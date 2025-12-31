/**
 * ============================================================================
 * TYPES EXTRACTION - Définitions pour l'extraction DOCX vers JSON
 * ============================================================================
 *
 * Ce fichier contient tous les types TypeScript relatifs à l'extraction
 * de contenu structuré depuis un document DOCX. Utilisé par le node DocxExtractor.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - L'extraction transforme un DOCX en JSON structuré
 * - La structure hiérarchique préserve l'organisation du document
 * - Les tableaux peuvent être convertis en array d'objets (si headers détectés)
 *
 * @author Rokodo
 * @version 1.0.0
 */

// ============================================================================
// OPTIONS D'EXTRACTION
// ============================================================================

/**
 * Options pour l'extraction de contenu DOCX.
 *
 * @example
 * const options: ExtractionOptions = {
 *   includeMetadata: true,
 *   preserveHierarchy: true,
 *   tableFormat: 'objects',
 *   includeStyles: false
 * };
 */
export interface ExtractionOptions {
	/** Inclure les métadonnées du document (titre, auteur, etc.) */
	includeMetadata?: boolean;

	/** Regrouper le contenu par sections */
	includeSections?: boolean;

	/** Inclure les informations de style (gras, italique) */
	includeStyles?: boolean;

	/** Format des tableaux: 'array' (lignes) ou 'objects' (si headers) */
	tableFormat?: 'array' | 'objects';

	/** Structure hiérarchique (titres → contenu) vs liste plate */
	preserveHierarchy?: boolean;
}

// ============================================================================
// DOCUMENT EXTRAIT
// ============================================================================

/**
 * Document extrait avec toutes ses composantes.
 *
 * C'est la structure principale retournée par le node DocxExtractor.
 *
 * @example
 * const doc: ExtractedDocument = {
 *   metadata: { title: 'Rapport', wordCount: 1500 },
 *   content: { sections: [...] },
 *   tables: [{ id: 'table_1', headers: ['Nom', 'Valeur'], data: [...] }],
 *   stats: { sectionsFound: 5, tablesFound: 2 }
 * };
 */
export interface ExtractedDocument {
	/** Métadonnées du document */
	metadata: ExtractedMetadata;

	/** Contenu structuré du document */
	content: ExtractedContent;

	/** Tableaux extraits séparément */
	tables: ExtractedTable[];

	/** Statistiques d'extraction */
	stats: ExtractionStats;
}

/**
 * Métadonnées extraites du document.
 */
export interface ExtractedMetadata {
	/** Titre du document (depuis core.xml) */
	title?: string;

	/** Auteur du document */
	author?: string;

	/** Date de création */
	created?: string;

	/** Date de dernière modification */
	modified?: string;

	/** Nombre de mots (calculé) */
	wordCount: number;

	/** Nombre de paragraphes */
	paragraphCount: number;

	/** Nombre de caractères */
	characterCount?: number;
}

// ============================================================================
// CONTENU STRUCTURÉ
// ============================================================================

/**
 * Contenu extrait du document.
 * Peut être hiérarchique (sections) ou plat (paragraphs).
 */
export interface ExtractedContent {
	/** Sections du document (mode hiérarchique) */
	sections?: ExtractedSection[];

	/** Paragraphes (mode plat) */
	paragraphs?: ExtractedParagraph[];
}

/**
 * Section extraite du document.
 *
 * Une section regroupe le contenu sous un titre de niveau donné.
 * Elle peut contenir des sous-sections (structure récursive).
 */
export interface ExtractedSection {
	/** Identifiant unique de la section (ex: "section_1", "section_1_1") */
	id: string;

	/** Titre de la section */
	title: string;

	/** Niveau hiérarchique (1 = H1, 2 = H2, etc.) */
	level: number;

	/** Contenu de la section */
	content: SectionContent[];

	/** Sous-sections (structure récursive) */
	subsections?: ExtractedSection[];
}

/**
 * Élément de contenu dans une section.
 * Peut être un paragraphe, un titre, une liste ou une référence à un tableau.
 */
export type SectionContent =
	| SectionParagraph
	| SectionHeading
	| SectionList
	| SectionTableRef;

/**
 * Paragraphe dans une section.
 */
export interface SectionParagraph {
	type: 'paragraph';
	text: string;
	style?: ExtractedTextStyle;
}

/**
 * Titre dans une section.
 */
export interface SectionHeading {
	type: 'heading';
	text: string;
	level: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Liste dans une section.
 */
export interface SectionList {
	type: 'list';
	items: ExtractedListItem[];
	ordered: boolean;
}

/**
 * Référence à un tableau (le tableau complet est dans tables[]).
 */
export interface SectionTableRef {
	type: 'table';
	reference: string; // ID du tableau dans tables[]
}

// ============================================================================
// PARAGRAPHES (MODE PLAT)
// ============================================================================

/**
 * Paragraphe extrait (mode plat).
 */
export interface ExtractedParagraph {
	/** Contenu textuel */
	text: string;

	/** Type de paragraphe */
	type: 'paragraph' | 'heading' | 'listItem';

	/** Niveau de titre (si type = 'heading') */
	headingLevel?: number;

	/** Index dans la liste (si type = 'listItem') */
	listIndex?: number;

	/** Liste ordonnée ou non (si type = 'listItem') */
	listOrdered?: boolean;

	/** Style du texte (si includeStyles = true) */
	style?: ExtractedTextStyle;

	/** ID de la section parente */
	sectionId?: string;
}

/**
 * Style de texte extrait.
 */
export interface ExtractedTextStyle {
	/** Texte en gras */
	bold?: boolean;

	/** Texte en italique */
	italic?: boolean;

	/** Texte souligné */
	underline?: boolean;
}

// ============================================================================
// LISTES
// ============================================================================

/**
 * Élément de liste extrait.
 */
export interface ExtractedListItem {
	/** Contenu textuel de l'élément */
	text: string;

	/** Niveau d'indentation (0 = premier niveau) */
	level: number;

	/** Index numérique (pour listes numérotées) */
	index?: number;

	/** Style du texte */
	style?: ExtractedTextStyle;
}

// ============================================================================
// TABLEAUX
// ============================================================================

/**
 * Tableau extrait du document.
 *
 * Si tableFormat = 'objects' et que des headers sont détectés,
 * le champ `data` contient les lignes sous forme d'objets clé-valeur.
 *
 * @example
 * // Avec headers
 * {
 *   id: 'table_1',
 *   headers: ['Nom', 'Email'],
 *   data: [
 *     { 'Nom': 'Alice', 'Email': 'alice@example.com' },
 *     { 'Nom': 'Bob', 'Email': 'bob@example.com' }
 *   ]
 * }
 *
 * // Sans headers (format array)
 * {
 *   id: 'table_1',
 *   rows: [
 *     { cells: [{ text: 'Alice' }, { text: 'alice@example.com' }] }
 *   ]
 * }
 */
export interface ExtractedTable {
	/** Identifiant unique du tableau */
	id: string;

	/** En-têtes de colonnes (si détectés) */
	headers?: string[];

	/** Lignes brutes du tableau */
	rows: ExtractedTableRow[];

	/** Données sous forme d'objets (si tableFormat = 'objects' et headers présents) */
	data?: Record<string, string>[];

	/** Nombre de lignes */
	rowCount: number;

	/** Nombre de colonnes */
	columnCount: number;
}

/**
 * Ligne de tableau extraite.
 */
export interface ExtractedTableRow {
	/** Cellules de la ligne */
	cells: ExtractedTableCell[];

	/** Est-ce une ligne d'en-tête ? */
	isHeader?: boolean;
}

/**
 * Cellule de tableau extraite.
 */
export interface ExtractedTableCell {
	/** Contenu textuel de la cellule */
	text: string;

	/** Fusion horizontale (nombre de colonnes) */
	colspan?: number;

	/** Fusion verticale (nombre de lignes) */
	rowspan?: number;

	/** Style du texte */
	style?: ExtractedTextStyle;
}

// ============================================================================
// STATISTIQUES
// ============================================================================

/**
 * Statistiques d'extraction.
 */
export interface ExtractionStats {
	/** Nombre de sections détectées */
	sectionsFound: number;

	/** Nombre de titres détectés */
	headingsFound: number;

	/** Nombre de listes détectées */
	listsFound: number;

	/** Nombre de tableaux détectés */
	tablesFound: number;

	/** Nombre total d'éléments extraits */
	totalElements: number;

	/** Temps de traitement en millisecondes */
	processingTimeMs: number;
}

// ============================================================================
// DÉTECTION DE STRUCTURE
// ============================================================================

/**
 * Niveau de titre détecté (1 à 6).
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Information sur un élément de liste détecté.
 */
export interface ListItemInfo {
	/** Texte de l'élément */
	text: string;

	/** Niveau d'indentation */
	level: number;

	/** Liste ordonnée (numérotée) ou non (puces) */
	ordered: boolean;

	/** Numéro de l'élément (si ordonnée) */
	number?: number;
}

/**
 * Information sur une section détectée.
 */
export interface SectionInfo {
	/** Identifiant de section (ex: "A", "B", "1", "2") */
	id: string;

	/** Titre complet de la section */
	title: string;

	/** Niveau hiérarchique */
	level: number;
}

// ============================================================================
// RÉSULTAT D'EXTRACTION
// ============================================================================

/**
 * Résultat de l'opération d'extraction.
 * Utilisé pour le retour du service d'extraction.
 */
export interface ExtractionResult {
	/** Indique si l'extraction a réussi */
	success: boolean;

	/** Document extrait (si succès) */
	document?: ExtractedDocument;

	/** Message d'erreur (si échec) */
	error?: string;

	/** Avertissements non bloquants */
	warnings: string[];
}
