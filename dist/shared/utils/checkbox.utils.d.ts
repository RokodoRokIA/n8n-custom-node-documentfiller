/**
 * ============================================================================
 * UTILITAIRES CHECKBOX - Extraction et manipulation des cases à cocher
 * ============================================================================
 *
 * Ce module gère l'extraction des checkboxes depuis les documents DOCX.
 * Supporte plusieurs formats:
 * - Unicode: ☑ (coché) et ☐ (non coché)
 * - Word Form Controls: FORMCHECKBOX
 * - Content Controls: w:sdt avec checkbox
 *
 * @author Rokodo
 * @version 1.0.0
 */
/**
 * Représente une checkbox extraite d'un document.
 */
export interface ExtractedCheckbox {
    /** Index du paragraphe contenant la checkbox */
    index: number;
    /** État de la checkbox (cochée ou non) */
    checked: boolean;
    /** Type de checkbox détecté */
    type: 'unicode' | 'formcontrol' | 'contentcontrol';
    /** Label/contexte associé à la checkbox */
    label: string;
    /** Section du document (si détectée) */
    section?: string;
    /** Position dans le XML (pour le remplacement) */
    xmlStart?: number;
    xmlEnd?: number;
    /** Question associée (pour les paires Oui/Non) */
    questionContext?: string;
}
/**
 * Paire de checkboxes Oui/Non.
 */
export interface CheckboxPair {
    /** Contexte/question de la paire */
    question: string;
    /** Index du paragraphe */
    paragraphIndex: number;
    /** Checkbox "Oui" */
    oui: ExtractedCheckbox;
    /** Checkbox "Non" */
    non: ExtractedCheckbox;
    /** Valeur actuelle (true = Oui coché, false = Non coché, null = aucun) */
    value: boolean | null;
}
/**
 * Extrait toutes les checkboxes d'un document XML.
 *
 * @param xml - Le contenu XML du document DOCX
 * @returns Liste des checkboxes extraites avec leur contexte
 */
export declare function extractCheckboxes(xml: string): ExtractedCheckbox[];
/**
 * Identifie les paires de checkboxes Oui/Non.
 *
 * @param checkboxes - Liste des checkboxes extraites
 * @returns Liste des paires identifiées
 */
export declare function findCheckboxPairs(checkboxes: ExtractedCheckbox[]): CheckboxPair[];
/**
 * Génère les tags appropriés pour les checkboxes.
 *
 * @param checkboxes - Liste des checkboxes
 * @param pairs - Paires Oui/Non identifiées
 * @returns Map de tag → état (true/false)
 */
export declare function generateCheckboxTags(checkboxes: ExtractedCheckbox[], pairs: CheckboxPair[]): Map<string, {
    checked: boolean;
    label: string;
    type: string;
}>;
/**
 * Convertit une valeur booléenne en symbole Unicode.
 *
 * @param checked - État de la checkbox
 * @param style - Style de checkbox ('unicode' | 'text' | 'boolean')
 * @returns Le symbole correspondant
 */
export declare function booleanToCheckbox(checked: boolean, style?: 'unicode' | 'text' | 'boolean'): string;
/**
 * Résultat du mapping des checkboxes.
 */
export interface CheckboxMatch {
    templateCheckbox: ExtractedCheckbox;
    targetCheckbox: ExtractedCheckbox;
    newState: boolean;
}
/**
 * Trouve les correspondances entre les checkboxes du template et de la cible.
 *
 * @param templateCheckboxes - Checkboxes du template
 * @param targetCheckboxes - Checkboxes de la cible
 * @returns Liste des correspondances avec le nouvel état
 */
export declare function matchCheckboxes(templateCheckboxes: ExtractedCheckbox[], targetCheckboxes: ExtractedCheckbox[]): CheckboxMatch[];
/**
 * Applique l'état des checkboxes au XML du document cible.
 *
 * @param targetXml - XML du document cible
 * @param matches - Correspondances de checkboxes
 * @returns XML modifié avec les checkboxes mises à jour
 */
export declare function applyCheckboxesToXml(targetXml: string, matches: CheckboxMatch[]): {
    xml: string;
    applied: string[];
    failed: string[];
};
