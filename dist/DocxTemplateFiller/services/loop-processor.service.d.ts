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
export declare function processLoopsInXml(xml: string, rawData: Record<string, unknown>): string;
