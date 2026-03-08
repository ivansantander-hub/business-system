import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/auth";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  COMPANY_TYPE_PERMISSIONS,
  type Permission,
  type CompanyType,
} from "@/lib/rbac";
import { Role } from "@prisma/client";

const CONFIGURABLE_ROLES: Role[] = ["ADMIN", "CASHIER", "WAITER", "ACCOUNTANT", "TRAINER"];

export async function GET(request: Request) {
  let companyId: string;
  try {
    companyId = requireCompanyId(request);
  } catch {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { type: true },
  });

  const companyType = (company?.type || "RESTAURANT") as CompanyType;
  const typePerms = COMPANY_TYPE_PERMISSIONS[companyType] || ALL_PERMISSIONS;

  const dbOverrides = await prisma.rolePermission.findMany({
    where: { companyId },
  });

  const overrideMap = new Map<string, boolean>();
  for (const rp of dbOverrides) {
    overrideMap.set(`${rp.role}:${rp.permission}`, rp.enabled);
  }

  const result = CONFIGURABLE_ROLES.map((role) => {
    const defaults = ROLE_PERMISSIONS[role] || [];
    const permissions = typePerms.map((perm) => {
      const key = `${role}:${perm}`;
      const isDefault = defaults.includes(perm);
      const enabled = overrideMap.has(key) ? overrideMap.get(key)! : isDefault;
      return {
        permission: perm,
        label: PERMISSION_LABELS[perm] || perm,
        enabled,
        isDefault,
      };
    });
    return { role, permissions };
  });

  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  let companyId: string;
  try {
    companyId = requireCompanyId(request);
  } catch {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const body = await request.json();
  const { role, permission, enabled } = body as {
    role: string;
    permission: string;
    enabled: boolean;
  };

  if (!role || !permission || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "role, permission, and enabled are required" },
      { status: 400 }
    );
  }

  if (!CONFIGURABLE_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "Invalid or non-configurable role" }, { status: 400 });
  }

  if (!ALL_PERMISSIONS.includes(permission as Permission)) {
    return NextResponse.json({ error: "Invalid permission" }, { status: 400 });
  }

  await prisma.rolePermission.upsert({
    where: {
      companyId_role_permission: { companyId, role, permission },
    },
    update: { enabled },
    create: { companyId, role, permission, enabled },
  });

  return NextResponse.json({ ok: true });
}

/** Bulk update: set all permissions for a role at once */
export async function POST(request: Request) {
  let companyId: string;
  try {
    companyId = requireCompanyId(request);
  } catch {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const body = await request.json();
  const { role, permissions } = body as {
    role: string;
    permissions: { permission: string; enabled: boolean }[];
  };

  if (!role || !Array.isArray(permissions)) {
    return NextResponse.json(
      { error: "role and permissions array required" },
      { status: 400 }
    );
  }

  if (!CONFIGURABLE_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const ops = permissions
    .filter((p) => ALL_PERMISSIONS.includes(p.permission as Permission))
    .map((p) =>
      prisma.rolePermission.upsert({
        where: {
          companyId_role_permission: { companyId, role, permission: p.permission },
        },
        update: { enabled: p.enabled },
        create: { companyId, role, permission: p.permission, enabled: p.enabled },
      })
    );

  await prisma.$transaction(ops);

  return NextResponse.json({ ok: true, updated: ops.length });
}
