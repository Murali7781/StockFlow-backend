const test = require('node:test');
const assert = require('node:assert/strict');
const { formatDatabaseError } = require('../utils/databaseErrors');

test('database authentication errors provide guidance without logging credentials', () => {
  const message = formatDatabaseError({
    code: 'ER_ACCESS_DENIED_ERROR',
    message: 'Access denied with password: test-secret',
  });

  assert.match(message, /verify the selected provider credentials/);
  assert.doesNotMatch(message, /test-secret/);
});

test('unclassified database errors do not pass through arbitrary messages', () => {
  const message = formatDatabaseError(new Error('connection failed: test-secret'));

  assert.doesNotMatch(message, /test-secret/);
  assert.match(message, /verify the TiDB endpoint/);
});
