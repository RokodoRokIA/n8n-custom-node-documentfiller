/**
 * ============================================================================
 * TYPES PDF TEMPLATE MAPPER
 * ============================================================================
 *
 * Types spécifiques au PdfTemplateMapper pour le transfer learning sur PDF.
 * Ces types définissent les structures pour l'extraction, le matching et
 * le remplissage de documents PDF.
 *
 * CONCEPTS CLÉS:
 * - PdfTextElement: Élément de texte avec position absolue (x, y)
 * - PdfField: Champ détecté (label + zone de saisie)
 * - PdfPlacement: Décision de placement d'une valeur
 *
 * @author Rokodo
 * @version 1.0.0
 */

// ============================================================================
// ÉLÉMENTS PDF EXTRAITS
// ============================================================================

/**
 * Élément de texte extrait d'un PDF avec sa position absolue.
 * Les coordonnées sont en points PDF (72 points = 1 pouce).
 */
export interface PdfTextElement {
	/** Contenu textuel */
	text: string;

	/** Position X en points (depuis la gauche) */
	x: number;

	/** Position Y en points (depuis le bas de la page) */
	y: number;

	/** Largeur du texte en points */
	width: number;

	/** Hauteur du texte en points */
	height: number;

	/** Numéro de page (1-indexed) */
	page: number;

	/** Taille de police détectée */
	fontSize?: number;

	/** Nom de la police */
	fontName?: string;

	/** Index de l'élément dans la page */
	index: number;
}

/**
 * Ligne de texte reconstruite à partir d'éléments adjacents.
 * Plusieurs PdfTextElement peuvent former une PdfTextLine.
 */
export interface PdfTextLine {
	/** Texte complet de la ligne */
	text: string;

	/** Position X du début de la ligne */
	x: number;

	/** Position Y de la ligne */
	y: number;

	/** Largeur totale de la ligne */
	width: number;

	/** Hauteur de la ligne */
	height: number;

	/** Numéro de page */
	page: number;

	/** Éléments composant cette ligne */
	elements: PdfTextElement[];

	/** Index de la ligne dans la page */
	lineIndex: number;
}

/**
 * Zone vide détectée (potentiel champ de saisie).
 */
export interface PdfEmptyZone {
	/** Position X de la zone */
	x: number;

	/** Position Y de la zone */
	y: number;

	/** Largeur de la zone */
	width: number;

	/** Hauteur de la zone */
	height: number;

	/** Numéro de page */
	page: number;

	/** Texte précédant cette zone (label probable) */
	precedingText?: string;

	/** Type de zone détecté */
	type: 'underline' | 'box' | 'gap' | 'after_colon';
}

// ============================================================================
// CHAMPS DÉTECTÉS
// ============================================================================

/**
 * Champ détecté dans un document PDF.
 * Un champ = un label + une zone de saisie.
 */
export interface PdfField {
	/** Identifiant unique du champ */
	id: string;

	/** Label du champ (texte descriptif) */
	label: string;

	/** Position du label */
	labelPosition: {
		x: number;
		y: number;
		width: number;
		height: number;
		page: number;
	};

	/** Zone de saisie associée */
	inputZone: {
		x: number;
		y: number;
		width: number;
		height: number;
		page: number;
	};

	/** Type de champ */
	fieldType: 'text' | 'checkbox' | 'date' | 'number' | 'multiline';

	/** Valeur actuelle (si pré-remplie) */
	currentValue?: string;

	/** Tag associé depuis le template */
	tag?: string;

	/** Score de confiance de la détection */
	confidence: number;
}

/**
 * Tag extrait d'un template PDF.
 */
export interface PdfTemplateTag {
	/** Nom du tag (ex: "NOM_ENTREPRISE") */
	tag: string;

	/** Tag complet avec délimiteurs (ex: "{{NOM_ENTREPRISE}}") */
	fullTag: string;

	/** Position dans le PDF */
	position: {
		x: number;
		y: number;
		width: number;
		height: number;
		page: number;
	};

	/** Contexte environnant */
	context: {
		textBefore: string;
		textAfter: string;
		lineText: string;
	};

	/** Type de placement */
	placementType: 'inline' | 'after_colon' | 'in_cell' | 'replace';
}

// ============================================================================
// MATCHING ET PLACEMENT
// ============================================================================

/**
 * Résultat du matching entre un tag template et une zone cible.
 */
export interface PdfMatchResult {
	/** Tag du template */
	tag: string;

	/** Champ cible identifié */
	targetField: PdfField;

	/** Score de confiance (0-1) */
	confidence: number;

	/** Raison du matching */
	reason: string;

	/** Position de placement */
	placementPosition: {
		x: number;
		y: number;
		page: number;
	};
}

/**
 * Décision de placement pour remplir le PDF.
 */
export interface PdfPlacement {
	/** Tag ou identifiant du champ */
	fieldId: string;

	/** Valeur à insérer */
	value: string;

	/** Position d'insertion */
	position: {
		x: number;
		y: number;
		page: number;
	};

	/** Style du texte */
	style: {
		fontSize: number;
		fontName?: string;
		color?: { r: number; g: number; b: number };
	};

	/** Largeur maximale (pour le retour à la ligne) */
	maxWidth?: number;
}

// ============================================================================
// STRUCTURE DE PAGE
// ============================================================================

/**
 * Structure d'une page PDF extraite.
 */
export interface PdfPageContent {
	/** Numéro de page (1-indexed) */
	pageNumber: number;

	/** Largeur de la page en points */
	width: number;

	/** Hauteur de la page en points */
	height: number;

	/** Éléments de texte bruts */
	textElements: PdfTextElement[];

	/** Lignes reconstruites */
	lines: PdfTextLine[];

	/** Zones vides détectées */
	emptyZones: PdfEmptyZone[];

	/** Champs détectés */
	fields: PdfField[];
}

/**
 * Document PDF entièrement extrait.
 */
export interface PdfDocumentContent {
	/** Nombre total de pages */
	pageCount: number;

	/** Contenu de chaque page */
	pages: PdfPageContent[];

	/** Métadonnées du document */
	metadata: {
		title?: string;
		author?: string;
		creator?: string;
	};

	/** Tags trouvés (si template) */
	tags?: PdfTemplateTag[];
}

// ============================================================================
// CONTEXTE DE MAPPING
// ============================================================================

/**
 * Contexte complet pour le mapping PDF.
 */
export interface PdfMappingContext {
	/** Contenu du template extrait */
	templateContent: PdfDocumentContent;

	/** Contenu du document cible extrait */
	targetContent: PdfDocumentContent;

	/** Tags extraits du template */
	templateTags: PdfTemplateTag[];

	/** Données à remplir */
	fillData?: Record<string, string>;

	/** Options de mapping */
	options: PdfMappingOptions;
}

/**
 * Options pour le mapping PDF.
 */
export interface PdfMappingOptions {
	/** Tolérance de position en points (défaut: 10) */
	positionTolerance: number;

	/** Score minimum de confiance (défaut: 0.7) */
	minConfidence: number;

	/** Activer le mode debug */
	debug: boolean;

	/** Nombre max de pages à traiter (défaut: toutes) */
	maxPages?: number;
}

// ============================================================================
// RÉSULTAT DU NODE
// ============================================================================

/**
 * Résultat complet du PdfTemplateMapper.
 */
export interface PdfMappingResult {
	/** Succès global */
	success: boolean;

	/** PDF modifié (buffer) */
	pdfBuffer: Buffer;

	/** Statistiques */
	stats: {
		templateTagsFound: number;
		targetFieldsDetected: number;
		matchesFound: number;
		placementsApplied: number;
		pagesProcessed: number;
	};

	/** Matchings effectués */
	matches: PdfMatchResult[];

	/** Placements appliqués */
	placements: PdfPlacement[];

	/** Erreurs rencontrées */
	errors: string[];

	/** Avertissements */
	warnings: string[];

	/** Données de debug (si activé) */
	debug?: {
		templateContent: PdfDocumentContent;
		targetContent: PdfDocumentContent;
		llmPrompt?: string;
		llmResponse?: string;
	};
}

// ============================================================================
// AGENT REACT POUR PDF
// ============================================================================

/**
 * État de l'agent ReAct pour PDF.
 */
export interface PdfAgentState {
	/** Itération courante */
	iteration: number;

	/** Maximum d'itérations */
	maxIterations: number;

	/** Tags attendus */
	expectedPlacements: PdfExpectedPlacement[];

	/** Placements effectués */
	appliedPlacements: PdfPlacement[];

	/** Problèmes détectés */
	issues: PdfAgentIssue[];

	/** Score de satisfaction (0-100) */
	satisfaction: number;
}

/**
 * Placement attendu par l'agent.
 */
export interface PdfExpectedPlacement {
	/** Tag à placer */
	tag: string;

	/** Position attendue (depuis le template) */
	expectedPosition: {
		x: number;
		y: number;
		page: number;
	};

	/** Contexte du template */
	templateContext: {
		labelBefore: string;
		labelAfter: string;
	};

	/** Statut */
	status: 'pending' | 'matched' | 'placed' | 'verified' | 'failed';
}

/**
 * Problème détecté par l'agent PDF.
 */
export interface PdfAgentIssue {
	/** Type de problème */
	type: 'no_match' | 'low_confidence' | 'position_mismatch' | 'overlap';

	/** Sévérité */
	severity: 'critical' | 'warning' | 'info';

	/** Tag concerné */
	tag?: string;

	/** Description */
	description: string;

	/** Position concernée */
	position?: {
		x: number;
		y: number;
		page: number;
	};
}
