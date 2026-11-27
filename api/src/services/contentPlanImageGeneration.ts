import { DomainError } from '../errors/domainError.js';
import { confirmMedia } from './contentPlanMedia.js';
import { activeWritingRules, getCommonWritingRules, getOwnedChannel } from './contentPlanService.js';
import { getApiKey, reserveContentPlanGeneration, unavailable } from './contentPlanTextGeneration.js';
import { requestOpenAi } from './openAiClient.js';

export async function generateContentPlanImage(userId: string, body?: {
  prompt?: unknown;
  channelId?: unknown;
  postNote?: unknown;
  excludeCommonRules?: unknown;
  excludeChannelRules?: unknown;
  sourceMediaId?: unknown;
  refinement?: unknown;
}) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const postNote = typeof body?.postNote === 'string' ? body.postNote.trim() : '';
  const refinement = typeof body?.refinement === 'string' ? body.refinement.trim() : '';
  const editing = body?.sourceMediaId != null;
  if (!prompt || prompt.length > 1000 || postNote.length > 1000 || (editing && (!refinement || refinement.length > 1000))) {
    throw new DomainError('Описание и уточнение должны быть не длиннее 1 000 символов.', {
      status: 400, code: 'CONTENT_PLAN_AI_INVALID_IMAGE_PROMPT'
    });
  }

  const apiKey = getApiKey();
  if (!apiKey) throw unavailable('image');
  const [channel, commonRules] = await Promise.all([
    body?.channelId == null ? null : getOwnedChannel(userId, body.channelId),
    getCommonWritingRules(userId, 'image')
  ]);
  const rules = [
    ['Общие правила', activeWritingRules(commonRules, body?.excludeCommonRules)],
    ['Правила канала', activeWritingRules(channel?.imageRules ?? '', body?.excludeChannelRules)],
    ['Пожелания к этому посту', postNote],
    ['Уточнение к выбранному варианту', refinement]
  ];
  const instructions = [
    editing ? 'Измени приложенное изображение согласно уточнению. Сохрани детали, которых оно не касается.' : 'Создай изображение по описанию.',
    'Описание: ' + prompt,
    ...rules.filter(([, value]) => value).map(([label, value]) => label + ': ' + value)
  ].join('\n\n');
  const source = editing ? await confirmMedia(userId, body?.sourceMediaId) : null;
  const quota = await reserveContentPlanGeneration(userId, 'image');
  try {
    const response = await requestOpenAi(source ? '/v1/images/edits' : '/v1/images/generations', apiKey, {
      model: 'gpt-image-2.6-flare',
      prompt: instructions,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'jpeg',
      n: 1,
      ...(source ? { images: [{ image_url: source.previewUrl }] } : {})
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
