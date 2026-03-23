/**
 * PageHeader — Cabecera estándar de pantalla
 * ============================================
 * Garantiza que todas las pantallas del tab tengan
 * exactamente el mismo padding, tipografía y estilo.
 *
 * Props:
 *   title         — texto del encabezado (variant="title", color primary)
 *   rightElement  — nodo opcional alineado a la derecha (pills, botones…)
 *   withSeparator — dibuja un separador ultra fino debajo (útil cuando
 *                   el header es "sticky" sobre una FlatList)
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { Text } from "./Text";

interface PageHeaderProps {
  title:          string;
  rightElement?:  React.ReactNode;
  /** Añade un borde inferior #EDF2F7. Actívalo sólo en pantallas con
   *  scroll que necesiten separación visual bajo el header fijo. */
  withSeparator?: boolean;
}

export function PageHeader({ title, rightElement, withSeparator = false }: PageHeaderProps) {
  return (
    <View style={[styles.header, withSeparator && styles.headerBorder]}>
      <Text variant="title" style={styles.title}>{title}</Text>
      {rightElement && <View style={styles.right}>{rightElement}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingTop:        20,
    paddingBottom:     16,
    backgroundColor:   Colors.appBackground,   // blanco puro
  },
  headerBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.primary,
  },
  right: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
});
