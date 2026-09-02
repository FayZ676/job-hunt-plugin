export const MARK_PATHS = [
  "M19.07 4.93A10 10 0 0 0 6.99 3.34",
  "M2.29 9.62A10 10 0 1 0 21.31 8.35",
  "M16.24 7.76A6 6 0 1 0 8.23 16.67",
  "m13.41 10.59 5.66-5.66",
];

export const MARK_BLIP = { cx: 12, cy: 18, r: 1.5 };

export default function Mark({
  size = 18,
  strokeWidth = 1.5,
  className = "",
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={(strokeWidth * 24) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
      <circle {...MARK_BLIP} className="fill-blip" stroke="none" />
    </svg>
  );
}
