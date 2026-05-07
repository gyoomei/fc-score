import { publicConfig } from "@/config/public-config";
import { MiniApp } from "@/features/app/mini-app";
import { getFarcasterPageMetadata } from "@/neynar-farcaster-sdk/src/nextjs/get-farcaster-page-metadata";
import { Metadata } from "next";

type HomePageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
  return getFarcasterPageMetadata({
    title: publicConfig.name,
    description: publicConfig.description,
    homeUrl: publicConfig.homeUrl,
    path: "",
    splashImageUrl: publicConfig.splashImageUrl,
    splashBackgroundColor: publicConfig.splashBackgroundColor,
    buttonTitle: publicConfig.shareButtonTitle,
    searchParams,
  });
}

export default function Home() {
  return <MiniApp />;
}
