import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ className = "", variant = "primary", type, ...props }: ButtonProps) {
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      type={type ?? (props.onClick ? "button" : "submit")}
      {...props}
    />
  );
}
