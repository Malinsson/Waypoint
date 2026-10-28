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

function userId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "You need to log in to do this");
  }
  return req.user.id;
}

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
  res.json({ lists: await listFavorites(userId(req)) });
}

export async function createFavoriteController(req: Request, res: Response) {
  res.status(201).json({ location: await createFavorite(userId(req), locationInput(req)) });
}

export async function deleteFavoriteController(req: Request, res: Response) {
  await deleteFavorite(userId(req), routeParam(req, "id"));
  res.status(204).send();
}

export async function createFavoriteListController(req: Request, res: Response) {
  const { name } = listNameSchema.parse(req.body);
  res.status(201).json({ list: await createFavoriteList(userId(req), name) });
}

export async function renameFavoriteListController(req: Request, res: Response) {
  const { name } = listNameSchema.parse(req.body);
  res.json({ list: await renameFavoriteList(userId(req), routeParam(req, "listId"), name) });
}

export async function deleteFavoriteListController(req: Request, res: Response) {
  await deleteFavoriteList(userId(req), routeParam(req, "listId"));
  res.status(204).send();
}

export async function addLocationToListController(req: Request, res: Response) {
  res.status(201).json({
    location: await addLocationToList(userId(req), routeParam(req, "listId"), locationInput(req)),
  });
}

export async function removeLocationFromListController(req: Request, res: Response) {
  await removeLocationFromList(
    userId(req),
    routeParam(req, "listId"),
    routeParam(req, "locationId"),
  );
  res.status(204).send();
}

export async function getFavoriteListController(req: Request, res: Response) {
  res.json({ list: await getFavoriteList(userId(req), routeParam(req, "listId")) });
}

