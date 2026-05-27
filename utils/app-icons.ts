import type { ImageSource } from "expo-image";

export type AppIconName =
  | "accounting"
  | "add-circle"
  | "alert-circle"
  | "apple-logo"
  | "arrow-down"
  | "arrow-down-outline"
  | "arrow-up"
  | "arrow-up-outline"
  | "bug"
  | "calendar"
  | "calendar-outline"
  | "cart"
  | "chart"
  | "checkmark-circle"
  | "chevron-back"
  | "chevron-forward"
  | "circle"
  | "close"
  | "cloud"
  | "cloud-download"
  | "cloud-upload"
  | "document"
  | "download"
  | "hourglass"
  | "local-drive"
  | "language"
  | "logout"
  | "mic"
  | "mic-outline"
  | "pencil"
  | "person-circle"
  | "refresh"
  | "remove-circle"
  | "scan"
  | "server"
  | "settings"
  | "sparkles"
  | "statistics"
  | "trash"
  | "trending-down"
  | "trending-down-outline"
  | "trending-up"
  | "trending-up-outline";

type IconDefinition = {
  sf: string;
  android: ImageSource;
};

export const APP_ICONS: Record<AppIconName, IconDefinition> = {
  accounting: {
    sf: "dollarsign.circle",
    android: require("@expo/material-symbols/payments.xml"),
  },
  statistics: {
    sf: "chart.bar",
    android: require("@expo/material-symbols/bar_chart.xml"),
  },
  settings: {
    sf: "gearshape",
    android: require("@expo/material-symbols/settings.xml"),
  },
  close: {
    sf: "xmark",
    android: require("@expo/material-symbols/close.xml"),
  },
  "chevron-back": {
    sf: "chevron.left",
    android: require("@expo/material-symbols/chevron_left.xml"),
  },
  "chevron-forward": {
    sf: "chevron.right",
    android: require("@expo/material-symbols/chevron_right.xml"),
  },
  "person-circle": {
    sf: "person.circle",
    android: require("@expo/material-symbols/person.xml"),
  },
  "apple-logo": {
    sf: "apple.logo",
    android: require("@expo/material-symbols/login.xml"),
  },
  logout: {
    sf: "rectangle.portrait.and.arrow.right",
    android: require("@expo/material-symbols/logout.xml"),
  },
  cloud: {
    sf: "cloud",
    android: require("@expo/material-symbols/cloud.xml"),
  },
  cart: {
    sf: "cart",
    android: require("@expo/material-symbols/shopping_cart.xml"),
  },
  sparkles: {
    sf: "sparkles",
    android: require("@expo/material-symbols/star_shine.xml"),
  },
  refresh: {
    sf: "arrow.clockwise",
    android: require("@expo/material-symbols/refresh.xml"),
  },
  "cloud-upload": {
    sf: "icloud.and.arrow.up",
    android: require("@expo/material-symbols/cloud_upload.xml"),
  },
  "cloud-download": {
    sf: "icloud.and.arrow.down",
    android: require("@expo/material-symbols/cloud_download.xml"),
  },
  server: {
    sf: "externaldrive",
    android: require("@expo/material-symbols/dns.xml"),
  },
  "local-drive": {
    sf: "internaldrive",
    android: require("@expo/material-symbols/save.xml"),
  },
  bug: {
    sf: "ladybug",
    android: require("@expo/material-symbols/bug_report.xml"),
  },
  download: {
    sf: "square.and.arrow.down",
    android: require("@expo/material-symbols/download.xml"),
  },
  hourglass: {
    sf: "hourglass",
    android: require("@expo/material-symbols/hourglass_empty.xml"),
  },
  language: {
    sf: "globe",
    android: require("@expo/material-symbols/language.xml"),
  },
  trash: {
    sf: "trash",
    android: require("@expo/material-symbols/delete.xml"),
  },
  "checkmark-circle": {
    sf: "checkmark.circle.fill",
    android: require("@expo/material-symbols/check_circle.xml"),
  },
  circle: {
    sf: "circle",
    android: require("@expo/material-symbols/radio_button_unchecked.xml"),
  },
  "alert-circle": {
    sf: "exclamationmark.circle",
    android: require("@expo/material-symbols/error.xml"),
  },
  pencil: {
    sf: "pencil",
    android: require("@expo/material-symbols/edit.xml"),
  },
  "arrow-up": {
    sf: "arrow.up",
    android: require("@expo/material-symbols/arrow_upward.xml"),
  },
  "arrow-up-outline": {
    sf: "arrow.up",
    android: require("@expo/material-symbols/arrow_upward.xml"),
  },
  "arrow-down": {
    sf: "arrow.down",
    android: require("@expo/material-symbols/arrow_downward.xml"),
  },
  "arrow-down-outline": {
    sf: "arrow.down",
    android: require("@expo/material-symbols/arrow_downward.xml"),
  },
  mic: {
    sf: "mic.fill",
    android: require("@expo/material-symbols/mic.xml"),
  },
  "mic-outline": {
    sf: "mic",
    android: require("@expo/material-symbols/mic.xml"),
  },
  calendar: {
    sf: "calendar",
    android: require("@expo/material-symbols/calendar_today.xml"),
  },
  "calendar-outline": {
    sf: "calendar",
    android: require("@expo/material-symbols/calendar_today.xml"),
  },
  "trending-up": {
    sf: "chart.line.uptrend.xyaxis",
    android: require("@expo/material-symbols/trending_up.xml"),
  },
  "trending-up-outline": {
    sf: "chart.line.uptrend.xyaxis",
    android: require("@expo/material-symbols/trending_up.xml"),
  },
  "trending-down": {
    sf: "chart.line.downtrend.xyaxis",
    android: require("@expo/material-symbols/trending_down.xml"),
  },
  "trending-down-outline": {
    sf: "chart.line.downtrend.xyaxis",
    android: require("@expo/material-symbols/trending_down.xml"),
  },
  scan: {
    sf: "doc.viewfinder",
    android: require("@expo/material-symbols/document_scanner.xml"),
  },
  document: {
    sf: "doc.text",
    android: require("@expo/material-symbols/description.xml"),
  },
  "remove-circle": {
    sf: "minus.circle",
    android: require("@expo/material-symbols/do_not_disturb_on.xml"),
  },
  "add-circle": {
    sf: "plus.circle",
    android: require("@expo/material-symbols/add_circle.xml"),
  },
  chart: {
    sf: "chart.bar",
    android: require("@expo/material-symbols/bar_chart.xml"),
  },
};
