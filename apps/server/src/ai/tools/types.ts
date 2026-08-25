import { z } from 'zod';

export interface ToolDefinition<Params extends z.ZodTypeAny, Result> {
  name: string;
  description: string;
  parameters: Params;
  handler: (userId: string, args: z.infer<Params>) => Promise<Result>;
}

/**
 * Type-erased form of ToolDefinition. `handler`'s parameter is contravariant, so a collection
 * mixing tools with different concrete Zod schemas can't be typed as ToolDefinition<ZodTypeAny,
 * unknown> without breaking assignability at each call site — defineTool erases it once here
 * instead, so tool files stay fully typed and callers just get a uniform array.
 */
export type AnyToolDefinition = ToolDefinition<z.ZodTypeAny, unknown>;

export function defineTool<Params extends z.ZodTypeAny, Result>(
  def: ToolDefinition<Params, Result>
): AnyToolDefinition {
  return def as unknown as AnyToolDefinition;
}
