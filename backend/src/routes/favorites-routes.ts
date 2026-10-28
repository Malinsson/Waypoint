import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  addLocationToListController,
  createFavoriteController,
  createFavoriteListController,
  deleteFavoriteController,
  deleteFavoriteListController,
  listFavoritesController,
  removeLocationFromListController,
  renameFavoriteListController,
  getFavoriteListController,
} from "../controllers/favorites-controller.js";

export const favoriteRouter = Router();

favoriteRouter.use(requireAuth);

favoriteRouter.get("/", listFavoritesController);
favoriteRouter.post("/", createFavoriteController);
favoriteRouter.delete("/:id", deleteFavoriteController);
favoriteRouter.post("/lists", createFavoriteListController);
favoriteRouter.get("/lists/:listId", getFavoriteListController);
favoriteRouter.patch("/lists/:listId", renameFavoriteListController);
favoriteRouter.delete("/lists/:listId", deleteFavoriteListController);
favoriteRouter.post("/lists/:listId/locations", addLocationToListController);
favoriteRouter.delete(
  "/lists/:listId/locations/:locationId",
  removeLocationFromListController,
);