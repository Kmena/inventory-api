const productRepository = require('../repositories/product.repository');
const { createHttpError } = require('../lib/errors');

async function listProducts() {
  return productRepository.findAllProducts();
}

async function getProduct(id) {
  const product = await productRepository.findProductById(id);
  if (!product) throw createHttpError(404, 'Producto no encontrado', 'not_found');
  return product;
}

async function createProduct(payload) {
  return productRepository.createProduct(payload);
}

async function updateProduct(id, payload) {
  await getProduct(id);
  return productRepository.updateProduct(id, payload);
}

async function removeProduct(id) {
  await getProduct(id);
  return productRepository.deleteProduct(id);
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, removeProduct };
