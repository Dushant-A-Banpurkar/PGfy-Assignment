const test = require('node:test');
const assert = require('node:assert/strict');
const { CreateUnverifiedPropertySchema } = require('../dist/schemas/property.js');
const { LogFollowupSchema, SubmitEnquirySchema } = require('../dist/schemas/enquiry.js');
const { requireRole } = require('../dist/middleware/requireRole.js');

const validProperty = {
  title: 'Sample PG',
  category: 'PG_HOSTEL',
  city: 'Pune',
  locality: 'Kothrud',
  addressLine: '1 Example Road',
  pincode: '411038',
  rentMin: 5000,
  rentMax: 9000,
  ownerContactName: 'Owner',
  ownerContactPhone: '+919876543210',
  categoryDetails: {
    sharingTypes: ['DOUBLE'],
    genderAllowed: 'BOYS',
    foodIncluded: false,
  },
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

test('property creation rejects category details for a different property category', () => {
  const result = CreateUnverifiedPropertySchema.safeParse({
    ...validProperty,
    categoryDetails: { bhkConfig: '2BHK' },
  });
  assert.equal(result.success, false);
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

test('role protection rejects spoofed identity headers without a bearer token', () => {
  const req = {
    headers: { 'x-user-id': '00000000-0000-0000-0000-000000000001', 'x-user-role': 'ADMIN' },
    header: () => undefined,
  };
  let status;
  let responseBody;
  let nextCalled = false;
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  requireRole(['ADMIN'])(req, res, () => {
    nextCalled = true;
  });

  assert.equal(status, 401);
  assert.equal(responseBody.error, 'Authentication required');
  assert.equal(nextCalled, false);
});
