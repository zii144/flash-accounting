import { useTheme } from "@/contexts/ThemeContext";
import {
  fontWeight,
  typeScale,
  type FontWeightToken,
  type TypeVariant,
} from "@/theme/tokens";
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

/**
 * The typography primitive — the ONLY sanctioned way to render text.
 *
 * `variant` sets size + tracking + a default weight from the type scale; `weight`
 * overrides just the weight (size role and weight are separate axes); `color` picks a
 * theme role. Screens never hand-set fontSize / fontWeight / letterSpacing / color on
 * text again. See docs/design-system/02-typography.md.
 *
 *   <Text variant="title">…</Text>
 *   <Text variant="amount" color="textSecondary">…</Text>   // tabular-nums auto
 *   <Text variant="body" weight="regular">…</Text>          // 16pt regular body
 */

/** Which theme role colors the text. `inherit` leaves color unset (parent/style wins). */
type TextColorRole =
  | "text"
  | "textSecondary"
  | "destructive"
  | "foreground"
  | "background"
  | "inherit";

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  weight?: FontWeightToken;
  color?: TextColorRole;
  /** Force tabular (monospaced) figures. Defaults on for the `amount` variant. */
  tabularNums?: boolean;
  /** Force UPPERCASE. Defaults on for the `micro` variant. */
  uppercase?: boolean;
};

// Cap Dynamic Type so the app's tuned layouts (e.g. the fixed 88pt ledger rows) survive
// large-text mode. Callers can still pass a different maxFontSizeMultiplier when needed.
const MAX_FONT_SCALE = 1.4;

export function Text({
  variant = "body",
  weight,
  color = "text",
  tabularNums,
  uppercase,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const { theme } = useTheme();
  const spec = typeScale[variant];

  const resolved: TextStyle = {
    fontSize: spec.fontSize,
    fontWeight: fontWeight[weight ?? spec.weight],
    letterSpacing: spec.letterSpacing,
  };
  if (color !== "inherit") {
    resolved.color = theme[color];
  }
  if (tabularNums ?? variant === "amount") {
    resolved.fontVariant = ["tabular-nums"];
  }
  if (uppercase ?? variant === "micro") {
    resolved.textTransform = "uppercase";
  }

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_FONT_SCALE}
      style={[resolved, style]}
      {...rest}
    />
  );
}
