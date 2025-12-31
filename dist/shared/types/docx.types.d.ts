/**
 * ============================================================================
 * TYPES DOCX - Définitions pour la manipulation de documents Word
 * ============================================================================
 *
 * Ce fichier contient tous les types TypeScript relatifs à la manipulation
 * de documents DOCX. Ces types sont utilisés par TemplateMapper et DocxTemplateFiller.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Un fichier DOCX est en réalité une archive ZIP contenant des fichiers XML
 * - Le contenu principal est dans word/document.xml
 * - Les tags {{TAG}} sont des placeholders à remplacer par des valeurs
 *
 * @author Rokodo
 * @version 2.0.0
 */
/**
 * Types de documents administratifs français supportés.
 *
 * - DC1 : Lettre de candidature (Déclaration du Candidat 1)
 * - DC2 : Déclaration du candidat individuel (Déclaration du Candidat 2)
 * - AE  : Acte d'Engagement
 * - UNKNOWN : Type non reconnu
 *
 * @example
 * const docType: DocumentType = 'DC1';
 */
export type DocumentType = 'DC1' | 'DC2' | 'AE' | 'UNKNOWN';
/**
 * Style d'affichage des cases à cocher dans le document final.
 *
 * - unicode : Utilise les symboles ☑ et ☐
 * - text    : Utilise 'X' pour coché et espace pour non coché
 * - boolean : Utilise les chaînes 'true' et 'false'
 */
export type CheckboxStyle = 'unicode' | 'text' | 'boolean';
/**
 * Type de tag détecté dans un document.
 *
 * - text       : Texte simple à remplacer
 * - checkbox   : Case à cocher (valeur booléenne)
 * - table_cell : Cellule de tableau
 * - date       : Champ de date
 */
export type TagType = 'text' | 'checkbox' | 'table_cell' | 'date';
/**
 * Type de données d'un tag pour la structure JSON.
 */
export type TagDataType = 'string' | 'boolean' | 'date' | 'number';
/**
 * Représente un tag extrait du template de référence avec son contexte complet.
 *
 * Cette interface est utilisée pour le "Transfer Learning" : on apprend d'un
 * template déjà taggué pour taguer un document similaire.
 *
 * @example
 * const tagContext: TagContext = {
 *   tag: 'NOM_COMMERCIAL',
 *   fullTag: '{{NOM_COMMERCIAL}}',
 *   labelBefore: 'Nom commercial :',
 *   labelAfter: '',
 *   section: 'A',
 *   type: 'text',
 *   xmlContext: '<w:p>...</w:p>',
 *   paragraphIndex: 15
 * };
 */
export interface TagContext {
    /** Le nom du tag sans les accolades (ex: "NOM_COMMERCIAL") */
    tag: string;
    /** Le tag complet avec accolades (ex: "{{NOM_COMMERCIAL}}") */
    fullTag: string;
    /** Le texte/label qui précède le tag dans le document */
    labelBefore: string;
    /** Le texte qui suit le tag dans le document */
    labelAfter: string;
    /** La section du document (A, B, C, D, E...) */
    section: string;
    /** Le type de tag détecté */
    type: TagType;
    /** Un extrait du XML pour le positionnement (aide au débogage) */
    xmlContext: string;
    /** Index du paragraphe dans le document */
    paragraphIndex: number;
    /** Index du tableau dans le document (si applicable) */
    tableIndex?: number;
    /** Index de la ligne dans le tableau (0 = en-tête) */
    rowIndex?: number;
    /** Index de la colonne dans le tableau */
    columnIndex?: number;
    /** Texte de l'en-tête de ligne (colonne 0) */
    rowHeader?: string;
    /** Texte de l'en-tête de colonne (ligne 0) */
    columnHeader?: string;
}
/**
 * Représente un tag extrait automatiquement du template.
 * Version simplifiée de TagContext pour la génération de structure de données.
 *
 * @example
 * const extractedTag: ExtractedTag = {
 *   tag: 'SIRET',
 *   type: 'string',
 *   context: 'Numéro SIRET :'
 * };
 */
export interface ExtractedTag {
    /** Le nom du tag (ex: "SIRET") */
    tag: string;
    /** Type de données déduit du nom du tag */
    type: TagDataType;
    /** Contexte/label associé au tag */
    context: string;
}
/**
 * Représente un paragraphe extrait du document cible (à taguer).
 *
 * Cette structure est utilisée pour analyser le document et trouver
 * où insérer les tags.
 */
export interface TargetParagraph {
    /** Index du paragraphe dans le document (commence à 0) */
    index: number;
    /** Contenu textuel du paragraphe */
    text: string;
    /** Position de début dans le XML */
    xmlStart: number;
    /** Position de fin dans le XML */
    xmlEnd: number;
    /** Section du document (A, B, C...) */
    section: string;
    /** Indique si le paragraphe est dans une cellule de tableau */
    isTableCell: boolean;
    /** Indique si le paragraphe contient déjà un tag {{...}} */
    hasExistingTag: boolean;
    /** Index du tableau dans le document (si applicable) */
    tableIndex?: number;
    /** Index de la ligne dans le tableau (0 = en-tête) */
    rowIndex?: number;
    /** Index de la colonne dans le tableau */
    columnIndex?: number;
    /** Texte de l'en-tête de ligne (colonne 0) */
    rowHeader?: string;
    /** Texte de l'en-tête de colonne (ligne 0) */
    columnHeader?: string;
}
/**
 * Point d'insertion pour un tag dans le document.
 *
 * - after_colon  : Après un deux-points (ex: "Nom : {{TAG}}")
 * - replace_empty: Remplace une cellule vide
 * - inline       : Dans le texte existant
 * - checkbox     : Pour une case à cocher
 * - table_cell   : Dans une cellule de tableau
 */
export type InsertionPoint = 'after_colon' | 'replace_empty' | 'inline' | 'checkbox' | 'table_cell';
/**
 * Résultat du matching IA entre un tag et un paragraphe cible.
 *
 * L'IA analyse le contexte sémantique pour trouver où placer chaque tag.
 */
export interface MatchResult {
    /** Nom du tag à insérer */
    tag: string;
    /** Index du paragraphe cible dans le document */
    targetParagraphIndex: number;
    /** Score de confiance de l'IA (0 à 1) */
    confidence: number;
    /** Type d'insertion à effectuer */
    insertionPoint: InsertionPoint;
    /** Raison du matching (optionnel, pour le débogage) */
    reason?: string;
}
/**
 * Résultat de l'application des tags dans un document.
 */
export interface TagApplicationResult {
    /** XML modifié avec les tags insérés */
    xml: string;
    /** Liste des tags appliqués avec succès */
    applied: string[];
    /** Liste des tags qui ont échoué avec les raisons */
    failed: string[];
}
/**
 * Résultat de la détection du type de document.
 */
export interface DocumentDetectionResult {
    /** Type de document détecté */
    type: DocumentType;
    /** Nom de l'acheteur extrait (si trouvé) */
    acheteur: string;
}
/**
 * Résultat du remplacement des tags dans un document.
 */
export interface TagReplacementResult {
    /** XML avec les tags remplacés */
    xml: string;
    /** Liste des tags remplacés */
    replaced: string[];
    /** Liste des tags non remplacés (valeur manquante) */
    remaining: string[];
}
/**
 * Résultat de validation XML.
 */
export interface XmlValidationResult {
    /** true si le XML est valide */
    valid: boolean;
    /** Message d'erreur si invalide */
    error?: string;
}
