async function syncGeneralPrice(tx, productId, amount, currency) {
  if (amount === undefined || amount === null) return;

  await tx.productPrice.updateMany({
    where: {
      productId,
      priceType: 'GENERAL',
      isActive: true,
    },
    data: {
      isActive: false,
      validTo: new Date(),
    },
  });

  await tx.productPrice.create({
    data: {
      productId,
      priceType: 'GENERAL',
      amount,
      currency: currency || 'CRC',
      isActive: true,
    },
  });
}

module.exports = {
  syncGeneralPrice,
};
