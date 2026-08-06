interface AndroidBackgroundBridge {
  batteryOptimizationIgnored: () => boolean;
  requestIgnoreBatteryOptimization: () => void;
}

export const androidBackground = (): AndroidBackgroundBridge | undefined =>
  (window as unknown as { AndroidBackground?: AndroidBackgroundBridge }).AndroidBackground;
