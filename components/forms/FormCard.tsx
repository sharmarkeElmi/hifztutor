import type { PropsWithChildren, ReactNode } from "react";

export type FormCardProps = PropsWithChildren<{
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
}>;

export default function FormCard({ title, description, className = "", children }: FormCardProps) {
  return (
    <div className={`rounded-lg border-[3px] border-black bg-white p-6 sm:p-8 ${className}`} style={{ borderColor: "#000" }}>
      {title || description ? (
        <div className="space-y-3 mb-5">
          {title ? <h1 className="text-3xl font-semibold tracking-tight text-[#111629]">{title}</h1> : null}
          {description ? (
            <p className="text-sm leading-relaxed text-slate-600">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
