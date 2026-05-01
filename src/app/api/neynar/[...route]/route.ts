// Complete Neynar API proxy using our new architecture
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import { createNeynarApiHandler } from "@/neynar-web-sdk/nextjs";
import { privateConfig } from "@/config/private-config";

const neynarApiKey = privateConfig.neynarApiKey;

const notConfigured = () =>
  Response.json(
    {
      error: {
        message:
          "NEYNAR_API_KEY is not configured on server. Neynar proxy is disabled.",
        status: 503,
      },
    },
    { status: 503 },
  );

const handlers = neynarApiKey
  ? createNeynarApiHandler(
      new NeynarAPIClient(
        new Configuration({
          apiKey: neynarApiKey,
        }),
      ),
    )
  : {
      GET: notConfigured,
      POST: notConfigured,
      PUT: notConfigured,
      DELETE: notConfigured,
      OPTIONS: () => new Response(null, { status: 204 }),
    };

export const { GET, POST, PUT, DELETE, OPTIONS } = handlers;
