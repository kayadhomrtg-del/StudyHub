import { useCallback, useEffect, useRef, useState } from "react";

import { extractMaterialText } from "./extractMaterialText";
import { isMaterialTextSupported } from "./materialTextSupport";
import { materialService } from "../materials/MaterialService";

export interface AiMaterialSource {
  id: string;
  title: string;
  text: string;
}

export interface AiMaterialSourceFailure {
  title: string;
  message: string;
  retry: boolean;
  backTo: string;
  backLabel: string;
}

export type AiMaterialSourceState =
  | { status: "loading" }
  | { status: "ready"; source: AiMaterialSource }
  | { status: "error"; failure: AiMaterialSourceFailure };

export function useMaterialAiSource(
  materialId: string | undefined,
  featureLabel: string,
) {
  const [state, setState] = useState<AiMaterialSourceState>({
    status: "loading",
  });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    const backToMaterial = (id: string) => ({
      backTo: `/materials/${id}`,
      backLabel: "Back to material",
    });

    if (!materialId) {
      setState({
        status: "error",
        failure: {
          title: "Material not found",
          message: `This ${featureLabel} link is missing its material ID.`,
          retry: false,
          backTo: "/materials",
          backLabel: "Back to materials",
        },
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const material = await materialService.getById(materialId);
      if (currentRequest !== requestId.current) return;

      if (!material) {
        setState({
          status: "error",
          failure: {
            title: "Material not found",
            message: "This material could not be found in local storage.",
            retry: true,
            backTo: "/materials",
            backLabel: "Back to materials",
          },
        });
        return;
      }

      if (!isMaterialTextSupported(material)) {
        setState({
          status: "error",
          failure: {
            title: `${featureLabel} not available for this file type`,
            message:
              "Only text, PDF, Word, PowerPoint, and spreadsheet files can be processed locally. This material's text cannot be extracted.",
            retry: false,
            ...backToMaterial(material.id),
          },
        });
        return;
      }

      const file = await materialService.getFile(material.id);
      if (currentRequest !== requestId.current) return;

      if (!file) {
        setState({
          status: "error",
          failure: {
            title: "Original file is missing",
            message:
              "The original file bytes are missing from local storage, so there is no text to use.",
            retry: true,
            ...backToMaterial(material.id),
          },
        });
        return;
      }

      const extracted = await extractMaterialText(material, file.bytes);
      if (currentRequest !== requestId.current) return;

      if (!extracted.ok) {
        setState({
          status: "error",
          failure: {
            title: `${featureLabel} source unavailable`,
            message: extracted.message,
            retry: true,
            ...backToMaterial(material.id),
          },
        });
        return;
      }

      setState({
        status: "ready",
        source: {
          id: material.id,
          title: material.title,
          text: extracted.value.text,
        },
      });
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setState({
        status: "error",
        failure: {
          title: `${featureLabel} source unavailable`,
          message:
            error instanceof Error
              ? error.message
              : "The material could not be prepared locally.",
          retry: true,
          ...backToMaterial(materialId),
        },
      });
    }
  }, [featureLabel, materialId]);

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  return { state, retry: load };
}
