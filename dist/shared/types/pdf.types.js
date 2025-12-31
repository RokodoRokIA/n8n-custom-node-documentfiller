"use strict";
/**
 * ============================================================================
 * TYPES PDF - Définitions pour la conversion DOCX vers PDF
 * ============================================================================
 *
 * Ce fichier contient tous les types TypeScript relatifs à la conversion
 * de documents DOCX vers PDF. Utilisé par le node DocxToPdf.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - pdf-lib est utilisé pour créer le PDF (pure JavaScript)
 * - Les polices standard PDF sont Helvetica, Times et Courier
 * - Les dimensions sont en points (72 points = 1 pouce)
 *
 * @author Rokodo
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MARGINS = exports.A4_HEIGHT = exports.A4_WIDTH = void 0;
// ============================================================================
// CONSTANTES
// ============================================================================
/**
 * Dimensions d'une page A4 en points.
 * 1 pouce = 72 points, A4 = 210mm x 297mm
 */
exports.A4_WIDTH = 595.28;
exports.A4_HEIGHT = 841.89;
/**
 * Marges par défaut en points (1 pouce = 72 points).
 */
exports.DEFAULT_MARGINS = {
    top: 72,
    bottom: 72,
    left: 72,
    right: 72,
};
