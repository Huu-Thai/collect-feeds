import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PHISHING_DB_BASE_URL =
  'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/refs/heads/master';

const DAILY_CRON = '0 3 * * *';
const HOURLY_CRON = '0 * * * *';

interface PhishingDbSourceSeed {
  file: string;
  indicatorType: 'IPV4' | 'DOMAIN' | 'URL';
  status: 'ACTIVE' | 'INACTIVE' | 'INVALID';
  schedule: string;
}

const PHISHING_DB_SOURCES: PhishingDbSourceSeed[] = [
  {
    file: 'phishing-IPs-ACTIVE.txt',
    indicatorType: 'IPV4',
    status: 'ACTIVE',
    schedule: DAILY_CRON,
  },
  {
    file: 'phishing-IPs-INACTIVE.txt',
    indicatorType: 'IPV4',
    status: 'INACTIVE',
    schedule: DAILY_CRON,
  },
  {
    file: 'phishing-IPs-INVALID.txt',
    indicatorType: 'IPV4',
    status: 'INVALID',
    schedule: DAILY_CRON,
  },
  {
    file: 'phishing-ips-NEW-today.txt',
    indicatorType: 'IPV4',
    status: 'ACTIVE',
    schedule: HOURLY_CRON,
  },
  {
    file: 'phishing-domains-ACTIVE.txt',
    indicatorType: 'DOMAIN',
    status: 'ACTIVE',
    schedule: DAILY_CRON,
  },
  {
    file: 'phishing-domains-INACTIVE.txt',
    indicatorType: 'DOMAIN',
    status: 'INACTIVE',
    schedule: DAILY_CRON,
  },
  {
    file: 'phishing-domains-INVALID.txt',
    indicatorType: 'DOMAIN',
    status: 'INVALID',
    schedule: DAILY_CRON,
  },
  {
    file: 'phishing-domains-NEW-today.txt',
    indicatorType: 'DOMAIN',
    status: 'ACTIVE',
    schedule: HOURLY_CRON,
  },
  {
    file: 'phishing-links-ACTIVE.txt',
    indicatorType: 'URL',
    status: 'ACTIVE',
    schedule: DAILY_CRON,
  },
  {
    file: 'phishing-links-ACTIVE-NOW.txt',
    indicatorType: 'URL',
    status: 'ACTIVE',
    schedule: HOURLY_CRON,
  },
  {
    file: 'phishing-links-ACTIVE-today.txt',
    indicatorType: 'URL',
    status: 'ACTIVE',
    schedule: HOURLY_CRON,
  },
  {
    file: 'phishing-links-NEW-today.txt',
    indicatorType: 'URL',
    status: 'ACTIVE',
    schedule: HOURLY_CRON,
  },
  {
    file: 'phishing-links-INACTIVE.txt',
    indicatorType: 'URL',
    status: 'INACTIVE',
    schedule: DAILY_CRON,
  },
  {
    file: 'phishing-links-INVALID.txt',
    indicatorType: 'URL',
    status: 'INVALID',
    schedule: DAILY_CRON,
  },
];

function sourceName(entry: PhishingDbSourceSeed): string {
  return `Phishing.Database - ${entry.file.replace('.txt', '')}`;
}

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { key: 'admin' },
    update: {},
    create: { name: 'Administrator', key: 'admin' },
  });

  const viewerRole = await prisma.role.upsert({
    where: { key: 'viewer' },
    update: {},
    create: { name: 'Viewer', key: 'viewer' },
  });

  await prisma.permission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.permission.create({
    data: { key: '*', method: '*', path: '*', roleId: adminRole.id },
  });

  await prisma.permission.deleteMany({ where: { roleId: viewerRole.id } });
  await prisma.permission.create({
    data: { key: 'read', method: 'GET', path: '*', roleId: viewerRole.id },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@threat-feed.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      firstname: 'Admin',
      lastname: 'User',
      roleId: adminRole.id,
    },
  });
  console.log(
    `Seeded admin user: ${adminEmail} / ${adminPassword} (change this password)`,
  );

  for (const entry of PHISHING_DB_SOURCES) {
    const source = await prisma.source.upsert({
      where: { name: sourceName(entry) },
      update: {
        params: {
          url: `${PHISHING_DB_BASE_URL}/${entry.file}`,
          indicatorType: entry.indicatorType,
          status: entry.status,
        },
      },
      create: {
        name: sourceName(entry),
        type: 'phishing_database',
        params: {
          url: `${PHISHING_DB_BASE_URL}/${entry.file}`,
          indicatorType: entry.indicatorType,
          status: entry.status,
        },
      },
    });

    const existingJob = await prisma.job.findFirst({
      where: { sourceId: source.id },
    });
    if (!existingJob) {
      await prisma.job.create({
        data: {
          name: sourceName(entry),
          type: 'phishing_database',
          sourceId: source.id,
          schedule: entry.schedule,
          isActive: true,
        },
      });
    }
  }
  console.log(
    `Seeded ${PHISHING_DB_SOURCES.length} Phishing.Database sources + jobs`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
