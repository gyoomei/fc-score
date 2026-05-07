import { NextResponse } from "next/server";
import accountAssociation from "@/config/account-association.json";
import appImages from "@/settings/app-images.json";
import appSettings from "@/settings/app-settings.json";

const canonicalDomain =
  process.env.NEXT_PUBLIC_CLOUDFLARE_WORKERS_URL ??
  process.env.NEXT_PUBLIC_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "fc-score.tomyratama128.workers.dev";

const homeUrl = `https://${canonicalDomain}`;

function resolveImageUrl(value: string): string {
  return value.startsWith("http")
    ? value
    : `${homeUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

export async function GET() {
  try {
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error generating Farcaster manifest:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

const config = {
  accountAssociation,
  frame: {
    version: "1",
    name: appSettings.name,
    iconUrl: resolveImageUrl(appImages.iconUrl),
    homeUrl,
    imageUrl: resolveImageUrl(appImages.imageUrl),
    buttonTitle: appSettings.shareButtonTitle,
    splashImageUrl: resolveImageUrl(appImages.splashImageUrl),
    splashBackgroundColor: appSettings.splashBackgroundColor,
    webhookUrl: `${homeUrl}/api/webhook`,
  },
};
