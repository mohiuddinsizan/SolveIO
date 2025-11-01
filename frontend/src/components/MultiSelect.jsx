import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/multiselect.css";

/**
 * props:
 *  label: string
 *  options: string[] (lowercase)
 *  values: string[]
 *  onChange: (next: string[]) => void
 *  placeholder?: string
 */
export default function MultiSelect({ label, options = [], values = [], onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const set = new Set(values);
    return options
      .filter(o => !set.has(o))
      .filter(o => (t ? o.includes(t) : true));
  }, [q, options, values]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const add = (item) => {
    if (!values.includes(item)) onChange([...values, item]);
    setQ("");
    setOpen(false);
  };
  const remove = (item) => {
    onChange(values.filter(v => v !== item));
  };

  return (
    <div className="ms" ref={ref}>
      {label && <div className="ms-label">{label}</div>}
      <div className="ms-box" onClick={() => setOpen(true)}>
        {values.map(v => (
          <span key={v} className="ms-pill">
            {v}
            <button type="button" onClick={(e)=>{ e.stopPropagation(); remove(v); }}>×</button>
          </span>
        ))}
        <input
          className="ms-input"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onFocus={()=>setOpen(true)}
          placeholder={placeholder || "Type to filter…"}
        />
      </div>

      {open && (
        <div className="ms-menu">
          {filtered.length === 0 && <div className="ms-empty">No options</div>}
          {filtered.map(opt => (
            <div key={opt} className="ms-item" onClick={()=>add(opt)}>{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}
