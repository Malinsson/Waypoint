import { Schema, model, Types } from "mongoose";

interface Rating {
    stars: number;
    comment?: string;
}

interface TripStop {
    locationId: Types.ObjectId;
    rating?: Rating;
}

interface Breakpoint {
    longitude: number;
    latitude: number;
    locationId?: Types.ObjectId;
    rating?: Rating;
}

export interface Trip {
    userId: Types.ObjectId;
    name: string;
    destinations: TripStop[];
    breakpoints: Breakpoint[];
    route: unknown; // GeoJSON LineString, stored as-is from the routing service
    maxDrivingHours: number;
    accommodationPreference: { types: string[] };
    totalRating?: Rating;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

const ratingSchema = new Schema<Rating>(
  {
    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: "stars must be an integer" },
    },
    comment: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);


const tripSchema = new Schema<Trip>({
    userId: { 
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        immutable: true
    },
    name: { 
        type: String,
        trim: true,
        required: true,
        maxlength: 100
    },
    destinations: [{
        locationId: { 
            type: Schema.Types.ObjectId,
            ref: "Location",
            required: true
        },
        rating: ratingSchema
    }],
    breakpoints: [{
        longitude: { 
            type: Number, 
            required: true,
            min: -180,
            max: 180
        },
        latitude: { 
            type: Number, 
            required: true,
            min: -90,
            max: 90
        },
        locationId: { 
            type: Schema.Types.ObjectId, 
            ref: "Location" 
        },
        rating: ratingSchema
    }],
    route: { 
        type: Schema.Types.Mixed,
        required: true
    },
    maxDrivingHours: {
        type: Number, 
        required: true,
        min: 1,
        max: 16,
    },
    accommodationPreference: {
        types : [{ type : String }]
    },
    totalRating : { 
        type : ratingSchema,
        required : false
    },
    
    completedAt : { type : Date }
}, 
{
    timestamps: true
});

tripSchema.index({ userId: 1, updatedAt: -1 });

export const Trip = model<Trip>("Trip", tripSchema);
