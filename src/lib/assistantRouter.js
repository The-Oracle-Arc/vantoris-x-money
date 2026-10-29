/**
 * Vantoris Command Router
 *
 * Routes requests to the appropriate Vantoris Command division.
 * The customer-facing AI remains Vantoris Assistant — divisions are internal
 * specialist capabilities invoked by Command, not separate personalities.
 */

export const COMMAND_DIVISIONS = {
  COMMAND: 'command',
  INTELLIGENCE: 'intelligence',
  OPERATIONS: 'operations',
  COMPLIANCE: 'compliance',
  SECURITY: 'security',
  SUPPORT: 'support',
  LOGISTICS: 'logistics',
  HUMANITARIAN: 'humanitarian',
  RECONNAISSANCE: 'reconnaissance',
  FINANCE: 'finance',
  MARKETS: 'markets',
  PORTFOLIO: 'portfolio',
  RISK: 'risk',
  NAVIGATION: 'navigation',
  RECORDS: 'records',
  COMMUNICATIONS: 'communications',
};

export const DIVISION_AGENTS = {
  [COMMAND_DIVISIONS.COMMAND]: 'command',
  [COMMAND_DIVISIONS.INTELLIGENCE]: 'intelligence',
  [COMMAND_DIVISIONS.OPERATIONS]: 'operations',
  [COMMAND_DIVISIONS.COMPLIANCE]: 'compliance',
  [COMMAND_DIVISIONS.SECURITY]: 'security',
  [COMMAND_DIVISIONS.SUPPORT]: 'support',
  [COMMAND_DIVISIONS.LOGISTICS]: 'logistics',
  [COMMAND_DIVISIONS.HUMANITARIAN]: 'humanitarian',
  [COMMAND_DIVISIONS.RECONNAISSANCE]: 'reconnaissance',
  [COMMAND_DIVISIONS.FINANCE]: 'finance',
  [COMMAND_DIVISIONS.MARKETS]: 'markets',
  [COMMAND_DIVISIONS.PORTFOLIO]: 'portfolio',
  [COMMAND_DIVISIONS.RISK]: 'risk',
  [COMMAND_DIVISIONS.NAVIGATION]: 'navigation',
  [COMMAND_DIVISIONS.RECORDS]: 'records',
  [COMMAND_DIVISIONS.COMMUNICATIONS]: 'communications',
};

export const DIVISION_LABELS = {
  [COMMAND_DIVISIONS.COMMAND]: 'Command',
  [COMMAND_DIVISIONS.INTELLIGENCE]: 'Intelligence',
  [COMMAND_DIVISIONS.OPERATIONS]: 'Operations',
  [COMMAND_DIVISIONS.COMPLIANCE]: 'Compliance',
  [COMMAND_DIVISIONS.SECURITY]: 'Security',
  [COMMAND_DIVISIONS.SUPPORT]: 'Support',
  [COMMAND_DIVISIONS.LOGISTICS]: 'Logistics',
  [COMMAND_DIVISIONS.HUMANITARIAN]: 'Humanitarian',
  [COMMAND_DIVISIONS.RECONNAISSANCE]: 'Reconnaissance',
  [COMMAND_DIVISIONS.FINANCE]: 'Finance',
  [COMMAND_DIVISIONS.MARKETS]: 'Markets',
  [COMMAND_DIVISIONS.PORTFOLIO]: 'Portfolio',
  [COMMAND_DIVISIONS.RISK]: 'Risk',
  [COMMAND_DIVISIONS.NAVIGATION]: 'Navigation',
  [COMMAND_DIVISIONS.RECORDS]: 'Records',
  [COMMAND_DIVISIONS.COMMUNICATIONS]: 'Communications',
};

const ROUTING_PATTERNS = [
  {
    division: COMMAND_DIVISIONS.OPERATIONS,
    keywords: ['transfer', 'send money', 'payment', 'ach', 'wire', 'deposit', 'withdraw', 'withdrawal', 'move money', 'fund', 'funding', 'pay', 'routing number', 'account number', 'direct deposit', 'check deposit', 'declined', 'transaction', 'balance', 'fee', 'overdraft', 'statement', 'account status', 'frozen', 'closed', 'dispute', 'charge', 'pending', 'history', 'account issue'],
  },
  {
    division: COMMAND_DIVISIONS.COMPLIANCE,
    keywords: ['kyc', 'verification', 'identity', 'id upload', 'document upload', 'verification status', 'compliance', 'approved', 'rejected', 'application', 'joint account', 'business account', 'ein', 'aml', 'sanctions', 'regulatory'],
  },
  {
    division: COMMAND_DIVISIONS.SECURITY,
    keywords: ['fraud', 'unauthorized', 'suspicious', 'security', 'breach', 'compromised', 'hacked', 'stolen', 'identity theft', 'frozen account', 'access control'],
  },
  {
    division: COMMAND_DIVISIONS.SUPPORT,
    keywords: ['help', 'support', 'guide', 'onboarding', 'next step', 'what do i do', 'how do i', 'where is', 'contact', 'message', 'advisor'],
  },
  {
    division: COMMAND_DIVISIONS.LOGISTICS,
    keywords: ['herobox', 'care package', 'shipping', 'delivery', 'tracking', 'order', 'fulfillment', 'package'],
  },
  {
    division: COMMAND_DIVISIONS.HUMANITARIAN,
    keywords: ['humanitarian', 'ngo', 'orphanage', 'children', 'relief', 'assistance', 'charity', 'donate', 'sponsor', 'hero', 'veteran', 'military', 'deployed'],
  },
  {
    division: COMMAND_DIVISIONS.RECONNAISSANCE,
    keywords: ['search', 'find', 'discover', 'research', 'current', 'latest', 'news', 'emerging', 'what is happening'],
  },
  {
    division: COMMAND_DIVISIONS.FINANCE,
    keywords: ['financial analysis', 'financial report', 'account intelligence', 'balance sheet', 'income', 'expense', 'cash flow', 'profit', 'loss'],
  },
  {
    division: COMMAND_DIVISIONS.MARKETS,
    keywords: ['investment research', 'market', 'stock', 'bond', 'etf', 'index', 'trading', 'signal', 'buy', 'sell', 'ticker'],
  },
  {
    division: COMMAND_DIVISIONS.PORTFOLIO,
    keywords: ['portfolio', 'position', 'allocation', 'performance', 'pnl', 'p&l', 'dividend', 'investment deposit', 'investment withdrawal'],
  },
  {
    division: COMMAND_DIVISIONS.RISK,
    keywords: ['risk', 'exposure', 'volatility', 'var', 'stress test', 'counterparty', 'operational risk'],
  },
  {
    division: COMMAND_DIVISIONS.NAVIGATION,
    keywords: ['where do i go', 'next action', 'what should i do next', 'how long', 'timeline', 'when will', 'plan', 'route'],
  },
  {
    division: COMMAND_DIVISIONS.RECORDS,
    keywords: ['statement', 'document', 'letter', 'certificate', 'proof of', 'reference letter', 'balance letter', 'summary', 'archive', 'historical'],
  },
  {
    division: COMMAND_DIVISIONS.COMMUNICATIONS,
    keywords: ['email', 'sms', 'whatsapp', 'notification', 'message', 'notify', 'alert', 'communicate'],
  },
  {
    division: COMMAND_DIVISIONS.COMMAND,
    keywords: ['diagnostic', 'health', 'system status', 'platform', 'uptime', 'background job', 'scheduled', 'metric', 'audit log', 'configuration', 'system report', 'generate account', 'build', 'code'],
  },
];

/**
 * Classifies a user message and returns the appropriate Command division.
 * Falls back to OPERATIONS for general banking queries.
 * @param {string} message - The user's message text
 * @returns {string} - Division from COMMAND_DIVISIONS
 */
export function routeRequest(message) {
  const lower = message.toLowerCase();
  let bestMatch = COMMAND_DIVISIONS.OPERATIONS;
  let bestScore = 0;

  for (const pattern of ROUTING_PATTERNS) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.split(' ').length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern.division;
    }
  }

  return bestMatch;
}

/**
 * Returns the agent name for a given division.
 * @param {string} division - From COMMAND_DIVISIONS
 * @returns {string} - Agent config name
 */
export function getAgentName(division) {
  return DIVISION_AGENTS[division] || DIVISION_AGENTS[COMMAND_DIVISIONS.OPERATIONS];
}

/**
 * Returns the human-readable label for a division.
 * @param {string} division - From COMMAND_DIVISIONS
 * @returns {string} - Display label
 */
export function getDivisionLabel(division) {
  return DIVISION_LABELS[division] || DIVISION_LABELS[COMMAND_DIVISIONS.OPERATIONS];
}

/**
 * Returns the case_type value for CaseWorkspace entity.
 * @param {string} division - From COMMAND_DIVISIONS
 * @returns {string} - Case type enum value
 */
export function getCaseType(division) {
  return division || COMMAND_DIVISIONS.OPERATIONS;
}

// === Backward-compatible exports (deprecated — use COMMAND_DIVISIONS) ===
export const SPECIALIST_TYPES = COMMAND_DIVISIONS;
export const SPECIALIST_AGENTS = DIVISION_AGENTS;
export const SPECIALIST_LABELS = DIVISION_LABELS;
export const getSpecialistLabel = getDivisionLabel;