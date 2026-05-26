import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export function signUp(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function signIn(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function signOut(): Promise<void> {
  return firebaseSignOut(getFirebaseAuth());
}

export function describeAuthError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case "auth/invalid-email":
        return "メールアドレスの形式が正しくありません。";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "メールアドレスまたはパスワードが違います。";
      case "auth/email-already-in-use":
        return "このメールアドレスは既に登録されています。";
      case "auth/weak-password":
        return "パスワードは6文字以上で設定してください。";
      case "auth/too-many-requests":
        return "試行回数が多すぎます。しばらくしてから再度お試しください。";
      case "auth/network-request-failed":
        return "ネットワークエラーが発生しました。接続を確認してください。";
      default:
        return `エラーが発生しました (${code})`;
    }
  }
  return "予期しないエラーが発生しました。";
}
