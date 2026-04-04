import type { DiffdiffAppProps } from "./diffdiff-app-shared.ts";
import { DiffdiffAppController } from "./diffdiff-app-controller.tsx";

export type { DiffdiffAppProps } from "./diffdiff-app-shared.ts";

export function DiffdiffApp(props: DiffdiffAppProps) {
  return <DiffdiffAppController {...props} />;
}
