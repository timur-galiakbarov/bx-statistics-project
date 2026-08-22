import { Schema, model } from 'mongoose';

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, required: true },
    amount: { type: Number, required: true },
    period: { type: String, required: true },
    status: { type: String, required: true, index: true },
    providerTransactionId: { type: String, index: true },
    rawCallbackPayload: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const PaymentModel = model('Payment', paymentSchema);
