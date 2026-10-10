import { useId, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useModalFocus } from "../../components/ui/useModalFocus";
import {
  ModuleService,
  ModuleValidationError,
  moduleService,
} from "./ModuleService";
import {
  toModuleInput,
  type ModuleField,
  type ModuleInput,
  type ModuleRecord,
  type ModuleValidationErrors,
} from "./module";

interface ModuleFormDialogProps {
  module?: ModuleRecord;
  service?: ModuleService;
  onClose: () => void;
  onSaved: () => void;
}

const emptyInput: ModuleInput = {
  name: "",
  code: "",
  semester: "",
  academicYear: "",
  lecturer: "",
  description: "",
  color: "",
};

interface TextFieldProps {
  id: ModuleField;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  maxLength,
  placeholder,
}: TextFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-ink" htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-brand" aria-hidden="true">*</span>}
      </label>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        aria-required={required}
        autoComplete="off"
        className={`w-full rounded-xl border bg-canvas px-3 py-2.5 text-[13px] text-ink placeholder:text-muted/70 focus:border-brand focus:ring-brand ${
          error ? "border-red-400" : "border-line"
        }`}
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {error && (
        <p className="mt-1 text-[11px] text-red-700 dark:text-red-300" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function ModuleFormDialog({
  module,
  service = moduleService,
  onClose,
  onSaved,
}: ModuleFormDialogProps) {
  const [input, setInput] = useState<ModuleInput>(
    module ? toModuleInput(module) : emptyInput,
  );
  const [errors, setErrors] = useState<ModuleValidationErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(module);
  const titleId = useId();
  const { dialogRef, onKeyDown } = useModalFocus(
    true,
    onClose,
    () => document.getElementById("name"),
  );

  function updateField(field: ModuleField, value: string) {
    setInput((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError("");

    try {
      if (module) {
        await service.update(module.id, input);
      } else {
        await service.create(input);
      }
      onSaved();
    } catch (error) {
      if (error instanceof ModuleValidationError) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(
          error instanceof Error
            ? error.message
            : "The module could not be saved. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm">
      <section
        aria-describedby={`${titleId}-description`}
        aria-labelledby={titleId}
        aria-modal="true"
        className="my-auto w-full max-w-2xl rounded-[22px] border border-line bg-surface shadow-xl"
        onKeyDown={onKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4 sm:px-7">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brand">
              YOUR COURSEWORK
            </p>
            <h2
              className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-ink"
              id={titleId}
            >
              {isEditing ? "Edit module" : "Add a module"}
            </h2>
            <p className="mt-1 text-[11px] text-muted" id={`${titleId}-description`}>
              Your module details are saved only on this device.
            </p>
          </div>
          <button
            aria-label="Close module form"
            className="grid size-9 place-items-center rounded-xl text-muted hover:bg-subtle hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <form className="space-y-4 px-5 py-5 sm:px-7 sm:py-6" onSubmit={handleSubmit}>
          {formError && (
            <p
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              {formError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              error={errors.name}
              id="name"
              label="Module name"
              maxLength={100}
              onChange={(value) => updateField("name", value)}
              placeholder="e.g. Introduction to Biology"
              required
              value={input.name}
            />
            <TextField
              error={errors.code}
              id="code"
              label="Module code"
              maxLength={30}
              onChange={(value) => updateField("code", value)}
              placeholder="e.g. BIO 101"
              required
              value={input.code}
            />
            <TextField
              error={errors.semester}
              id="semester"
              label="Semester"
              maxLength={50}
              onChange={(value) => updateField("semester", value)}
              placeholder="e.g. Fall semester"
              value={input.semester}
            />
            <TextField
              error={errors.academicYear}
              id="academicYear"
              label="Academic year"
              maxLength={20}
              onChange={(value) => updateField("academicYear", value)}
              placeholder="e.g. 2026–2027"
              value={input.academicYear}
            />
            <TextField
              error={errors.lecturer}
              id="lecturer"
              label="Lecturer (optional)"
              maxLength={120}
              onChange={(value) => updateField("lecturer", value)}
              placeholder="Lecturer name"
              value={input.lecturer}
            />
            <div>
              <label
                className="mb-1.5 block text-[12px] font-medium text-ink"
                htmlFor="color"
              >
                Accent color (optional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  aria-describedby={errors.color ? "color-error" : undefined}
                  aria-invalid={Boolean(errors.color)}
                  className="size-10 cursor-pointer rounded-lg border border-line bg-canvas p-1"
                  id="color"
                  onChange={(event) => updateField("color", event.target.value)}
                  type="color"
                  value={input.color || "#396f4e"}
                />
                <span className="text-[11px] text-muted">
                  {input.color || "Use the default accent"}
                </span>
                {input.color && (
                  <button
                    className="ml-auto text-[11px] font-medium text-brand hover:text-brand-strong"
                    onClick={() => updateField("color", "")}
                    type="button"
                  >
                    Clear
                  </button>
                )}
              </div>
              {errors.color && (
                <p className="mt-1 text-[11px] text-red-700 dark:text-red-300" id="color-error">
                  {errors.color}
                </p>
              )}
            </div>
          </div>
          <div>
            <label
              className="mb-1.5 block text-[12px] font-medium text-ink"
              htmlFor="description"
            >
              Description (optional)
            </label>
            <textarea
              aria-describedby={errors.description ? "description-error" : undefined}
              aria-invalid={Boolean(errors.description)}
              className={`min-h-24 w-full resize-y rounded-xl border bg-canvas px-3 py-2.5 text-[13px] text-ink placeholder:text-muted/70 focus:border-brand focus:ring-brand ${
                errors.description ? "border-red-400" : "border-line"
              }`}
              id="description"
              maxLength={2000}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="A few words about this module"
              value={input.description}
            />
            {errors.description && (
              <p
                className="mt-1 text-[11px] text-red-700 dark:text-red-300"
                id="description-error"
              >
                {errors.description}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <button
              className="rounded-xl border border-line px-4 py-2.5 text-[12px] font-medium text-ink hover:bg-subtle"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving…" : isEditing ? "Save changes" : "Add module"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
