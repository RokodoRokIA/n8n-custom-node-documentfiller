"use strict";
/**
 * ============================================================================
 * SERVICE LOOP PROCESSOR - Traitement des boucles dans le document
 * ============================================================================
 *
 * Ce service gère les boucles {#ARRAY}...{/ARRAY} dans le document DOCX.
 * Ces boucles permettent de dupliquer une section pour chaque élément d'un tableau.
 *
 * SYNTAXE DES BOUCLES :
 * ```
 * {#ITEMS}
 *   - {{NOM}} : {{PRIX}}€
 * {/ITEMS}
 * ```
 *
 * Avec les données { items: [{nom: "A", prix: 10}, {nom: "B", prix: 20}] }
 * Produit :
 * ```
 *   - A : 10€
 *   - B : 20€
 * ```
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - Les boucles sont différentes des tags simples {{TAG}}
 * - Elles utilisent {#...} pour ouvrir et {/...} pour fermer
 * - Le contenu entre les marqueurs est dupliqué pour chaque élément
 *
 * @author Rokodo
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processLoopsInXml = processLoopsInXml;
const utils_1 = require("../../shared/utils");
// ============================================================================
// TRAITEMENT DES BOUCLES
// ============================================================================
/**
 * Expression régulière pour détecter les boucles.
 *
 * Capture :
 * - Groupe 1 : Nom du tableau (ITEMS, LIGNES, etc.)
 * - Groupe 2 : Contenu de la boucle
 */
const LOOP_REGEX = /\{#([A-Z_0-9]+)\}([\s\S]*?)\{\/\1\}/gi;
/**
 * Traite toutes les boucles {#ARRAY}...{/ARRAY} dans le XML.
 *
 * Pour chaque boucle trouvée :
 * 1. Cherche le tableau correspondant dans les données
 * 2. Duplique le contenu pour chaque élément
 * 3. Remplace les tags {{TAG}} par les valeurs de chaque élément
 *
 * @param xml - Le XML du document
 * @param rawData - Les données JSON brutes (non aplaties)
 * @returns Le XML avec les boucles traitées
 *
 * @example
 * const xml = '{#ITEMS}<w:p>{{NOM}}</w:p>{/ITEMS}';
 * const data = { items: [{nom: 'A'}, {nom: 'B'}] };
 * const result = processLoopsInXml(xml, data);
 * // '<w:p>A</w:p><w:p>B</w:p>'
 */
function processLoopsInXml(xml, rawData) {
    let result = xml;
    let match;
    // Réinitialiser le lastIndex pour éviter les problèmes avec les regex globales
    LOOP_REGEX.lastIndex = 0;
    while ((match = LOOP_REGEX.exec(result)) !== null) {
        const arrayName = match[1]; // Nom du tableau (ex: ITEMS)
        const templateContent = match[2]; // Contenu à dupliquer
        const fullMatch = match[0]; // Match complet {#ITEMS}...{/ITEMS}
        // Chercher le tableau dans les données
        const arrayData = findArrayInData(rawData, arrayName);
        if (arrayData && arrayData.length > 0) {
            // Générer le contenu étendu pour chaque élément
            const expandedContent = generateExpandedContent(templateContent, arrayData);
            // Remplacer la boucle par le contenu étendu
            result = result.replace(fullMatch, expandedContent);
            // IMPORTANT: Recommencer la recherche depuis le début
            // car les positions ont changé après le remplacement
            LOOP_REGEX.lastIndex = 0;
        }
        else {
            // Pas de données pour cette boucle → supprimer le bloc
            result = result.replace(fullMatch, '');
            LOOP_REGEX.lastIndex = 0;
        }
    }
    return result;
}
// ============================================================================
// RECHERCHE DES DONNÉES
// ============================================================================
/**
 * Recherche un tableau dans les données JSON.
 *
 * Cette fonction gère :
 * - Accès direct (data.ITEMS ou data.items)
 * - Chemin imbriqué (data.commande.items → COMMANDE_ITEMS)
 *
 * @param data - Les données JSON
 * @param arrayName - Nom du tableau à chercher (en majuscules avec underscores)
 * @returns Le tableau trouvé ou undefined
 */
function findArrayInData(data, arrayName) {
    // Tentative 1: Accès direct (ITEMS ou items)
    if (Array.isArray(data[arrayName])) {
        return data[arrayName];
    }
    const lowerName = arrayName.toLowerCase();
    if (Array.isArray(data[lowerName])) {
        return data[lowerName];
    }
    // Tentative 2: Chemin imbriqué (COMMANDE_ITEMS → commande.items)
    return findNestedArray(data, arrayName);
}
/**
 * Recherche un tableau dans une structure imbriquée.
 *
 * Convertit le nom de tableau en chemin d'accès :
 * COMMANDE_ITEMS → ['commande', 'items']
 *
 * @param obj - L'objet à parcourir
 * @param path - Le chemin en majuscules avec underscores
 * @returns Le tableau trouvé ou undefined
 */
function findNestedArray(obj, path) {
    // Découper le chemin en parties
    const pathParts = path.toLowerCase().split('_');
    let current = obj;
    // Parcourir le chemin
    for (const part of pathParts) {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            const objCurrent = current;
            // Chercher la clé (insensible à la casse)
            const key = Object.keys(objCurrent).find((k) => k.toLowerCase() === part);
            if (key) {
                current = objCurrent[key];
            }
            else {
                return undefined;
            }
        }
        else {
            return undefined;
        }
    }
    // Vérifier que le résultat est un tableau
    return Array.isArray(current) ? current : undefined;
}
// ============================================================================
// GÉNÉRATION DU CONTENU
// ============================================================================
/**
 * Génère le contenu étendu en dupliquant le template pour chaque élément.
 *
 * @param template - Le contenu à dupliquer
 * @param arrayData - Les données du tableau
 * @returns Le contenu dupliqué avec les valeurs remplacées
 */
function generateExpandedContent(template, arrayData) {
    return arrayData
        .map((item) => {
        let itemContent = template;
        // Si l'élément est un objet, remplacer les tags par ses propriétés
        if (typeof item === 'object' && item !== null) {
            for (const [key, value] of Object.entries(item)) {
                // Créer une regex pour ce tag (insensible à la casse)
                const tagRegex = new RegExp(`\\{\\{${key.toUpperCase()}\\}\\}`, 'gi');
                // Convertir la valeur et l'échapper pour XML
                const displayValue = convertValueForDisplay(value);
                const safeValue = (0, utils_1.escapeXml)(displayValue);
                // Remplacer dans le contenu
                itemContent = itemContent.replace(tagRegex, safeValue);
            }
        }
        return itemContent;
    })
        .join('');
}
/**
 * Convertit une valeur pour l'affichage dans le document.
 *
 * @param value - La valeur à convertir
 * @returns La chaîne à afficher
 */
function convertValueForDisplay(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'boolean') {
        return value ? '☑' : '☐';
    }
    return String(value);
}
