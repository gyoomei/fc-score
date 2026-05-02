import { NextResponse } from "next/server";
import { calculateBaseWalletScore } from "@/lib/base-wallet-score";

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const url = new URL(req.url);
    const fidRaw = url.searchParams.get("fid");
    const fid = fidRaw && /^\d+$/.test(fidRaw) ? Number(fidRaw) : undefined;

    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: "Invalid Base wallet address" },
        { status: 400 },
      );
    }

    const result = await calculateBaseWalletScore(address, { fid });

    return NextResponse.json(result, {
      status: 200,
      headers: {
        // Short edge/browser cache makes repeated opens instant while keeping score fresh.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
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
