import { pipeline, env } from "@huggingface/transformers";
env.allowLocalModels = false;
self.onmessage = async (e: MessageEvent) => {
  try {
    const { samples, language, device } = e.data;
    const transcriber = await pipeline(
      "automatic-speech-recognition",
      "onnx-community/whisper-tiny",
      {
        device,
        dtype: device === "webgpu" ? "fp32" : "q8",
        progress_callback: (p: unknown) =>
          self.postMessage({ type: "progress", value: p }),
      },
    );
    const result = await transcriber(samples, {
      language: language === "hr" ? "croatian" : "english",
      task: "transcribe",
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    self.postMessage({ type: "result", result });
    await transcriber.dispose();
  } catch (err) {
    self.postMessage({ type: "error", message: String(err) });
  }
};
