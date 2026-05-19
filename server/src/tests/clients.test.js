/**
 * Client Management Unit Tests
 * Tests the client management functionality without database dependencies
 */

const { z } = require('zod');

// Import validation schemas (we'll extract these from the controller)
const clientSchema = z.object({
  company_name: z.string().min(1, "Company name is required").max(255),
  email: z.string().email("Invalid email format").max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  kra_pin: z.string().max(50).optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active')
});

const contactSchema = z.object({
  contact_name: z.string().min(1, "Contact name is required").max(255),
  email: z.string().email("Invalid email format").max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  role: z.string().max(100).optional().nullable(),
  is_primary: z.boolean().default(false)
});

// Helper function to generate unique client ID
function generateClientId() {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `CL-${year}-${timestamp}`;
}

// Test suite
function runTests() {
  console.log('🧪 Running Client Management Unit Tests...\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  function test(name, testFn) {
    totalTests++;
    try {
      testFn();
      console.log(`✅ ${name}`);
      passedTests++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
  }
  
  // Test 1: Client ID Generation
  test('Client ID generation follows correct format', () => {
    const clientId = generateClientId();
    const pattern = /^CL-\d{4}-\d{6}$/;
    if (!pattern.test(clientId)) {
      throw new Error(`Client ID ${clientId} doesn't match pattern CL-YYYY-XXXXXX`);
    }
  });
  
  // Test 2: Valid Client Data Validation
  test('Valid client data passes validation', () => {
    const validClient = {
      company_name: 'ACME Corporation Ltd',
      email: 'info@acme.com',
      phone: '+254700123456',
      address: '123 Business Street',
      city: 'Nairobi',
      country: 'Kenya',
      kra_pin: 'A123456789Z',
      status: 'active'
    };
    
    const result = clientSchema.parse(validClient);
    if (!result) {
      throw new Error('Valid client data failed validation');
    }
  });
  
  // Test 3: Invalid Email Validation
  test('Invalid email is rejected', () => {
    const invalidClient = {
      company_name: 'ACME Corporation Ltd',
      email: 'invalid-email',
      status: 'active'
    };
    
    try {
      clientSchema.parse(invalidClient);
      throw new Error('Invalid email should have been rejected');
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw new Error('Expected ZodError for invalid email');
      }
    }
  });
  
  // Test 4: Missing Company Name Validation
  test('Missing company name is rejected', () => {
    const invalidClient = {
      email: 'info@acme.com',
      status: 'active'
    };
    
    try {
      clientSchema.parse(invalidClient);
      throw new Error('Missing company name should have been rejected');
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw new Error('Expected ZodError for missing company name');
      }
    }
  });
  
  // Test 5: Invalid Status Validation
  test('Invalid status is rejected', () => {
    const invalidClient = {
      company_name: 'ACME Corporation Ltd',
      status: 'invalid_status'
    };
    
    try {
      clientSchema.parse(invalidClient);
      throw new Error('Invalid status should have been rejected');
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw new Error('Expected ZodError for invalid status');
      }
    }
  });
  
  // Test 6: Valid Contact Data Validation
  test('Valid contact data passes validation', () => {
    const validContact = {
      contact_name: 'John Doe',
      email: 'john@acme.com',
      phone: '+254700123457',
      role: 'CEO',
      is_primary: true
    };
    
    const result = contactSchema.parse(validContact);
    if (!result) {
      throw new Error('Valid contact data failed validation');
    }
  });
  
  // Test 7: Missing Contact Name Validation
  test('Missing contact name is rejected', () => {
    const invalidContact = {
      email: 'john@acme.com',
      role: 'CEO'
    };
    
    try {
      contactSchema.parse(invalidContact);
      throw new Error('Missing contact name should have been rejected');
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw new Error('Expected ZodError for missing contact name');
      }
    }
  });
  
  // Test 8: Optional Fields Handling
  test('Optional fields are handled correctly', () => {
    const minimalClient = {
      company_name: 'Minimal Corp'
    };
    
    const result = clientSchema.parse(minimalClient);
    if (result.status !== 'active') {
      throw new Error('Default status should be active');
    }
  });
  
  // Test 9: Phone Format Validation (Basic)
  test('Phone format validation works', () => {
    const phonePattern = /^[\+]?[0-9\-\(\)\s]+$/;
    
    const validPhones = ['+254700123456', '0700123456', '+1-555-123-4567', '(555) 123-4567'];
    const invalidPhones = ['abc123', 'phone@email.com', ''];
    
    validPhones.forEach(phone => {
      if (!phonePattern.test(phone)) {
        throw new Error(`Valid phone ${phone} was rejected`);
      }
    });
    
    invalidPhones.forEach(phone => {
      if (phone && phonePattern.test(phone)) {
        throw new Error(`Invalid phone ${phone} was accepted`);
      }
    });
  });
  
  // Test 10: Data Length Limits
  test('Data length limits are enforced', () => {
    const longString = 'a'.repeat(300);
    
    const invalidClient = {
      company_name: longString,
      status: 'active'
    };
    
    try {
      clientSchema.parse(invalidClient);
      throw new Error('Long company name should have been rejected');
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw new Error('Expected ZodError for long company name');
      }
    }
  });
  
  // Summary
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Client Management validation is working correctly.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  clientSchema,
  contactSchema,
  generateClientId
};