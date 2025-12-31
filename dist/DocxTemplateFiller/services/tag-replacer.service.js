"use strict";
/**
 * ============================================================================
 * SERVICE TAG REPLACER - Remplacement des tags dans le document
 * ============================================================================
 *
 * Ce service gère le remplacement des tags {{TAG}} par leurs valeurs
 * dans le XML du document DOCX.
 *
 * FONCTIONNALITÉS :
 * - Remplacement simple des tags par leurs valeurs
 * - Gestion des tags sans valeur (suppression ou conservation)
 * - Échappement des caractères spéciaux XML
 * - Suivi des tags remplacés et non remplacés
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Un tag est au format {{NOM_DU_TAG}} dans le document
 * - On cherche la valeur correspondante dans les données
 * - Si trouvée, on remplace le tag par la valeur
 * - Les caractères spéciaux (<, >, &, etc.) sont échappés
 *
 * @author Rokodo
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceTagsInXml = replaceTagsInXml;
exports.extractTagsFromXml = extractTagsFromXml;
const utils_1 = require("../../shared/utils");
// ============================================================================
// REMPLACEMENT DES TAGS
// ============================================================================
/**
 * Expression régulière pour trouver les tags {{TAG}}.
 * Ne capture pas les marqueurs de boucle {#...} et {/...}
 */
const TAG_REGEX = /\{\{[A-Z_0-9]+\}\}/gi;
/**
 * Remplace tous les tags {{TAG}} dans le XML par leurs valeurs.
 *
 * @param xml - Le XML du document
 * @param data - Les données de remplacement (clé = nom du tag, valeur = contenu)
 * @param keepEmpty - Si true, conserve les tags sans valeur ; sinon les supprime
 * @returns Le XML modifié et les statistiques de remplacement
 *
 * @example
 * const xml = '<w:t>Nom: {{NOM}}, SIRET: {{SIRET}}</w:t>';
 * const data = { NOM: 'Ma Société' };
 * const result = replaceTagsInXml(xml, data, false);
 * // xml: '<w:t>Nom: Ma Société, SIRET: </w:t>'
 * // replaced: ['NOM']
 * // remaining: ['SIRET']
 */
function replaceTagsInXml(xml, data, keepEmpty = false) {
    let result = xml;
    const replaced = [];
    const remaining = [];
    // Trouver tous les tags uniques dans le document
    const allTags = xml.match(TAG_REGEX) || [];
    const uniqueTags = [...new Set(allTags)];
    for (const fullTag of uniqueTags) {
        // Extraire le nom du tag (sans les accolades)
        const tagName = fullTag.replace(/[{}]/g, '');
        const value = data[tagName];
        // Vérifier si on a une valeur pour ce tag
        if (isValidValue(value)) {
            // Ne pas remplacer si c'est un JSON de tableau (géré par les boucles)
            if (isArrayJson(value)) {
                continue;
            }
            // Remplacer le tag par sa valeur (échappée pour XML)
            result = replaceTag(result, fullTag, value);
            replaced.push(tagName);
        }
        else {
            remaining.push(tagName);
        }
    }
    // Nettoyer les tags sans valeur (sauf si keepEmpty = true)
    if (!keepEmpty) {
        result = result.replace(TAG_REGEX, '');
    }
    return { xml: result, replaced, remaining };
}
// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================
/**
 * Vérifie si une valeur est valide pour le remplacement.
 *
 * @param value - La valeur à vérifier
 * @returns true si la valeur peut être utilisée
 */
function isValidValue(value) {
    return value !== undefined && value !== null && value !== '';
}
/**
 * Vérifie si une valeur est un JSON de tableau.
 *
 * Les tableaux JSON sont gérés par le système de boucles,
 * pas par le remplacement simple de tags.
 *
 * @param value - La valeur à vérifier
 * @returns true si c'est un JSON de tableau
 */
function isArrayJson(value) {
    if (!value.startsWith('[') || !value.endsWith(']')) {
        return false;
    }
    try {
        JSON.parse(value);
        return true;
    }
    catch {
        // Ce n'est pas du JSON valide, traiter comme une valeur normale
        return false;
    }
}
/**
 * Remplace un tag spécifique par sa valeur dans le XML.
 *
 * @param xml - Le XML source
 * @param fullTag - Le tag complet (ex: "{{NOM}}")
 * @param value - La valeur de remplacement
 * @returns Le XML avec le tag remplacé
 */
function replaceTag(xml, fullTag, value) {
    // Échapper les caractères spéciaux du tag pour l'utiliser en regex
    const escapedTag = fullTag.replace(/[{}]/g, '\\$&');
    const regex = new RegExp(escapedTag, 'g');
    // Échapper la valeur pour XML et remplacer
    const safeValue = (0, utils_1.escapeXml)(value);
    return xml.replace(regex, safeValue);
}
// ============================================================================
// EXTRACTION DES TAGS
// ============================================================================
/**
 * Extrait tous les noms de tags uniques d'un document XML.
 *
 * Utile pour générer un rapport des tags présents dans le document.
 *
 * @param xml - Le XML du document
 * @returns Liste des noms de tags (sans les accolades), sans doublons
 *
 * @example
 * const xml = '<w:t>{{NOM}} et {{NOM}} et {{SIRET}}</w:t>';
 * const tags = extractTagsFromXml(xml);
 *
 */
function extractTagsFromXml(xml) {
    const allTags = xml.match(TAG_REGEX) || [];
    const tagNames = allTags.map((tag) => tag.replace(/[{}]/g, ''));
    return [...new Set(tagNames)];
}
