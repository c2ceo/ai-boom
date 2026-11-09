export const SCHNELL_FREE_LIMIT = 1_000_000;
export const IMAGE_MODELS = {
  schnell: { label: "FLUX Schnell", endpoint: "fal-ai/flux/schnell", credits: 1 },
  dev: { label: "FLUX Dev", endpoint: "fal-ai/flux/dev", credits: 5 },
  pro: { label: "FLUX 1.1 Pro", endpoint: "fal-ai/flux-pro/v1.1", credits: 8 },
} as const;
export type ImageModel = keyof typeof IMAGE_MODELS;
export function imageCreditCost(model: ImageModel, freeReserved: number): number {
  return model === "schnell" && freeReserved < SCHNELL_FREE_LIMIT ? 0 : IMAGE_MODELS[model].credits;
}