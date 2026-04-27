import * as Sentry from "@sentry/react-native";

type MonitoringContext = Record<string, unknown>;
type MonitoringUser = {
  id: string;
  email?: string | null;
  username?: string | null;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : JSON.stringify(error));
}

function withMonitoringScope(
  context: MonitoringContext | undefined,
  callback: () => void
): void {
  if (!context || Object.keys(context).length === 0) {
    callback();
    return;
  }

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }
    callback();
  });
}

const dsn = readEnv("EXPO_PUBLIC_SENTRY_DSN");
const enableInDevelopment = readEnv("EXPO_PUBLIC_SENTRY_ENABLE_IN_DEV") === "true";
const environment =
  readEnv("EXPO_PUBLIC_APP_ENV") ??
  readEnv("EAS_BUILD_PROFILE") ??
  (__DEV__ ? "development" : "production");
const monitoringEnabled = Boolean(dsn) && (!__DEV__ || enableInDevelopment);

let didInitialize = false;

export function initializeMonitoring(): void {
  if (didInitialize || !monitoringEnabled || !dsn) {
    return;
  }

  Sentry.init({
    dsn,
    enabled: monitoringEnabled,
    debug: __DEV__,
    environment,
    attachStacktrace: true,
    sendDefaultPii: false,
    enableNativeFramesTracking: !__DEV__,
  });

  didInitialize = true;
}

export function isMonitoringEnabled(): boolean {
  return monitoringEnabled;
}

export function captureMonitoringException(
  error: unknown,
  context?: MonitoringContext
): void {
  if (!monitoringEnabled) {
    return;
  }

  const normalizedError = normalizeError(error);
  withMonitoringScope(context, () => {
    Sentry.captureException(normalizedError);
  });
}

export function captureMonitoringMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: MonitoringContext
): void {
  if (!monitoringEnabled) {
    return;
  }

  withMonitoringScope(context, () => {
    Sentry.captureMessage(message, level);
  });
}

export function setMonitoringUser(user: MonitoringUser | null): void {
  if (!monitoringEnabled) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
    username: user.username ?? undefined,
  });
}
