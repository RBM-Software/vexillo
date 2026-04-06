import { db } from "@/lib/db";
import { flags, environments, flagStates } from "@/lib/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export type DashboardFlagRow = {
  id: string;
  name: string;
  key: string;
  description: string;
  createdAt: Date;
  states: Record<string, boolean>;
};

export type DashboardEnvironmentRef = {
  id: string;
  name: string;
  slug: string;
};

export async function getDashboardFlagsAndEnvironments() {
  const [rows, envRows] = await Promise.all([
    db
      .select({
        id: flags.id,
        name: flags.name,
        key: flags.key,
        description: flags.description,
        createdAt: flags.createdAt,
        envSlug: environments.slug,
        enabled: sql<boolean>`COALESCE(${flagStates.enabled}, false)`,
      })
      .from(flags)
      .crossJoin(environments)
      .leftJoin(
        flagStates,
        and(
          eq(flagStates.flagId, flags.id),
          eq(flagStates.environmentId, environments.id),
        ),
      )
      .orderBy(desc(flags.createdAt), asc(environments.name)),

    db
      .select({
        id: environments.id,
        name: environments.name,
        slug: environments.slug,
      })
      .from(environments)
      .orderBy(asc(environments.name)),
  ]);

  const flagMap = new Map<string, DashboardFlagRow>();

  for (const row of rows) {
    if (!flagMap.has(row.key)) {
      flagMap.set(row.key, {
        id: row.id,
        name: row.name,
        key: row.key,
        description: row.description,
        createdAt: row.createdAt,
        states: {},
      });
    }
    flagMap.get(row.key)!.states[row.envSlug] = row.enabled;
  }

  return {
    flags: Array.from(flagMap.values()),
    environments: envRows as DashboardEnvironmentRef[],
  };
}

export type DashboardFlagRolloutRow = {
  name: string;
  slug: string;
  enabled: boolean;
};

export async function getDashboardFlagByKey(key: string) {
  const rows = await db
    .select({
      id: flags.id,
      name: flags.name,
      key: flags.key,
      description: flags.description,
      createdAt: flags.createdAt,
      envSlug: environments.slug,
      envName: environments.name,
      enabled: sql<boolean>`COALESCE(${flagStates.enabled}, false)`,
    })
    .from(flags)
    .crossJoin(environments)
    .leftJoin(
      flagStates,
      and(
        eq(flagStates.flagId, flags.id),
        eq(flagStates.environmentId, environments.id),
      ),
    )
    .where(eq(flags.key, key))
    .orderBy(asc(environments.name));

  if (rows.length > 0) {
    const first = rows[0];
    const states: Record<string, boolean> = {};
    const rollout: DashboardFlagRolloutRow[] = [];
    for (const row of rows) {
      states[row.envSlug] = row.enabled;
      rollout.push({
        name: row.envName,
        slug: row.envSlug,
        enabled: row.enabled,
      });
    }
    return {
      flag: {
        id: first.id,
        name: first.name,
        key: first.key,
        description: first.description,
        createdAt: first.createdAt,
        states,
      },
      rollout,
    };
  }

  const [flagOnly] = await db
    .select({
      id: flags.id,
      name: flags.name,
      key: flags.key,
      description: flags.description,
      createdAt: flags.createdAt,
    })
    .from(flags)
    .where(eq(flags.key, key))
    .limit(1);

  if (!flagOnly) return null;

  return {
    flag: {
      ...flagOnly,
      states: {} as Record<string, boolean>,
    },
    rollout: [] as DashboardFlagRolloutRow[],
  };
}
