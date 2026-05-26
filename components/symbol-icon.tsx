import { APP_ICONS, type AppIconName } from "@/utils/app-icons";
import { Image } from "expo-image";
import type { ColorValue, ImageStyle, StyleProp } from "react-native";

type SymbolIconProps = {
  name: AppIconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ImageStyle>;
};

export function SymbolIcon({ name, size = 24, color, style }: SymbolIconProps) {
  const icon = APP_ICONS[name];
  const source =
    process.env.EXPO_OS === "ios" ? (`sf:${icon.sf}` as const) : icon.android;

  return (
    <Image
      source={source}
      tintColor={typeof color === "string" ? color : undefined}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
    />
  );
}
