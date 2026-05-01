import { NextResponse } from "next/server";
import { calculateBaseWalletScore } from "@/lib/base-wallet-score";

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: "Invalid Base wallet address" },
        { status: 400 },
      );
    }

    const apiKey = process.env.BASESCAN_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "BASESCAN_API_KEY is missing on server" },
        { status: 503 },
      );
    }

    const result = await calculateBaseWalletScore(address, apiKey);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to calculate Base wallet score",
        details: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
