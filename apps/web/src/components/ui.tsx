import React from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "gold" | "ghost";
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return <button className={cx("button", variant !== "default" && variant, className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cx("card", className)} {...props} />;
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("pill", className)} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("input", props.className)} {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("textarea", props.className)} {...props} />;
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("select", props.className)} {...props} />;
}

export function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" {...props} />;
}

type ToggleGroupProps = {
  value: string;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
  onValueChange: (value: string) => void;
};

export function ToggleGroup({ value, options, ariaLabel, onValueChange }: ToggleGroupProps) {
  return (
    <div className="language-toggle" aria-label={ariaLabel}>
      {options.map((option) => (
        <button key={option.value} className={value === option.value ? "active" : ""} onClick={() => onValueChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
