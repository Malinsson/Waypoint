import { Schema, model } from "mongoose";

export interface Location {
  name: string;
  description: string | undefined;
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
    description: {
      type: String,
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
    },
  },
  {
    timestamps: true,
  }
);

// Create a unique index on the wikidataId field to ensure that each location with a Wikidata ID is unique in the database. The sparse option allows documents without a wikidataId to be stored without violating the uniqueness constraint.
locationSchema.index({ wikidataId: 1 }, { unique: true, sparse: true });

export const Location = model<Location>("Location", locationSchema);