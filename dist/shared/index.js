"use strict";
/**
 * ============================================================================
 * MODULE PARTAGÉ - INDEX PRINCIPAL
 * ============================================================================
 *
 * Ce module centralise l'export de tous les types et utilitaires partagés
 * entre les nœuds TemplateMapper et DocxTemplateFiller.
 *
 * UTILISATION :
 * ```typescript
 * import { TagContext, normalizeText, loadDocxContent } from '../shared';
 * ```
 *
 * @author Rokodo
 * @version 2.0.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Types partagés
__exportStar(require("./types"), exports);
// Utilitaires partagés
__exportStar(require("./utils"), exports);
