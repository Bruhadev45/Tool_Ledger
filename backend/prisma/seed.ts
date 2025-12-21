import { PrismaClient, UserRole, InvoiceStatus, CredentialPermission, AuditAction, UserApprovalStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Simple encryption utility for seeding (matches EncryptionService logic)
// Note: This function is currently unused since dummy credentials were removed
// Kept for potential future use
function encrypt(text: string, encryptionKey: string): string {
  const algorithm = 'aes-256-gcm';
  
  // Validate encryption key first
  let keyBuffer: Buffer;
  try {
    // Try base64 decode first (common format)
    keyBuffer = Buffer.from(encryptionKey, 'base64');
    if (keyBuffer.length !== 32) {
      // If base64 decode doesn't give 32 bytes, try UTF-8
      keyBuffer = Buffer.from(encryptionKey, 'utf8');
    }
  } catch {
    // If base64 decode fails, use UTF-8
    keyBuffer = Buffer.from(encryptionKey, 'utf8');
  }
  
  // Validate key length
  if (keyBuffer.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes. ` +
      `Received: ${keyBuffer.length} bytes (string length: ${encryptionKey.length}). ` +
      `Generate a key with: openssl rand -base64 32`
    );
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
  // Default seed key: exactly 32 bytes (for development/testing only)
  // This is a 32-character string = 32 bytes for ASCII
  const defaultSeedKey = 'default-seed-key-for-dev-only-32';
  const encryptionKey = process.env.ENCRYPTION_KEY || defaultSeedKey;
  
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('⚠️  ENCRYPTION_KEY not found in environment. Using default seed key.');
    console.warn('   Note: In production, always set ENCRYPTION_KEY in your .env file.');
    console.warn('   Generate a secure key with: openssl rand -base64 32');
  }
  
  // Validate encryption key length before using it
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
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes. Current length: ${keyBuffer.length} bytes. ` +
      `Generate a key with: openssl rand -base64 32`
    );
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
      mfaEnabled: false, // Note: MFA will be required at login, but seed data doesn't enforce it
      isActive: true,
      approvalStatus: UserApprovalStatus.APPROVED, // Admins are auto-approved
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
      approvalStatus: UserApprovalStatus.APPROVED, // Seed users are pre-approved
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
      approvalStatus: UserApprovalStatus.APPROVED, // Seed users are pre-approved
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
      approvalStatus: UserApprovalStatus.APPROVED, // Seed users are pre-approved
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
      approvalStatus: UserApprovalStatus.APPROVED, // Accountants are auto-approved
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
      approvalStatus: UserApprovalStatus.APPROVED, // Accountants are auto-approved
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

  // Initialize empty credentials array (no dummy credentials created)
  const credentials: any[] = [];

  // Skip credential shares (no dummy credentials)
  console.log('\n🔗 Skipping credential shares (no dummy credentials)');

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

  // Skip invoice-credential links (no dummy credentials)
  console.log('\n🔗 Skipping invoice-credential links (no dummy credentials)');

  // Create comments (only invoice comments, no credential comments)
  console.log('\n💬 Creating comments...');
  const existingComments = await prisma.comment.count();
  if (existingComments > 0) {
    console.log(`   ⏩ Skipping - ${existingComments} comments already exist`);
  } else if (invoices.length >= 2) {
    await prisma.comment.create({
      data: {
        content: 'Please verify this invoice amount matches the subscription.',
        invoiceId: invoices[0].id,
        userId: admin1.id,
      },
    });
    await prisma.comment.create({
      data: {
        content: 'Invoice approved - matches expected billing.',
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
  } else if (invoices.length >= 1) {
    await prisma.auditLog.createMany({
      data: [
        {
          action: AuditAction.UPLOAD,
          resourceType: 'invoice',
          resourceId: invoices[0].id,
          userId: admin1.id,
          organizationId: organization.id,
          ipAddress: '192.168.1.100',
          metadata: { invoiceNumber: invoices[0].invoiceNumber },
        },
        {
          action: AuditAction.APPROVE,
          resourceType: 'invoice',
          resourceId: invoices[0].id,
          userId: admin1.id,
          organizationId: organization.id,
          ipAddress: '192.168.1.100',
          metadata: { invoiceNumber: invoices[0].invoiceNumber },
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
  console.log('\n✨ Seed Data Summary:');
  console.log(`   📝 Credentials: ${credentials.length} (no dummy credentials created)`);
  console.log(`   📄 Invoices: ${invoices.length}`);
  console.log(`   👥 Teams: 4 (Design Team, AI Team, Finance Team, Development Team)`);
  console.log(`   💬 Comments: ${invoices.length >= 2 ? 2 : 0}`);
  console.log(`   🔔 Notifications: 4`);
  console.log(`   📊 Audit Logs: ${invoices.length >= 1 ? 2 : 0}`);
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
