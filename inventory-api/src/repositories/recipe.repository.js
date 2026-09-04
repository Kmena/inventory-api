const prisma = require('../lib/prisma');

const recipeListOrderBy = /** @type {any} */ ([{ id: 'asc' }]);
const recipeVersionOrderBy = /** @type {any} */ ([{ versionNumber: 'desc' }]);
const recipeStageOrderBy = /** @type {any} */ ([{ stageOrder: 'asc' }]);
const recipeStageInputOrderBy = /** @type {any} */ ([{ sortOrder: 'asc' }]);

const recipeVersionInclude = /** @type {any} */ ({
  stages: {
    include: {
      stageInputs: {
        include: { product: true },
        orderBy: recipeStageInputOrderBy,
      },
    },
    orderBy: recipeStageOrderBy,
  },
  createdByUser: {
    select: { id: true, fullName: true, username: true },
  },
  approvedByUser: {
    select: { id: true, fullName: true, username: true },
  },
});

const recipeInclude = /** @type {any} */ ({
  versions: {
    include: recipeVersionInclude,
    orderBy: recipeVersionOrderBy,
  },
});

function transaction(work) {
  return prisma.$transaction(work);
}

function findRecipes(companyId, pagination = null) {
  const where = { companyId };
  if (!pagination) {
    return prisma.recipe.findMany({ where, orderBy: recipeListOrderBy, include: recipeInclude });
  }

  return prisma.$transaction([
    prisma.recipe.count({ where }),
    prisma.recipe.findMany({
      where,
      orderBy: recipeListOrderBy,
      skip: pagination.skip,
      take: pagination.take,
      include: recipeInclude,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findRecipeById(id, companyId, db = prisma) {
  return db.recipe.findFirst({
    where: { id, companyId },
    include: recipeInclude,
  });
}

function createRecipe(data, db = prisma) {
  return db.recipe.create({
    data,
    include: recipeInclude,
  });
}

async function updateRecipe(id, companyId, data, db = prisma) {
  const result = await db.recipe.updateMany({
    where: { id, companyId },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return findRecipeById(id, companyId, db);
}

function findRecipeVersionsByRecipeId(recipeId, companyId, db = prisma) {
  return /** @type {any} */ (db).recipeVersion.findMany({
    where: { recipeId, companyId },
    orderBy: recipeVersionOrderBy,
    include: recipeVersionInclude,
  });
}

function findRecipeVersionById(id, companyId, db = prisma) {
  return /** @type {any} */ (db).recipeVersion.findFirst({
    where: { id, companyId },
    include: {
      ...recipeVersionInclude,
      recipe: true,
    },
  });
}

function findLatestRecipeVersion(recipeId, companyId, db = prisma) {
  return /** @type {any} */ (db).recipeVersion.findFirst({
    where: { recipeId, companyId },
    orderBy: recipeVersionOrderBy,
    include: recipeVersionInclude,
  });
}

function createRecipeVersion(data, db = prisma) {
  return /** @type {any} */ (db).recipeVersion.create({
    data,
    include: {
      ...recipeVersionInclude,
      recipe: true,
    },
  });
}

async function updateRecipeVersion(id, companyId, data, db = prisma) {
  // updateMany does not support nested relation writes (stages: { deleteMany, create }).
  // Use a findFirst ownership check + update (single record) instead so nested writes work.
  const existing = await /** @type {any} */ (db).recipeVersion.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  return /** @type {any} */ (db).recipeVersion.update({
    where: { id },
    data,
    include: {
      ...recipeVersionInclude,
      recipe: true,
    },
  });
}

module.exports = {
  transaction,
  findRecipes,
  findRecipeById,
  createRecipe,
  updateRecipe,
  findRecipeVersionsByRecipeId,
  findRecipeVersionById,
  findLatestRecipeVersion,
  createRecipeVersion,
  updateRecipeVersion,
};
