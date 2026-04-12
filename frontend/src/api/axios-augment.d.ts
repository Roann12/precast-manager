import "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** When true, a 401 response will not clear the session or redirect to login. */
    skipUnauthorizedRedirect?: boolean;
  }
}
