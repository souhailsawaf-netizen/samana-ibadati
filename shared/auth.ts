const ENGLISH_LETTER_OR_DIGIT = /^[A-Za-z0-9]$/;
const ARABIC_LETTER = /^(?=\p{Script_Extensions=Arabic})\p{L}$/u;
const ARABIC_MARK = /^(?=\p{Script_Extensions=Arabic})\p{M}$/u;
const ARABIC_DIGIT = /^[\u0660-\u0669\u06f0-\u06f9]$/;

export const STUDENT_REGISTRATION_PASSWORD_LENGTH = 6;

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .normalize("NFC")
    .replace(/[A-Z]/g, character => character.toLowerCase())
    .normalize("NFC");
}

export function isValidUsername(value: string): boolean {
  const characters = Array.from(value.trim());
  if (characters.length < 3 || characters.length > 32) return false;

  const isLetterOrDigit = (character: string) =>
    ENGLISH_LETTER_OR_DIGIT.test(character) ||
    ARABIC_LETTER.test(character) ||
    ARABIC_DIGIT.test(character);

  return (
    isLetterOrDigit(characters[0]!) &&
    characters.every(
      (character, index) =>
        isLetterOrDigit(character) ||
        character === "_" ||
        character === "-" ||
        (index > 0 && ARABIC_MARK.test(character))
    )
  );
}

export function hasExactStudentRegistrationPasswordLength(
  value: string
): boolean {
  return Array.from(value).length === STUDENT_REGISTRATION_PASSWORD_LENGTH;
}
