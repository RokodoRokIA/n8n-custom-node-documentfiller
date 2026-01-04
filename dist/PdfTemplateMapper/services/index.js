"use strict";
/**
 * ============================================================================
 * SERVICES PDF TEMPLATE MAPPER - INDEX
 * ============================================================================
 *
 * Point d'entrée pour tous les services du PdfTemplateMapper.
 *
 * ARCHITECTURE:
 * - pdf-extractor.service.ts : Extraction de texte avec positions
 * - pdf-matcher.service.ts : Matching LLM avec positions
 * - pdf-filler.service.ts : Remplissage du PDF
 *
 * @author Rokodo
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPdfReActAgent = exports.mergePdfs = exports.extractPage = exports.copyPage = exports.createEmptyPdf = exports.getPdfInfo = exports.savePdfDocument = exports.loadPdfDocument = exports.drawDebugRectangle = exports.fillCheckbox = exports.fillPdf = exports.validateMatches = exports.findBestMatch = exports.runPdfMatchingAgent = exports.calculatePositionSimilarity = exports.findFieldsNearPosition = exports.findLinesContaining = exports.extractPdfContent = void 0;
// Service d'extraction PDF
var pdf_extractor_service_1 = require("./pdf-extractor.service");
Object.defineProperty(exports, "extractPdfContent", { enumerable: true, get: function () { return pdf_extractor_service_1.extractPdfContent; } });
Object.defineProperty(exports, "findLinesContaining", { enumerable: true, get: function () { return pdf_extractor_service_1.findLinesContaining; } });
Object.defineProperty(exports, "findFieldsNearPosition", { enumerable: true, get: function () { return pdf_extractor_service_1.findFieldsNearPosition; } });
Object.defineProperty(exports, "calculatePositionSimilarity", { enumerable: true, get: function () { return pdf_extractor_service_1.calculatePositionSimilarity; } });
// Service de matching LLM
var pdf_matcher_service_1 = require("./pdf-matcher.service");
Object.defineProperty(exports, "runPdfMatchingAgent", { enumerable: true, get: function () { return pdf_matcher_service_1.runPdfMatchingAgent; } });
Object.defineProperty(exports, "findBestMatch", { enumerable: true, get: function () { return pdf_matcher_service_1.findBestMatch; } });
Object.defineProperty(exports, "validateMatches", { enumerable: true, get: function () { return pdf_matcher_service_1.validateMatches; } });
// Service de remplissage PDF
var pdf_filler_service_1 = require("./pdf-filler.service");
Object.defineProperty(exports, "fillPdf", { enumerable: true, get: function () { return pdf_filler_service_1.fillPdf; } });
Object.defineProperty(exports, "fillCheckbox", { enumerable: true, get: function () { return pdf_filler_service_1.fillCheckbox; } });
Object.defineProperty(exports, "drawDebugRectangle", { enumerable: true, get: function () { return pdf_filler_service_1.drawDebugRectangle; } });
Object.defineProperty(exports, "loadPdfDocument", { enumerable: true, get: function () { return pdf_filler_service_1.loadPdfDocument; } });
Object.defineProperty(exports, "savePdfDocument", { enumerable: true, get: function () { return pdf_filler_service_1.savePdfDocument; } });
Object.defineProperty(exports, "getPdfInfo", { enumerable: true, get: function () { return pdf_filler_service_1.getPdfInfo; } });
Object.defineProperty(exports, "createEmptyPdf", { enumerable: true, get: function () { return pdf_filler_service_1.createEmptyPdf; } });
Object.defineProperty(exports, "copyPage", { enumerable: true, get: function () { return pdf_filler_service_1.copyPage; } });
Object.defineProperty(exports, "extractPage", { enumerable: true, get: function () { return pdf_filler_service_1.extractPage; } });
Object.defineProperty(exports, "mergePdfs", { enumerable: true, get: function () { return pdf_filler_service_1.mergePdfs; } });
// Service Agent ReAct PDF
var pdf_react_agent_service_1 = require("./pdf-react-agent.service");
Object.defineProperty(exports, "runPdfReActAgent", { enumerable: true, get: function () { return pdf_react_agent_service_1.runPdfReActAgent; } });
