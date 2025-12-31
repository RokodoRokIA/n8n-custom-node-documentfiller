"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
