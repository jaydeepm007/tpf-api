import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
dotenv.config();

const key = CryptoJS.enc.Utf8.parse(process.env.EncryptKey || '1203199320052011');
const iv = CryptoJS.enc.Utf8.parse(process.env.EncryptIV || '1203199320052011');

export function encryptUsingAES256(text: string): string {
  const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(text), key, {
    keySize: 128 / 8,
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

export function decryptUsingAES256(decString: string): string {
  const decrypted = CryptoJS.AES.decrypt(decString, key, {
    keySize: 128 / 8,
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}
