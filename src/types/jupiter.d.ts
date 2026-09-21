interface JupiterInitParams {
  displayMode: "widget" | "integrated" | "modal";
  widgetStyle?: {
    position?: "bottom-left" | "bottom-right";
    size?: "sm" | "default";
  };
  endpoint: string;
}

interface Window {
  Jupiter?: {
    init: (params: JupiterInitParams) => void;
  };
}
