import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.LLM_MODEL || 'gpt-5';

export interface LLMResponse {
  content: string;
  reasoning?: string;
}

export async function queryLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResponse> {
  const response = await openai.responses.create({
    model: MODEL,
    instructions: systemPrompt,
    input: [{ role: 'user', content: userPrompt }],
    reasoning: { effort: 'medium', summary: 'detailed' },
  });

  // Find reasoning item and extract first summary text
  const reasoningItem = response.output.find(item => item.type === 'reasoning');
  const reasoning = reasoningItem?.summary?.[0]?.text;

  return {
    content: response.output_text || '',
    reasoning,
  };
}

export async function queryLLMStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>  // ← Changed from 'object'
): Promise<T & { _reasoning?: string }> {
  const response = await openai.responses.create({
    model: MODEL,
    instructions: systemPrompt,
    input: [{ role: 'user', content: userPrompt }],
    reasoning: { effort: 'medium', summary: 'detailed' },
    text: {
      format: {
        type: 'json_schema',
        name: 'response',
        strict: true,
        schema,
      },
    },
  });

  const reasoningItem = response.output.find(item => item.type === 'reasoning');
  const reasoning = reasoningItem?.summary?.[0]?.text;

  const parsed = JSON.parse(response.output_text || '{}');

  return {
    ...parsed,
    _reasoning: reasoning,
  } as T & { _reasoning?: string };
}