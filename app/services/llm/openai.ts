import OpenAI from 'openai';

export class OpenAIProvider {
  constructor(private readonly client: OpenAI) {}

  async completeStructured<T>(params: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    jsonSchema: Record<string, unknown>;
    schemaName: string;
  }): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: 'gpt-4o',
          messages: params.messages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: params.schemaName,
              strict: true,
              schema: params.jsonSchema,
            },
          },
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('Empty response from OpenAI');
        return JSON.parse(content) as T;
      } catch (err) {
        if (!isRetryable(err) || attempt === 2) throw err;
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
    throw new Error('Max retries exceeded');
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    return err.status === 429 || err.status >= 500;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
