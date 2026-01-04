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

// Service d'extraction PDF
export {
	extractPdfContent,
	findLinesContaining,
	findFieldsNearPosition,
	calculatePositionSimilarity,
} from './pdf-extractor.service';

// Service de matching LLM
export {
	runPdfMatchingAgent,
	findBestMatch,
	validateMatches,
} from './pdf-matcher.service';

// Service de remplissage PDF
export {
	fillPdf,
	fillCheckbox,
	drawDebugRectangle,
	loadPdfDocument,
	savePdfDocument,
	getPdfInfo,
	createEmptyPdf,
	copyPage,
	extractPage,
	mergePdfs,
} from './pdf-filler.service';

// Service Agent ReAct PDF
export {
	runPdfReActAgent,
	type PdfMappingContext,
	type AgentResult,
	type Position,
} from './pdf-react-agent.service';
