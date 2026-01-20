import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors and display user-friendly error messages
 * Prevents the entire app from crashing when a component throws an error
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (__DEV__) {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // In production, you would send this to an error reporting service
    // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback onReset={this.handleReset} error={this.state.error} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  onReset: () => void;
  error: Error | null;
}

function ErrorFallback({ onReset, error }: ErrorFallbackProps) {
  // Safely get theme with fallback
  let theme: { background: string; inputBackground: string; text: string; textSecondary: string; foreground: string };
  try {
    theme = useTheme().theme;
  } catch {
    // Fallback theme if ThemeContext is not available
    theme = {
      background: '#FFFFFF',
      inputBackground: '#F5F5F5',
      text: '#000000',
      textSecondary: '#666666',
      foreground: '#000000',
    };
  }

  // Safely get translations with fallback
  let t: (key: string) => string;
  try {
    t = useLanguage().t;
  } catch {
    // Fallback if LanguageContext is not available
    t = (key: string) => {
      const fallbacks: Record<string, string> = {
        errorOccurred: "Something went wrong",
        errorMessage: "We encountered an unexpected error. Please try again or restart the app.",
        tryAgain: "Try Again",
      };
      return fallbacks[key] || key;
    };
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.content, { backgroundColor: theme.inputBackground }]}>
        <Ionicons name="alert-circle" size={64} color={theme.textSecondary} />
        <Text style={[styles.title, { color: theme.text }]}>
          {t("errorOccurred")}
        </Text>
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          {t("errorMessage")}
        </Text>
        {__DEV__ && error && (
          <View style={[styles.errorDetails, { backgroundColor: theme.background }]}>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>
              {error.toString()}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.foreground }]}
          onPress={onReset}
        >
          <Text style={[styles.buttonText, { color: theme.background }]}>
            {t("tryAgain")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  errorDetails: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    maxHeight: 200,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 120,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
