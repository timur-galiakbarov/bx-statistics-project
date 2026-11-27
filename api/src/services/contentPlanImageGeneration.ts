import { DomainError } from '../errors/domainError.js';
import { getApiKey, reserveContentPlanGeneration, unavailable } from './contentPlanTextGeneration.js';
import { requestOpenAi } from './openAiClient.js';

export async function generateContentPlanImage(userId: string, input: unknown) {
  const prompt = typeof input === 'string' ? input.trim() : '';
  if (!prompt || prompt.length > 1000) {
    throw new DomainError('Опишите изображение в пределах 1 000 символов.', {
      status: 400, code: 'CONTENT_PLAN_AI_INVALID_IMAGE_PROMPT'
    });
  }
  const apiKey = getApiKey();
  if (!apiKey) throw unavailable('image');
  const quota = await reserveContentPlanGeneration(userId, 'image');
  try {
    const response = await requestOpenAi('/v1/images/generations', apiKey, {
      model: 'gpt-image-2.6-flare',
      prompt,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'jpeg',
      n: 1
    }, 120_000);
    if (!response.ok) throw unavailable('image');
    const result = await response.json() as { data?: Array<{ b64_json?: string }> };
    const image = result.data?.[0]?.b64_json;
    if (!image || Buffer.byteLength(image, 'base64') > 5 * 1024 * 1024) throw unavailable('image');
    return { image, ...quota };
  } catch {
    throw unavailable('image');
  }
}
