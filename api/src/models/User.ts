import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    // Не у всех исторических пользователей был привязан VK. Sparse-индекс
    // разрешает хранить таких пользователей, сохраняя уникальность VK ID.
    vkId: { type: String, unique: true, sparse: true, index: true },
    legacy: {
      // Есть только у перенесённых из Bitrix пользователей. Новые пользователи
      // создаются через VK OAuth и не имеют legacy ID.
      bitrixId: { type: Number }
    },
    email: { type: String },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    photo: { type: String },
    activeTo: { type: Date, required: true },
    trialEndsAt: { type: Date },
    isAdmin: { type: Boolean, default: false },
    enforceAccessRestrictions: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, index: true },
    lastActivityAt: { type: Date, index: true },
    // Первое касание до регистрации: UTM-метки, rb_clickid VK Ads, yclid Директа
    // или внешний referrer из cookie лендинга.
    acquisition: {
      utmSource: { type: String },
      utmMedium: { type: String },
      utmCampaign: { type: String },
      utmContent: { type: String },
      utmTerm: { type: String },
      rbClickId: { type: String },
      yclid: { type: String },
      referrer: { type: String },
      landingPath: { type: String },
      firstVisitAt: { type: Date }
    },
    // Последнее рекламное касание уже зарегистрированного пользователя.
    lastAcquisition: {
      utmSource: { type: String },
      utmMedium: { type: String },
      utmCampaign: { type: String },
      utmContent: { type: String },
      utmTerm: { type: String },
      rbClickId: { type: String },
      yclid: { type: String },
      referrer: { type: String },
      landingPath: { type: String },
      firstVisitAt: { type: Date },
      at: { type: Date }
    },
    // Цели для рекламных счётчиков, которые фронт ещё не отправил (регистрация, оплата).
    pendingGoals: [
      {
        goal: { type: String, required: true },
        value: { type: Number },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// Partial index keeps existing non-Bitrix service accounts valid while making
// every migrated Bitrix ID unique.
userSchema.index(
  { 'legacy.bitrixId': 1 },
  { unique: true, partialFilterExpression: { 'legacy.bitrixId': { $exists: true } } }
);

export const UserModel = model('User', userSchema);
