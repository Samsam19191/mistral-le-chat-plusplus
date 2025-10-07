import { getServerEnv, isMock } from "@/lib/env";

export async function GET() {
  try {
    const env = getServerEnv();
    const mode = isMock() ? "mock" : "real";
    
    return Response.json({
      model: env.MISTRAL_MODEL,
      mode,
    });
  } catch (error) {
    console.error("Failed to get chat config:", error);
    
    return Response.json(
      { error: "Failed to get chat configuration" },
      { status: 500 }
    );
  }
}
