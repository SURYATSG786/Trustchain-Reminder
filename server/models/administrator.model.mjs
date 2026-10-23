import { randomBytes, scryptSync } from "node:crypto";
export function credential(email, password) {
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 180
  )
    throw Error("Enter a valid administrator email");
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  )
    throw Error("Password must contain between 12 and 256 characters");
  const salt = randomBytes(16).toString("hex");
  return {
    email: email.trim().toLowerCase(),
    salt,
    passwordHash: scryptSync(password, salt, 64).toString("hex"),
    createdAt: new Date().toISOString(),
  };
}
