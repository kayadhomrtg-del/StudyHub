import { extractMaterialText } from "../ai/extractMaterialText";
import { isMaterialTextSupported } from "../ai/materialTextSupport";
import { materialService } from "../materials/MaterialService";
import type { MaterialRecord } from "../materials/material";
import { studySessionService } from "./StudySessionService";
import type { StudySessionRecord } from "./studySession";

export interface StudySessionSource {
  session: StudySessionRecord;
  material: MaterialRecord;
  text: string;
  notes: string[];
}

export async function loadStudySessionSource(
  sessionId: string | undefined,
): Promise<StudySessionSource> {
  if (!sessionId) throw new Error("This guided recall link is missing its study session ID.");

  const session = await studySessionService.getById(sessionId);
  if (!session) throw new Error("This study session could not be found in local storage.");
  if (session.status !== "planned") {
    throw new Error("Guided recall is available only for planned study sessions.");
  }
  if (!session.materialId) {
    throw new Error("This study session is not linked to a material.");
  }

  const material = await materialService.getById(session.materialId);
  if (!material) throw new Error("The material linked to this study session could not be found.");
  if (!isMaterialTextSupported(material)) {
    throw new Error("This material type cannot be read locally. Choose text, PDF, Word, PowerPoint, or spreadsheet material.");
  }

  const file = await materialService.getFile(material.id);
  if (!file) throw new Error("The original file bytes are missing from local storage.");

  const extracted = await extractMaterialText(material, file.bytes);
  if (!extracted.ok) throw new Error(extracted.message);
  if (!extracted.value.text.trim()) {
    throw new Error(
      extracted.value.notes.join(" ") || "No readable text could be extracted from this material.",
    );
  }

  return {
    session,
    material,
    text: extracted.value.text,
    notes: extracted.value.notes,
  };
}
