import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure which model to use - can be switched to 'gpt-5' when available
const MODEL = process.env.LLM_MODEL || 'gpt-5';

export interface LLMResponse {
  content: string;
  reasoning?: string;
}

export async function queryLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResponse> {
  // Add reasoning instruction to prompt
  const enhancedUserPrompt = `${userPrompt}

Before your response, think through your strategy step by step in a <reasoning> block. Then provide your actual response.

Format:
<reasoning>
Your strategic thinking here...
</reasoning>

Your actual response here (1-3 sentences)`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 1,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedUserPrompt },
    ],
  });

  const fullContent = response.choices[0].message.content || '';
  
  // Parse reasoning and content
  const reasoningMatch = fullContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined;
  
  // Get content after reasoning block, or full content if no reasoning block
  let content = fullContent;
  if (reasoningMatch) {
    content = fullContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/, '').trim();
  }

  return {
    content,
    reasoning,
  };
}

export async function queryLLMStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: object
  ): Promise<T & { _reasoning?: string }> {
    const existingProperties = (schema as { properties?: Record<string, unknown> }).properties || {};
    const existingRequired = (schema as { required?: string[] }).required || [];
    
    // Only add reasoning if not already present
    const hasReasoning = 'reasoning' in existingProperties;
    
    const schemaWithReasoning = {
      ...schema,
      properties: hasReasoning ? existingProperties : {
        reasoning: { 
          type: 'string', 
          description: 'Your private strategic thinking process. Think step by step about the situation, what you know, what others might know, and what the best move is.' 
        },
        ...existingProperties,
      },
      required: hasReasoning ? existingRequired : ['reasoning', ...existingRequired],
    };
  
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          strict: true,
          schema: schemaWithReasoning,
        },
      },
    });
  
    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    // Extract reasoning and return separately
    const { reasoning, ...rest } = parsed;
    
    return {
      ...rest,
      _reasoning: reasoning,
    } as T & { _reasoning?: string };
  }
