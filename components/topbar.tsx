"use client";

export default function TopBar({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="h-14 shrink-0 border-b border-linesub bg-panel/60 backdrop-blur flex items-center px-6 gap-4">
      <div className="min-w-0">
        <h1 className="text-[13.5px] font-[510] text-ink tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-[11px] text-faint leading-tight mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );
}
