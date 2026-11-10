const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegistration, validateLogin } = require('../validators/authValidators');
const { validateProduct } = require('../validators/productValidators');
const { validateSetting } = require('../validators/settingValidators');

test('registration normalizes email and requires an organization name', () => {
  const result = validateRegistration({
    email: '  Owner@Example.com ',
    password: '12345678',
    confirmPassword: '12345678',
    organizationName: '  My Store  ',
  });

  assert.equal(result.email, 'owner@example.com');
  assert.equal(result.organizationName, 'My Store');
  assert.equal(result.password, '12345678');
});

test('registration does not accept a client-selected organization id', () => {
  assert.throws(
    () =>
      validateRegistration({
        email: 'owner@example.com',
        password: 'a-secure-password',
        confirmPassword: 'a-secure-password',
        organizationName: 'My Store',
        organization_id: 'another-tenant',
      }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('registration requires matching password confirmation', () => {
  assert.throws(
    () =>
      validateRegistration({
        email: 'owner@example.com',
        password: '12345678',
        confirmPassword: '87654321',
        organizationName: 'My Store',
      }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () =>
      validateRegistration({
        email: 'owner@example.com',
        password: '12345678',
        confirmPassword: 'a-different-password',
        organizationName: 'My Store',
      }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () =>
      validateRegistration({
        email: 'owner@example.com',
        password: '12345678',
        organizationName: 'My Store',
      }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('registration accepts eight-character passwords without complexity rules', () => {
  assert.equal(validateRegistration({
    email: 'owner@example.com',
    password: '12345678',
    confirmPassword: '12345678',
    organizationName: 'My Store',
  }).password, '12345678');

  assert.throws(
    () => validateRegistration({
      email: 'owner@example.com',
      password: '1234567',
      confirmPassword: '1234567',
      organizationName: 'My Store',
    }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('authentication rejects invalid emails and bcrypt-overlong passwords', () => {
  assert.throws(
    () => validateLogin({ email: 'invalid-email', password: '12345678' }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () => validateLogin({ email: 'owner@example.com', password: 'x'.repeat(73) }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('login normalizes email without modifying the password', () => {
  assert.deepEqual(
    validateLogin({ email: ' OWNER@example.com ', password: ' secret  ' }),
    { email: 'owner@example.com', password: ' secret  ' },
  );
});

test('product validation applies MVP defaults and accepts decimal prices', () => {
  const result = validateProduct({
    name: 'Widget',
    sku: ' W-001 ',
    costPrice: 19.99,
    sellingPrice: 25,
  });

  assert.equal(result.name, 'Widget');
  assert.equal(result.sku, 'W-001');
  assert.equal(result.quantityOnHand, 0);
  assert.equal(result.lowStockThreshold, null);
  assert.equal(result.costPrice, '19.99');
  assert.equal(result.sellingPrice, '25.00');
  assert.equal(result.description, null);
});

test('product validation rejects negative stock and untrusted organization fields', () => {
  assert.throws(
    () =>
      validateProduct({
        name: 'Widget',
        sku: 'W-001',
        quantityOnHand: -1,
      }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () =>
      validateProduct({
        name: 'Widget',
        sku: 'W-001',
        quantityOnHand: null,
      }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () =>
      validateProduct({
        name: 'Widget',
        sku: 'W-001',
        organizationId: 'another-tenant',
      }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('product updates validate only supplied fields', () => {
  assert.deepEqual(validateProduct({ quantityOnHand: 3 }, { partial: true }), {
    quantityOnHand: 3,
  });
  assert.throws(
    () => validateProduct({}, { partial: true }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('settings require a non-negative integer threshold', () => {
  assert.deepEqual(validateSetting({ defaultLowStockThreshold: 0 }), {
    defaultLowStockThreshold: 0,
  });
  assert.throws(
    () => validateSetting({ defaultLowStockThreshold: -1 }),
    { code: 'VALIDATION_ERROR' },
  );
});
