/**
 * Owner identity from Cloudflare Access. Access signs the owner in on the protected hostname and
 * forwards the verified email address in this header; requests without it are not the owner.
 */
export const ACCESS_USER_HEADER = "Cf-Access-Authenticated-User-Email";

export const isLocalRequest = (request: Request) => {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
};

export const signedInUser = (request: Request): string => request.headers.get(ACCESS_USER_HEADER) || "";

export const isAuthorized = (request: Request) => isLocalRequest(request) || signedInUser(request) !== "";
