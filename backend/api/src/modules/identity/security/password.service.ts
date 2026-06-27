import { scrypt, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { Injectable } from "@nestjs/common";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const FORMAT = "scrypt$1";

@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    return `${FORMAT}$${salt.toString("base64url")}$${key.toString("base64url")}`;
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    const [algorithm, version, saltValue, hashValue] = passwordHash.split("$");

    if (`${algorithm}$${version}` !== FORMAT || !saltValue || !hashValue) {
      return false;
    }

    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "base64url");
    const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;

    if (actual.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  }
}