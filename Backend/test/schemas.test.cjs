const test = require('node:test');
const assert = require('node:assert/strict');
const { CreateUnverifiedPropertySchema, UpdatePropertySchema } = require('../dist/schemas/property.js');
const { LogFollowupSchema, SubmitEnquirySchema } = require('../dist/schemas/enquiry.js');

const validProperty = {
  name: 'Sample PG',
  category: 'PG',
  city: 'Pune',
  locality: 'Kothrud',
  addressLine: '1 Example Road',
  pincode: '411038',
  rentMin: 5000,
  rentMax: 9000,
  ownerContactName: 'Owner',
  ownerContactPhone: '+919876543210',
};

test('property creation accepts valid values and applies defaults', () => {
  const parsed = CreateUnverifiedPropertySchema.parse(validProperty);
  assert.equal(parsed.securityDeposit, 0);
  assert.deepEqual(parsed.amenities, []);
  assert.equal(parsed.publishImmediately, false);
});

test('property creation rejects rent ranges with max below min', () => {
  const result = CreateUnverifiedPropertySchema.safeParse({
    ...validProperty,
    rentMin: 10000,
    rentMax: 5000,
  });
  assert.equal(result.success, false);
});

test('property update rejects empty patches', () => {
  assert.equal(UpdatePropertySchema.safeParse({}).success, false);
  assert.equal(UpdatePropertySchema.safeParse({ locality: 'Baner' }).success, true);
});

test('enquiry rejects invalid property identifiers', () => {
  assert.equal(
    SubmitEnquirySchema.safeParse({
      propertyId: 'not-a-uuid',
      tenantName: 'Tenant',
      tenantPhone: '+919876543210',
    }).success,
    false,
  );
});

test('sales follow-up validates the selected channel', () => {
  const result = LogFollowupSchema.safeParse({
    channel: 'INVALID',
    outcomeStatus: 'Reached',
    notes: 'Called tenant',
  });
  assert.equal(result.success, false);
});
