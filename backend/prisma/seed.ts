import { PrismaClient, UserRole, UserApprovalStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initializing database...');

  // Create default organization
  const organization = await prisma.organization.upsert({
    where: { domain: 'toolledger.com' },
    update: {},
    create: {
      name: 'ToolLedger',
      domain: 'toolledger.com',
    },
  });

  console.log('✅ Organization created:', organization.name);

  // Hash password for admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create default admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@toolledger.com' },
    update: {
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      email: 'admin@toolledger.com',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      organizationId: organization.id,
      mfaEnabled: false,
      isActive: true,
      approvalStatus: UserApprovalStatus.APPROVED,
    },
  });

  console.log('✅ Admin user created/updated:', admin.email);

  console.log('\n📋 Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👑 Admin Account:');
  console.log('   Email: admin@toolledger.com');
  console.log('   Password: admin123');
  console.log('   Role: ADMIN (Full system access)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✨ Database initialized successfully!');
  console.log('   📝 Organization: 1');
  console.log('   👤 Users: 1 (Admin)');
  console.log('   📊 Ready for production use');
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
