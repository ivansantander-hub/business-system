/**
 * Avatar - User or entity visual identifier.
 *
 * @level Atom
 * @example
 * <Avatar name="Ivan Santander" size="md" />
 * <Avatar name="Ivan" size="lg" src="/api/profile/avatar" />
 */

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, { wrapper: string; text: string }> = {
  sm: { wrapper: "w-7 h-7", text: "text-[10px]" },
  md: { wrapper: "w-9 h-9", text: "text-xs" },
  lg: { wrapper: "w-12 h-12", text: "text-sm" },
  xl: { wrapper: "w-24 h-24", text: "text-2xl" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({ name = "", src, size = "md", className = "" }: AvatarProps) {
  const s = sizeClasses[size];

  if (src) {
    return (
      <div
        className={`${s.wrapper} rounded-xl overflow-hidden flex-shrink-0 ${className}`}
        aria-hidden="true"
      >
        <img
          src={src}
          alt={name || "Avatar"}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).parentElement!.classList.add("bg-gradient-accent", "flex", "items-center", "justify-center", "shadow-glow-sm");
            const span = document.createElement("span");
            span.className = `${s.text} font-bold text-white`;
            span.textContent = name ? getInitials(name) : "?";
            (e.target as HTMLImageElement).parentElement!.appendChild(span);
          }}
        />
      </div>
    );
  }

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
