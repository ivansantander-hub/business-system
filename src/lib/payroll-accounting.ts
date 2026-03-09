import { prisma } from "@/lib/prisma";
import { createJournalEntry } from "@/lib/accounting";

export async function generatePayrollJournalEntries(payrollRunId: string): Promise<void> {
  const run = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: {
      items: {
        include: {
          details: true,
          employee: true,
        },
      },
    },
  });

  if (!run) throw new Error("Payroll run not found");

  let totalSalaries = 0;
  let totalTransportSubsidy = 0;
  let totalHealthEmployee = 0;
  let totalPensionEmployee = 0;
  let totalWithholding = 0;
  let totalSolidarityFund = 0;
  let totalHealthEmployer = 0;
  let totalPensionEmployer = 0;
  let totalArl = 0;
  let totalCompensation = 0;
  let totalSena = 0;
  let totalIcbf = 0;
  let totalNetPay = 0;
  let totalPrima = 0;
  let totalCesantias = 0;
  let totalCesantiasInterest = 0;
  let totalVacations = 0;

  for (const item of run.items) {
    totalNetPay += item.netPay.toNumber();

    for (const d of item.details) {
      const amount = d.amount.toNumber();
      switch (d.conceptCode) {
        case "SAL": case "HE_D": case "RN": case "RD": case "COM": case "BON":
          totalSalaries += amount; break;
        case "AUX_TRANS": totalTransportSubsidy += amount; break;
        case "SAL_EMP": totalHealthEmployee += amount; break;
        case "PEN_EMP": totalPensionEmployee += amount; break;
        case "RET_FTE": totalWithholding += amount; break;
        case "FSP": totalSolidarityFund += amount; break;
        case "SAL_ER": totalHealthEmployer += amount; break;
        case "PEN_ER": totalPensionEmployer += amount; break;
        case "ARL": totalArl += amount; break;
        case "CCF": totalCompensation += amount; break;
        case "SENA": totalSena += amount; break;
        case "ICBF": totalIcbf += amount; break;
      }
    }
  }

  const provisions = await prisma.payrollProvision.findMany({
    where: { companyId: run.companyId, period: run.period },
  });

  for (const p of provisions) {
    totalPrima += p.primaAmount.toNumber();
    totalCesantias += p.cesantiasAmount.toNumber();
    totalCesantiasInterest += p.cesantiasInterestAmount.toNumber();
    totalVacations += p.vacationsAmount.toNumber();
  }

  const lines: { accountCode: string; debit: number; credit: number; description?: string }[] = [];

  if (totalSalaries > 0) lines.push({ accountCode: "5105", debit: totalSalaries, credit: 0, description: "Gastos Salarios" });
  if (totalTransportSubsidy > 0) lines.push({ accountCode: "5195", debit: totalTransportSubsidy, credit: 0, description: "Auxilio de Transporte" });
  if (totalHealthEmployer > 0) lines.push({ accountCode: "5105", debit: totalHealthEmployer, credit: 0, description: "Aporte Salud Empleador" });
  if (totalPensionEmployer > 0) lines.push({ accountCode: "5105", debit: totalPensionEmployer, credit: 0, description: "Aporte Pensión Empleador" });
  if (totalArl > 0) lines.push({ accountCode: "5105", debit: totalArl, credit: 0, description: "ARL" });
  if (totalCompensation > 0) lines.push({ accountCode: "5105", debit: totalCompensation, credit: 0, description: "Caja Compensación" });
  if (totalSena > 0) lines.push({ accountCode: "5105", debit: totalSena, credit: 0, description: "SENA" });
  if (totalIcbf > 0) lines.push({ accountCode: "5105", debit: totalIcbf, credit: 0, description: "ICBF" });

  if (totalPrima > 0) lines.push({ accountCode: "5105", debit: totalPrima, credit: 0, description: "Provisión Prima" });
  if (totalCesantias > 0) lines.push({ accountCode: "5105", debit: totalCesantias, credit: 0, description: "Provisión Cesantías" });
  if (totalCesantiasInterest > 0) lines.push({ accountCode: "5105", debit: totalCesantiasInterest, credit: 0, description: "Provisión Intereses Cesantías" });
  if (totalVacations > 0) lines.push({ accountCode: "5105", debit: totalVacations, credit: 0, description: "Provisión Vacaciones" });

  if (totalNetPay > 0) lines.push({ accountCode: "2505", debit: 0, credit: totalNetPay, description: "Salarios por Pagar" });
  if (totalHealthEmployee > 0) lines.push({ accountCode: "2404", debit: 0, credit: totalHealthEmployee, description: "Aportes Salud Empleado" });
  if (totalPensionEmployee > 0) lines.push({ accountCode: "2404", debit: 0, credit: totalPensionEmployee, description: "Aportes Pensión Empleado" });
  if (totalSolidarityFund > 0) lines.push({ accountCode: "2404", debit: 0, credit: totalSolidarityFund, description: "Fondo Solidaridad" });
  if (totalWithholding > 0) lines.push({ accountCode: "2365", debit: 0, credit: totalWithholding, description: "Retención en la Fuente" });

  const totalEmployerSS = totalHealthEmployer + totalPensionEmployer + totalArl + totalCompensation + totalSena + totalIcbf;
  if (totalEmployerSS > 0) lines.push({ accountCode: "2404", debit: 0, credit: totalEmployerSS, description: "Aportes SS Empleador" });

  if (totalPrima > 0) lines.push({ accountCode: "2510", debit: 0, credit: totalPrima, description: "Provisión Prima" });
  if (totalCesantias > 0) lines.push({ accountCode: "2510", debit: 0, credit: totalCesantias, description: "Provisión Cesantías" });
  if (totalCesantiasInterest > 0) lines.push({ accountCode: "2510", debit: 0, credit: totalCesantiasInterest, description: "Provisión Int. Cesantías" });
  if (totalVacations > 0) lines.push({ accountCode: "2510", debit: 0, credit: totalVacations, description: "Provisión Vacaciones" });

  if (lines.length > 0) {
    const periodStr = run.period.toISOString().slice(0, 7);
    await prisma.$transaction(async (tx) => {
      await createJournalEntry(
        tx as Parameters<typeof createJournalEntry>[0],
        run.companyId,
        `Nómina ${periodStr}`,
        `NOM-${payrollRunId.slice(0, 8)}`,
        lines
      );
    });
  }
}
