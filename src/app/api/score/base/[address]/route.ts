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

    const result = await calculateBaseWalletScore(address);

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
