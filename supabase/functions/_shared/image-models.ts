import { creditsForCost } from './economics.ts';
export const SCHNELL_FREE_LIMIT = 10_000;
export const IMAGE_MODELS = {
  schnell: { label: "FLUX Schnell", tier: 'Fast', endpoint: "fal-ai/flux/schnell", credits: creditsForCost(0.003) },
  dev: { label: "FLUX Dev", tier: 'High Quality', endpoint: "fal-ai/flux/dev", credits: creditsForCost(0.025) },
  pro: { label: "FLUX 1.1 Pro", tier: 'Ultra Accuracy', endpoint: "fal-ai/flux-pro/v1.1", credits: creditsForCost(0.04) },
} as const;
export type ImageModel = keyof typeof IMAGE_MODELS;
export function imageCreditCost(model: ImageModel, freeReserved: number): number {
  return model === "schnell" && freeReserved < SCHNELL_FREE_LIMIT ? 0 : IMAGE_MODELS[model].credits;
}