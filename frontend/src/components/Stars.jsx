export default function Stars({ value = 0, outOf = 5 }) {
  const full = Math.round(value);
  return (
    <span>
      {Array.from({ length: outOf }).map((_, i) => (
        <span key={i} className={`star ${i < full ? "" : "off"}`}>★</span>
      ))}
    </span>
  );
}
