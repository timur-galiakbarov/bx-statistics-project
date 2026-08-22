import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    vkId: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    photo: { type: String },
    activeTo: { type: Date, required: true },
    isAdmin: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const UserModel = model('User', userSchema);
