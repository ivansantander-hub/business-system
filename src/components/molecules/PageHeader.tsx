/**
 * PageHeader - Page title with icon and optional actions.
 *
 * @level Molecule
 * @example
 * <PageHeader icon={<Package />} title="Productos" actions={<Button>Nuevo</Button>} />
 */

export interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
      <div className="flex items-center gap-3 min-w-0">
        <div className="page-icon flex-shrink-0" aria-hidden="true">{icon}</div>
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 sm:ml-auto flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
