export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (password: string) => password.length >= 8 },
  { label: "One uppercase letter", test: (password: string) => /[A-Z]/.test(password) },
  { label: "One lowercase letter", test: (password: string) => /[a-z]/.test(password) },
  { label: "One number", test: (password: string) => /\d/.test(password) },
  {
    label: "One special character",
    test: (password: string) => /[^A-Za-z0-9\s]/.test(password),
  },
] as const;

export type PasswordStrength = {
  score: number;
  percentage: number;
  label: "None" | "Weak" | "Fair" | "Moderate" | "Strong" | "Very strong";
  isValid: boolean;
};

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, percentage: 0, label: "None", isValid: false };

  const score = PASSWORD_REQUIREMENTS.filter((requirement) => requirement.test(password)).length;
  const labels: PasswordStrength["label"][] = [
    "Weak",
    "Weak",
    "Fair",
    "Moderate",
    "Strong",
    "Very strong",
  ];

  return {
    score,
    percentage: (score / PASSWORD_REQUIREMENTS.length) * 100,
    label: labels[score],
    isValid: score === PASSWORD_REQUIREMENTS.length,
  };
}

export function validateEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

export function validateNewPassword(password: string) {
  return getPasswordStrength(password).isValid;
}
