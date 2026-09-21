"use client";

import { useState } from "react";
import { useTransition } from "react";
import {
  ONBOARDING,
  isVisible,
  validate,
  type Answers,
  type Field,
  type Section,
} from "@/lib/onboarding";
import { saveOnboarding } from "@/app/portal/onboarding-actions";

export function OnboardingForm({
  initial,
  sections = ONBOARDING,
  submitLabel = "Save and get started",
  onlyEditable = false,
}: {
  initial: Answers;
  sections?: Section[];
  submitLabel?: string;
  onlyEditable?: boolean;
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function set(key: string, value: string | string[]) {
    setAnswers((a) => ({ ...a, [key]: value }));
    setError(null);
    setSaved(false);
  }

  function toggle(key: string, value: string) {
    const current = Array.isArray(answers[key]) ? (answers[key] as string[]) : [];
    set(
      key,
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  }

  function submit() {
    // Validate the whole form when onboarding, but only what's on screen when
    // editing delivery preferences — the rest isn't being changed.
    const toCheck = onlyEditable
      ? { ...initial, ...answers }
      : answers;
    const problem = validate(toCheck);
    if (problem && !onlyEditable) {
      setError(problem);
      return;
    }
    if (onlyEditable && problem) {
      // Only block on problems in fields actually shown here.
      const shown = sections.flatMap((s) => s.fields).map((f) => f.label);
      if (shown.some((l) => problem.startsWith(l))) {
        setError(problem);
        return;
      }
    }

    start(async () => {
      const r = await saveOnboarding(toCheck, onlyEditable);
      if (r.ok) {
        setSaved(true);
        setError(null);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="grid gap-6">
      {sections.map((section) => {
        const fields = section.fields.filter(
          (f) => (!onlyEditable || f.editable) && isVisible(f, answers)
        );
        if (fields.length === 0) return null;

        return (
          <div key={section.title} className="card p-6 sm:p-8">
            <h2 className="text-xl mb-6">{section.title}</h2>
            <div className="grid gap-5">
              {fields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  answers={answers}
                  set={set}
                  toggle={toggle}
                  disabled={pending}
                />
              ))}
            </div>
          </div>
        );
      })}

      {error && (
        <p className="text-sm text-danger animate-fade-in font-semibold">{error}</p>
      )}
      {saved && (
        <p className="text-sm text-ok animate-fade-in font-semibold">Saved.</p>
      )}

      <div>
        <button onClick={submit} disabled={pending} className="btn btn-primary btn-lg">
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  answers,
  set,
  toggle,
  disabled,
}: {
  field: Field;
  answers: Answers;
  set: (key: string, value: string | string[]) => void;
  toggle: (key: string, value: string) => void;
  disabled: boolean;
}) {
  const value = answers[field.key];

  return (
    <div className="animate-fade-in">
      <label className="label" htmlFor={field.key}>
        {field.label}
        {!field.required && (
          <span className="font-normal text-muted"> (optional)</span>
        )}
      </label>
      {field.help && <p className="text-sm text-muted mb-3 -mt-1">{field.help}</p>}

      {field.type === "radio" && (
        <div className="grid gap-2">
          {field.options?.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 rounded-xl border-1.5 p-4 cursor-pointer transition-colors ${
                value === o.value
                  ? "border-blue bg-blue-tint"
                  : "border-line hover:bg-panel"
              }`}
              style={{ borderWidth: "1.5px" }}
            >
              <input
                type="radio"
                name={field.key}
                value={o.value}
                checked={value === o.value}
                onChange={() => set(field.key, o.value)}
                disabled={disabled}
                className="mt-1 h-4 w-4 accent-[var(--color-blue)]"
              />
              <span className="text-body">{o.label}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === "checkbox" && (
        <div className="grid gap-2">
          {/* Always-on, shown so it's clear what they're getting on top. */}
          <div className="flex items-start gap-3 rounded-xl border p-4 border-line bg-panel">
            <input
              type="checkbox"
              checked
              disabled
              className="mt-1 h-4 w-4 accent-[var(--color-blue)]"
            />
            <span className="text-body">
              Portal notification{" "}
              <span className="text-muted">— always included</span>
            </span>
          </div>
          {field.options?.map((o) => {
            const on = Array.isArray(value) && value.includes(o.value);
            return (
              <label
                key={o.value}
                className={`flex items-start gap-3 rounded-xl p-4 cursor-pointer transition-colors ${
                  on ? "border-blue bg-blue-tint" : "border-line hover:bg-panel"
                }`}
                style={{ borderWidth: "1.5px", borderStyle: "solid" }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(field.key, o.value)}
                  disabled={disabled}
                  className="mt-1 h-4 w-4 accent-[var(--color-blue)]"
                />
                <span className="text-body">{o.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.type === "textarea" && (
        <textarea
          id={field.key}
          rows={4}
          className="field"
          value={(value as string) ?? ""}
          onChange={(e) => set(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      )}

      {["text", "tel", "email"].includes(field.type) && (
        <input
          id={field.key}
          type={field.type}
          className="field"
          value={(value as string) ?? ""}
          onChange={(e) => set(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          autoComplete={
            field.key === "phone" || field.key === "delivery_phone"
              ? "tel"
              : field.key === "email" || field.key === "delivery_email"
                ? "email"
                : "off"
          }
        />
      )}
    </div>
  );
}
