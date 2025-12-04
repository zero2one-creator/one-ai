/**
 * vue-resizable-panels 类型声明
 */
declare module "vue-resizable-panels" {
  import { DefineComponent } from "vue";

  export const PanelGroup: DefineComponent<{
    direction: "horizontal" | "vertical";
    layout?: number[];
  }>;

  export const Panel: DefineComponent<{
    id?: string;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
  }>;

  export const PanelResizeHandle: DefineComponent<{}>;
}
