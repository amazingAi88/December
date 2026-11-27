import React from 'react';
import { ArrowLeft, AlertTriangle, Info } from 'lucide-react';

interface StudioTopBarProps {
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function StudioTopBar({ title, subtitle, onBack, actions }: StudioTopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#36304E] bg-[#0D0B14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#36304E] bg-[#151221] text-[#F7F4EF] transition-colors hover:border-[#FFB347]/60 hover:bg-[#1F1B2E] cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-bold tracking-tight text-[#F7F4EF]">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-[#B3ACC8]">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

interface StudioSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}

export function StudioSwitch({ checked, onChange, ariaLabel }: StudioSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
        checked
          ? 'border-[#34D399] bg-[#10B981]'
          : 'border-[#7B7399] bg-[#2A253D]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full shadow transition-transform ${
          checked ? 'translate-x-6 bg-white' : 'translate-x-1 bg-[#D0CADF]'
        }`}
      />
    </button>
  );
}

export function StatusPill({
  label,
  tone = 'NEUTRAL',
}: {
  label: string;
  tone?: 'SUCCESS' | 'ACTIVE' | 'WARN' | 'ERROR' | 'NEUTRAL';
}) {
  const styles: Record<string, string> = {
    SUCCESS: 'border-[#34D399]/35 bg-[#0E3325] text-[#34D399]',
    ACTIVE: 'border-[#38BDF8]/35 bg-[#0F2D3E] text-[#38BDF8]',
    WARN: 'border-[#FBBF24]/35 bg-[#3B2C09] text-[#FBBF24]',
    ERROR: 'border-[#F87171]/35 bg-[#44161A] text-[#F87171]',
    NEUTRAL: 'border-[#36304E] bg-[#1F1B2E] text-[#B3ACC8]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
        styles[tone] || styles.NEUTRAL
      }`}
    >
      {label}
    </span>
  );
}

export function StepHeaderRow({
  stepNumber,
  stepName,
  totalSteps = 3,
}: {
  stepNumber: number;
  stepName: string;
  totalSteps?: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#36304E] bg-[#151221] px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFB347] font-mono text-xs font-bold text-[#1E1100]">
          {stepNumber}
        </span>
        <span className="font-display text-sm font-semibold text-[#F7F4EF]">
          {stepName}
        </span>
      </div>
      <span className="font-mono text-xs text-[#B3ACC8]">
        Step {stepNumber} / {totalSteps}
      </span>
    </div>
  );
}

export function StudioDisclosureCard({
  title,
  body,
  isWarning = false,
  icon,
}: {
  title: string;
  body: string;
  isWarning?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        isWarning
          ? 'border-[#FBBF24]/40 bg-[#3B2C09]/40'
          : 'border-[#36304E] bg-[#151221]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${isWarning ? 'text-[#FBBF24]' : 'text-[#FFB347]'}`}>
          {icon || (isWarning ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />)}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#F7F4EF]">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#B3ACC8]">{body}</p>
        </div>
      </div>
    </div>
  );
}

export function StudioChip({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[36px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
        selected
          ? 'border-[#FFB347] bg-[#FFB347] text-[#1E1100]'
          : 'border-[#5D557A] bg-[#1D192B] text-[#E6E1F2] hover:border-[#FFB347]/60'
      }`}
    >
      {label}
    </button>
  );
}

export function ToolRoleTag({
  role,
  tone = 'CYAN',
}: {
  role: string;
  tone?: 'CYAN' | 'GOLD' | 'EMERALD' | 'CORAL';
}) {
  const palette: Record<string, string> = {
    CYAN: 'border-[#38BDF8]/35 bg-[#0F2D3E] text-[#38BDF8]',
    GOLD: 'border-[#FFB347]/35 bg-[#3E290E] text-[#FFB347]',
    EMERALD: 'border-[#34D399]/35 bg-[#0E3325] text-[#34D399]',
    CORAL: 'border-[#FF6B4A]/35 bg-[#421A13] text-[#FF6B4A]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${
        palette[tone] || palette.CYAN
      }`}
    >
      {role}
    </span>
  );
}
