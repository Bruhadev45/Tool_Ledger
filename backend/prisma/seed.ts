import { PrismaClient, UserRole, InvoiceStatus, CredentialPermission, AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Simple encryption utility for seeding (matches EncryptionService logic)
function encrypt(text: string, encryptionKey: string): string {
  const algorithm = 'aes-256-gcm';
  
  // Handle base64 encoded keys
  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(encryptionKey, 'base64');
    if (keyBuffer.length !== 32) {
      keyBuffer = Buffer.from(encryptionKey, 'utf8');
    }
  } catch {
    keyBuffer = Buffer.from(encryptionKey, 'utf8');
  }
  
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (or 44 characters base64 encoded)');
  }
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Get encryption key from environment
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-seed-key-32bytes!!';
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('⚠️  ENCRYPTION_KEY not found in environment. Using default seed key.');
    console.warn('   Note: In production, always set ENCRYPTION_KEY in your .env file.');
  }

  // Create organization
  const organization = await prisma.organization.upsert({
    where: { domain: 'toolledger.com' },
    update: {},
    create: {
      name: 'ToolLedger',
      domain: 'toolledger.com',
    },
  });

  console.log('✅ Organization created:', organization.name);

  // Skip cleanup of extra admin users - just upsert the main admin
  // This avoids foreign key constraint issues with existing data
  console.log('\n🧹 Skipping admin cleanup to preserve existing data...');

  // Hash password for all users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create 1 Admin user (Main Hero) - Only one admin allowed
  const admin1 = await prisma.user.upsert({
    where: { email: 'admin@toolledger.com' },
    update: {
      firstName: 'Admin',
      lastName: 'Hero',
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      email: 'admin@toolledger.com',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'Hero',
      role: UserRole.ADMIN,
      organizationId: organization.id,
      mfaEnabled: false,
      isActive: true,
    },
  });

  console.log('✅ Admin user created/updated (Main Hero):', admin1.email);

  // Create 3 Regular Users
  const user1 = await prisma.user.upsert({
    where: { email: 'user1@toolledger.com' },
    update: {},
    create: {
      email: 'user1@toolledger.com',
      passwordHash: hashedPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER,
      organizationId: organization.id,
      isActive: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'user2@toolledger.com' },
    update: {},
    create: {
      email: 'user2@toolledger.com',
      passwordHash: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: UserRole.USER,
      organizationId: organization.id,
      isActive: true,
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'user3@toolledger.com' },
    update: {},
    create: {
      email: 'user3@toolledger.com',
      passwordHash: hashedPassword,
      firstName: 'Michael',
      lastName: 'Chen',
      role: UserRole.USER,
      organizationId: organization.id,
      isActive: true,
    },
  });

  console.log('✅ Users created:', user1.email, user2.email, user3.email);

  // Create 2 Accountant users
  const accountant1 = await prisma.user.upsert({
    where: { email: 'accountant1@toolledger.com' },
    update: {},
    create: {
      email: 'accountant1@toolledger.com',
      passwordHash: hashedPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.ACCOUNTANT,
      organizationId: organization.id,
      isActive: true,
    },
  });

  const accountant2 = await prisma.user.upsert({
    where: { email: 'accountant2@toolledger.com' },
    update: {},
    create: {
      email: 'accountant2@toolledger.com',
      passwordHash: hashedPassword,
      firstName: 'Robert',
      lastName: 'Brown',
      role: UserRole.ACCOUNTANT,
      organizationId: organization.id,
      isActive: true,
    },
  });

  console.log('✅ Accountants created:', accountant1.email, accountant2.email);

  // Create Teams
  console.log('\n👥 Creating teams...');
  const designTeam = await prisma.team.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: 'Design Team',
      },
    },
    update: {},
    create: {
      name: 'Design Team',
      description: 'UI/UX design and creative team',
      organizationId: organization.id,
    },
  });

  const aiTeam = await prisma.team.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: 'AI Team',
      },
    },
    update: {},
    create: {
      name: 'AI Team',
      description: 'AI and machine learning development team',
      organizationId: organization.id,
    },
  });

  const financeTeam = await prisma.team.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: 'Finance Team',
      },
    },
    update: {},
    create: {
      name: 'Finance Team',
      description: 'Finance and accounting team',
      organizationId: organization.id,
    },
  });

  const devTeam = await prisma.team.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: 'Development Team',
      },
    },
    update: {},
    create: {
      name: 'Development Team',
      description: 'Software development and engineering team',
      organizationId: organization.id,
    },
  });

  console.log('✅ Created teams:', designTeam.name, aiTeam.name, financeTeam.name, devTeam.name);

  // Assign users to teams
  await prisma.user.update({
    where: { id: user1.id },
    data: { teamId: designTeam.id },
  });

  await prisma.user.update({
    where: { id: user2.id },
    data: { teamId: aiTeam.id },
  });

  await prisma.user.update({
    where: { id: user3.id },
    data: { teamId: devTeam.id },
  });

  await prisma.user.update({
    where: { id: accountant1.id },
    data: { teamId: financeTeam.id },
  });

  await prisma.user.update({
    where: { id: accountant2.id },
    data: { teamId: financeTeam.id },
  });

  console.log('✅ Assigned users to teams');

  // Create dummy credentials for various tools
  console.log('\n📝 Creating dummy credentials for tools...');
  const credentialData = [
    // AI/ML Tools
    {
      name: 'ChatGPT Plus',
      username: 'chatgpt-user',
      password: 'ChatGPTPass123!',
      apiKey: 'sk-proj-xxxxxxxxxxxxxxxxxxxx',
      notes: 'OpenAI ChatGPT Plus subscription and API access for development team.',
      tags: ['ai', 'chatgpt', 'openai', 'ml'],
      owner: admin1,
    },
    {
      name: 'Orchids AI Platform',
      username: 'orchids-api',
      password: 'OrchidsKey456!',
      apiKey: 'orch_xxxxxxxxxxxxxxxxxxxx',
      notes: 'Orchids AI platform API credentials for advanced AI workflows.',
      tags: ['ai', 'orchids', 'ml', 'automation'],
      owner: user1,
    },
    {
      name: 'Cursor IDE',
      username: 'cursor-dev',
      password: 'CursorPass789!',
      apiKey: 'crsr_xxxxxxxxxxxxxxxxxxxx',
      notes: 'Cursor IDE subscription and API access for AI-powered coding.',
      tags: ['cursor', 'ide', 'development', 'ai-coding'],
      owner: user2,
    },
    {
      name: 'Claude AI (Anthropic)',
      username: 'claude-api',
      password: 'ClaudeKey321!',
      apiKey: 'sk-ant-xxxxxxxxxxxxxxxxxxxx',
      notes: 'Anthropic Claude API for AI assistant and coding tasks.',
      tags: ['ai', 'claude', 'anthropic', 'assistant'],
      owner: user1,
    },
    {
      name: 'GitHub Copilot',
      username: 'github-copilot',
      password: 'CopilotPass654!',
      apiKey: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      notes: 'GitHub Copilot subscription for AI pair programming.',
      tags: ['github', 'copilot', 'ai-coding', 'development'],
      owner: user3,
    },
    // Cloud & Infrastructure
    {
      name: 'AWS Production Account',
      username: 'aws-admin',
      password: 'AWSPass123!',
      apiKey: 'AKIAIOSFODNN7EXAMPLE',
      notes: 'Main AWS account for production workloads. Rotate keys quarterly.',
      tags: ['aws', 'production', 'cloud', 'infrastructure'],
      owner: admin1,
    },
    {
      name: 'Google Cloud Platform',
      username: 'gcp-service',
      password: 'GCPKey456!',
      apiKey: 'AIzaSyxxxxxxxxxxxxxxxxxxxx',
      notes: 'GCP service account for cloud infrastructure management.',
      tags: ['gcp', 'google-cloud', 'cloud', 'infrastructure'],
      owner: user2,
    },
    {
      name: 'Azure DevOps',
      username: 'azure-devops',
      password: 'AzurePass789!',
      apiKey: null,
      notes: 'Azure DevOps organization for CI/CD pipelines and project management.',
      tags: ['azure', 'ci-cd', 'devops', 'microsoft'],
      owner: user3,
    },
    // Development Tools
    {
      name: 'GitHub Enterprise',
      username: 'dev-team',
      password: 'GitHubPass456!',
      apiKey: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      notes: 'GitHub Enterprise account for all repositories and version control.',
      tags: ['github', 'version-control', 'devops', 'git'],
      owner: admin1,
    },
    {
      name: 'GitLab Premium',
      username: 'gitlab-user',
      password: 'GitLabKey321!',
      apiKey: 'glpat-xxxxxxxxxxxxxxxxxxxx',
      notes: 'GitLab Premium subscription for advanced CI/CD features.',
      tags: ['gitlab', 'ci-cd', 'version-control', 'devops'],
      owner: user3,
    },
    {
      name: 'Docker Hub',
      username: 'docker-user',
      password: 'DockerHub987!',
      apiKey: null,
      notes: 'Docker Hub account for container registry and image management.',
      tags: ['docker', 'containers', 'devops', 'registry'],
      owner: user1,
    },
    // Database Services
    {
      name: 'MongoDB Atlas Cluster',
      username: 'mongodb-admin',
      password: 'MongoDBPass321!',
      apiKey: null,
      notes: 'MongoDB Atlas connection for main database cluster.',
      tags: ['mongodb', 'database', 'cloud', 'nosql'],
      owner: user2,
    },
    {
      name: 'PostgreSQL (Supabase)',
      username: 'supabase-db',
      password: 'SupabasePass654!',
      apiKey: 'sb_xxxxxxxxxxxxxxxxxxxx',
      notes: 'Supabase PostgreSQL database credentials for backend services.',
      tags: ['postgresql', 'supabase', 'database', 'sql'],
      owner: user3,
    },
    // Payment & Services
    {
      name: 'Stripe Payment Gateway',
      username: 'stripe-api',
      password: 'StripeKey789!',
      apiKey: 'sk_live_xxxxxxxxxxxxxxxxxxxx',
      notes: 'Production Stripe API keys for payment processing.',
      tags: ['stripe', 'payments', 'production', 'fintech'],
      owner: admin1,
    },
    {
      name: 'SendGrid Email Service',
      username: 'sendgrid-api',
      password: 'SendGridPass147!',
      apiKey: 'SG.xxxxxxxxxxxxxxxxxxxx',
      notes: 'SendGrid API key for transactional emails and notifications.',
      tags: ['sendgrid', 'email', 'notifications', 'communication'],
      owner: user3,
    },
    // Communication Tools
    {
      name: 'Slack Workspace',
      username: 'slack-bot',
      password: 'SlackToken654!',
      apiKey: 'xoxb-xxxxxxxxxxxxxxxxxxxx',
      notes: 'Slack bot token for team notifications and automation.',
      tags: ['slack', 'communication', 'automation', 'team'],
      owner: user1,
    },
    {
      name: 'Discord Bot',
      username: 'discord-bot',
      password: 'DiscordKey258!',
      apiKey: 'MTxxxxxxxxxxxxxxxxxxxx',
      notes: 'Discord bot token for community management and notifications.',
      tags: ['discord', 'communication', 'bot', 'community'],
      owner: user2,
    },
    // Design & Creative Tools
    {
      name: 'Figma Team',
      username: 'figma-designer',
      password: 'FigmaPass369!',
      apiKey: 'figd_xxxxxxxxxxxxxxxxxxxx',
      notes: 'Figma team account for design collaboration and prototyping.',
      tags: ['figma', 'design', 'ui-ux', 'collaboration'],
      owner: user3,
    },
    {
      name: 'Adobe Creative Cloud',
      username: 'adobe-creative',
      password: 'AdobeKey741!',
      apiKey: null,
      notes: 'Adobe Creative Cloud subscription for design and creative work.',
      tags: ['adobe', 'design', 'creative', 'subscription'],
      owner: user3,
    },
  ];

  // Check if credentials already exist
  const existingCredentials = await prisma.credential.findMany({
    where: { organizationId: organization.id },
  });

  const credentials = [];
  if (existingCredentials.length > 0) {
    console.log(`   ⏩ Skipping - ${existingCredentials.length} credentials already exist`);
    credentials.push(...existingCredentials);
  } else {
    for (const cred of credentialData) {
      const encryptedUsername = encryptionKey ? encrypt(cred.username, encryptionKey) : cred.username;
      const encryptedPassword = encryptionKey ? encrypt(cred.password, encryptionKey) : cred.password;
      const encryptedApiKey = cred.apiKey && encryptionKey ? encrypt(cred.apiKey, encryptionKey) : cred.apiKey;
      const encryptedNotes = cred.notes && encryptionKey ? encrypt(cred.notes, encryptionKey) : cred.notes;

      const created = await prisma.credential.create({
        data: {
          name: cred.name,
          username: encryptedUsername,
          password: encryptedPassword,
          apiKey: encryptedApiKey,
          notes: encryptedNotes,
          tags: cred.tags,
          organizationId: organization.id,
          ownerId: cred.owner.id,
        },
      });
      credentials.push(created);
    }
    console.log(`✅ Created ${credentials.length} credentials`);
  }

  // Create credential shares (skip if they already exist)
  console.log('\n🔗 Creating credential shares...');
  const existingShares = await prisma.credentialShare.count();
  if (existingShares > 0) {
    console.log(`   ⏩ Skipping - ${existingShares} credential shares already exist`);
  } else if (credentials.length >= 3) {
    await prisma.credentialShare.create({
      data: {
        credentialId: credentials[0].id, // ChatGPT
        userId: user1.id,
        permission: CredentialPermission.VIEW_ONLY,
      },
    });
    await prisma.credentialShare.create({
      data: {
        credentialId: credentials[1].id, // Orchids
        userId: admin1.id,
        permission: CredentialPermission.EDIT,
      },
    });
    await prisma.credentialShare.create({
      data: {
        credentialId: credentials[2].id, // Cursor
        userId: user1.id,
        permission: CredentialPermission.VIEW_ONLY,
      },
    });
    console.log('✅ Created credential shares');
  }

  // Create dummy invoices for the tools
  console.log('\n📄 Creating dummy invoices...');
  const invoiceData = [
    // AI Tools Invoices
    {
      invoiceNumber: 'INV-2024-001',
      amount: 20.00,
      currency: 'USD',
      provider: 'ChatGPT',
      billingDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-15'),
      category: 'AI Tools',
      status: InvoiceStatus.APPROVED,
      uploadedBy: admin1,
      approvedBy: admin1,
      approvedAt: new Date('2024-01-20'),
    },
    {
      invoiceNumber: 'INV-2024-002',
      amount: 99.00,
      currency: 'USD',
      provider: 'Orchids',
      billingDate: new Date('2024-01-20'),
      dueDate: new Date('2024-02-20'),
      category: 'AI Tools',
      status: InvoiceStatus.APPROVED,
      uploadedBy: user1,
      approvedBy: admin1,
      approvedAt: new Date('2024-01-25'),
    },
    {
      invoiceNumber: 'INV-2024-003',
      amount: 20.00,
      currency: 'USD',
      provider: 'Cursor',
      billingDate: new Date('2024-01-25'),
      dueDate: new Date('2024-02-25'),
      category: 'Development Tools',
      status: InvoiceStatus.APPROVED,
      uploadedBy: user2,
      approvedBy: admin1,
      approvedAt: new Date('2024-01-28'),
    },
    {
      invoiceNumber: 'INV-2024-004',
      amount: 15.00,
      currency: 'USD',
      provider: 'Claude AI',
      billingDate: new Date('2024-02-01'),
      dueDate: new Date('2024-03-01'),
      category: 'AI Tools',
      status: InvoiceStatus.PENDING,
      uploadedBy: user1,
      approvedBy: null,
      approvedAt: null,
    },
    {
      invoiceNumber: 'INV-2024-005',
      amount: 10.00,
      currency: 'USD',
      provider: 'GitHub Copilot',
      billingDate: new Date('2024-02-05'),
      dueDate: new Date('2024-03-05'),
      category: 'Development Tools',
      status: InvoiceStatus.APPROVED,
      uploadedBy: user3,
      approvedBy: admin1,
      approvedAt: new Date('2024-02-10'),
    },
    // Cloud Services
    {
      invoiceNumber: 'INV-2024-006',
      amount: 1250.50,
      currency: 'USD',
      provider: 'AWS',
      billingDate: new Date('2024-02-10'),
      dueDate: new Date('2024-03-10'),
      category: 'Cloud Services',
      status: InvoiceStatus.APPROVED,
      uploadedBy: admin1,
      approvedBy: admin1,
      approvedAt: new Date('2024-02-12'),
    },
    {
      invoiceNumber: 'INV-2024-007',
      amount: 850.00,
      currency: 'USD',
      provider: 'Google Cloud Platform',
      billingDate: new Date('2024-02-15'),
      dueDate: new Date('2024-03-15'),
      category: 'Cloud Services',
      status: InvoiceStatus.PENDING,
      uploadedBy: user2,
      approvedBy: null,
      approvedAt: null,
    },
    {
      invoiceNumber: 'INV-2024-008',
      amount: 675.00,
      currency: 'USD',
      provider: 'Azure DevOps',
      billingDate: new Date('2024-02-20'),
      dueDate: new Date('2024-03-20'),
      category: 'DevOps Tools',
      status: InvoiceStatus.APPROVED,
      uploadedBy: user3,
      approvedBy: admin1,
      approvedAt: new Date('2024-02-22'),
    },
    // Development Tools
    {
      invoiceNumber: 'INV-2024-009',
      amount: 21.00,
      currency: 'USD',
      provider: 'GitHub',
      billingDate: new Date('2024-02-25'),
      dueDate: new Date('2024-03-25'),
      category: 'Development Tools',
      status: InvoiceStatus.APPROVED,
      uploadedBy: admin1,
      approvedBy: admin1,
      approvedAt: new Date('2024-02-28'),
    },
    {
      invoiceNumber: 'INV-2024-010',
      amount: 29.00,
      currency: 'USD',
      provider: 'GitLab',
      billingDate: new Date('2024-03-01'),
      dueDate: new Date('2024-04-01'),
      category: 'Development Tools',
      status: InvoiceStatus.PENDING,
      uploadedBy: user3,
      approvedBy: null,
      approvedAt: null,
    },
    // Database Services
    {
      invoiceNumber: 'INV-2024-011',
      amount: 1500.00,
      currency: 'USD',
      provider: 'MongoDB Atlas',
      billingDate: new Date('2024-03-05'),
      dueDate: new Date('2024-04-05'),
      category: 'Database Services',
      status: InvoiceStatus.APPROVED,
      uploadedBy: user2,
      approvedBy: admin1,
      approvedAt: new Date('2024-03-08'),
    },
    {
      invoiceNumber: 'INV-2024-012',
      amount: 25.00,
      currency: 'USD',
      provider: 'Supabase',
      billingDate: new Date('2024-03-10'),
      dueDate: new Date('2024-04-10'),
      category: 'Database Services',
      status: InvoiceStatus.APPROVED,
      uploadedBy: user3,
      approvedBy: admin1,
      approvedAt: new Date('2024-03-12'),
    },
    // Payment & Communication
    {
      invoiceNumber: 'INV-2024-013',
      amount: 320.75,
      currency: 'USD',
      provider: 'Stripe',
      billingDate: new Date('2024-03-15'),
      dueDate: new Date('2024-04-15'),
      category: 'Payment Processing',
      status: InvoiceStatus.APPROVED,
      uploadedBy: admin1,
      approvedBy: admin1,
      approvedAt: new Date('2024-03-18'),
    },
    {
      invoiceNumber: 'INV-2024-014',
      amount: 19.95,
      currency: 'USD',
      provider: 'SendGrid',
      billingDate: new Date('2024-03-20'),
      dueDate: new Date('2024-04-20'),
      category: 'Email Services',
      status: InvoiceStatus.PENDING,
      uploadedBy: user3,
      approvedBy: null,
      approvedAt: null,
    },
    {
      invoiceNumber: 'INV-2024-015',
      amount: 8.75,
      currency: 'USD',
      provider: 'Slack',
      billingDate: new Date('2024-03-25'),
      dueDate: new Date('2024-04-25'),
      category: 'Communication',
      status: InvoiceStatus.APPROVED,
      uploadedBy: user1,
      approvedBy: admin1,
      approvedAt: new Date('2024-03-28'),
    },
    // Design Tools
    {
      invoiceNumber: 'INV-2024-016',
      amount: 12.00,
      currency: 'USD',
      provider: 'Figma',
      billingDate: new Date('2024-04-01'),
      dueDate: new Date('2024-05-01'),
      category: 'Design Tools',
      status: InvoiceStatus.APPROVED,
      uploadedBy: user3,
      approvedBy: admin1,
      approvedAt: new Date('2024-04-03'),
    },
    {
      invoiceNumber: 'INV-2024-017',
      amount: 52.99,
      currency: 'USD',
      provider: 'Adobe',
      billingDate: new Date('2024-04-05'),
      dueDate: new Date('2024-05-05'),
      category: 'Design Tools',
      status: InvoiceStatus.PENDING,
      uploadedBy: user3,
      approvedBy: null,
      approvedAt: null,
    },
  ];

  // Check if invoices already exist
  const existingInvoices = await prisma.invoice.findMany({
    where: { organizationId: organization.id },
  });

  const invoices = [];
  if (existingInvoices.length > 0) {
    console.log(`   ⏩ Skipping - ${existingInvoices.length} invoices already exist`);
    invoices.push(...existingInvoices);
  } else {
    for (const inv of invoiceData) {
      const invoiceDataToCreate: any = {
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        currency: inv.currency,
        provider: inv.provider,
        billingDate: inv.billingDate,
        dueDate: inv.dueDate,
        category: inv.category,
        status: inv.status,
        organizationId: organization.id,
        uploadedById: inv.uploadedBy.id,
        approvedById: inv.approvedBy?.id,
        approvedAt: inv.approvedAt,
      };

      // Add optional rejection fields if they exist
      if ('rejectedAt' in inv && inv.rejectedAt) {
        invoiceDataToCreate.rejectedAt = inv.rejectedAt;
      }
      if ('rejectionReason' in inv && inv.rejectionReason) {
        invoiceDataToCreate.rejectionReason = inv.rejectionReason;
      }

      const created = await prisma.invoice.create({
        data: invoiceDataToCreate,
      });
      invoices.push(created);
    }
    console.log(`✅ Created ${invoices.length} invoices`);
  }

  // Link invoices to credentials (skip if they exist)
  console.log('\n🔗 Linking invoices to credentials...');
  const existingLinks = await prisma.invoiceCredentialLink.count();
  if (existingLinks > 0) {
    console.log(`   ⏩ Skipping - ${existingLinks} invoice-credential links already exist`);
  } else {
    const invoiceCredentialLinks = [
      { invoiceIndex: 0, credentialIndex: 0 }, // ChatGPT invoice -> ChatGPT credential
      { invoiceIndex: 1, credentialIndex: 1 }, // Orchids invoice -> Orchids credential
      { invoiceIndex: 2, credentialIndex: 2 }, // Cursor invoice -> Cursor credential
      { invoiceIndex: 3, credentialIndex: 3 }, // Claude invoice -> Claude credential
      { invoiceIndex: 4, credentialIndex: 4 }, // GitHub Copilot invoice -> GitHub Copilot credential
      { invoiceIndex: 5, credentialIndex: 5 }, // AWS invoice -> AWS credential
      { invoiceIndex: 6, credentialIndex: 6 }, // GCP invoice -> GCP credential
      { invoiceIndex: 7, credentialIndex: 7 }, // Azure invoice -> Azure credential
      { invoiceIndex: 8, credentialIndex: 8 }, // GitHub invoice -> GitHub credential
      { invoiceIndex: 9, credentialIndex: 9 }, // GitLab invoice -> GitLab credential
      { invoiceIndex: 10, credentialIndex: 10 }, // MongoDB invoice -> MongoDB credential
      { invoiceIndex: 11, credentialIndex: 11 }, // Supabase invoice -> Supabase credential
      { invoiceIndex: 12, credentialIndex: 12 }, // Stripe invoice -> Stripe credential
      { invoiceIndex: 13, credentialIndex: 13 }, // SendGrid invoice -> SendGrid credential
      { invoiceIndex: 14, credentialIndex: 14 }, // Slack invoice -> Slack credential
      { invoiceIndex: 15, credentialIndex: 15 }, // Figma invoice -> Figma credential
      { invoiceIndex: 16, credentialIndex: 16 }, // Adobe invoice -> Adobe credential
    ];

  const existingLinks = await prisma.invoiceCredentialLink.count();
  if (existingLinks > 0) {
    console.log(`   ⏩ Skipping - ${existingLinks} invoice-credential links already exist`);
  } else {
    for (const link of invoiceCredentialLinks) {
      if (invoices[link.invoiceIndex] && credentials[link.credentialIndex]) {
        await prisma.invoiceCredentialLink.create({
          data: {
            invoiceId: invoices[link.invoiceIndex].id,
            credentialId: credentials[link.credentialIndex].id,
          },
        });
      }
    }
    console.log('✅ Created invoice-credential links');
  }
  }

  // Create comments (skip if they exist)
  console.log('\n💬 Creating comments...');
  const existingComments = await prisma.comment.count();
  if (existingComments > 0) {
    console.log(`   ⏩ Skipping - ${existingComments} comments already exist`);
  } else if (credentials.length >= 3 && invoices.length >= 2) {
    await prisma.comment.create({
      data: {
        content: 'ChatGPT API usage has increased significantly this month. Consider upgrading plan.',
        credentialId: credentials[0].id,
        userId: admin1.id,
      },
    });
    await prisma.comment.create({
      data: {
        content: 'Orchids AI integration completed successfully. API key rotated.',
        credentialId: credentials[1].id,
        userId: user1.id,
      },
    });
    await prisma.comment.create({
      data: {
        content: 'Cursor IDE is working great for the team. Renew subscription next month.',
        credentialId: credentials[2].id,
        userId: user2.id,
      },
    });
    await prisma.comment.create({
      data: {
        content: 'Please verify this invoice amount matches our ChatGPT subscription.',
        invoiceId: invoices[0].id,
        userId: admin1.id,
      },
    });
    await prisma.comment.create({
      data: {
        content: 'Orchids invoice approved - matches expected billing.',
        invoiceId: invoices[1].id,
        userId: admin1.id,
      },
    });
    console.log('✅ Created comments');
  }

  // Create notifications (skip if they already exist)
  console.log('\n🔔 Creating notifications...');
  const existingNotifications = await prisma.notification.count();
  if (existingNotifications > 0) {
    console.log(`   ⏩ Skipping - ${existingNotifications} notifications already exist`);
  } else {
    await prisma.notification.createMany({
      data: [
        {
          userId: admin1.id,
          type: 'invoice_upload',
          title: 'New Invoice Uploaded',
          message: 'A new invoice INV-2024-004 has been uploaded and requires approval.',
          read: false,
          metadata: JSON.stringify({ invoiceId: invoices[3]?.id }),
        },
        {
          userId: user1.id,
          type: 'access_request',
          title: 'Credential Access Request',
          message: 'Admin User has requested access to ChatGPT Plus.',
          read: false,
        },
        {
          userId: admin1.id,
          type: 'approval',
          title: 'Invoice Approved',
          message: 'Invoice INV-2024-001 has been approved.',
          read: true,
          metadata: JSON.stringify({ invoiceId: invoices[0]?.id }),
        },
        {
          userId: user2.id,
          type: 'invoice_upload',
          title: 'Invoice Approved',
          message: 'Invoice INV-2024-003 (Cursor) has been approved.',
          read: false,
          metadata: JSON.stringify({ invoiceId: invoices[2]?.id }),
        },
      ],
    });
    console.log('✅ Created notifications');
  }

  // Create audit logs (skip if they already exist)
  console.log('\n📊 Creating audit logs...');
  const existingAuditLogs = await prisma.auditLog.count();
  if (existingAuditLogs > 0) {
    console.log(`   ⏩ Skipping - ${existingAuditLogs} audit logs already exist`);
  } else if (credentials.length >= 3 && invoices.length >= 1) {
    await prisma.auditLog.createMany({
      data: [
        {
          action: AuditAction.CREATE,
          resourceType: 'credential',
          resourceId: credentials[0]?.id,
          userId: admin1.id,
          organizationId: organization.id,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          metadata: JSON.stringify({ credentialName: credentials[0]?.name }),
        },
        {
          action: AuditAction.CREATE,
          resourceType: 'credential',
          resourceId: credentials[1]?.id,
          userId: user1.id,
          organizationId: organization.id,
          ipAddress: '192.168.1.101',
          metadata: JSON.stringify({ credentialName: credentials[1]?.name }),
        },
        {
          action: AuditAction.CREATE,
          resourceType: 'credential',
          resourceId: credentials[2]?.id,
          userId: user2.id,
          organizationId: organization.id,
          ipAddress: '192.168.1.102',
          metadata: JSON.stringify({ credentialName: credentials[2]?.name }),
        },
        {
          action: AuditAction.UPLOAD,
          resourceType: 'invoice',
          resourceId: invoices[0]?.id,
          userId: admin1.id,
          organizationId: organization.id,
          ipAddress: '192.168.1.100',
          metadata: JSON.stringify({ invoiceNumber: invoices[0]?.invoiceNumber }),
        },
        {
          action: AuditAction.APPROVE,
          resourceType: 'invoice',
          resourceId: invoices[0]?.id,
          userId: admin1.id,
          organizationId: organization.id,
          ipAddress: '192.168.1.100',
          metadata: JSON.stringify({ invoiceNumber: invoices[0]?.invoiceNumber }),
        },
        {
          action: AuditAction.READ,
          resourceType: 'credential',
          resourceId: credentials[0]?.id,
          userId: user1.id,
          organizationId: organization.id,
          ipAddress: '192.168.1.101',
        },
        {
          action: AuditAction.SHARE,
          resourceType: 'credential',
          resourceId: credentials[0]?.id,
          userId: admin1.id,
          organizationId: organization.id,
          ipAddress: '192.168.1.100',
          metadata: JSON.stringify({ sharedWith: user1.email }),
        },
      ],
    });
    console.log('✅ Created audit logs');
  }

  console.log('\n📋 Demo Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⭐ MAIN HERO - Admin (1 account):');
  console.log('   👑 Email: admin@toolledger.com');
  console.log('   🔑 Password: password123');
  console.log('   🎯 Role: ADMIN (Full access - Main Hero of the website)');
  console.log('   ✨ Features: All admin features, user management, analytics, approvals');
  console.log('');
  console.log('👤 Users (3 accounts):');
  console.log('   1. Email: user1@toolledger.com (John Doe)');
  console.log('   2. Email: user2@toolledger.com (Sarah Johnson)');
  console.log('   3. Email: user3@toolledger.com (Michael Chen)');
  console.log('   Password: password123');
  console.log('   Role: USER (manage credentials, invoices, analytics)');
  console.log('');
  console.log('👤 Accountants (2 accounts):');
  console.log('   1. Email: accountant1@toolledger.com (Jane Smith)');
  console.log('   2. Email: accountant2@toolledger.com (Robert Brown)');
  console.log('   Password: password123');
  console.log('   Role: ACCOUNTANT (financial analytics, admin spending)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✨ Dummy Data Summary:');
  console.log(`   📝 Credentials: ${credentials.length} (including ChatGPT, Orchids, Cursor, and more)`);
  console.log(`   📄 Invoices: ${invoices.length} (linked to credentials)`);
  console.log(`   👥 Teams: 4 (Design Team, AI Team, Finance Team, Development Team)`);
  console.log(`   💬 Comments: 5`);
  console.log(`   🔔 Notifications: 4`);
  console.log(`   📊 Audit Logs: 7`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
