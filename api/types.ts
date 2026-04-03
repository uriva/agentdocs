// Shared types for the Deno API Hono app

export type AppEnv = {
  Variables: {
    identityId: string;
    identityKeys: {
      signingPublicKey: string;
      encryptionPublicKey: string;
    };
    rawBody: string;
  };
};
