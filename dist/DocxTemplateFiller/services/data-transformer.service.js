"use strict";
/**
 * ============================================================================
 * SERVICE DATA TRANSFORMER - Transformation des données JSON
 * ============================================================================
 *
 * Ce service gère la transformation des données JSON d'entrée en format
 * compatible avec le remplacement des tags dans le document DOCX.
 *
 * FONCTIONNALITÉS :
 * - Aplatissement d'objets imbriqués (entreprise.nom → ENTREPRISE_NOM)
 * - Gestion des tableaux (items[0].nom → ITEMS_0_NOM)
 * - Conversion des booléens en symboles de checkbox
 * - Ajustement du style des checkboxes selon les préférences
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Le JSON d'entrée peut avoir n'importe quelle structure
 * - On le transforme en format "plat" où chaque clé = un tag du document
 * - Les clés sont en MAJUSCULES avec underscores
 *
 * @author Rokodo
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenJsonToTags = flattenJsonToTags;
exports.adjustCheckboxStyle = adjustCheckboxStyle;
// ============================================================================
// APLATISSEMENT DU JSON
// ============================================================================
/**
 * Aplatit un objet JSON imbriqué en un objet plat avec les clés en majuscules.
 *
 * Cette fonction est le cœur du système de mapping. Elle permet d'utiliser
 * n'importe quelle structure JSON comme source de données.
 *
 * EXEMPLES DE TRANSFORMATION :
 * - { entreprise: { nom: "Test" } } → { "ENTREPRISE_NOM": "Test" }
 * - { items: [{nom: "A"}, {nom: "B"}] } → { "ITEMS_0_NOM": "A", "ITEMS_1_NOM": "B" }
 * - { actif: true } → { "ACTIF": "☑" }
 *
 * @param obj - L'objet JSON à aplatir
 * @param prefix - Préfixe à ajouter aux clés (utilisé en récursion)
 * @returns Un objet plat avec des valeurs string
 *
 * @example
 * const data = { entreprise: { nom: 'Ma Société', siret: '123' } };
 * const flat = flattenJsonToTags(data);
 * // { ENTREPRISE_NOM: 'Ma Société', ENTREPRISE_SIRET: '123' }
 */
function flattenJsonToTags(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        // Construire la clé du tag
        // Si on a un préfixe (récursion), on l'ajoute avec underscore
        const tagKey = prefix
            ? `${prefix}_${key}`.toUpperCase()
            : key.toUpperCase();
        // Ignorer les valeurs null/undefined
        if (value === null || value === undefined) {
            continue;
        }
        // Cas 1: Objet imbriqué (non-tableau) → Récursion
        if (typeof value === 'object' && !Array.isArray(value)) {
            const nestedResult = flattenJsonToTags(value, tagKey);
            Object.assign(result, nestedResult);
            continue;
        }
        // Cas 2: Tableau → Traitement spécial
        if (Array.isArray(value)) {
            handleArrayValue(result, tagKey, value);
            continue;
        }
        // Cas 3: Booléen → Symbole de checkbox
        if (typeof value === 'boolean') {
            result[tagKey] = value ? '☑' : '☐';
            continue;
        }
        // Cas 4: Valeur simple → Conversion en string
        result[tagKey] = String(value);
    }
    return result;
}
/**
 * Gère la transformation d'une valeur tableau.
 *
 * DEUX CAS :
 * 1. Tableau d'objets : créer des tags indexés (ITEMS_0_NOM, ITEMS_1_NOM, etc.)
 * 2. Tableau de valeurs simples : joindre avec des virgules
 *
 * @param result - L'objet résultat à modifier
 * @param tagKey - La clé du tag pour ce tableau
 * @param value - Le tableau à traiter
 */
function handleArrayValue(result, tagKey, value) {
    if (value.length === 0) {
        return;
    }
    // Cas 1: Tableau d'objets
    if (typeof value[0] === 'object' && value[0] !== null) {
        // Créer des tags indexés pour chaque élément
        value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
                const itemPrefix = `${tagKey}_${index}`;
                const itemTags = flattenJsonToTags(item, itemPrefix);
                Object.assign(result, itemTags);
            }
        });
        // Aussi stocker le tableau complet pour les boucles éventuelles
        result[tagKey] = JSON.stringify(value);
        return;
    }
    // Cas 2: Tableau de valeurs simples
    result[tagKey] = value
        .map((item) => {
        if (typeof item === 'object') {
            return JSON.stringify(item);
        }
        return String(item);
    })
        .join(', ');
}
// ============================================================================
// STYLE DES CHECKBOXES
// ============================================================================
/**
 * Ajuste le style d'affichage des checkboxes.
 *
 * Par défaut, les booléens sont convertis en symboles Unicode (☑/☐).
 * Cette fonction permet de changer ce style selon les préférences.
 *
 * STYLES DISPONIBLES :
 * - unicode : ☑ et ☐ (défaut)
 * - text    : X et espace
 * - boolean : "true" et "false"
 *
 * @param data - Les données avec les checkboxes en format unicode
 * @param style - Le style souhaité
 * @returns Les données avec le style ajusté
 *
 * @example
 * const data = { CHECK_ACTIF: '☑', CHECK_INACTIF: '☐' };
 * const adjusted = adjustCheckboxStyle(data, 'text');
 * // { CHECK_ACTIF: 'X', CHECK_INACTIF: ' ' }
 */
function adjustCheckboxStyle(data, style) {
    // Si le style est unicode, pas de modification nécessaire
    if (style === 'unicode') {
        return data;
    }
    const result = { ...data };
    for (const key of Object.keys(result)) {
        const value = result[key];
        // Détecter les valeurs de checkbox (☑ ou ☐)
        if (value === '☑' || value === '☐') {
            const isChecked = value === '☑';
            switch (style) {
                case 'text':
                    result[key] = isChecked ? 'X' : ' ';
                    break;
                case 'boolean':
                    result[key] = isChecked ? 'true' : 'false';
                    break;
            }
        }
    }
    return result;
}
