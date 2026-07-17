"use client";

import Avatar from "boring-avatars";

const PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#0ea5e9",
  "#a855f7",
  "#14b8a6",
  "#e11d48",
];

const VARIANTS = ["beam", "marble", "pixel", "sunset", "ring", "bauhaus"] as const;

export function getInitials(name: string | null, phone: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

/** Color Tailwind de respaldo (p.ej. si no se usa el SVG). */
export function getAvatarColorClass(id: number): string {
  const classes = [
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-sky-500",
    "bg-purple-500",
    "bg-teal-500",
  ];
  return classes[id % classes.length];
}

function avatarSeed(id: number, name: string | null, phone: string): string {
  return `${id}-${name?.trim() || phone}`;
}

function avatarVariant(id: number): (typeof VARIANTS)[number] {
  return VARIANTS[id % VARIANTS.length];
}

interface ChatAvatarProps {
  id: number;
  name: string | null;
  phone: string;
  size?: number;
  className?: string;
}

/** Avatar SVG estable por chat (mismo id = mismo icono). */
export function ChatAvatar({ id, name, phone, size = 36, className = "" }: ChatAvatarProps) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
      title={name || phone}
    >
      <Avatar
        size={size}
        name={avatarSeed(id, name, phone)}
        variant={avatarVariant(id)}
        colors={PALETTE}
      />
    </span>
  );
}
