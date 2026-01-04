"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
