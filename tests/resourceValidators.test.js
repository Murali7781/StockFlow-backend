const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateContact,
  validateInventoryMovement,
  validateOrder,
  validateWarehouse,
} = require('../validators/resourceValidators');

const productId = '00000000-0000-4000-8000-000000000001';
const supplierId = '00000000-0000-4000-8000-000000000002';

test('contact validation normalizes optional email and rejects unknown fields', () => {
  assert.deepEqual(
    validateContact({ name: 'Supplier', email: '  BUYER@EXAMPLE.COM ' }),
    { name: 'Supplier', email: 'buyer@example.com' },
  );
  assert.throws(
    () => validateContact({ name: 'Supplier', organizationId: 'other-tenant' }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () => validateContact({ name: 'Supplier', email: 'not-an-email' }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('warehouse validation requires a boolean default flag', () => {
  assert.deepEqual(
    validateWarehouse({ name: 'Main', isDefault: true }),
    { name: 'Main', isDefault: true },
  );
  assert.throws(
    () => validateWarehouse({ name: 'Main', isDefault: 'true' }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('order validation validates lines and calculates decimal totals', () => {
  const result = validateOrder(
    {
      orderNumber: 'PO-001',
      supplierId,
      lines: [
        { productId, quantity: 3, unitPrice: 12.5 },
        { productId, quantity: 2, unitPrice: 0.1 },
      ],
    },
    { partyField: 'supplierId' },
  );

  assert.equal(result.status, undefined);
  assert.equal(result.totalAmount, '37.70');
  assert.deepEqual(result.lines, [
    { productId, quantity: 3, unitPrice: '12.50' },
    { productId, quantity: 2, unitPrice: '0.10' },
  ]);
  assert.match(result.orderDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('order validation rejects invalid status, dates, and quantities', () => {
  assert.throws(
    () =>
      validateOrder(
        {
          orderNumber: 'PO-002',
          supplierId,
          dueDate: '2025-01-01',
          orderDate: '2025-02-01',
          lines: [{ productId, quantity: 1, unitPrice: 2 }],
        },
        { partyField: 'supplierId' },
      ),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () => validateOrder({ status: 'UNKNOWN' }, { partyField: 'supplierId', partial: true }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () =>
      validateOrder(
        {
          orderNumber: 'PO-003',
          supplierId,
          lines: [{ productId, quantity: 0, unitPrice: 2 }],
        },
        { partyField: 'supplierId' },
      ),
    { code: 'VALIDATION_ERROR' },
  );
});

test('inventory movement validation accepts only positive IN/OUT quantities', () => {
  assert.deepEqual(validateInventoryMovement({
    productId,
    type: 'IN',
    quantity: 4,
  }), {
    productId,
    type: 'IN',
    quantity: 4,
    warehouseId: null,
  });
  assert.throws(
    () => validateInventoryMovement({ productId, type: 'OUT', quantity: -1 }),
    { code: 'VALIDATION_ERROR' },
  );
});
