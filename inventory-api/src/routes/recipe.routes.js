const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const {
  createRecipeSchema,
  updateRecipeSchema,
  createRecipeVersionSchema,
  updateRecipeVersionSchema,
  approveRecipeVersionSchema,
} = require('../schemas/recipe.schema');
const recipeService = require('../services/recipe.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('recipe.view'), async (req, res, next) => {
  try {
    return res.json(await recipeService.listRecipes(req.auth, parsePaginationQuery(req.query)));
  } catch (error) {
    return next(error);
  }
});

router.post('/', authorizeAccessPolicy('recipe.manage'), validate(createRecipeSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await recipeService.createRecipe(req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', authorizeAccessPolicy('recipe.view'), async (req, res, next) => {
  try {
    return res.json(await recipeService.getRecipe(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', authorizeAccessPolicy('recipe.manage'), validate(updateRecipeSchema), async (req, res, next) => {
  try {
    return res.json(await recipeService.updateRecipe(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/versions', authorizeAccessPolicy('recipe.view'), async (req, res, next) => {
  try {
    return res.json(await recipeService.listRecipeVersions(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/versions', authorizeAccessPolicy('recipe.manage'), validate(createRecipeVersionSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await recipeService.createRecipeVersion(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.put('/versions/:id', authorizeAccessPolicy('recipe.manage'), validate(updateRecipeVersionSchema), async (req, res, next) => {
  try {
    return res.json(await recipeService.updateRecipeVersion(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/versions/:id/approve', authorizeAccessPolicy('recipe.approve'), validate(approveRecipeVersionSchema), async (req, res, next) => {
  try {
    return res.json(await recipeService.approveRecipeVersion(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
