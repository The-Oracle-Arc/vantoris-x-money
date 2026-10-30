const models = new Map();

models.set('automatic', { name: 'automatic', description: 'Automatic model selection', cost: 'medium' });
models.set('gpt_5_mini', { name: 'gpt_5_mini', description: 'Fast, cost-effective', cost: 'low' });
models.set('gemini_3_flash', { name: 'gemini_3_flash', description: 'Fast with web search', cost: 'low' });
models.set('claude_sonnet_4_6', { name: 'claude_sonnet_4_6', description: 'High quality reasoning', cost: 'high' });
models.set('claude_opus_4_6', { name: 'claude_opus_4_6', description: 'Highest quality', cost: 'critical' });

const priorityMap = { low: 'gpt_5_mini', normal: 'automatic', high: 'claude_sonnet_4_6', critical: 'claude_opus_4_6' };

export const ModelRegistry = {
  register(model) { models.set(model.name, model); },
  get(name) { return models.get(name); },
  list() { return Array.from(models.values()); },
  select(priority = 'normal') { return models.get(priorityMap[priority] || 'automatic'); },
  getPriorityMap() { return priorityMap; },
};