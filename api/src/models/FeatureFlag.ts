import { Schema, model } from 'mongoose';

// Переключатели фич из админки. Нет документа — фича выключена: новая фича
// выкатывается выключенной и включается вручную, сначала для администраторов.
const featureFlagSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    mode: { type: String, enum: ['off', 'admins', 'all'], required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export const FeatureFlagModel = model('FeatureFlag', featureFlagSchema);
