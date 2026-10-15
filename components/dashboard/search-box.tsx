"use client";

/** "Search customer name" box used on the Approve, Payments and Batch tabs. */
export function SearchBox({ value, onChange, count }: { value: string; onChange: (v: string) => void; count: number }) {
  return (
    <div className="field" role="search">
      <label className="field-label" htmlFor="customer-search">
        Search customer name
      </label>
      <input
        id="customer-search"
        className="input"
        type="search"
        autoComplete="off"
        placeholder="Name or order number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value.trim() && (
        <span className="form-note" aria-live="polite">
          {count} match{count === 1 ? "" : "es"}
        </span>
      )}
    </div>
  );
}
