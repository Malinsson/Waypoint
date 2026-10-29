import type { LonLat } from "../types/geo.js";
import { resolveBreakPoints } from "./geoservice-facade.js";

type GeoServiceLeg = {
    coordinates: LonLat[];
    durationSeconds: number;
    distanceMeters: number;
};

export type GeoServiceInput = {
    legs: GeoServiceLeg[];
    maxDrivingSeconds: number;
};

type GeoServiceBreakpoints = {
    legIndex: number;
    location: LonLat;
    cumulativeSeconds: number;
};

export type GeoServiceResult = {
    breakPoints: GeoServiceBreakpoints[];
};



export async function findBreakPoints(input: GeoServiceInput): Promise<GeoServiceResult> {
  return resolveBreakPoints(input);
}