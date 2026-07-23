const test = require('node:test');
const assert = require('node:assert/strict');

const economicActivityService = require('../src/services/economic-activity.service');

test('searchActivities returns the full catalog when the query is blank', () => {
  const activities = economicActivityService.searchActivities('   ');

  assert.ok(Array.isArray(activities));
  assert.ok(activities.length >= 10);
  assert.ok(activities.some((activity) => activity.code === '620100'));
});

test('searchActivities filters activities by code or normalized name fragments', () => {
  const byCode = economicActivityService.searchActivities('620100');
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].name, 'Programacion informatica');

  const byName = economicActivityService.searchActivities('supermercados');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].code, '471101');
});
