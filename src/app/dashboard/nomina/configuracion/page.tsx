"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Loader2 } from "lucide-react";
import Toast from "@/components/ui/Toast";
import { Button, Input } from "@/components/atoms";
import PageHeader from "@/components/molecules/PageHeader";

interface PayrollConfig {
  id?: string;
  companyId?: string;
  minimumWage?: number;
  transportSubsidy?: number;
  uvtValue?: number;
  payrollFrequency?: string;
  healthEmployeeRate?: number;
  pensionEmployeeRate?: number;
  healthEmployerRate?: number;
  pensionEmployerRate?: number;
  arlRateLevel1?: number;
  arlRateLevel2?: number;
  arlRateLevel3?: number;
  arlRateLevel4?: number;
  arlRateLevel5?: number;
  compensationRate?: number;
  senaRate?: number;
  icbfRate?: number;
  primaRate?: number;
  cesantiasRate?: number;
  cesantiasInterestRate?: number;
  vacationsRate?: number;
  solidarityFundThreshold?: number;
  solidarityFundRate?: number;
}

const toDisplay = (v: number | string | undefined, isPercent: boolean): string => {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  if (n == null || Number.isNaN(n)) return "";
  return isPercent ? String((n * 100).toFixed(2)) : String(n);
};

const fromDisplay = (s: string, isPercent: boolean): number => {
  const n = Number.parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return isPercent ? n / 100 : n;
};

export default function ConfiguracionNominaPage() {
  const [config, setConfig] = useState<PayrollConfig>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        const f: Record<string, string> = {};
        const percentKeys = [
          "healthEmployeeRate",
          "pensionEmployeeRate",
          "healthEmployerRate",
          "pensionEmployerRate",
          "arlRateLevel1",
          "arlRateLevel2",
          "arlRateLevel3",
          "arlRateLevel4",
          "arlRateLevel5",
          "compensationRate",
          "senaRate",
          "icbfRate",
          "primaRate",
          "cesantiasRate",
          "cesantiasInterestRate",
          "vacationsRate",
          "solidarityFundRate",
        ];
        const currencyKeys = ["minimumWage", "transportSubsidy", "uvtValue"];
        const numKeys = ["solidarityFundThreshold"];
        for (const k of percentKeys) {
          f[k] = toDisplay(data[k], true);
        }
        for (const k of currencyKeys) {
          f[k] = toDisplay(data[k], false);
        }
        for (const k of numKeys) {
          f[k] = toDisplay(data[k], false);
        }
        f.payrollFrequency = data.payrollFrequency ?? "MONTHLY";
        setForm(f);
      }
    } catch {
      setToast({ message: "Error al cargar configuración", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const percentKeys = [
        "healthEmployeeRate",
        "pensionEmployeeRate",
        "healthEmployerRate",
        "pensionEmployerRate",
        "arlRateLevel1",
        "arlRateLevel2",
        "arlRateLevel3",
        "arlRateLevel4",
        "arlRateLevel5",
        "compensationRate",
        "senaRate",
        "icbfRate",
        "primaRate",
        "cesantiasRate",
        "cesantiasInterestRate",
        "vacationsRate",
        "solidarityFundRate",
      ];
      const body: Record<string, number | string> = {
        minimumWage: fromDisplay(form.minimumWage, false),
        transportSubsidy: fromDisplay(form.transportSubsidy, false),
        uvtValue: fromDisplay(form.uvtValue, false),
        payrollFrequency: form.payrollFrequency || "MONTHLY",
        solidarityFundThreshold: fromDisplay(form.solidarityFundThreshold, false),
      };
      for (const k of percentKeys) {
        body[k] = fromDisplay(form[k], true);
      }

      const res = await fetch("/api/payroll/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setToast({ message: "Configuración guardada", type: "success" });
        loadConfig();
      } else {
        const err = await res.json();
        setToast({ message: err?.error || "Error al guardar", type: "error" });
      }
    } catch {
      setToast({ message: "Error de conexión", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (loading && Object.keys(form).length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings className="w-5 h-5" />}
        title="Configuración de Nómina"
        actions={
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={saving}
          >
            Guardar
          </Button>
        }
      />

      <form onSubmit={handleSave} className="space-y-8">
        {/* General */}
        <section className="card p-4 sm:p-6">
          <h2 className="section-title mb-4">General</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="minimumWage" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Salario mínimo (COP)
              </label>
              <Input
                id="minimumWage"
                type="number"
                step="1"
                value={form.minimumWage ?? ""}
                onChange={(e) => updateForm("minimumWage", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="transportSubsidy" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Auxilio transporte (COP)
              </label>
              <Input
                id="transportSubsidy"
                type="number"
                step="1"
                value={form.transportSubsidy ?? ""}
                onChange={(e) => updateForm("transportSubsidy", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="uvtValue" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                UVT (COP)
              </label>
              <Input
                id="uvtValue"
                type="number"
                step="1"
                value={form.uvtValue ?? ""}
                onChange={(e) => updateForm("uvtValue", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="payrollFrequency" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Frecuencia de nómina
              </label>
              <select
                id="payrollFrequency"
                className="input-field w-full"
                value={form.payrollFrequency ?? "MONTHLY"}
                onChange={(e) => updateForm("payrollFrequency", e.target.value)}
              >
                <option value="MONTHLY">Mensual</option>
                <option value="BIWEEKLY">Quincenal</option>
                <option value="WEEKLY">Semanal</option>
              </select>
            </div>
          </div>
        </section>

        {/* Employee Rates */}
        <section className="card p-4 sm:p-6">
          <h2 className="section-title mb-4">Tasas Empleado</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="healthEmployeeRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Salud empleado (%)
              </label>
              <Input
                id="healthEmployeeRate"
                type="number"
                step="0.01"
                value={form.healthEmployeeRate ?? ""}
                onChange={(e) => updateForm("healthEmployeeRate", e.target.value)}
                placeholder="4"
              />
            </div>
            <div>
              <label htmlFor="pensionEmployeeRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Pensión empleado (%)
              </label>
              <Input
                id="pensionEmployeeRate"
                type="number"
                step="0.01"
                value={form.pensionEmployeeRate ?? ""}
                onChange={(e) => updateForm("pensionEmployeeRate", e.target.value)}
                placeholder="4"
              />
            </div>
          </div>
        </section>

        {/* Employer Rates */}
        <section className="card p-4 sm:p-6">
          <h2 className="section-title mb-4">Tasas Empleador</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="healthEmployerRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Salud empleador (%)
              </label>
              <Input
                id="healthEmployerRate"
                type="number"
                step="0.01"
                value={form.healthEmployerRate ?? ""}
                onChange={(e) => updateForm("healthEmployerRate", e.target.value)}
                placeholder="8.5"
              />
            </div>
            <div>
              <label htmlFor="pensionEmployerRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Pensión empleador (%)
              </label>
              <Input
                id="pensionEmployerRate"
                type="number"
                step="0.01"
                value={form.pensionEmployerRate ?? ""}
                onChange={(e) => updateForm("pensionEmployerRate", e.target.value)}
                placeholder="12"
              />
            </div>
          </div>
        </section>

        {/* ARL */}
        <section className="card p-4 sm:p-6">
          <h2 className="section-title mb-4">ARL (por nivel de riesgo)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>
                <label htmlFor={`arlRateLevel${n}`} className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nivel {n} (%)
                </label>
                <Input
                  id={`arlRateLevel${n}`}
                  type="number"
                  step="0.0001"
                  value={form[`arlRateLevel${n}`] ?? ""}
                  onChange={(e) => updateForm(`arlRateLevel${n}`, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Parafiscales */}
        <section className="card p-4 sm:p-6">
          <h2 className="section-title mb-4">Parafiscales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="compensationRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Caja de Compensación (%)
              </label>
              <Input
                id="compensationRate"
                type="number"
                step="0.01"
                value={form.compensationRate ?? ""}
                onChange={(e) => updateForm("compensationRate", e.target.value)}
                placeholder="4"
              />
            </div>
            <div>
              <label htmlFor="senaRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                SENA (%)
              </label>
              <Input
                id="senaRate"
                type="number"
                step="0.01"
                value={form.senaRate ?? ""}
                onChange={(e) => updateForm("senaRate", e.target.value)}
                placeholder="2"
              />
            </div>
            <div>
              <label htmlFor="icbfRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                ICBF (%)
              </label>
              <Input
                id="icbfRate"
                type="number"
                step="0.01"
                value={form.icbfRate ?? ""}
                onChange={(e) => updateForm("icbfRate", e.target.value)}
                placeholder="3"
              />
            </div>
          </div>
        </section>

        {/* Provisions */}
        <section className="card p-4 sm:p-6">
          <h2 className="section-title mb-4">Provisiones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="primaRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Prima (%)
              </label>
              <Input
                id="primaRate"
                type="number"
                step="0.01"
                value={form.primaRate ?? ""}
                onChange={(e) => updateForm("primaRate", e.target.value)}
                placeholder="8.33"
              />
            </div>
            <div>
              <label htmlFor="cesantiasRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Cesantías (%)
              </label>
              <Input
                id="cesantiasRate"
                type="number"
                step="0.01"
                value={form.cesantiasRate ?? ""}
                onChange={(e) => updateForm("cesantiasRate", e.target.value)}
                placeholder="8.33"
              />
            </div>
            <div>
              <label htmlFor="cesantiasInterestRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Intereses cesantías (%)
              </label>
              <Input
                id="cesantiasInterestRate"
                type="number"
                step="0.01"
                value={form.cesantiasInterestRate ?? ""}
                onChange={(e) => updateForm("cesantiasInterestRate", e.target.value)}
                placeholder="1"
              />
            </div>
            <div>
              <label htmlFor="vacationsRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Vacaciones (%)
              </label>
              <Input
                id="vacationsRate"
                type="number"
                step="0.01"
                value={form.vacationsRate ?? ""}
                onChange={(e) => updateForm("vacationsRate", e.target.value)}
                placeholder="4.17"
              />
            </div>
          </div>
        </section>

        {/* Solidarity Fund */}
        <section className="card p-4 sm:p-6">
          <h2 className="section-title mb-4">Fondo de Solidaridad Pensional</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="solidarityFundThreshold" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Umbral (múltiplo SMMLV)
              </label>
              <Input
                id="solidarityFundThreshold"
                type="number"
                step="0.1"
                value={form.solidarityFundThreshold ?? ""}
                onChange={(e) => updateForm("solidarityFundThreshold", e.target.value)}
                placeholder="4"
              />
            </div>
            <div>
              <label htmlFor="solidarityFundRate" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tasa (%)
              </label>
              <Input
                id="solidarityFundRate"
                type="number"
                step="0.01"
                value={form.solidarityFundRate ?? ""}
                onChange={(e) => updateForm("solidarityFundRate", e.target.value)}
                placeholder="1"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            Guardar configuración
          </Button>
        </div>
      </form>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
