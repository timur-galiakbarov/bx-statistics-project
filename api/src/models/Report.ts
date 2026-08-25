import { Schema, model } from 'mongoose';

const reportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, index: true },
    params: { type: Schema.Types.Mixed },
    fileUrl: { type: String },
    filePath: { type: String },
    status: { type: String, required: true, default: 'created' }
  },
  { timestamps: true }
);

export const ReportModel = model('Report', reportSchema);
