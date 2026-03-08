/**
 * Avatar - User or entity visual identifier.
 *
 * @level Atom
 * @example
 * <Avatar name="Ivan Santander" size="md" />
 */

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  name?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, { wrapper: string; text: string }> = {
  sm: { wrapper: "w-7 h-7", text: "text-[10px]" },
  md: { wrapper: "w-9 h-9", text: "text-xs" },
  lg: { wrapper: "w-12 h-12", text: "text-sm" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({ name = "", size = "md", className = "" }: AvatarProps) {
  const s = sizeClasses[size];
  return (
    <div
      className={`${s.wrapper} bg-gradient-accent rounded-xl flex items-center justify-center shadow-glow-sm flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <span className={`${s.text} font-bold text-white`}>
        {name ? getInitials(name) : "?"}
      </span>
    </div>
  );
}
