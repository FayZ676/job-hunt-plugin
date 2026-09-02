export default function Wordmark({ size = 17, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      style={{ fontSize: size }}
      className={`inline-flex shrink-0 items-center font-mono font-normal
        leading-none tracking-tight ${className}`}
    >
      <span className="text-soft">/</span>
      <span className="font-semibold text-base-content">job</span>
      <span aria-hidden className="ml-[0.14em] inline-block h-[0.95em] w-[0.5em] bg-blip" />
    </span>
  );
}
