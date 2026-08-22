import { Schema, model } from 'mongoose';
const vkTokenSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accessToken: { type: String, required: true },
    scopes: [{ type: String }],
    expiresAt: { type: Date }
}, { timestamps: true });
export const VkTokenModel = model('VkToken', vkTokenSchema);
