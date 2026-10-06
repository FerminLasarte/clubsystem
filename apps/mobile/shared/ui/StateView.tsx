import { ActivityIndicator, StyleSheet, View } from "react-native";

import { errorMessage } from "@clubsystem/api";
import { colors, spacing } from "@/shared/theme/tokens";

import { Button } from "./Button";
import { Text } from "./Text";

type StateViewProps =
  | { kind: "loading"; message?: string }
  | { kind: "error"; error: unknown; onRetry: () => void }
  | { kind: "empty"; title: string; description?: string; action?: { title: string; onPress: () => void } };

/** Estados de carga, error (con reintento) y vacío. El error nunca se muestra como vacío. */
export function StateView(props: StateViewProps) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {props.kind === "loading" && (
        <>
          <ActivityIndicator color={colors.primary} />
          {props.message ? (
            <Text color="muted" align="center">
              {props.message}
            </Text>
          ) : null}
        </>
      )}
      {props.kind === "error" && (
        <>
          <Text variant="subheading" align="center">
            No pudimos cargar esta información
          </Text>
          <Text color="muted" align="center">
            {errorMessage(props.error)}
          </Text>
          <Button title="Reintentar" variant="secondary" onPress={props.onRetry} />
        </>
      )}
      {props.kind === "empty" && (
        <>
          <Text variant="subheading" align="center">
            {props.title}
          </Text>
          {props.description ? (
            <Text color="muted" align="center">
              {props.description}
            </Text>
          ) : null}
          {props.action ? <Button title={props.action.title} onPress={props.action.onPress} /> : null}
        </>
      )}
    </View>
  );
}

interface QueryLike {
  isPending: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Carga o error de una query de TanStack (usar cuando `isPending || isError`). */
export function QueryState({ query }: { query: QueryLike }) {
  if (query.isPending) return <StateView kind="loading" />;
  return <StateView kind="error" error={query.error} onRetry={() => void query.refetch()} />;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "stretch",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
});
