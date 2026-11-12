/** Placeholder mark: gradient square with a rotated inner square. */
export function Logo({ size = 30, inner = "var(--bg)" }: { size?: number; inner?: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid flex-none place-items-center bg-gradient-to-br from-em to-blue"
      style={{ width: size, height: size, borderRadius: size * 0.27 }}
    >
      <span
        style={{ width: size * 0.37, height: size * 0.37, borderRadius: 2, background: inner, transform: "rotate(45deg)" }}
      />
    </span>
  );
}
