const { Product, Warehouse, WarehouseStock, InventoryMovement } = require('../models');
const AppError = require('../utils/AppError');

async function applyStockMovement({
  organizationId,
  productId,
  warehouseId = null,
  type,
  quantity,
  reference = null,
  note = null,
  createdBy,
  transaction,
}) {
  const product = await Product.findOne({
    where: { id: productId, organizationId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product was not found in this organization');
  }

  let warehouseStock;
  if (warehouseId) {
    const warehouse = await Warehouse.findOne({
      where: { id: warehouseId, organizationId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!warehouse) {
      throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'Warehouse was not found in this organization');
    }
    warehouseStock = await WarehouseStock.findOne({
      where: { organizationId, warehouseId, productId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!warehouseStock && type === 'OUT') {
      throw new AppError(409, 'INSUFFICIENT_STOCK', 'The warehouse does not have enough stock');
    }
  }

  const nextProductQuantity =
    type === 'IN'
      ? Number(product.quantityOnHand) + quantity
      : Number(product.quantityOnHand) - quantity;
  if (nextProductQuantity < 0) {
    throw new AppError(409, 'INSUFFICIENT_STOCK', 'The product does not have enough stock');
  }
  if (nextProductQuantity > 4294967295) {
    throw new AppError(400, 'STOCK_LIMIT_EXCEEDED', 'The product quantity exceeds the supported limit');
  }

  if (warehouseStock) {
    const nextWarehouseQuantity =
      type === 'IN'
        ? Number(warehouseStock.quantityOnHand) + quantity
        : Number(warehouseStock.quantityOnHand) - quantity;
    if (nextWarehouseQuantity < 0) {
      throw new AppError(409, 'INSUFFICIENT_STOCK', 'The warehouse does not have enough stock');
    }
    if (nextWarehouseQuantity > 4294967295) {
      throw new AppError(400, 'STOCK_LIMIT_EXCEEDED', 'The warehouse quantity exceeds the supported limit');
    }
    warehouseStock.quantityOnHand = nextWarehouseQuantity;
    await warehouseStock.save({ transaction, validate: true });
  } else if (warehouseId) {
    await WarehouseStock.create(
      { organizationId, warehouseId, productId, quantityOnHand: quantity },
      { transaction },
    );
  }

  product.quantityOnHand = nextProductQuantity;
  product.lastUpdatedBy = createdBy;
  await product.save({ transaction, validate: true });

  return InventoryMovement.create(
    {
      organizationId,
      productId,
      warehouseId,
      type,
      quantity,
      reference,
      note,
      createdBy,
    },
    { transaction },
  );
}

module.exports = { applyStockMovement };
