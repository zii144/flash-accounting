/**
 * Production-ready logging utility
 * Wraps console methods and provides structured logging
 * In production, logs are only shown in __DEV__ mode
 * Can be extended to send logs to a remote service
 */
import { captureMonitoringException, captureMonitoringMessage } from "./monitoring";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = __DEV__;

  /**
   * Logs debug messages (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Logs informational messages (only in development)
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context || '');
    }
  }

  /**
   * Logs warning messages (always logged, but can be sent to monitoring in production)
   */
  warn(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, context || '');
    }
    captureMonitoringMessage(message, 'warning', context);
  }

  /**
   * Logs error messages (always logged, should be sent to error tracking in production)
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = `${message}: ${errorMessage}`;

    if (this.isDevelopment) {
      console.error(`[ERROR] ${fullMessage}`, context || '', error || '');
    }
    if (error instanceof Error) {
      captureMonitoringException(error, { message, ...context });
      return;
    }

    captureMonitoringMessage(fullMessage, 'error', context);
  }

  /**
   * Logs messages with a specific level
   */
  log(level: LogLevel, message: string, error?: Error | unknown, context?: LogContext): void {
    switch (level) {
      case 'debug':
        this.debug(message, context);
        break;
      case 'info':
        this.info(message, context);
        break;
      case 'warn':
        this.warn(message, context);
        break;
      case 'error':
        this.error(message, error, context);
        break;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logError = (message: string, error?: Error | unknown, context?: LogContext) =>
  logger.error(message, error, context);
