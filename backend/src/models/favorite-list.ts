import { Schema, model, Types } from "mongoose";

export interface FavoriteList {
  user: Types.ObjectId;
  name: string;
  locations: Types.ObjectId[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const favoriteListSchema = new Schema<FavoriteList>(
    {
        user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
        name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
    },    
        locations: [
            {
                type: Schema.Types.ObjectId,
                ref: "Location",
            },
            ],
        isDefault: {
        type: Boolean,
        default: false,
        },
    },
  {
    timestamps: true,
  }
);

// Prevent duplicate list names for the same user.
favoriteListSchema.index(
  { user: 1, name: 1 },
  { unique: true }
);

export const FavoriteList = model<FavoriteList>(
  "FavoriteList",
  favoriteListSchema
);