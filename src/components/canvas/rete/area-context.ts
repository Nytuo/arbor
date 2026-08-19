import type { NodeEditor } from "rete";
import type { AreaPlugin } from "rete-area-plugin";
import type { Schemes, AreaExtra } from "./schema";

export const areaInstanceRef: { current: AreaPlugin<Schemes, AreaExtra> | null } = {
  current: null,
};
export const editorInstanceRef: { current: NodeEditor<Schemes> | null } = {
  current: null,
};

export const useAreaCtx = () => {
  const area = areaInstanceRef.current;
  if (!area) throw new Error("Area plugin not ready yet");
  return { area };
};
