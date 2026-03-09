import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Decimal = Prisma.Decimal;
const D = (v: number | string | Decimal) => new Prisma.Decimal(String(v));

interface PayrollCalcResult {
  totalEarnings: Decimal;
  totalDeductions: Decimal;
  employerCosts: Decimal;
  netPay: Decimal;
  details: {
    conceptCode: string;
    conceptName: string;
    type: "EARNING" | "DEDUCTION" | "EMPLOYER_COST";
    quantity: number;
    rate: number;
    base: Decimal;
    amount: Decimal;
  }[];
  provisions: {
    prima: Decimal;
    cesantias: Decimal;
    cesantiasInterest: Decimal;
    vacations: Decimal;
  };
}

function arlRateForLevel(config: { arlRateLevel1: Decimal; arlRateLevel2: Decimal; arlRateLevel3: Decimal; arlRateLevel4: Decimal; arlRateLevel5: Decimal }, level: number): Decimal {
  const map: Record<number, Decimal> = {
    1: config.arlRateLevel1,
    2: config.arlRateLevel2,
    3: config.arlRateLevel3,
    4: config.arlRateLevel4,
    5: config.arlRateLevel5,
  };
  return map[level] ?? config.arlRateLevel1;
}

export async function calculateEmployeePayroll(
  employeeId: string,
  companyId: string,
  daysWorked: number = 30,
  extras?: { overtimeHours?: number; nightSurchargeHours?: number; sundayHours?: number; commissions?: number; bonuses?: number }
): Promise<PayrollCalcResult> {
  const config = await prisma.payrollConfig.findUnique({ where: { companyId } });
  if (!config) throw new Error("Payroll configuration not found for company");

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const details: PayrollCalcResult["details"] = [];
  let totalEarnings = D(0);
  let totalDeductions = D(0);
  let employerCosts = D(0);

  const baseSalary = employee.baseSalary;
  const minimumWage = config.minimumWage;
  const isIntegral = employee.salaryType === "INTEGRAL";
  const dailyRate = D(baseSalary.toNumber() / 30);
  const proratedSalary = D(dailyRate.toNumber() * daysWorked);

  details.push({
    conceptCode: "SAL",
    conceptName: "Salario Base",
    type: "EARNING",
    quantity: daysWorked,
    rate: 1,
    base: baseSalary,
    amount: proratedSalary,
  });
  totalEarnings = totalEarnings.add(proratedSalary);

  if (!isIntegral && baseSalary.lte(minimumWage.mul(2)) && daysWorked > 0) {
    const transportSubsidy = D(config.transportSubsidy.toNumber() * daysWorked / 30);
    details.push({
      conceptCode: "AUX_TRANS",
      conceptName: "Auxilio de Transporte",
      type: "EARNING",
      quantity: daysWorked,
      rate: 1,
      base: config.transportSubsidy,
      amount: transportSubsidy,
    });
    totalEarnings = totalEarnings.add(transportSubsidy);
  }

  const hourlyRate = D(baseSalary.toNumber() / 240);

  if (extras?.overtimeHours && extras.overtimeHours > 0) {
    const overtimeRate = 1.25;
    const amount = D(hourlyRate.toNumber() * overtimeRate * extras.overtimeHours);
    details.push({ conceptCode: "HE_D", conceptName: "Horas Extras Diurnas", type: "EARNING", quantity: extras.overtimeHours, rate: overtimeRate, base: hourlyRate, amount });
    totalEarnings = totalEarnings.add(amount);
  }

  if (extras?.nightSurchargeHours && extras.nightSurchargeHours > 0) {
    const nightRate = 1.75;
    const amount = D(hourlyRate.toNumber() * nightRate * extras.nightSurchargeHours);
    details.push({ conceptCode: "RN", conceptName: "Recargo Nocturno", type: "EARNING", quantity: extras.nightSurchargeHours, rate: nightRate, base: hourlyRate, amount });
    totalEarnings = totalEarnings.add(amount);
  }

  if (extras?.sundayHours && extras.sundayHours > 0) {
    const sundayRate = 1.75;
    const amount = D(hourlyRate.toNumber() * sundayRate * extras.sundayHours);
    details.push({ conceptCode: "RD", conceptName: "Recargo Dominical/Festivo", type: "EARNING", quantity: extras.sundayHours, rate: sundayRate, base: hourlyRate, amount });
    totalEarnings = totalEarnings.add(amount);
  }

  if (extras?.commissions && extras.commissions > 0) {
    const amount = D(extras.commissions);
    details.push({ conceptCode: "COM", conceptName: "Comisiones", type: "EARNING", quantity: 1, rate: 1, base: amount, amount });
    totalEarnings = totalEarnings.add(amount);
  }

  if (extras?.bonuses && extras.bonuses > 0) {
    const amount = D(extras.bonuses);
    details.push({ conceptCode: "BON", conceptName: "Bonificaciones", type: "EARNING", quantity: 1, rate: 1, base: amount, amount });
    totalEarnings = totalEarnings.add(amount);
  }

  const ibc = isIntegral ? D(baseSalary.toNumber() * 0.7) : totalEarnings;

  // Employee deductions
  const healthEmp = D(ibc.toNumber() * config.healthEmployeeRate.toNumber());
  details.push({ conceptCode: "SAL_EMP", conceptName: "Salud Empleado", type: "DEDUCTION", quantity: 1, rate: config.healthEmployeeRate.toNumber(), base: ibc, amount: healthEmp });
  totalDeductions = totalDeductions.add(healthEmp);

  const pensionEmp = D(ibc.toNumber() * config.pensionEmployeeRate.toNumber());
  details.push({ conceptCode: "PEN_EMP", conceptName: "Pensión Empleado", type: "DEDUCTION", quantity: 1, rate: config.pensionEmployeeRate.toNumber(), base: ibc, amount: pensionEmp });
  totalDeductions = totalDeductions.add(pensionEmp);

  const smlmvMultiple = baseSalary.toNumber() / minimumWage.toNumber();
  if (smlmvMultiple >= config.solidarityFundThreshold) {
    const solidarityAmount = D(ibc.toNumber() * config.solidarityFundRate.toNumber());
    details.push({ conceptCode: "FSP", conceptName: "Fondo Solidaridad Pensional", type: "DEDUCTION", quantity: 1, rate: config.solidarityFundRate.toNumber(), base: ibc, amount: solidarityAmount });
    totalDeductions = totalDeductions.add(solidarityAmount);
  }

  const withholding = calculateWithholdingTax(totalEarnings.toNumber(), config.uvtValue.toNumber(), employee.dependents, employee.voluntaryDeductions.toNumber());
  if (withholding > 0) {
    const whAmount = D(withholding);
    details.push({ conceptCode: "RET_FTE", conceptName: "Retención en la Fuente", type: "DEDUCTION", quantity: 1, rate: 0, base: totalEarnings, amount: whAmount });
    totalDeductions = totalDeductions.add(whAmount);
  }

  // Employer costs
  const healthEr = D(ibc.toNumber() * config.healthEmployerRate.toNumber());
  details.push({ conceptCode: "SAL_ER", conceptName: "Salud Empleador", type: "EMPLOYER_COST", quantity: 1, rate: config.healthEmployerRate.toNumber(), base: ibc, amount: healthEr });
  employerCosts = employerCosts.add(healthEr);

  const pensionEr = D(ibc.toNumber() * config.pensionEmployerRate.toNumber());
  details.push({ conceptCode: "PEN_ER", conceptName: "Pensión Empleador", type: "EMPLOYER_COST", quantity: 1, rate: config.pensionEmployerRate.toNumber(), base: ibc, amount: pensionEr });
  employerCosts = employerCosts.add(pensionEr);

  const arlRate = arlRateForLevel(config, employee.arlRiskLevel);
  const arlAmount = D(ibc.toNumber() * arlRate.toNumber());
  details.push({ conceptCode: "ARL", conceptName: "ARL", type: "EMPLOYER_COST", quantity: 1, rate: arlRate.toNumber(), base: ibc, amount: arlAmount });
  employerCosts = employerCosts.add(arlAmount);

  const compensationAmount = D(ibc.toNumber() * config.compensationRate.toNumber());
  details.push({ conceptCode: "CCF", conceptName: "Caja Compensación", type: "EMPLOYER_COST", quantity: 1, rate: config.compensationRate.toNumber(), base: ibc, amount: compensationAmount });
  employerCosts = employerCosts.add(compensationAmount);

  if (!isIntegral && baseSalary.lt(minimumWage.mul(10))) {
    const senaAmount = D(ibc.toNumber() * config.senaRate.toNumber());
    details.push({ conceptCode: "SENA", conceptName: "SENA", type: "EMPLOYER_COST", quantity: 1, rate: config.senaRate.toNumber(), base: ibc, amount: senaAmount });
    employerCosts = employerCosts.add(senaAmount);

    const icbfAmount = D(ibc.toNumber() * config.icbfRate.toNumber());
    details.push({ conceptCode: "ICBF", conceptName: "ICBF", type: "EMPLOYER_COST", quantity: 1, rate: config.icbfRate.toNumber(), base: ibc, amount: icbfAmount });
    employerCosts = employerCosts.add(icbfAmount);
  }

  // Provisions
  const provisionBase = isIntegral ? D(0) : totalEarnings;
  const prima = D(provisionBase.toNumber() * config.primaRate.toNumber());
  const cesantias = D(provisionBase.toNumber() * config.cesantiasRate.toNumber());
  const cesantiasInterest = D(cesantias.toNumber() * config.cesantiasInterestRate.toNumber() / 12);
  const vacations = D(provisionBase.toNumber() * config.vacationsRate.toNumber());

  const netPay = totalEarnings.sub(totalDeductions);

  return {
    totalEarnings,
    totalDeductions,
    employerCosts,
    netPay,
    details,
    provisions: { prima, cesantias, cesantiasInterest, vacations },
  };
}

function calculateWithholdingTax(monthlyIncome: number, uvt: number, dependents: number, voluntaryDeductions: number): number {
  let taxableIncome = monthlyIncome;
  taxableIncome -= monthlyIncome * 0.04; // health
  taxableIncome -= monthlyIncome * 0.04; // pension
  taxableIncome -= voluntaryDeductions;

  const dependentDeduction = Math.min(monthlyIncome * 0.10, 32 * uvt);
  taxableIncome -= dependentDeduction * Math.min(dependents, 1);

  const exempt25 = Math.min(taxableIncome * 0.25, 240 * uvt);
  taxableIncome -= exempt25;

  if (taxableIncome <= 0) return 0;

  const uvtIncome = taxableIncome / uvt;

  if (uvtIncome <= 95) return 0;
  if (uvtIncome <= 150) return (uvtIncome - 95) * 0.19 * uvt;
  if (uvtIncome <= 360) return ((uvtIncome - 150) * 0.28 + 55 * 0.19) * uvt;
  if (uvtIncome <= 640) return ((uvtIncome - 360) * 0.33 + 210 * 0.28 + 55 * 0.19) * uvt;
  if (uvtIncome <= 945) return ((uvtIncome - 640) * 0.35 + 280 * 0.33 + 210 * 0.28 + 55 * 0.19) * uvt;
  if (uvtIncome <= 2300) return ((uvtIncome - 945) * 0.37 + 305 * 0.35 + 280 * 0.33 + 210 * 0.28 + 55 * 0.19) * uvt;
  return ((uvtIncome - 2300) * 0.39 + 1355 * 0.37 + 305 * 0.35 + 280 * 0.33 + 210 * 0.28 + 55 * 0.19) * uvt;
}

export async function runPayrollCalculation(payrollRunId: string): Promise<void> {
  const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
  if (!run) throw new Error("Payroll run not found");
  if (run.status !== "DRAFT") throw new Error("Payroll run must be in DRAFT status");

  const employees = await prisma.employee.findMany({
    where: {
      companyId: run.companyId,
      isActive: true,
      ...(run.branchId ? { branchId: run.branchId } : {}),
    },
  });

  let runTotalEarnings = D(0);
  let runTotalDeductions = D(0);
  let runTotalEmployerCosts = D(0);
  let runNetPay = D(0);

  for (const emp of employees) {
    const periodDays = Math.ceil((run.periodEnd.getTime() - run.periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysWorked = Math.min(periodDays, 30);

    const calc = await calculateEmployeePayroll(emp.id, run.companyId, daysWorked);

    const item = await prisma.payrollItem.create({
      data: {
        payrollRunId: run.id,
        employeeId: emp.id,
        baseSalary: emp.baseSalary,
        daysWorked,
        totalEarnings: calc.totalEarnings,
        totalDeductions: calc.totalDeductions,
        employerCosts: calc.employerCosts,
        netPay: calc.netPay,
      },
    });

    for (const d of calc.details) {
      await prisma.payrollItemDetail.create({
        data: {
          payrollItemId: item.id,
          conceptCode: d.conceptCode,
          conceptName: d.conceptName,
          type: d.type,
          quantity: D(d.quantity),
          rate: D(d.rate),
          base: d.base,
          amount: d.amount,
        },
      });
    }

    await prisma.payrollProvision.upsert({
      where: {
        companyId_employeeId_period: {
          companyId: run.companyId,
          employeeId: emp.id,
          period: run.period,
        },
      },
      update: {
        primaAmount: calc.provisions.prima,
        cesantiasAmount: calc.provisions.cesantias,
        cesantiasInterestAmount: calc.provisions.cesantiasInterest,
        vacationsAmount: calc.provisions.vacations,
      },
      create: {
        companyId: run.companyId,
        employeeId: emp.id,
        period: run.period,
        primaAmount: calc.provisions.prima,
        cesantiasAmount: calc.provisions.cesantias,
        cesantiasInterestAmount: calc.provisions.cesantiasInterest,
        vacationsAmount: calc.provisions.vacations,
      },
    });

    runTotalEarnings = runTotalEarnings.add(calc.totalEarnings);
    runTotalDeductions = runTotalDeductions.add(calc.totalDeductions);
    runTotalEmployerCosts = runTotalEmployerCosts.add(calc.employerCosts);
    runNetPay = runNetPay.add(calc.netPay);
  }

  await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: "CALCULATED",
      totalEarnings: runTotalEarnings,
      totalDeductions: runTotalDeductions,
      totalEmployerCosts: runTotalEmployerCosts,
      netPay: runNetPay,
    },
  });
}
