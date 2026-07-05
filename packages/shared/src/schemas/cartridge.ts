import { z } from 'zod';

export const createCartridgeSchema = z.object({
  name: z.string().min(1).max(60),
});
export type CreateCartridgeInput = z.infer<typeof createCartridgeSchema>;

export interface Cartridge {
  id: string;
  name: string;
}
