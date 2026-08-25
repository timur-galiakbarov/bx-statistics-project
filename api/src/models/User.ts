import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    // Не у всех исторических пользователей был привязан VK. Sparse-индекс
    // разрешает хранить таких пользователей, сохраняя уникальность VK ID.
    vkId: { type: String, unique: true, sparse: true, index: true },
    legacy: {
      bitrixId: { type: Number, required: true }
    },
    email: { type: String },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    photo: { type: String },
    activeTo: { type: Date, required: true },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, index: true },
    lastActivityAt: { type: Date }
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
