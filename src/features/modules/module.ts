export interface ModuleRecord {
  id: string;
  name: string;
  code: string;
  semester?: string;
  academicYear?: string;
  lecturer?: string;
  description?: string;
  color?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleInput {
  name: string;
  code: string;
  semester: string;
  academicYear: string;
  lecturer: string;
  description: string;
  color: string;
}

export type ModuleField = keyof ModuleInput;
export type ModuleValidationErrors = Partial<Record<ModuleField, string>>;

export interface ModuleValidationResult {
  errors: ModuleValidationErrors;
  normalized: ModuleInput;
}

export function validateModuleInput(
  input: ModuleInput,
  existingModules: ModuleRecord[] = [],
  excludeId?: string,
): ModuleValidationResult {
  const normalized: ModuleInput = {
    name: input.name.trim(),
    code: input.code.trim(),
    semester: input.semester.trim(),
    academicYear: input.academicYear.trim(),
    lecturer: input.lecturer.trim(),
    description: input.description.trim(),
    color: input.color.trim(),
  };
  const errors: ModuleValidationErrors = {};

  if (!normalized.name) {
    errors.name = "Enter a module name.";
  } else if (normalized.name.length > 100) {
    errors.name = "Module names must be 100 characters or fewer.";
  }

  if (!normalized.code) {
    errors.code = "Enter a module code.";
  } else if (normalized.code.length > 30) {
    errors.code = "Module codes must be 30 characters or fewer.";
  } else if (
    existingModules.some(
      (module) =>
        module.id !== excludeId &&
        module.code.toLocaleLowerCase() === normalized.code.toLocaleLowerCase(),
    )
  ) {
    errors.code = "A module with this code already exists.";
  }

  if (normalized.semester.length > 50) {
    errors.semester = "Semester must be 50 characters or fewer.";
  }
  if (normalized.academicYear.length > 20) {
    errors.academicYear = "Academic year must be 20 characters or fewer.";
  }
  if (normalized.lecturer.length > 120) {
    errors.lecturer = "Lecturer must be 120 characters or fewer.";
  }
  if (normalized.description.length > 2000) {
    errors.description = "Description must be 2,000 characters or fewer.";
  }
  if (normalized.color && !/^#[\da-f]{6}$/i.test(normalized.color)) {
    errors.color = "Choose a valid six-digit accent color.";
  }

  return { errors, normalized };
}

export function toModuleInput(module: ModuleRecord): ModuleInput {
  return {
    name: module.name,
    code: module.code,
    semester: module.semester ?? "",
    academicYear: module.academicYear ?? "",
    lecturer: module.lecturer ?? "",
    description: module.description ?? "",
    color: module.color ?? "",
  };
}
