/**
 * DataTable - Responsive table wrapper with headers.
 *
 * @level Molecule
 * @example
 * <DataTable
 *   headers={["Nombre", "Email", "Rol"]}
 *   empty={items.length === 0}
 *   emptyMessage="Sin resultados"
 * >
 *   {items.map(i => <tr key={i.id}>...</tr>)}
 * </DataTable>
 */

export interface DataTableProps {
  headers: { label: string; className?: string }[];
  children: React.ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
}

export default function DataTable({ headers, children, empty, emptyMessage = "Sin datos", emptyIcon }: DataTableProps) {
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`table-header ${i === 0 ? "rounded-l-lg" : ""} ${i === headers.length - 1 ? "rounded-r-lg" : ""} ${h.className || ""}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="table-cell text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  {emptyIcon && <span className="text-slate-300 dark:text-slate-600">{emptyIcon}</span>}
                  <span className="text-muted">{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
