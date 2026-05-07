import { NextResponse } from "next/server";
import accountAssociation from "@/config/account-association.json";

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
    name: "Example Frame",
    iconUrl: "https://fc-score.tomyratama128.workers.dev/icon.png",
    homeUrl: "https://fc-score.tomyratama128.workers.dev",
    imageUrl: "https://fc-score.tomyratama128.workers.dev/image.png",
    buttonTitle: "Check this out",
    splashImageUrl: "https://fc-score.tomyratama128.workers.dev/splash.png",
    splashBackgroundColor: "#eeccff",
    webhookUrl: "https://fc-score.tomyratama128.workers.dev/api/webhook",
  },
};
