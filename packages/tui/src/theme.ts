import type { PierreThemeName } from "./types.ts";

export interface UiTheme {
  appBackground: string;
  chromeBackground: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderActive: string;
  text: string;
  textMuted: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  additionBg: string;
  additionLineNumberBg: string;
  deletionBg: string;
  deletionLineNumberBg: string;
  contextBg: string;
  hunkBg: string;
  modalBg: string;
  reviewedBg: string;
  syntaxComment: string;
  syntaxFunction: string;
  syntaxKeyword: string;
  syntaxNumber: string;
  syntaxOperator: string;
  syntaxPunctuation: string;
  syntaxString: string;
  syntaxType: string;
  syntaxVariable: string;
}

export const DARK_THEME: UiTheme = {
  appBackground: "#07131b",
  chromeBackground: "#0b1b26",
  surface: "#10202d",
  surfaceMuted: "#152838",
  border: "#29475c",
  borderActive: "#67b7e1",
  text: "#e6edf3",
  textMuted: "#8ea4b5",
  accent: "#9cdcfe",
  success: "#3fb950",
  danger: "#ff7b72",
  warning: "#d4a72c",
  additionBg: "#0f2619",
  additionLineNumberBg: "#163526",
  deletionBg: "#2a1718",
  deletionLineNumberBg: "#3a2021",
  contextBg: "#0d1822",
  hunkBg: "#183041",
  modalBg: "#0c1823",
  reviewedBg: "#0d2634",
  syntaxComment: "#8ea4b5",
  syntaxFunction: "#9cdcfe",
  syntaxKeyword: "#ff7b72",
  syntaxNumber: "#79c0ff",
  syntaxOperator: "#8ea4b5",
  syntaxPunctuation: "#8ea4b5",
  syntaxString: "#7ee787",
  syntaxType: "#d4a72c",
  syntaxVariable: "#e6edf3",
};

export const LIGHT_THEME: UiTheme = {
  appBackground: "#eef5f8",
  chromeBackground: "#dce8ee",
  surface: "#ffffff",
  surfaceMuted: "#edf3f6",
  border: "#b4c7d3",
  borderActive: "#2676a3",
  text: "#10202d",
  textMuted: "#5b7383",
  accent: "#0c6d97",
  success: "#177245",
  danger: "#a93a32",
  warning: "#8a6200",
  additionBg: "#e8f5ec",
  additionLineNumberBg: "#dceee3",
  deletionBg: "#f9ebeb",
  deletionLineNumberBg: "#f4dddd",
  contextBg: "#f5f9fb",
  hunkBg: "#e5f0f7",
  modalBg: "#fdfefe",
  reviewedBg: "#e8f3f8",
  syntaxComment: "#5b7383",
  syntaxFunction: "#0c6d97",
  syntaxKeyword: "#a93a32",
  syntaxNumber: "#2676a3",
  syntaxOperator: "#5b7383",
  syntaxPunctuation: "#5b7383",
  syntaxString: "#177245",
  syntaxType: "#8a6200",
  syntaxVariable: "#10202d",
};

export function getUiTheme(themeName: PierreThemeName): UiTheme {
  return themeName === "pierre-light" ? LIGHT_THEME : DARK_THEME;
}
