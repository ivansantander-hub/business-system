import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

const CONFIG_FIELDS = [
  "retentionYears",
  "dianResolution",
  "dianPrefix",
  "dianRangeFrom",
  "dianRangeTo",
  "economicActivity",
  "taxResponsibilities",
  "electronicInvoicingEnabled",
  "dianTechnicalKey",
  "dianEnvironment",
  "dianSoftwareId",
  "dianSoftwarePin",
  "dianTestSetId",
] as const;

export type CompanyConfig = {
  retentionYears: number;
  dianResolution: string | null;
  dianPrefix: string | null;
  dianRangeFrom: number | null;
  dianRangeTo: number | null;
  economicActivity: string | null;
  taxResponsibilities: string | null;
  electronicInvoicingEnabled: boolean;
  dianTechnicalKey: string | null;
  dianEnvironment: string | null;
  dianSoftwareId: string | null;
  dianSoftwarePin: string | null;
  dianTestSetId: string | null;
};

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      retentionYears: true,
      dianResolution: true,
      dianPrefix: true,
      dianRangeFrom: true,
      dianRangeTo: true,
      economicActivity: true,
      taxResponsibilities: true,
      electronicInvoicingEnabled: true,
      dianTechnicalKey: true,
      dianEnvironment: true,
      dianSoftwareId: true,
      dianSoftwarePin: true,
      dianTestSetId: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const config: CompanyConfig = {
    retentionYears: company.retentionYears,
    dianResolution: company.dianResolution,
    dianPrefix: company.dianPrefix,
    dianRangeFrom: company.dianRangeFrom,
    dianRangeTo: company.dianRangeTo,
    economicActivity: company.economicActivity,
    taxResponsibilities: company.taxResponsibilities,
    electronicInvoicingEnabled: company.electronicInvoicingEnabled,
    dianTechnicalKey: company.dianTechnicalKey,
    dianEnvironment: company.dianEnvironment,
    dianSoftwareId: company.dianSoftwareId,
    dianSoftwarePin: company.dianSoftwarePin,
    dianTestSetId: company.dianTestSetId,
  };

  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const body = await request.json();

  const data: Record<string, unknown> = {};
  for (const key of CONFIG_FIELDS) {
    if (key in body) {
      const value = body[key];
      if (key === "retentionYears") {
        const num = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
        if (!Number.isNaN(num) && num >= 1 && num <= 30) {
          data[key] = num;
        }
      } else if (key === "electronicInvoicingEnabled") {
        data[key] = typeof value === "boolean" ? value : value === "true" || value === true;
      } else if (key === "dianRangeFrom" || key === "dianRangeTo") {
        if (value === "" || value === null || value === undefined) {
          data[key] = null;
        } else {
          const num = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
          if (!Number.isNaN(num)) data[key] = num;
        }
      } else {
        data[key] = value === "" || value === null || value === undefined ? null : String(value);
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  await prisma.company.update({
    where: { id: companyId },
    data,
  });

  return NextResponse.json({ ok: true });
}
