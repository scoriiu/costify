interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  return (
    <div className="sticky top-14 z-40 flex h-13 items-center justify-between border-b border-dark-3 bg-dark/[0.88] px-7 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <h1 className="text-[20px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>{title}</h1>
      </div>
    </div>
  );
}
