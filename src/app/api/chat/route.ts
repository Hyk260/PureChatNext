import { openai } from '@ai-sdk/openai';
import { deepseek } from '@ai-sdk/deepseek';
import { ChatSDKError } from "@/libs/errors";
import { streamText, UIMessage, convertToModelMessages } from 'ai';

export const maxDuration = 30;

/**
 * chat API
 * POST /api/chat
 */
export async function POST(request: Request) {
  let requestBody;

  try {
    const json = await request.json();
    requestBody = json;
  } catch {
    return new ChatSDKError("bad_request:api").toResponse();
  }
  const { messages }: { messages: UIMessage[] } = requestBody
  console.log('messages:', messages);

  const result = streamText({
    model: deepseek('deepseek-chat'),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}