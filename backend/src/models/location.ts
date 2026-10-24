import { Schema, model, Types } from "mongoose";

export interface Location {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  wikidataId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<Location>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    wikidataId: {
      type: String,
      optional: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Location = model<Location>("Location", locationSchema);