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
import { CheckboxStyle } from '../../shared/types';
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
export declare function flattenJsonToTags(obj: Record<string, unknown>, prefix?: string): Record<string, string>;
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
export declare function adjustCheckboxStyle(data: Record<string, string>, style: CheckboxStyle): Record<string, string>;
