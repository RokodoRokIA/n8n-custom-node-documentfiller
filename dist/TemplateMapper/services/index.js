"use strict";
/**
 * ============================================================================
 * SERVICES TEMPLATE MAPPER - INDEX
 * ============================================================================
 *
 * Point d'entree pour tous les services du TemplateMapper.
 *
 * ARCHITECTURE v4.0 - AGENT REACT AUTONOME:
 * - react-agent.service.ts : Agent ReAct autonome (NOUVEAU - recommandé)
 * - unified-mapper.service.ts : Ancien service (legacy)
 * - llm.service.ts : Appels LLM
 * - tag-applicator.service.ts : Application des tags au XML
 *
 * @author Rokodo
 * @version 4.0.0
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
exports.runReActAgent = exports.applyCheckboxDecisions = exports.performUnifiedMapping = void 0;
// Service LLM (appels aux modeles de langage)
__exportStar(require("./llm.service"), exports);
// Service d'application des tags
__exportStar(require("./tag-applicator.service"), exports);
// Service unifie legacy (Tags + Checkboxes en 1 appel)
var unified_mapper_service_1 = require("./unified-mapper.service");
Object.defineProperty(exports, "performUnifiedMapping", { enumerable: true, get: function () { return unified_mapper_service_1.performUnifiedMapping; } });
Object.defineProperty(exports, "applyCheckboxDecisions", { enumerable: true, get: function () { return unified_mapper_service_1.applyCheckboxDecisions; } });
// NOUVEAU: Agent ReAct autonome avec verification post-application
var react_agent_service_1 = require("./react-agent.service");
Object.defineProperty(exports, "runReActAgent", { enumerable: true, get: function () { return react_agent_service_1.runReActAgent; } });
