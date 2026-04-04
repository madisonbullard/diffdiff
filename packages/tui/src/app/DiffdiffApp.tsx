import type { DiffdiffAppProps } from "./state/app-props.ts";
import { DiffdiffAppController } from "./shell/app-controller.tsx";

export type { DiffdiffAppProps } from "./state/app-props.ts";

export function DiffdiffApp(props: DiffdiffAppProps) {
  return <DiffdiffAppController {...props} />;
}
