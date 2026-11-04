import { Schema, model } from 'mongoose';

export const surveyPlaces = ['report', 'access-ended'] as const;
export const surveyOutcomes = ['yes', 'partly', 'no'] as const;

const schema = new Schema({
  _id: { type: String, required: true },
  place: { type: String, enum: surveyPlaces, required: true },
  goal: { type: String, required: true, maxlength: 500 },
  outcome: { type: String, enum: surveyOutcomes, required: true },
  suggestion: { type: String, maxlength: 1000 },
  day: { type: String, required: true }
}, { versionKey: false });

schema.index({ day: -1, _id: -1 });

export const SurveyResponseModel = model('SurveyResponse', schema);
