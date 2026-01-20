/**
 * Data validation utilities for consumption entries
 * Ensures data integrity and prevents invalid data from being saved
 */

import { Consumption, ConsumptionType } from "@/types/consumption";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ConsumptionInput {
  amount: string | number;
  description?: string;
  type?: ConsumptionType;
}

/**
 * Maximum allowed amount (prevents unrealistic values)
 */
export const MAX_AMOUNT = 999999999.99;

/**
 * Maximum description length
 */
export const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Minimum amount (prevents zero or negative amounts)
 */
export const MIN_AMOUNT = 0.01;

/**
 * Validates amount input
 */
export function validateAmount(
  amount: string | number,
  allowZero: boolean = false
): ValidationResult {
  const errors: string[] = [];

  // Convert to number if string
  const numAmount =
    typeof amount === "string" ? parseFloat(amount.replace(/,/g, "")) : amount;

  // Check if it's a valid number
  if (isNaN(numAmount)) {
    errors.push("Amount must be a valid number");
    return { isValid: false, errors };
  }

  // Check if amount is zero or negative
  if (numAmount <= 0 && !allowZero) {
    errors.push("Amount must be greater than zero");
  }

  if (numAmount < 0) {
    errors.push("Amount cannot be negative");
  }

  // Check maximum amount
  if (numAmount > MAX_AMOUNT) {
    errors.push(`Amount cannot exceed ${MAX_AMOUNT.toLocaleString()}`);
  }

  // Check decimal places (max 2)
  if (typeof amount === "string") {
    const decimalPart = amount.split(".")[1];
    if (decimalPart && decimalPart.length > 2) {
      errors.push("Amount can have at most 2 decimal places");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates description input
 */
export function validateDescription(description?: string): ValidationResult {
  const errors: string[] = [];

  if (description === undefined || description === null) {
    return { isValid: true, errors: [] };
  }

  // Check maximum length
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
    );
  }

  // Check for only whitespace
  if (description.trim().length === 0 && description.length > 0) {
    errors.push("Description cannot be only whitespace");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates consumption type
 */
export function validateType(type?: ConsumptionType): ValidationResult {
  const errors: string[] = [];

  if (!type) {
    errors.push("Type is required");
    return { isValid: false, errors };
  }

  const validTypes: ConsumptionType[] = ["expense", "income"];
  if (!validTypes.includes(type)) {
    errors.push(`Type must be one of: ${validTypes.join(", ")}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a complete consumption input
 */
export function validateConsumption(
  input: ConsumptionInput
): ValidationResult {
  const errors: string[] = [];

  // Validate amount
  const amountValidation = validateAmount(input.amount);
  if (!amountValidation.isValid) {
    errors.push(...amountValidation.errors);
  }

  // Validate description (optional)
  const descriptionValidation = validateDescription(input.description);
  if (!descriptionValidation.isValid) {
    errors.push(...descriptionValidation.errors);
  }

  // Validate type (optional, defaults to expense)
  if (input.type !== undefined) {
    const typeValidation = validateType(input.type);
    if (!typeValidation.isValid) {
      errors.push(...typeValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an existing consumption object
 */
export function validateConsumptionObject(
  consumption: Partial<Consumption>
): ValidationResult {
  const errors: string[] = [];

  // Validate required fields
  if (!consumption.id) {
    errors.push("ID is required");
  }

  if (consumption.amount === undefined || consumption.amount === null) {
    errors.push("Amount is required");
  } else {
    const amountValidation = validateAmount(consumption.amount);
    if (!amountValidation.isValid) {
      errors.push(...amountValidation.errors);
    }
  }

  if (!consumption.date) {
    errors.push("Date is required");
  } else {
    // Validate date format
    const date = new Date(consumption.date);
    if (isNaN(date.getTime())) {
      errors.push("Date must be a valid ISO date string");
    }
  }

  // Validate optional fields
  if (consumption.description !== undefined) {
    const descriptionValidation = validateDescription(consumption.description);
    if (!descriptionValidation.isValid) {
      errors.push(...descriptionValidation.errors);
    }
  }

  if (consumption.type !== undefined) {
    const typeValidation = validateType(consumption.type);
    if (!typeValidation.isValid) {
      errors.push(...typeValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes description input (trims whitespace, limits length)
 */
export function sanitizeDescription(description?: string): string {
  if (!description) {
    return "";
  }

  return description.trim().slice(0, MAX_DESCRIPTION_LENGTH);
}

/**
 * Sanitizes description during live typing (no trim, to allow spaces)
 */
export function sanitizeDescriptionLive(description?: string): string {
  if (!description) {
    return "";
  }

  return description.slice(0, MAX_DESCRIPTION_LENGTH);
}

/**
 * Sanitizes amount input (removes invalid characters, limits decimals)
 */
export function sanitizeAmount(amount: string | number): string {
  if (typeof amount === "number") {
    return amount.toString();
  }

  // Remove all non-digit characters except decimal point
  let cleaned = amount.replace(/[^\d.]/g, "");

  // Handle multiple decimal points
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts.slice(1).join("")}`;
  }

  // Limit decimal places to 2
  const parts2 = cleaned.split(".");
  if (parts2[1] && parts2[1].length > 2) {
    cleaned = `${parts2[0]}.${parts2[1].slice(0, 2)}`;
  }

  return cleaned;
}
