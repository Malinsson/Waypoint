import { z } from "zod";
import type { Request, Response } from "express";
import {
  addLocationToList,
  createFavorite,
  createFavoriteList,
  deleteFavorite,
  deleteFavoriteList,
  listFavorites,
  removeLocationFromList,
  renameFavoriteList,
  getFavoriteList,
  type LocationInput,
} from "../services/favorites-service.js";
import { requireUserId } from "../middleware/auth.js";
import { AppError } from "../utils/app-error.js";

const locationSchema = z.object({
  name: z.string("Name is required").trim().min(1).max(80),
  description: z.string().trim().min(1).max(200).optional(),
  latitude: z.number("Latitude is required").min(-90).max(90),
  longitude: z.number("Longitude is required").min(-180).max(180),
  wikidataId: z.string().trim().max(100).optional(),
});

const listNameSchema = z.object({
  name: z.string("List name is required").trim().min(1).max(80),
});

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || !value) {
    throw new AppError(404, "NOT_FOUND", "The requested favorite was not found");
  }
  return value;
}

function locationInput(req: Request): LocationInput {
  const input = locationSchema.parse(req.body);
  return {
    ...input,
    description: input.description,
  };
}

export async function listFavoritesController(req: Request, res: Response) {
  res.json({ lists: await listFavorites(requireUserId(req)) });
}

export async function createFavoriteController(req: Request, res: Response) {
  res.status(201).json({ location: await createFavorite(requireUserId(req), locationInput(req)) });
}

export async function deleteFavoriteController(req: Request, res: Response) {
  await deleteFavorite(requireUserId(req), routeParam(req, "id"));
  res.status(204).send();
}

export async function createFavoriteListController(req: Request, res: Response) {
  const { name } = listNameSchema.parse(req.body);
  res.status(201).json({ list: await createFavoriteList(requireUserId(req), name) });
}

export async function renameFavoriteListController(req: Request, res: Response) {
  const { name } = listNameSchema.parse(req.body);
  res.json({ list: await renameFavoriteList(requireUserId(req), routeParam(req, "listId"), name) });
}

export async function deleteFavoriteListController(req: Request, res: Response) {
  await deleteFavoriteList(requireUserId(req), routeParam(req, "listId"));
  res.status(204).send();
}

export async function addLocationToListController(req: Request, res: Response) {
  res.status(201).json({
    location: await addLocationToList(requireUserId(req), routeParam(req, "listId"), locationInput(req)),
  });
}

export async function removeLocationFromListController(req: Request, res: Response) {
  await removeLocationFromList(
    requireUserId(req),
    routeParam(req, "listId"),
    routeParam(req, "locationId"),
  );
  res.status(204).send();
}

export async function getFavoriteListController(req: Request, res: Response) {
  res.json({ list: await getFavoriteList(requireUserId(req), routeParam(req, "listId")) });
}
