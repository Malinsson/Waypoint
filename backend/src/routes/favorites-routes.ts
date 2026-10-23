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
} from "../controllers/favorites-controller.js";

export const favoriteRouter = Router();

favoriteRouter.use(requireAuth);

favoriteRouter.get("/", listFavoritesController);
favoriteRouter.post("/", createFavoriteController);
favoriteRouter.post("/lists", createFavoriteListController);
favoriteRouter.patch("/lists/:listId", renameFavoriteListController);
favoriteRouter.delete("/lists/:listId", deleteFavoriteListController);
favoriteRouter.post("/lists/:listId/locations", addLocationToListController);
favoriteRouter.delete(
  "/lists/:listId/locations/:locationId",
  removeLocationFromListController,
);
favoriteRouter.delete("/:id", deleteFavoriteController);