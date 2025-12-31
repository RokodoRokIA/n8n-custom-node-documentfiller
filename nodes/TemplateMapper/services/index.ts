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

// Service LLM (appels aux modeles de langage)
export * from './llm.service';

// Service d'application des tags
export * from './tag-applicator.service';

// Service unifie legacy (Tags + Checkboxes en 1 appel)
export {
	performUnifiedMapping,
	applyCheckboxDecisions,
	UnifiedMappingResult,
} from './unified-mapper.service';

// NOUVEAU: Agent ReAct autonome avec verification post-application
export {
	runReActAgent,
	MappingContext,
	CheckboxDecision,
	AgentResult,
	AgentState,
	ExpectedTag,
	AgentIssue,
	AgentAction,
} from './react-agent.service';
