import { NextResponse } from "next/server";
import { logoutWaClient } from "@/lib/wp/waClient";

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientKey = searchParams.get("key") || "default";
    
    const result = await logoutWaClient(clientKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[WA-LOGOUT-API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Support GET for easy manual trigger if needed
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientKey = searchParams.get("key") || "default";
    
    const result = await logoutWaClient(clientKey);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
