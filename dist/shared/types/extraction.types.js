"use strict";
/**
 * ============================================================================
 * TYPES EXTRACTION - Définitions pour l'extraction DOCX vers JSON
 * ============================================================================
 *
 * Ce fichier contient tous les types TypeScript relatifs à l'extraction
 * de contenu structuré depuis un document DOCX. Utilisé par le node DocxExtractor.
 *
 * POUR LES DÉVELOPPEURS JUNIORS :
 * - L'extraction transforme un DOCX en JSON structuré
 * - La structure hiérarchique préserve l'organisation du document
 * - Les tableaux peuvent être convertis en array d'objets (si headers détectés)
 *
 * @author Rokodo
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
