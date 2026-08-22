import { Schema, model } from 'mongoose';
const savedGroupSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: {
        type: String,
        enum: ['free', 'bookmark', 'favorite', 'managed'],
        required: true,
        index: true
    },
    vkGroupId: { type: String, required: true },
    name: { type: String, required: true },
    photo: { type: String },
    membersCount: { type: Number }
}, { timestamps: true });
savedGroupSchema.index({ userId: 1, source: 1, vkGroupId: 1 }, { unique: true });
export const SavedGroupModel = model('SavedGroup', savedGroupSchema);
