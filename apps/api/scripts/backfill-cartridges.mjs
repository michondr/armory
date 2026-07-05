// One-off: seed default cartridges + import existing gun/ammo calibers for all users.
// Run in a container on the compose network:
//   docker run --rm --network armory_default -v "$PWD":/app -w /app --env-file .env \
//     node:24-bookworm node apps/api/scripts/backfill-cartridges.mjs
import { PrismaClient } from '@prisma/client';

const DEFAULTS = [
  '.22 LR', '.17 HMR', '9mm Luger', '.380 ACP', '.40 S&W', '.45 ACP', '10mm Auto',
  '.357 Magnum', '.38 Special', '.44 Magnum', '.223 Remington', '5.56x45mm NATO',
  '.243 Winchester', '.270 Winchester', '6mm Creedmoor', '6.5 Creedmoor', '6.5 Grendel',
  '.308 Winchester', '7.62x51mm NATO', '7.62x39mm', '.30-06 Springfield', '.30-30 Winchester',
  '.300 AAC Blackout', '.300 Winchester Magnum', '.338 Lapua Magnum', '12 Gauge', '20 Gauge',
];

const prisma = new PrismaClient();
const users = await prisma.user.findMany({ select: { id: true, email: true } });

for (const u of users) {
  const before = await prisma.cartridge.count({ where: { userId: u.id } });
  await prisma.cartridge.createMany({
    data: DEFAULTS.map((name) => ({ userId: u.id, name })),
    skipDuplicates: true,
  });
  const [guns, ammo] = await Promise.all([
    prisma.gun.findMany({
      where: { userId: u.id, deletedAt: null, NOT: { caliber: null } },
      select: { caliber: true },
    }),
    prisma.ammo.findMany({
      where: { userId: u.id, deletedAt: null, NOT: { caliber: null } },
      select: { caliber: true },
    }),
  ]);
  const names = [...new Set([...guns, ...ammo].map((x) => x.caliber?.trim()).filter(Boolean))];
  if (names.length) {
    await prisma.cartridge.createMany({
      data: names.map((name) => ({ userId: u.id, name })),
      skipDuplicates: true,
    });
  }
  const after = await prisma.cartridge.count({ where: { userId: u.id } });
  console.log(`${u.email}: ${before} -> ${after} (imported: ${names.join(', ') || 'none'})`);
}

console.log(`Done. ${users.length} user(s).`);
await prisma.$disconnect();
