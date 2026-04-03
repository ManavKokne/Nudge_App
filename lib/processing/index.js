import { PROCESSING_MODE } from "@/lib/constants";
import { runMockProcessing } from "@/lib/processing/mock";
import { runMlProcessing } from "@/lib/processing/ml";

export async function processPost(post) {
  const mode = (process.env.PROCESSING_MODE || PROCESSING_MODE || "mock").toLowerCase();

  if (mode === "ml") {
    return runMlProcessing(post);
  }

  return runMockProcessing(post);
}
