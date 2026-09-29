export type AuthKind = "none" | "bearer" | "api_key" | "basic" | "header";

export const AUTH_KINDS: AuthKind[] = ["none", "bearer", "api_key", "basic", "header"];

export interface AuthInput {
  kind: AuthKind;
  token: string;
  user: string;
  password: string;
  headerName: string;
  headerValue: string;
}

export const emptyAuth = (): AuthInput => ({
  kind: "none",
  token: "",
  user: "",
  password: "",
  headerName: "",
  headerValue: "",
});

export const authWire = (auth: AuthInput) => ({
  kind: auth.kind,
  token: auth.token.trim(),
  user: auth.user.trim(),
  password: auth.password,
  header_name: auth.headerName.trim(),
  header_value: auth.headerValue.trim(),
});
