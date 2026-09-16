import { useRef, useState, useEffect } from "react";
import s from "./custom-select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  isCurrent?: boolean;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  aria?: string;
}

export default function CustomSelect({ id, value, options, onChange, disabled = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={s.container}>
      <button
        id={id}
        className={`${s.trigger} ${isOpen ? s.open : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={s.value}>{selectedOption?.label || "Select..."}</span>
        <svg className={s.chevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      </button>

      {isOpen && (
        <ul className={s.menu} role="listbox">
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={value === option.value}>
              <button
                className={`${s.option} ${value === option.value ? s.selected : ""}`}
                onClick={() => handleSelect(option.value)}
                type="button"
              >
                <span className={s.label}>{option.label}</span>
                {value === option.value && (
                  <svg className={s.checkmark} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M20 6L9 17l-5-5"></path>
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
