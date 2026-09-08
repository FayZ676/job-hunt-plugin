export default function Wordmark({
  size = 17,
  working = false,
  waiting = 0,
  className = "",
}: {
  size?: number;
  working?: boolean;
  waiting?: number;
  className?: string;
}) {
  return (
    <span
      style={{ fontSize: size }}
      className={`inline-flex shrink-0 items-center font-mono font-normal
        leading-none tracking-tight ${className}`}
    >
      <span className="text-soft">/</span>
      <span className="font-semibold text-base-content">job</span>
      {waiting ? (
        <span
          key={waiting}
          className="ml-[0.14em] inline-flex h-[0.95em] min-w-[0.5em] animate-arrive items-center
            justify-center px-[0.16em] bg-mark font-semibold text-mark-content tabular-nums"
          style={{ fontSize: "0.8em" }}
        >
          {waiting}
        </span>
      ) : (
        <span
          aria-hidden
          className={`ml-[0.14em] inline-block h-[0.95em] w-[0.5em] bg-mark ${working ? "animate-blink" : ""}`}
        />
      )}
    </span>
  );
}
