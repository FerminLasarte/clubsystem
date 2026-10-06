import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { colors, typography, type ColorToken, type TypographyVariant } from "@/shared/theme/tokens";

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: "left" | "center" | "right";
}

export function Text({ variant = "body", color = "text", align, style, ...props }: TextProps) {
  return <RNText style={[typography[variant], { color: colors[color], textAlign: align }, style]} {...props} />;
}
