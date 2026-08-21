/**
 * Creates one known login per role, and promotes the nominated account to
 * Super Admin. Safe to re-run: every write is an upsert keyed on email, so the
 * seeded accounts are reset to a known state rather than duplicated.
 *
 *   npm run seed
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../generated/prisma/client';
import { generatePgCode } from '../modules/auth/services/pg-code';

interface BcryptApi {
  hash(value: string, saltRounds: number): Promise<string>;
}

const bcrypt = require('bcrypt') as BcryptApi;
const BCRYPT_SALT_ROUNDS = 10;

/** Shared across the seeded accounts so they are easy to test with. */
const SEED_PASSWORD = 'Pzee@12345';

/** This existing account is promoted to Super Admin; its password is untouched. */
const PROMOTE_TO_SUPER_ADMIN = 'prakashmanig000@gmail.com';

interface SeedAccount {
  role: UserRole;
  label: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  /** Only for the PG owner. */
  pg?: { name: string; location: string };
}

const ACCOUNTS: SeedAccount[] = [
  {
    role: UserRole.SUPER_ADMIN,
    label: 'Super Admin',
    email: 'superadmin@pzee.in',
    phone: '9000000001',
    firstName: 'Pzee',
    lastName: 'Admin',
  },
  {
    role: UserRole.PG_OWNER,
    label: 'PG Owner',
    email: 'owner@pzee.in',
    phone: '9000000002',
    firstName: 'Demo',
    lastName: 'Owner',
    pg: { name: 'Pzee Demo PG', location: 'Pitampura, New Delhi 110034' },
  },
  {
    role: UserRole.USER,
    label: 'PG Finder',
    email: 'user@pzee.in',
    phone: '9000000003',
    firstName: 'Demo',
    lastName: 'Resident',
  },
];

function createPrismaClient(): PrismaClient {
  const connectionUrl = new URL(
    process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  );

  // Both parameters are needed, and must match DatabaseService: with
  // `sslmode=require` alone the driver now performs full certificate
  // verification, which Supabase's self-signed chain fails.
  connectionUrl.searchParams.set('uselibpqcompat', 'true');
  connectionUrl.searchParams.set('sslmode', 'require');

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionUrl.toString() }),
  });
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  const password = await bcrypt.hash(SEED_PASSWORD, BCRYPT_SALT_ROUNDS);
  const summary: Array<Record<string, string>> = [];

  try {
    for (const account of ACCOUNTS) {
      const user = await prisma.user.upsert({
        where: { email: account.email },
        // Re-running resets the password and role, but keeps the same row.
        update: {
          password,
          role: account.role,
          isActive: true,
          isBlocked: false,
        },
        create: {
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          phone: account.phone,
          password,
          role: account.role,
          country: 'India',
          state: 'Delhi',
          city: 'New Delhi',
        },
        select: { id: true, email: true, role: true },
      });

      let pgCode = '—';

      if (account.pg) {
        const existing = await prisma.pg.findUnique({
          where: { ownerId: user.id },
          select: { pgCode: true },
        });

        // The PG code is an identity people share, so never regenerate one
        // that already exists.
        const pg = await prisma.pg.upsert({
          where: { ownerId: user.id },
          update: { name: account.pg.name, location: account.pg.location },
          create: {
            pgCode: existing?.pgCode ?? generatePgCode(),
            name: account.pg.name,
            location: account.pg.location,
            ownerId: user.id,
          },
          select: { pgCode: true },
        });

        pgCode = pg.pgCode;
      }

      summary.push({
        Role: account.role,
        'Logs in as': account.label,
        Email: account.email,
        Password: SEED_PASSWORD,
        'PG ID': pgCode,
      });
    }

    // Promote the nominated real account. Only the role changes.
    const promoted = await prisma.user.updateMany({
      where: { email: PROMOTE_TO_SUPER_ADMIN },
      data: { role: UserRole.SUPER_ADMIN },
    });

    console.log('\nSeeded logins (shared password):');
    console.table(summary);

    console.log(
      promoted.count > 0
        ? `Promoted ${PROMOTE_TO_SUPER_ADMIN} to SUPER_ADMIN (its own password is unchanged).`
        : `No account found for ${PROMOTE_TO_SUPER_ADMIN}; nothing promoted.`,
    );

    const roleCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    });

    console.log('\nAccounts per role:');
    console.table(
      roleCounts.map((entry) => ({
        Role: entry.role,
        Accounts: entry._count._all,
      })),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
