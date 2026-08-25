import { Schema, model } from 'mongoose';

const newsSchema = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    isVisible: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const NewsModel = model('News', newsSchema);
