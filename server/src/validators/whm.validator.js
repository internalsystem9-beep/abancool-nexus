const z = require('zod');

const createAccountSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(16).regex(/^[a-z0-9_-]+$/i),
    domain: z.string().url().or(z.string().regex(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i)),
    password: z.string().min(12),
    contactemail: z.string().email(),
    plan: z.string().optional().default('default'),
  }),
});

const suspendAccountSchema = z.object({
  params: z.object({
    username: z.string(),
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
});

const terminateAccountSchema = z.object({
  params: z.object({
    username: z.string(),
  }),
  body: z.object({
    keepDns: z.boolean().optional().default(false),
  }),
});

const changePasswordSchema = z.object({
  params: z.object({
    username: z.string(),
  }),
  body: z.object({
    password: z.string().min(12),
  }),
});

const upgradeAccountSchema = z.object({
  params: z.object({
    username: z.string(),
  }),
  body: z.object({
    newPlan: z.string(),
  }),
});

const createPackageSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    featurelist: z.string().optional(),
    maxaddon: z.number().int().nonnegative().optional(),
    maxpark: z.number().int().nonnegative().optional(),
    maxsql: z.number().int().nonnegative().optional(),
    maxpop: z.number().int().nonnegative().optional(),
    maxemail: z.number().int().nonnegative().optional(),
    maxlist: z.number().int().nonnegative().optional(),
    maxforwarders: z.number().int().nonnegative().optional(),
    diskspace: z.string().optional(),
    bandwidth: z.string().optional(),
  }),
});

const editPackageSchema = z.object({
  params: z.object({
    name: z.string(),
  }),
  body: z.object({
    featurelist: z.string().optional(),
    maxaddon: z.number().int().optional(),
    maxpark: z.number().int().optional(),
    maxsql: z.number().int().optional(),
    maxpop: z.number().int().optional(),
    maxemail: z.number().int().optional(),
    maxlist: z.number().int().optional(),
    maxforwarders: z.number().int().optional(),
    diskspace: z.string().optional(),
    bandwidth: z.string().optional(),
  }),
});

const generateCSRSchema = z.object({
  body: z.object({
    username: z.string(),
    domain: z.string(),
    countryCode: z.string().length(2).optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    organization: z.string().optional(),
  }),
});

const createLoginSessionSchema = z.object({
  body: z.object({
    username: z.string(),
    redirectUrl: z.string().url().optional(),
  }),
});

const generateSSOLinkSchema = z.object({
  body: z.object({
    username: z.string(),
  }),
  query: z.object({
    returnUrl: z.string().url().optional(),
  }).optional(),
});

const createDNSZoneSchema = z.object({
  body: z.object({
    domain: z.string().regex(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i),
    nameserver1: z.string(),
    nameserver2: z.string(),
    nameserver3: z.string().optional(),
    nameserver4: z.string().optional(),
  }),
});

const createMXRecordSchema = z.object({
  body: z.object({
    domain: z.string(),
    priority: z.number().int().positive(),
    exchange: z.string(),
  }),
});

module.exports = {
  createAccountSchema,
  suspendAccountSchema,
  terminateAccountSchema,
  changePasswordSchema,
  upgradeAccountSchema,
  createPackageSchema,
  editPackageSchema,
  generateCSRSchema,
  createLoginSessionSchema,
  generateSSOLinkSchema,
  createDNSZoneSchema,
  createMXRecordSchema,
};
